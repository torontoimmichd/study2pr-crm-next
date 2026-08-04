/**
 * whatsapp-webhook — Supabase Edge Function
 * Meta WhatsApp Cloud API webhook endpoint.
 *
 *  GET  → Meta subscription verify challenge (hub.mode/hub.verify_token/hub.challenge)
 *  POST → verify X-Hub-Signature-256 HMAC against META_APP_SECRET, persist the
 *         raw payload, enqueue a job per message/status, return 200 FAST (<5s).
 *         ALL processing is async in comms-worker. Idempotency: the worker
 *         inserts events keyed on provider_message_id (UNIQUE) — Meta retries
 *         aggressively; duplicates are impossible by construction.
 *
 * Deploy:  supabase functions deploy whatsapp-webhook --no-verify-jwt
 *          (Meta cannot send a Supabase JWT; auth is the HMAC signature.)
 * Secrets: META_APP_SECRET, WHATSAPP_VERIFY_TOKEN
 *          (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected.)
 */
import { createClient } from "npm:@supabase/supabase-js@2";

// ── Typed webhook payload (subset we consume — no `any`) ─────────────────────
interface WaMedia { id: string; mime_type?: string; sha256?: string; caption?: string; filename?: string }
interface WaMessage {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "image" | "document" | "audio" | "video" | "sticker" | "button" | "interactive" | "unknown";
  text?: { body: string };
  image?: WaMedia; document?: WaMedia; audio?: WaMedia; video?: WaMedia; sticker?: WaMedia;
  button?: { text: string; payload: string };
  interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
}
interface WaStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title?: string; message?: string }>;
}
interface WaChangeValue {
  messaging_product: "whatsapp";
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: Array<{ profile: { name: string }; wa_id: string }>;
  messages?: WaMessage[];
  statuses?: WaStatus[];
}
interface WaWebhookBody {
  object: string;
  entry: Array<{ id: string; changes: Array<{ field: string; value: WaChangeValue }> }>;
}

// ── HMAC SHA-256 signature check ─────────────────────────────────────────────
async function validSignature(appSecret: string, rawBody: string, header: string | null): Promise<boolean> {
  if (!header || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = "sha256=" + Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  // constant-time compare
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // ── GET: Meta verify challenge ─────────────────────────────────────────────
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === Deno.env.get("WHATSAPP_VERIFY_TOKEN")) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const rawBody = await req.text();
  const appSecret = Deno.env.get("META_APP_SECRET") ?? "";
  const sigOk = await validSignature(appSecret, rawBody, req.headers.get("x-hub-signature-256"));

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Persist raw intake either way (debugging + forensics), but only enqueue if signed.
  let parsed: WaWebhookBody | null = null;
  try { parsed = JSON.parse(rawBody) as WaWebhookBody; } catch { parsed = null; }

  await supabase.from("wa_webhook_events").insert({
    signature_ok: sigOk,
    payload: parsed ?? { unparseable: rawBody.slice(0, 4000) },
  });

  if (!sigOk) return new Response("Invalid signature", { status: 401 });
  if (!parsed || parsed.object !== "whatsapp_business_account") {
    return new Response("Ignored", { status: 200 }); // malformed/other → ack, don't retry-loop
  }

  // Enqueue one job per message and per status — processing is fully async.
  const jobs: Array<{ type: string; payload: Record<string, unknown> }> = [];
  for (const entry of parsed.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value;
      const contactName = v.contacts?.[0]?.profile?.name ?? null;
      for (const msg of v.messages ?? []) {
        jobs.push({ type: "wa_inbound", payload: { message: msg, contactName, phoneNumberId: v.metadata.phone_number_id } });
      }
      for (const st of v.statuses ?? []) {
        jobs.push({ type: "wa_status", payload: { status: st } });
      }
    }
  }
  if (jobs.length > 0) {
    await supabase.from("jobs").insert(jobs.map((j) => ({ type: j.type, payload: j.payload })));
  }

  // Fast ACK — Meta requires < 5s. Worker does the heavy lifting.
  return new Response("EVENT_RECEIVED", { status: 200 });
});
