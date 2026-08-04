/**
 * wa-send — Supabase Edge Function
 * Outbound WhatsApp: write the spine event FIRST (delivery_status='queued'),
 * then call the Graph API, then set provider_message_id + 'sent'. The status
 * webhook later reconciles delivered/read/failed.
 *
 * 24-HOUR SERVICE WINDOW — enforced HERE, server-side (the composer also
 * enforces it in UX, but a stale tab must not produce silent failures):
 *   window open  (last_inbound_at within 24h) → free-form text allowed
 *   window closed → ONLY approved templates; free text is rejected with 409.
 *
 * COST NOTE: from 1 Oct 2026 Meta charges for business messages INCLUDING
 * service replies inside the 24h window. Every outbound event records
 * payload.cost_category ('service_in_window' | 'template_utility' |
 * 'template_marketing' | 'template_authentication') so spend is measurable
 * from day one.
 *
 * Deploy: supabase functions deploy wa-send        (verify_jwt = true, default)
 * Secrets: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID
 */
import { createClient } from "npm:@supabase/supabase-js@2";

interface SendBody {
  conversation_id: string;
  text?: string;                       // free-form (window must be open)
  template?: { name: string; language: string }; // closed-window path
}
interface WindowState { open: boolean; expires_at: string | null; seconds_left: number }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });

  // Caller identity from the user JWT (verify_jwt already validated it).
  const authHeader = req.headers.get("authorization") ?? "";
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData } = await userClient.auth.getUser();
  const staffId = userData?.user?.id;
  if (!staffId) return new Response("Unauthorized", { status: 401, headers: CORS });

  const body = (await req.json()) as SendBody;
  if (!body.conversation_id || (!body.text && !body.template)) {
    return new Response(JSON.stringify({ error: "conversation_id and text|template required" }),
      { status: 400, headers: { ...CORS, "content-type": "application/json" } });
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // RLS-equivalent authorization: caller must see this conversation.
  const { data: canSee } = await userClient.from("conversations")
    .select("id").eq("id", body.conversation_id).maybeSingle();
  if (!canSee) return new Response("Forbidden", { status: 403, headers: CORS });

  const { data: conv, error: convErr } = await sb.from("conversations")
    .select("id, channel, contact_identity_id, client_id, lead_id, last_inbound_at")
    .eq("id", body.conversation_id).single();
  if (convErr || !conv) return new Response("Conversation not found", { status: 404, headers: CORS });

  // Recipient handle from the linked identity (or lead/client phone fallback).
  let to: string | null = null;
  if (conv.contact_identity_id) {
    const { data: ident } = await sb.from("contact_identities")
      .select("handle_norm").eq("id", conv.contact_identity_id).maybeSingle();
    to = ident?.handle_norm ?? null;
  }
  if (!to && conv.lead_id) {
    const { data: lead } = await sb.from("leads").select("phone").eq("id", conv.lead_id).maybeSingle();
    to = lead?.phone ?? null;
  }
  if (!to && conv.client_id) {
    const { data: client } = await sb.from("clients").select("phone").eq("id", conv.client_id).maybeSingle();
    to = client?.phone ?? null;
  }
  if (!to) return new Response("No recipient handle on conversation", { status: 422, headers: CORS });
  to = to.replace(/^\+/, ""); // Graph API wants digits without '+'

  // ── 24h window guard (server-side source of truth) ─────────────────────────
  const { data: win } = await sb.rpc("wa_window_state", { p_conversation: conv.id });
  const windowState = win as unknown as WindowState | null;
  const windowOpen = windowState?.open === true;
  if (!windowOpen && !body.template) {
    return new Response(JSON.stringify({
      error: "window_closed",
      message: "24h service window is closed — send an approved template instead.",
    }), { status: 409, headers: { ...CORS, "content-type": "application/json" } });
  }

  if (body.template?.name === "hello_world") {
    return new Response(JSON.stringify({
      error: "hello_world is a Meta test template and cannot be sent to production numbers. Create an approved business template instead.",
    }), { status: 422, headers: { ...CORS, "content-type": "application/json" } });
  }

  if (body.template) {
    const { data: approvedTemplate } = await sb.from("wa_templates")
      .select("name, status")
      .eq("name", body.template.name)
      .maybeSingle();
    if (!approvedTemplate || approvedTemplate.status !== "approved") {
      return new Response(JSON.stringify({
        error: `WhatsApp template "${body.template.name}" is not approved for production sending.`,
      }), { status: 422, headers: { ...CORS, "content-type": "application/json" } });
    }
  }

  const costCategory = body.template
    ? `template_${(await templateCategory(sb, body.template.name)) ?? "utility"}`
    : "service_in_window";

  // 1) Write the event FIRST (queued).
  const { data: ev, error: evErr } = await sb.from("communication_events").insert({
    conversation_id: conv.id, direction: "outbound", channel: "whatsapp",
    actor_id: staffId,
    event_type: body.template ? "template" : "message",
    body: body.text ?? `[template] ${body.template?.name}`,
    payload: { cost_category: costCategory, template: body.template ?? null },
    delivery_status: "queued",
  }).select("id").single();
  if (evErr || !ev) return new Response(`event write failed: ${evErr?.message}`, { status: 500, headers: CORS });

  // 2) Call the Graph API.
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
  const apiBody = body.template
    ? { messaging_product: "whatsapp", to, type: "template",
        template: { name: body.template.name, language: { code: body.template.language } } }
    : { messaging_product: "whatsapp", to, type: "text", text: { body: body.text } };

  const apiRes = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(apiBody),
  });
  const apiJson = (await apiRes.json()) as { messages?: Array<{ id: string }>; error?: { message: string } };

  // 3) Reconcile immediate result; status webhook upgrades it later.
  if (!apiRes.ok || !apiJson.messages?.[0]?.id) {
    await sb.from("communication_events").update({
      delivery_status: "failed",
      payload: { cost_category: costCategory, error: apiJson.error?.message ?? `http_${apiRes.status}` },
    }).eq("id", ev.id);
    return new Response(JSON.stringify({ error: apiJson.error?.message ?? "send failed" }),
      { status: 502, headers: { ...CORS, "content-type": "application/json" } });
  }

  await sb.from("communication_events").update({
    provider_message_id: apiJson.messages[0].id, delivery_status: "sent",
  }).eq("id", ev.id);
  await sb.from("conversations").update({
    last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", conv.id);
  await sb.from("comm_audit_logs").insert({
    actor_id: staffId, action: "send", entity_type: "communication_event", entity_id: ev.id,
    detail: { cost_category: costCategory, window_open: windowOpen },
  });

  return new Response(JSON.stringify({ ok: true, event_id: ev.id }),
    { status: 200, headers: { ...CORS, "content-type": "application/json" } });
});

async function templateCategory(
  sb: ReturnType<typeof createClient>, name: string,
): Promise<string | null> {
  const { data } = await sb.from("wa_templates").select("category").eq("name", name).maybeSingle();
  return (data?.category as string | undefined) ?? null;
}
