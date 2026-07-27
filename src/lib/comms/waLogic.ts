/**
 * waLogic — pure, testable comms logic.
 * IMPORTANT: normalize_phone/resolve_identity in sql/35 are the runtime
 * AUTHORITY (the worker calls the SQL RPC). These TS mirrors exist for the
 * composer UX and the vitest suites; any change must be made in BOTH places.
 */

// ─── phone normalization (mirror of sql/35 normalize_phone) ──────────────────
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = input.replace(/[^0-9+]/g, "");
  if (d.startsWith("00")) d = "+" + d.slice(2);
  if (d.startsWith("+")) {
    d = "+" + d.slice(1).replace(/[^0-9]/g, "");
    return d.length >= 10 && d.length <= 17 ? d : null;
  }
  d = d.replace(/[^0-9]/g, "");
  if (d.length === 10) return "+91" + d;
  if (d.length === 11 && d.startsWith("0")) return "+91" + d.slice(1);
  if (d.length === 12 && d.startsWith("91")) return "+" + d;
  if (d.length >= 11 && d.length <= 15) return "+" + d;
  return null;
}

export function normalizeEmail(input: string | null | undefined): string | null {
  if (!input) return null;
  const e = input.trim().toLowerCase();
  return e.length > 0 ? e : null;
}

// ─── identity routing (mirror of worker branching over resolve_identity) ─────
export interface ResolveResult {
  status: "match" | "ambiguous" | "none";
  client_id?: string | null;
  lead_id?: string | null;
}
export interface RoutingDecision {
  triage: boolean;          // goes to reception triage queue
  createLead: boolean;      // auto-create a Lead for unknown contact
  clientId: string | null;
  leadId: string | null;
}
/** NEVER guesses on ambiguity — ambiguous strips owners and routes to triage. */
export function decideRouting(res: ResolveResult): RoutingDecision {
  if (res.status === "ambiguous") {
    return { triage: true, createLead: false, clientId: null, leadId: null };
  }
  if (res.status === "none") {
    return { triage: true, createLead: true, clientId: null, leadId: null };
  }
  return {
    triage: false, createLead: false,
    clientId: res.client_id ?? null, leadId: res.lead_id ?? null,
  };
}

// ─── Meta webhook signature (X-Hub-Signature-256) ────────────────────────────
export async function verifyMetaSignature(
  appSecret: string, rawBody: string, header: string | null | undefined,
): Promise<boolean> {
  if (!header || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = "sha256=" +
    Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

// ─── webhook payload parsing (typed, tolerant) ───────────────────────────────
export interface ParsedJob { type: "wa_inbound" | "wa_status"; payload: Record<string, unknown> }
interface WaChangeValueLoose {
  metadata?: { phone_number_id?: string };
  contacts?: Array<{ profile?: { name?: string } }>;
  messages?: Array<Record<string, unknown> & { id?: string }>;
  statuses?: Array<Record<string, unknown> & { id?: string }>;
}
interface WaEntryLoose { changes?: Array<{ value?: WaChangeValueLoose }> }
interface WaWebhookBodyLoose { object?: unknown; entry?: WaEntryLoose[] }
/** Malformed payloads yield [] — never throw (Meta must always get its 200). */
export function parseWebhookJobs(raw: string): ParsedJob[] {
  let body: WaWebhookBodyLoose;
  try { body = JSON.parse(raw) as WaWebhookBodyLoose; } catch { return []; }
  if (body.object !== "whatsapp_business_account" || !Array.isArray(body.entry)) return [];
  const jobs: ParsedJob[] = [];
  for (const entry of body.entry) {
    for (const change of entry.changes ?? []) {
      const v = change.value;
      if (!v) continue;
      const contactName = v.contacts?.[0]?.profile?.name ?? null;
      for (const msg of v.messages ?? []) {
        if (typeof msg.id === "string") {
          jobs.push({ type: "wa_inbound", payload: { message: msg, contactName, phoneNumberId: v.metadata?.phone_number_id ?? null } });
        }
      }
      for (const st of v.statuses ?? []) {
        if (typeof st.id === "string") jobs.push({ type: "wa_status", payload: { status: st } });
      }
    }
  }
  return jobs;
}

// ─── idempotency gate (worker consults the spine before writing) ─────────────
/** Given the set of provider ids already in the spine, keep only new jobs. */
export function dropDuplicateInbound(jobs: ParsedJob[], existingProviderIds: Set<string>): ParsedJob[] {
  return jobs.filter((j) => {
    if (j.type !== "wa_inbound") return true;
    const id = (j.payload.message as { id?: string } | undefined)?.id;
    return !(id && existingProviderIds.has(id));
  });
}

// ─── media limits ────────────────────────────────────────────────────────────
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
export function isOversizedMedia(sizeBytes: number | null | undefined): boolean {
  return (sizeBytes ?? 0) > MAX_MEDIA_BYTES;
}

// ─── 24h service window ──────────────────────────────────────────────────────
export interface WindowState { open: boolean; expiresAt: Date | null; msLeft: number }
export function windowState(lastInboundAt: string | null, now: Date = new Date()): WindowState {
  if (!lastInboundAt) return { open: false, expiresAt: null, msLeft: 0 };
  const expires = new Date(new Date(lastInboundAt).getTime() + 24 * 3600 * 1000);
  const msLeft = expires.getTime() - now.getTime();
  return { open: msLeft > 0, expiresAt: expires, msLeft: Math.max(0, msLeft) };
}
