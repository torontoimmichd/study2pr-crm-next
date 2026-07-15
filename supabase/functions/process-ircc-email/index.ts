/**
 * process-ircc-email — Supabase Edge Function
 *
 * Receives inbound emails forwarded via Postmark Inbound webhook.
 * Flow:
 *   1. Parse subject + body for UCI numbers (format: 1234-5678) and
 *      IRCC application/file numbers (format: APPXXXXXXXX or Exxxxxxxx or numeric)
 *   2. Try to match against cases.uci_number and cases.application_number
 *   3. Insert row into ircc_emails (with matched_case_id if found)
 *   4. If matched → email owner/admin/senior_advisor + that case's case_manager
 *   5. Return 200 so Postmark doesn't retry
 *
 * Deploy:
 *   supabase functions deploy process-ircc-email --no-verify-jwt
 *
 * Set secrets:
 *   supabase secrets set POSTMARK_SERVER_TOKEN=your-token
 *   supabase secrets set POSTMARK_FROM_EMAIL=noreply@study2pr.in
 *   supabase secrets set CRM_BASE_URL=https://crm.study2pr.in
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const POSTMARK_TOKEN    = Deno.env.get("POSTMARK_SERVER_TOKEN") ?? "";
const FROM_EMAIL        = Deno.env.get("POSTMARK_FROM_EMAIL") ?? "noreply@study2pr.in";
const CRM_URL           = Deno.env.get("CRM_BASE_URL") ?? "https://crm.study2pr.in";

// ─── Regex patterns ──────────────────────────────────────────────────────────
// UCI: 4-digit groups separated by hyphen e.g. 1234-5678 or 1234-5678-9012
const UCI_RE = /\b(\d{4}-\d{4}(?:-\d{4})?)\b/g;

// Application numbers: APPXXXXXXXX, Exxxxxxxx, or 10-12 digit run
const APP_RE = /\b(APP\d{7,10}|E\d{7,10}|\d{10,12})\b/gi;

// IRCC keyword detection
const KEYWORDS = [
  "approved", "refused", "rejected", "additional document",
  "biometrics", "medical exam", "decision made", "status update",
  "permanent residence", "study permit", "work permit", "visitor visa",
  "express entry", "profile created", "invitation to apply",
  "acknowledgement of receipt", "AOR", "IRCC", "CIC",
];

function extractMatches(text: string): { ucis: string[]; apps: string[] } {
  const ucis = Array.from(new Set([...text.matchAll(UCI_RE)].map(m => m[1])));
  const apps = Array.from(new Set([...text.matchAll(APP_RE)].map(m => m[1].toUpperCase())));
  return { ucis, apps };
}

function detectKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return KEYWORDS.filter(k => lower.includes(k.toLowerCase()));
}

function detectEmailType(subject: string, body: string): string {
  const combined = `${subject} ${body}`.toLowerCase();
  if (combined.includes("approved")) return "approval";
  if (combined.includes("refused") || combined.includes("rejected")) return "refusal";
  if (combined.includes("additional document") || combined.includes("request for")) return "document_request";
  if (combined.includes("biometrics")) return "biometrics";
  if (combined.includes("medical")) return "medical";
  if (combined.includes("acknowledgement") || combined.includes("AOR")) return "aor";
  if (combined.includes("decision")) return "decision";
  return "general_update";
}

// ─── Send notification email via Postmark ────────────────────────────────────
async function sendNotification(
  toEmail: string,
  toName: string,
  subject: string,
  caseCode: string,
  clientName: string,
  emailSubject: string,
  emailType: string,
  caseId: string,
  keywords: string[],
) {
  if (!POSTMARK_TOKEN) return;

  const caseUrl = `${CRM_URL}/cases/${caseId}`;
  const body = `
Hi ${toName},

An IRCC update has been received for one of your cases.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLIENT:      ${clientName}
CASE:        ${caseCode}
EMAIL TYPE:  ${emailType.replace(/_/g, " ").toUpperCase()}
SUBJECT:     ${emailSubject}
FLAGS:       ${keywords.length > 0 ? keywords.join(", ") : "none"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View the case and full email here:
${caseUrl}

— Study2PR CRM (automated notification)
`;

  await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": POSTMARK_TOKEN,
    },
    body: JSON.stringify({
      From: FROM_EMAIL,
      To: toEmail,
      Subject: `[IRCC Update] ${clientName} — ${emailType.replace(/_/g, " ")}`,
      TextBody: body,
      MessageStream: "outbound",
    }),
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, fn: "process-ircc-email" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const subject   = (payload.Subject as string) ?? "";
  const bodyText  = (payload.TextBody as string) ?? (payload.StrippedTextReply as string) ?? "";
  const fromAddr  = (payload.From as string) ?? "";
  const receivedAt = new Date().toISOString();

  const combined = `${subject}\n${bodyText}`;
  const { ucis, apps } = extractMatches(combined);
  const flags    = detectKeywords(combined);
  const emailType = detectEmailType(subject, bodyText);
  const requiresAction = ["document_request", "biometrics", "medical"].includes(emailType);

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ── Try to match a case ───────────────────────────────────────────────────
  let matchedCase: {
    id: string; case_code: string | null;
    uci_number: string | null; application_number: string | null;
    case_manager_id: string | null; senior_advisor_id: string | null;
    client: { full_name: string } | null;
  } | null = null;

  if (ucis.length > 0) {
    const { data } = await sb
      .from("cases")
      .select("id, case_code, uci_number, application_number, case_manager_id, senior_advisor_id, client:clients(full_name)")
      .in("uci_number", ucis)
      .eq("is_archived", false)
      .maybeSingle();
    if (data) matchedCase = data as typeof matchedCase;
  }

  if (!matchedCase && apps.length > 0) {
    const { data } = await sb
      .from("cases")
      .select("id, case_code, uci_number, application_number, case_manager_id, senior_advisor_id, client:clients(full_name)")
      .in("application_number", apps)
      .eq("is_archived", false)
      .maybeSingle();
    if (data) matchedCase = data as typeof matchedCase;
  }

  // ── Insert into ircc_emails ───────────────────────────────────────────────
  const { data: inserted, error: insertErr } = await sb
    .from("ircc_emails")
    .insert({
      subject,
      body_text: bodyText.slice(0, 10000),
      from_address: fromAddr,
      received_at: receivedAt,
      email_type: emailType,
      keyword_flags: flags,
      requires_action: requiresAction,
      matched_case_id: matchedCase?.id ?? null,
      delivery_channel: "postmark",
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("[process-ircc-email] insert error", insertErr.message);
  }

  // ── Notify staff if matched ───────────────────────────────────────────────
  if (matchedCase && inserted && POSTMARK_TOKEN) {
    const clientName = matchedCase.client?.full_name ?? "Unknown client";
    const caseCode   = matchedCase.case_code ?? matchedCase.id.slice(0, 8);

    // Collect staff to notify: all owners/admins/senior_advisors + case's manager
    const { data: staffList } = await sb
      .from("staff_profiles")
      .select("id, full_name, email, role")
      .in("role", ["owner", "admin", "senior_advisor"])
      .eq("is_active", true);

    const toNotify = new Map<string, { full_name: string; email: string }>();
    for (const s of staffList ?? []) {
      if (s.email) toNotify.set(s.id, { full_name: s.full_name, email: s.email });
    }

    // Also add the specific case manager (may already be in list)
    if (matchedCase.case_manager_id) {
      const { data: cm } = await sb
        .from("staff_profiles")
        .select("id, full_name, email")
        .eq("id", matchedCase.case_manager_id)
        .maybeSingle();
      if (cm?.email) toNotify.set(cm.id, { full_name: cm.full_name, email: cm.email });
    }

    // Fire notifications (parallel, non-blocking)
    await Promise.allSettled(
      Array.from(toNotify.values()).map(({ full_name, email }) =>
        sendNotification(email, full_name, subject, caseCode, clientName, subject, emailType, matchedCase!.id, flags)
      )
    );

    // Mark notification as sent
    await sb
      .from("ircc_emails")
      .update({ notification_sent_at: new Date().toISOString() })
      .eq("id", inserted.id);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      matched: !!matchedCase,
      case_id: matchedCase?.id ?? null,
      ucis_found: ucis,
      apps_found: apps,
      keywords: flags,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
