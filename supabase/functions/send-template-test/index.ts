// Edge function: send-template-test
// Renders a message template with sample variable values and emails the result.
// Logs an audit row + a `messages` row (is_template=false) for traceability.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReqBody {
  template_id: string;
  recipient_email: string;
}

const SAMPLE_VARS: Record<string, string> = {
  "client.full_name": "Priya Sharma (sample)",
  "client.email": "priya.sample@example.com",
  "client.phone": "+91 98765 43210",
  "case.case_number": "PR-2026-00042",
  "case.visa_label": "Express Entry – CEC",
  "case.fee": "₹ 1,75,000",
  "visa.label": "Express Entry – CEC",
  "staff.full_name": "Study2PR Team",
  "date.today": new Date().toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "numeric",
  }),
};

function render(tpl: string | null, vars: Record<string, string>): string {
  if (!tpl) return "";
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
    return vars[key] ?? `{{${key}}}`;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { template_id, recipient_email }: ReqBody = await req.json();
    if (!template_id || !recipient_email) {
      return new Response(
        JSON.stringify({ error: "template_id and recipient_email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("FROM_EMAIL") ?? "noreply@example.com";

    // Identify caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await callerClient.auth.getUser();
    const actorId = userRes?.user?.id ?? null;

    const admin = createClient(supabaseUrl, serviceKey);

    // Load template
    const { data: tpl, error: tplErr } = await admin
      .from("messages")
      .select("id, template_name, channel, subject, body, is_template")
      .eq("id", template_id)
      .eq("is_template", true)
      .maybeSingle();
    if (tplErr) throw tplErr;
    if (!tpl) {
      return new Response(JSON.stringify({ error: "Template not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const renderedSubject = render(tpl.subject, SAMPLE_VARS);
    const renderedBody = render(tpl.body, SAMPLE_VARS);

    // Send via Resend if configured; otherwise return preview only
    let providerStatus: "sent" | "preview" | "failed" = "preview";
    let providerError: string | null = null;
    if (resendKey && tpl.channel === "email") {
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [recipient_email],
            subject: `[TEST] ${renderedSubject || tpl.template_name || "Template preview"}`,
            html: `<div style="font-family:system-ui,sans-serif;max-width:640px;margin:auto;">
                     <div style="background:#fef3c7;color:#92400e;padding:8px 12px;border-radius:6px;font-size:12px;margin-bottom:16px;">
                       This is a TEST send of template "${tpl.template_name ?? "Untitled"}" with sample variable values.
                     </div>
                     ${renderedBody}
                   </div>`,
          }),
        });
        if (!r.ok) {
          providerStatus = "failed";
          providerError = await r.text();
        } else {
          providerStatus = "sent";
        }
      } catch (e) {
        providerStatus = "failed";
        providerError = e instanceof Error ? e.message : String(e);
      }
    }

    // Log a sent-message row
    await admin.from("messages").insert({
      is_template: false,
      template_id: tpl.id,
      channel: tpl.channel,
      direction: "outbound",
      from_staff_id: actorId,
      to_contact: recipient_email,
      subject: renderedSubject || null,
      body: renderedBody || null,
      status: providerStatus === "sent" ? "sent" : providerStatus === "failed" ? "failed" : "queued",
      sent_at: new Date().toISOString(),
      template_name: `[TEST] ${tpl.template_name ?? ""}`.trim(),
    });

    // Audit
    await admin.from("audit_log").insert({
      action: "TEST_SEND",
      entity_type: "message_template",
      entity_id: tpl.id,
      actor_id: actorId,
      actor_type: "staff",
      changes: { recipient_email, status: providerStatus, provider_error: providerError },
    });

    return new Response(
      JSON.stringify({
        status: providerStatus,
        provider_error: providerError,
        rendered_subject: renderedSubject,
        rendered_body: renderedBody,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
