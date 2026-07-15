"use client";

/**
 * /inbox — IRCC Email Inbox
 *
 * Shows all inbound IRCC emails stored in the ircc_emails table.
 * Emails are matched to cases by the process-ircc-email Edge Function.
 * Staff can also manually link an unmatched email to a case.
 */

import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Mail, AlertCircle, CheckCircle, Link2, Search, RefreshCw,
  ChevronDown, ChevronUp, ExternalLink, Clock
} from "lucide-react";
import { fmtRelative, fmtDateTimeIST } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const EMAIL_TYPE_COLORS: Record<string, string> = {
  approval:         "bg-green-100 text-green-700",
  refusal:          "bg-red-100 text-red-700",
  document_request: "bg-amber-100 text-amber-700",
  biometrics:       "bg-violet-100 text-violet-700",
  medical:          "bg-blue-100 text-blue-700",
  aor:              "bg-sky-100 text-sky-700",
  decision:         "bg-orange-100 text-orange-700",
  general_update:   "bg-slate-100 text-slate-600",
};

interface IRCCEmail {
  id: string;
  subject: string | null;
  from_address: string | null;
  body_text: string | null;
  received_at: string;
  email_type: string | null;
  keyword_flags: string[] | null;
  requires_action: boolean | null;
  matched_case_id: string | null;
  notification_sent_at: string | null;
  case?: { case_code: string | null; client: { full_name: string } | null } | null;
}

type FilterTab = "all" | "action_required" | "matched" | "unmatched";

export default function IRCCInbox() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab]   = useState<FilterTab>("all");
  const [search, setSearch]         = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [linkingId, setLinkingId]   = useState<string | null>(null);
  const [caseSearch, setCaseSearch] = useState("");

  const { data: emails = [], isLoading, refetch } = useQuery<IRCCEmail[]>({
    queryKey: ["ircc-inbox"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("ircc_emails")
        .select(`
          id, subject, from_address, body_text, received_at,
          email_type, keyword_flags, requires_action,
          matched_case_id, notification_sent_at,
          case:cases(case_code, client:clients(full_name))
        `)
        .order("received_at", { ascending: false })
        .limit(200);
      if (error) { console.warn("[IRCCInbox]", error.message); return []; }
      return (data ?? []) as IRCCEmail[];
    },
  });

  // Cases for manual linking
  const { data: cases = [] } = useQuery({
    queryKey: ["cases-for-linking", caseSearch],
    queryFn: async () => {
      let q = supabase
        .from("cases")
        .select("id, case_code, uci_number, application_number, client:clients(full_name)")
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(50);
      if (caseSearch.trim()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        q = (q as any).ilike("case_code", `%${caseSearch}%`);
      }
      const { data } = await q;
      return (data ?? []) as Array<{
        id: string; case_code: string | null; uci_number: string | null;
        application_number: string | null;
        client: { full_name: string } | null;
      }>;
    },
    enabled: !!linkingId,
  });

  const linkToCase = async (emailId: string, caseId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("ircc_emails")
      .update({ matched_case_id: caseId })
      .eq("id", emailId);
    if (error) { toast.error(error.message); return; }
    toast.success("Email linked to case");
    setLinkingId(null);
    void qc.invalidateQueries({ queryKey: ["ircc-inbox"] });
  };

  const filtered = emails.filter((e) => {
    if (activeTab === "action_required" && !e.requires_action) return false;
    if (activeTab === "matched"   && !e.matched_case_id) return false;
    if (activeTab === "unmatched" &&  e.matched_case_id) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(e.subject ?? "").toLowerCase().includes(q) &&
          !(e.from_address ?? "").toLowerCase().includes(q) &&
          !(e.case?.client?.full_name ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const counts = {
    all:             emails.length,
    action_required: emails.filter((e) => e.requires_action).length,
    matched:         emails.filter((e) => e.matched_case_id).length,
    unmatched:       emails.filter((e) => !e.matched_case_id).length,
  };

  return (
    <div>
      <PageHeader
        title="IRCC Inbox"
        subtitle="Inbound IRCC emails — auto-matched to cases by UCI or application number"
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="h-4 w-4 mr-1.5" />Refresh
          </Button>
        }
      />

      <div className="p-6 max-w-5xl space-y-4">
        {/* Filter tabs */}
        <div className="flex gap-0 border-b border-border overflow-x-auto">
          {(["all", "action_required", "matched", "unmatched"] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors capitalize",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.replace(/_/g, " ")}
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {counts[tab]}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by subject, sender, client…"
            className="pl-9"
          />
        </div>

        {/* Email list */}
        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Mail className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No emails found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              IRCC emails arrive here once the Postmark inbound webhook is configured.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((email) => {
              const isExpanded = expandedId === email.id;
              const isLinking  = linkingId  === email.id;
              const typeMeta   = EMAIL_TYPE_COLORS[email.email_type ?? "general_update"] ?? EMAIL_TYPE_COLORS.general_update;

              return (
                <div
                  key={email.id}
                  className={cn(
                    "card-surface rounded-xl overflow-hidden border",
                    email.requires_action && !email.matched_case_id
                      ? "border-amber-300"
                      : "border-border"
                  )}
                >
                  {/* Header row */}
                  <div
                    className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : email.id)}
                  >
                    {/* Status icon */}
                    <div className={cn(
                      "mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                      email.matched_case_id ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500"
                    )}>
                      {email.matched_case_id
                        ? <CheckCircle className="h-4 w-4" />
                        : <Mail className="h-4 w-4" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-medium truncate">{email.subject || "(no subject)"}</span>
                        {email.requires_action && (
                          <Badge className="bg-amber-100 text-amber-700 text-[10px] shrink-0">Action required</Badge>
                        )}
                        {email.email_type && (
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0", typeMeta)}>
                            {email.email_type.replace(/_/g, " ")}
                          </span>
                        )}
                        <span
                          className="text-[11px] text-muted-foreground/70 ml-auto"
                          title={fmtDateTimeIST(email.received_at)}
                        >
                          {fmtRelative(email.received_at)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                        <span className="text-xs text-muted-foreground">{email.from_address}</span>
                        {email.matched_case_id && email.case ? (
                          <Link
                            to={`/cases/${email.matched_case_id}`}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" />
                            {email.case.case_code ?? email.matched_case_id.slice(0, 8)}
                            {email.case.client ? ` · ${email.case.client.full_name}` : ""}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground/60 italic">No case matched</span>
                        )}
                        {email.keyword_flags && email.keyword_flags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {email.keyword_flags.slice(0, 4).map((f) => (
                              <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {f}
                              </span>
                            ))}
                          </div>
                        )}
                        {email.notification_sent_at && (
                          <span className="flex items-center gap-1 text-[10px] text-green-600">
                            <Clock className="h-2.5 w-2.5" />
                            Staff notified {fmtRelative(email.notification_sent_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
                  </div>

                  {/* Expanded body */}
                  {isExpanded && (
                    <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                      {email.body_text ? (
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans bg-muted/30 rounded p-3 max-h-60 overflow-y-auto">
                          {email.body_text.slice(0, 3000)}
                          {email.body_text.length > 3000 ? "\n…[truncated]" : ""}
                        </pre>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No body text available.</p>
                      )}

                      {/* Link to case */}
                      {!email.matched_case_id && !isLinking && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setLinkingId(email.id); setCaseSearch(""); }}
                        >
                          <Link2 className="h-3.5 w-3.5 mr-1.5" />Link to a case manually
                        </Button>
                      )}

                      {isLinking && (
                        <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                          <p className="text-xs font-medium">Search and select a case to link:</p>
                          <Input
                            placeholder="Type case code…"
                            value={caseSearch}
                            onChange={(e) => setCaseSearch(e.target.value)}
                            className="text-sm"
                          />
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {cases.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => linkToCase(email.id, c.id)}
                                className="w-full text-left text-xs px-2.5 py-2 rounded hover:bg-primary/10 transition-colors flex items-center justify-between"
                              >
                                <span className="font-medium">{c.case_code ?? c.id.slice(0, 8)}</span>
                                <span className="text-muted-foreground">{c.client?.full_name}</span>
                                {(c.uci_number || c.application_number) && (
                                  <span className="text-[10px] text-muted-foreground/60">
                                    {c.uci_number && `UCI: ${c.uci_number}`}
                                    {c.uci_number && c.application_number && " · "}
                                    {c.application_number && `App: ${c.application_number}`}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLinkingId(null)}
                          >Cancel</Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Setup banner if inbox is empty */}
        {!isLoading && emails.length === 0 && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 shrink-0" />
              <p className="text-sm font-semibold text-blue-800">Setup required: Postmark Inbound</p>
            </div>
            <p className="text-xs text-blue-700 leading-relaxed">
              To receive IRCC emails here automatically, forward your IRCC inbox
              (e.g. ircc@study2pr.in) to your Postmark inbound address and set the
              webhook URL to your Edge Function. See the setup guide below.
            </p>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li>In Postmark → Servers → your server → <strong>Inbound</strong> → copy the inbound email address</li>
              <li>In your email provider, set up forwarding: <code className="bg-blue-100 px-1 rounded">ircc@study2pr.in → [postmark inbound address]</code></li>
              <li>In Postmark → Inbound → set webhook URL to: <code className="bg-blue-100 px-1 rounded">https://[your-project].supabase.co/functions/v1/process-ircc-email</code></li>
              <li>Deploy the Edge Function: <code className="bg-blue-100 px-1 rounded">supabase functions deploy process-ircc-email --no-verify-jwt</code></li>
              <li>Set secrets: <code className="bg-blue-100 px-1 rounded">POSTMARK_SERVER_TOKEN</code>, <code className="bg-blue-100 px-1 rounded">POSTMARK_FROM_EMAIL</code>, <code className="bg-blue-100 px-1 rounded">CRM_BASE_URL</code></li>
              <li>On each Case detail, fill in the <strong>UCI Number</strong> and <strong>Application Number</strong></li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
