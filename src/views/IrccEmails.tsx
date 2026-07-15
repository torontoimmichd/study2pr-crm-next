"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, AlertCircle, CheckCircle2, Search, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { TableSkeleton } from "@/components/TableSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fmtDateTimeIST, fmtRelative } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

type FilterKey = "action" | "all" | "done";

interface IrccEmail {
  id: string;
  subject: string | null;
  from_address: string | null;
  received_at: string;
  email_type: string | null;
  requires_action: boolean | null;
  processed_at: string | null;
  action_due_at: string | null;
  keyword_flags: string[] | null;
  matched_case_id: string | null;
  case_ref?: string | null;
}

export default function IrccEmails() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterKey>("action");
  const [search, setSearch] = useState("");

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ["ircc-emails", filter],
    queryFn: async () => {
      let q = supabase
        .from("ircc_emails")
        .select("id, subject, from_address, received_at, email_type, requires_action, processed_at, action_due_at, keyword_flags, matched_case_id")
        .order("received_at", { ascending: false })
        .limit(300);

      if (filter === "action") q = q.eq("requires_action", true).is("processed_at", null);
      else if (filter === "done") q = q.not("processed_at", "is", null);

      const { data, error } = await q;
      if (error) throw error;

      const caseIds = [...new Set((data ?? []).map((r) => r.matched_case_id).filter(Boolean) as string[])];
      const { data: cases } = caseIds.length
        ? await supabase.from("cases").select("id, case_ref").in("id", caseIds)
        : { data: [] };

      const caseMap = new Map(
        ((cases ?? []) as { id: string; case_ref: string }[]).map((c) => [c.id, c.case_ref])
      );

      return (data ?? []).map((r) => ({
        ...r,
        case_ref: r.matched_case_id ? caseMap.get(r.matched_case_id) ?? null : null,
      })) as IrccEmail[];
    },
  });

  const handleMarkDone = async (email: IrccEmail) => {
    const { error } = await supabase
      .from("ircc_emails")
      .update({ processed_at: new Date().toISOString(), processed_by: user?.id ?? null })
      .eq("id", email.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as processed");
    void qc.invalidateQueries({ queryKey: ["ircc-emails"] });
    void qc.invalidateQueries({ queryKey: ["sidebar-badge-counts"] });
  };

  const filtered = emails.filter((e) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (e.subject ?? "").toLowerCase().includes(q) ||
      (e.case_ref ?? "").toLowerCase().includes(q) ||
      (e.email_type ?? "").toLowerCase().includes(q) ||
      (e.keyword_flags ?? []).some((f) => f.toLowerCase().includes(q))
    );
  });

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "action", label: "Needs Action" },
    { key: "all",    label: "All" },
    { key: "done",   label: "Processed" },
  ];

  return (
    <div>
      <PageHeader
        title="IRCC Emails"
        subtitle="Incoming IRCC correspondence matched to cases"
      />

      <div className="p-6 space-y-4">
        {/* Tabs + search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 border border-border rounded-lg p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm transition-colors",
                  filter === f.key
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search subject, case, keyword…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Mail}
            title={filter === "action" ? "No action items" : "No emails found"}
            description={filter === "action" ? "All IRCC emails have been reviewed." : "IRCC emails are ingested automatically."}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((email) => {
              const isOverdue =
                email.action_due_at && new Date(email.action_due_at) < new Date() && !email.processed_at;
              return (
                <div
                  key={email.id}
                  className={cn(
                    "card-surface p-4 flex items-start gap-4",
                    email.requires_action && !email.processed_at && "border-l-4 border-l-destructive"
                  )}
                >
                  <div className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                    email.processed_at ? "bg-success/10" : email.requires_action ? "bg-destructive/10" : "bg-muted"
                  )}>
                    {email.processed_at
                      ? <CheckCircle2 className="h-4 w-4 text-success" />
                      : email.requires_action
                      ? <AlertCircle className="h-4 w-4 text-destructive" />
                      : <Mail className="h-4 w-4 text-muted-foreground" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{email.subject ?? "(no subject)"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span>{email.from_address ?? "IRCC"}</span>
                          <span>·</span>
                          <span title={fmtDateTimeIST(email.received_at)}>{fmtRelative(email.received_at)}</span>
                          {email.case_ref && (
                            <>
                              <span>·</span>
                              <span className="text-primary font-medium">Case {email.case_ref}</span>
                            </>
                          )}
                          {email.email_type && (
                            <>
                              <span>·</span>
                              <span className="capitalize">{email.email_type.replace(/_/g, " ")}</span>
                            </>
                          )}
                        </div>
                        {email.keyword_flags && email.keyword_flags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {email.keyword_flags.map((f) => (
                              <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                                {f}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isOverdue && (
                          <span className="text-xs text-destructive font-medium">
                            Due {fmtDateTimeIST(email.action_due_at)}
                          </span>
                        )}
                        {!email.processed_at && email.requires_action && (
                          <Button size="sm" variant="outline" onClick={() => void handleMarkDone(email)}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark done
                          </Button>
                        )}
                        {email.processed_at && (
                          <span className="text-xs text-muted-foreground">
                            Processed {fmtRelative(email.processed_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
