/**
 * comms-worker — Supabase Edge Function
 * Drains the `jobs` table (claim via claim_jobs → FOR UPDATE SKIP LOCKED).
 * Invoke on a schedule (every minute) via Supabase Cron:
 *   Dashboard → Integrations → Cron → Schedule → HTTP request to this function.
 * Deploy: supabase functions deploy comms-worker --no-verify-jwt
 *         (protect with WORKER_SECRET header check below instead of JWT)
 * Secrets: WORKER_SECRET, WHATSAPP_ACCESS_TOKEN
 *
 * Job types handled (Sprint 1): wa_inbound | wa_status
 * Also drains due WhatsApp rows from outbound_messages. Lead creation queues
 * the welcome row in PostgreSQL; this worker is the only sender for that queue.
 * Extension points: 'email_inbound' → Sprint 2 · 'call_event' → Sprint 2 ·
 *                   'sla_check' → Sprint 3 · 'ai_summarize' → Sprint 4.
 */
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

interface WaMedia { id: string; mime_type?: string; caption?: string; filename?: string }
interface WaMessage {
  from: string; id: string; timestamp: string;
  type: "text" | "image" | "document" | "audio" | "video" | "sticker" | "button" | "interactive" | "unknown";
  text?: { body: string };
  image?: WaMedia; document?: WaMedia; audio?: WaMedia; video?: WaMedia; sticker?: WaMedia;
  button?: { text: string; payload: string };
  interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
}
interface WaStatus { id: string; status: "sent" | "delivered" | "read" | "failed"; timestamp: string; recipient_id: string }
interface JobRow { id: string; type: string; payload: Record<string, unknown>; attempts: number }
interface ResolveResult {
  status: "match" | "ambiguous" | "none";
  handle_norm: string | null;
  client_id?: string | null;
  lead_id?: string | null;
  identity_id?: string | null;
}
interface OutboundRow {
  id: string;
  template_code: string | null;
  to_contact: string | null;
  body: string | null;
  related_lead_id: string | null;
  created_by: string | null;
  attempts: number;
}
interface WaTemplateRow { name: string; language: string; status: string; body: string }

const MAX_MEDIA_BYTES = 25 * 1024 * 1024; // oversized media → reject, keep text event

function db(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function textOf(msg: WaMessage): string | null {
  if (msg.text?.body) return msg.text.body;
  if (msg.button?.text) return msg.button.text;
  if (msg.interactive?.button_reply?.title) return msg.interactive.button_reply.title;
  if (msg.interactive?.list_reply?.title) return msg.interactive.list_reply.title;
  const media = msg.image ?? msg.document ?? msg.audio ?? msg.video ?? msg.sticker;
  return media?.caption ?? null;
}

function mediaOf(msg: WaMessage): WaMedia | null {
  return msg.image ?? msg.document ?? msg.audio ?? msg.video ?? msg.sticker ?? null;
}

async function rehostMedia(sb: SupabaseClient, media: WaMedia, eventId: string, orgId: string): Promise<void> {
  // Provider URLs expire — download NOW and re-host in Supabase Storage.
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
  const metaRes = await fetch(`https://graph.facebook.com/v20.0/${media.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) throw new Error(`media meta ${metaRes.status}`);
  const meta = (await metaRes.json()) as { url: string; mime_type?: string; file_size?: number };
  if ((meta.file_size ?? 0) > MAX_MEDIA_BYTES) {
    await sb.from("comm_audit_logs").insert({
      action: "media_rejected", entity_type: "communication_event", entity_id: eventId,
      detail: { reason: "oversized", size: meta.file_size, media_id: media.id },
    });
    return;
  }
  const bin = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!bin.ok) throw new Error(`media download ${bin.status}`);
  const bytes = new Uint8Array(await bin.arrayBuffer());
  const path = `${orgId}/${eventId}/${media.id}`;
  const { error: upErr } = await sb.storage.from("comms-media")
    .upload(path, bytes, { contentType: meta.mime_type ?? media.mime_type ?? "application/octet-stream", upsert: true });
  if (upErr) throw new Error(`storage upload: ${upErr.message}`);
  await sb.from("comm_attachments").insert({
    event_id: eventId, storage_path: path,
    mime_type: meta.mime_type ?? media.mime_type ?? null,
    file_name: media.filename ?? null, size_bytes: meta.file_size ?? bytes.length,
  });
}

async function handleInbound(sb: SupabaseClient, job: JobRow): Promise<void> {
  const msg = job.payload.message as unknown as WaMessage;
  const contactName = (job.payload.contactName as string | null) ?? null;

  // Idempotency: Meta retries aggressively; provider_message_id is UNIQUE.
  const { data: dupe } = await sb.from("communication_events")
    .select("id").eq("provider_message_id", msg.id).maybeSingle();
  if (dupe) return; // duplicate delivery — done, no side effects

  const { data: resolved, error: rErr } = await sb.rpc("resolve_identity", {
    p_channel: "whatsapp", p_handle: msg.from,
  });
  if (rErr) throw new Error(`resolve_identity: ${rErr.message}`);
  const res = resolved as unknown as ResolveResult;

  let clientId: string | null = res.client_id ?? null;
  let leadId: string | null = res.lead_id ?? null;
  let triage = false;

  if (res.status === "ambiguous") {
    triage = true; clientId = null; leadId = null;   // NEVER guess — reception triage
  } else if (res.status === "none") {
    // Auto-create a Lead for the unknown number, then an identity for it.
    const { data: newLead, error: lErr } = await sb.from("leads").insert({
      full_name: contactName ?? `WhatsApp ${res.handle_norm ?? msg.from}`,
      phone: res.handle_norm ?? msg.from,
      source_code: "whatsapp_inbound",
      status: "new",
    }).select("id").single();
    if (lErr || !newLead) throw new Error(`lead create: ${lErr?.message}`);
    leadId = newLead.id;
    await sb.from("contact_identities").insert({
      channel: "whatsapp", handle_raw: msg.from, handle_norm: res.handle_norm ?? msg.from,
      lead_id: leadId, is_primary: true, link_status: "linked",
    });
    triage = true; // new unknown contact still lands in reception triage for routing
  }

  // Find or create the conversation for this contact on WhatsApp.
  let convId: string | null = null;
  let assignee: string | null = null;
  const owner = clientId
    ? await sb.from("clients").select("id").eq("id", clientId).maybeSingle()
    : null;
  void owner; // file-owner lookup: cases table is being renamed — Sprint 2 wires
              // assignment to the application's case_manager. Sprint 1: client/lead match
              // assigns to the lead's assigned_to when present.

  const convQuery = sb.from("conversations").select("id, assigned_to").eq("channel", "whatsapp").eq("status", triage ? "triage" : "open");
  const { data: existing } = clientId
    ? await convQuery.eq("client_id", clientId).maybeSingle()
    : leadId
      ? await convQuery.eq("lead_id", leadId).maybeSingle()
      : { data: null };

  if (existing) {
    convId = existing.id; assignee = existing.assigned_to;
  } else {
    if (leadId && !triage) {
      const { data: lead } = await sb.from("leads").select("assigned_to").eq("id", leadId).maybeSingle();
      assignee = (lead?.assigned_to as string | null) ?? null;
    }
    const { data: conv, error: cErr } = await sb.from("conversations").insert({
      channel: "whatsapp", client_id: clientId, lead_id: leadId,
      contact_identity_id: res.identity_id ?? null,
      assigned_to: assignee, status: triage || !assignee ? "triage" : "open",
    }).select("id").single();
    if (cErr || !conv) throw new Error(`conversation create: ${cErr?.message}`);
    convId = conv.id;
  }

  // Write the spine event.
  const occurredAt = new Date(Number(msg.timestamp) * 1000).toISOString();
  const { data: ev, error: eErr } = await sb.from("communication_events").insert({
    conversation_id: convId, direction: "inbound", channel: "whatsapp",
    event_type: mediaOf(msg) ? "media" : "message",
    body: textOf(msg), payload: { wa_type: msg.type },
    provider_message_id: msg.id, delivery_status: "delivered", occurred_at: occurredAt,
  }).select("id, org_id").single();
  if (eErr || !ev) {
    if (eErr?.code === "23505") return; // unique race on retry — idempotent success
    throw new Error(`event insert: ${eErr?.message}`);
  }

  const media = mediaOf(msg);
  if (media) await rehostMedia(sb, media, ev.id, ev.org_id as string);

  // Update conversation counters + 24h window anchor.
  await sb.from("conversations").update({
    last_inbound_at: occurredAt, updated_at: new Date().toISOString(),
  }).eq("id", convId);
  // unread_count increment (no raw SQL from client lib → tiny RPC-free approach):
  const { data: convRow } = await sb.from("conversations").select("unread_count").eq("id", convId).single();
  await sb.from("conversations").update({ unread_count: (convRow?.unread_count ?? 0) + 1 }).eq("id", convId);

  // Notify assignee (Realtime fan-out happens via table subscription).
  if (assignee) {
    await sb.from("comm_notifications").insert({
      staff_id: assignee, kind: "new_message",
      title: `New WhatsApp from ${contactName ?? res.handle_norm ?? "client"}`,
      body: textOf(msg)?.slice(0, 120) ?? "(media)", conversation_id: convId,
    });
  } else {
    // triage: notify all reception + managers
    const { data: staff } = await sb.from("staff_profiles").select("id")
      .in("role", ["intake_officer", "owner", "admin", "case_manager"]).eq("is_active", true);
    if (staff && staff.length > 0) {
      await sb.from("comm_notifications").insert(staff.map((s) => ({
        staff_id: s.id, kind: "triage",
        title: "Unmatched WhatsApp needs triage",
        body: textOf(msg)?.slice(0, 120) ?? "(media)", conversation_id: convId,
      })));
    }
  }
}

async function handleStatus(sb: SupabaseClient, job: JobRow): Promise<void> {
  const st = job.payload.status as unknown as WaStatus;
  // Reconcile delivery_status on the outbound event we wrote before sending.
  await sb.from("communication_events")
    .update({ delivery_status: st.status })
    .eq("provider_message_id", st.id);
}

function firstName(fullName: string | null): string {
  return fullName?.trim().split(/\s+/)[0] ?? "there";
}

function templateParameters(body: string, fullName: string | null): Array<{ type: "text"; text: string }> {
  const matches = [...body.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)];
  if (matches.length === 0) return [];
  const values: Record<string, string> = {
    "1": firstName(fullName),
    "first_name": firstName(fullName),
    "2": "Study2PR Team",
    "counselor_name": "Study2PR Team",
  };
  return matches.map((match) => ({ type: "text", text: values[match[1]] ?? "Study2PR Team" }));
}

async function handleOutbound(sb: SupabaseClient, row: OutboundRow): Promise<"sent" | "waiting" | "failed"> {
  if (!row.template_code) {
    await sb.from("outbound_messages").update({ status: "failed", attempts: row.attempts + 1, error_message: "Missing WhatsApp template code." }).eq("id", row.id);
    return "failed";
  }

  // The Meta template name is deliberately the same as the engine code. This
  // makes approval and audit traceable and prevents arbitrary template sends.
  const { data: template } = await sb.from("wa_templates")
    .select("name, language, status, body")
    .eq("name", row.template_code)
    .maybeSingle() as { data: WaTemplateRow | null };
  if (!template || template.status !== "approved") {
    await sb.from("outbound_messages").update({
      error_message: `Waiting for approved Meta template: ${row.template_code}`,
    }).eq("id", row.id);
    return "waiting";
  }

  let fullName: string | null = null;
  let conversationId: string | null = null;
  if (row.related_lead_id) {
    const { data: lead } = await sb.from("leads")
      .select("id, full_name, phone, org_id, assigned_to")
      .eq("id", row.related_lead_id).maybeSingle();
    fullName = (lead?.full_name as string | null) ?? null;
    if (!row.to_contact) row.to_contact = (lead?.phone as string | null) ?? null;

    const { data: existing } = await sb.from("conversations")
      .select("id")
      .eq("lead_id", row.related_lead_id)
      .eq("channel", "whatsapp")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    conversationId = existing?.id ?? null;
    if (!conversationId && lead) {
      const { data: created } = await sb.from("conversations").insert({
        org_id: lead.org_id,
        channel: "whatsapp",
        lead_id: row.related_lead_id,
        assigned_to: lead.assigned_to,
        status: lead.assigned_to ? "open" : "triage",
      }).select("id").single();
      conversationId = created?.id ?? null;
    }
  }

  const to = row.to_contact?.replace(/\D/g, "");
  if (!to || !conversationId) {
    await sb.from("outbound_messages").update({ status: "failed", attempts: row.attempts + 1, error_message: "WhatsApp recipient or conversation is missing." }).eq("id", row.id);
    return "failed";
  }

  const apiRes = await fetch(`https://graph.facebook.com/v20.0/${Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("WHATSAPP_ACCESS_TOKEN")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template.name,
        language: { code: template.language },
        ...(templateParameters(template.body, fullName).length > 0
          ? { components: [{ type: "body", parameters: templateParameters(template.body, fullName) }] }
          : {}),
      },
    }),
  });
  const apiJson = await apiRes.json() as { messages?: Array<{ id: string }>; error?: { message?: string } };
  if (!apiRes.ok || !apiJson.messages?.[0]?.id) {
    await sb.from("outbound_messages").update({
      status: "failed",
      attempts: row.attempts + 1,
      error_message: apiJson.error?.message ?? `http_${apiRes.status}`,
    }).eq("id", row.id);
    return "failed";
  }

  const providerId = apiJson.messages[0].id;
  await sb.from("communication_events").insert({
    conversation_id: conversationId,
    direction: "outbound",
    channel: "whatsapp",
    actor_id: row.created_by,
    event_type: "template",
    body: `[template] ${template.name}`,
    payload: { template: { name: template.name, language: template.language }, source: "outbound_messages", outbound_message_id: row.id },
    provider_message_id: providerId,
    delivery_status: "sent",
  });
  await sb.from("conversations").update({ last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conversationId);
  await sb.from("outbound_messages").update({ status: "sent", attempts: row.attempts + 1, sent_at: new Date().toISOString(), error_message: null }).eq("id", row.id);
  return "sent";
}

async function drainOutbound(sb: SupabaseClient): Promise<{ sent: number; waiting: number; failed: number }> {
  const { data: rows } = await sb.from("outbound_messages")
    .select("id, template_code, to_contact, body, related_lead_id, created_by, attempts")
    .eq("channel", "whatsapp")
    .eq("status", "queued")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(10) as { data: OutboundRow[] | null };
  const result = { sent: 0, waiting: 0, failed: 0 };
  for (const row of rows ?? []) {
    try {
      result[await handleOutbound(sb, row)]++;
    } catch (err) {
      await sb.from("outbound_messages").update({ status: "failed", attempts: row.attempts + 1, error_message: String(err) }).eq("id", row.id);
      result.failed++;
    }
  }
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.headers.get("x-worker-secret") !== Deno.env.get("WORKER_SECRET")) {
    return new Response("Forbidden", { status: 403 });
  }
  const sb = db();
  const { data: jobs, error } = await sb.rpc("claim_jobs", { p_types: ["wa_inbound", "wa_status"], p_limit: 20 });
  if (error) return new Response(`claim error: ${error.message}`, { status: 500 });

  let ok = 0, failed = 0;
  for (const job of (jobs ?? []) as JobRow[]) {
    try {
      if (job.type === "wa_inbound") await handleInbound(sb, job);
      else if (job.type === "wa_status") await handleStatus(sb, job);
      await sb.rpc("finish_job", { p_id: job.id, p_ok: true });
      ok++;
    } catch (err) {
      await sb.rpc("finish_job", { p_id: job.id, p_ok: false, p_error: String(err) });
      failed++;
    }
  }
  const outbound = await drainOutbound(sb);
  return new Response(JSON.stringify({ processed: ok, failed, outbound }), {
    status: 200, headers: { "content-type": "application/json" },
  });
});
