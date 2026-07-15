"use client";

import { useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { Inbox as InboxIcon, AlertTriangle, Clock, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

type Filter = "all" | "action" | "recent";

interface IrccEmailRow {
  id: string;
  subject: string | null;
  from_address: string | null;
  received_at: string;
  requires_action: boolean | null;
  email_type: string | null;
  matched_case_id: string | null;
  keyword_flags: string[] | null;
  case_code?: string | null;
}

const FILTERS: { key: Filter; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "all", label: "All", icon: InboxIcon },
  { key: "action", label: "Action required", icon: AlertTriangle },
  { key: "recent", label: "Recent (7d)", icon: Clock },
];

export default function Inbox() {
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["ircc-emails", filter],
    queryFn: async (): Promise<IrccEmailRow[]> => {
      let q = supabase
        .from("ircc_emails")
        .select("id, subject, from_address, received_at, requires_action, email_type, matched_case_id, keyword_flags")
        .order("received_at", { ascending: false })
        .limit(200);

      if (filter === "action") q = q.eq("requires_action", true);
      if (filter === "recent") {
        const sevenAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        q = q.gte("received_at", sevenAgo);
      }

      const { data: emails, error } = await q;
      if (error) throw error;
      const rows = (emails ?? []) as IrccEmailRow[];

      // Resolve case codes for linked emails
      const caseIds = Array.from(new Set(rows.map((r) => r.matched_case_id).filter(Boolean) as string[]));
      if (caseIds.length === 0) return rows;
      const { data: cases } = await supabase
        .from("cases")
        .select("id, case_code")
        .in("id", caseIds);
      const m = new Map((cases ?? []).map((c) => [c.id, c.case_code]));
      return rows.map((r) => ({ ...r, case_code: r.matched_case_id ? m.get(r.matched_case_id) ?? null : null }));
    },
  });

  const counts = useMemo(() => {
    const all = data?.length ?? 0;
    const action = data?.filter((r) => r.requires_action).length ?? 0;
    return { all, action };
  }, [data]);

  return (
    <div>
      <PageHeader
        title="Inbox"
        subtitle="IRCC and case-related emails matched to cases"
      />
      <div className="p-6 max-w-[1400px] space-y-4">
        {/* Filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map(({ key, label, icon: Icon }) => {
            const active = filter === key;
            const count = key === "action" ? counts.action : key === "all" ? counts.all : null;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:border-gold",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {count !== null && (
                  <span className={cn("ml-1 px-1.5 rounded-full text-[10px]", active ? "bg-primary-foreground/20" : "bg-muted")}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={<Mail className="h-5 w-5" />}
            title="Nothing here yet"
            description="IRCC emails arrive here once Gmail integration is live in Phase 2."
          />
        ) : (
          <div className="card-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Subject</th>
                  <th className="text-left px-4 py-3 font-medium">Linked case</th>
                  <th className="text-left px-4 py-3 font-medium">Flags</th>
                  <th className="text-left px-4 py-3 font-medium">Received</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => {
                  const flags: string[] = [
                    ...(row.email_type ? [row.email_type] : []),
                    ...((row.keyword_flags ?? []) as string[]),
                  ];
                  return (
                    <tr key={row.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          {row.requires_action && (
                            <span title="Action required" className="mt-1 h-2 w-2 rounded-full bg-destructive shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate max-w-[420px]">
                              {row.subject || <span className="italic text-muted-foreground">(no subject)</span>}
                            </div>
                            {row.from_address && (
                              <div className="text-xs text-muted-foreground truncate max-w-[420px]">
                                {row.from_address}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {row.matched_case_id ? (
                          <Link to={`/cases/${row.matched_case_id}`} className="text-accent hover:underline text-xs font-medium">
                            {row.case_code ?? row.matched_case_id.slice(0, 8)}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unmatched</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {flags.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {flags.slice(0, 4).map((f) => (
                              <span
                                key={f}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gold/15 text-navy capitalize"
                              >
                                {f.replace(/_/g, " ")}
                              </span>
                            ))}
                            {flags.length > 4 && (
                              <span className="text-[10px] text-muted-foreground">+{flags.length - 4}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtRelative(row.received_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
