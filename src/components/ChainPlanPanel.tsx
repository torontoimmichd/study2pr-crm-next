"use client";

// src/components/ChainPlanPanel.tsx
// Chain Plan for the CLIENTS module. Prospective applications are created by
// the chain engine (sql/24) when one of this client's applications is APPROVED
// — so the client record, not the lead, is where the chain lives.
// Anchor: prospective_applications.for_person_id = client id (engine v1 always
// writes the principal client there). Read-only v1: status workflow later.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link2, CalendarClock, Loader2 } from "lucide-react";
import { fmtDateIST } from "@/lib/format";
import { PathwayPlanCard } from "@/components/lead-detail/PathwayPlanCard";
import type { ApplicationRow, ProspectiveAppRow } from "@/lib/types";

interface Props {
  clientId: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-amber-100 text-amber-800",
  normal: "bg-slate-100 text-slate-600",
};

const STATUS_COLORS: Record<string, string> = {
  proposed: "bg-amber-100 text-amber-800",
  pending_counselor_action: "bg-amber-100 text-amber-800",
  client_contacted: "bg-sky-100 text-sky-700",
  client_consented: "bg-emerald-100 text-emerald-700",
  declined_by_client: "bg-slate-100 text-slate-500",
  expired: "bg-slate-100 text-slate-500",
  expired_missed: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};

type ProspRow = Omit<ProspectiveAppRow, "status"> & {
  status: string;
  notes?: string | null;
  target_label?: string | null;
};

export function ChainPlanPanel({ clientId }: Props) {
  // Prospective applications anchored on this client
  const { data: prospective = [], isLoading: loadingProsp } = useQuery<ProspRow[]>({
    queryKey: ["client-chain-plan", clientId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("prospective_applications")
        .select("*, chain_rule:triggered_by_rule(rule_code, description, counselor_script, sla_days, priority)")
        .eq("for_person_id", clientId)
        .neq("status", "converted_to_case")
        .order("trigger_date", { ascending: true });
      if (error) { console.warn("[ChainPlanPanel]", error.message); return []; }
      const rows = (data ?? []) as ProspRow[];

      // Resolve target_application_type codes → visa_types labels
      const codes = Array.from(new Set(rows.map(r => r.target_application_type).filter(Boolean)));
      if (codes.length > 0) {
        const { data: vts } = await supabase.from("visa_types").select("code, label").in("code", codes);
        const labelMap = new Map((vts ?? []).map(v => [v.code, v.label]));
        return rows.map(r => ({ ...r, target_label: labelMap.get(r.target_application_type) ?? r.target_application_type }));
      }
      return rows;
    },
    enabled: !!clientId,
  });

  // This client's applications, for the pathway visual
  const { data: applications = [] } = useQuery<ApplicationRow[]>({
    queryKey: ["client-chain-cases", clientId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("cases")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });
      if (error) { console.warn("[ChainPlanPanel cases]", error.message); return []; }
      const rows = (data ?? []) as ApplicationRow[];

      // Resolve visa labels for nicer step titles
      const ids = Array.from(new Set(rows.map(r => (r as unknown as { visa_type_id?: string }).visa_type_id).filter(Boolean))) as string[];
      if (ids.length > 0) {
        const { data: vts } = await supabase.from("visa_types").select("id, label").in("id", ids);
        const m = new Map((vts ?? []).map(v => [v.id, v.label]));
        return rows.map(r => ({ ...r, visa_type_name: m.get((r as unknown as { visa_type_id?: string }).visa_type_id ?? "") ?? null }));
      }
      return rows;
    },
    enabled: !!clientId,
  });

  if (loadingProsp) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading chain plan…
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Visual journey */}
      <PathwayPlanCard
        applications={applications}
        prospective={prospective as unknown as ProspectiveAppRow[]}
        expanded
      />

      {/* Prospective application cards */}
      <div className="flex flex-col gap-3">
        {prospective.length === 0 ? (
          <Card className="p-6 text-center">
            <Link2 className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium mb-1">No chain items yet</p>
            <p className="text-xs text-muted-foreground">
              Chain rules fire automatically when one of this client&apos;s applications
              is <span className="font-medium">approved</span> — the next recommended
              applications will appear here with a counselor talk-track.
            </p>
          </Card>
        ) : (
          prospective.map((p) => {
            const priority = p.chain_rule?.priority ?? "normal";
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{p.target_label ?? p.target_application_type}</p>
                    {p.chain_rule?.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{p.chain_rule.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.normal}`}>
                      {priority}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${STATUS_COLORS[p.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {p.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="w-3 h-3" />
                    Triggers {fmtDateIST(p.trigger_date)}
                  </span>
                  {p.expires_on && <span>Window closes {fmtDateIST(p.expires_on)}</span>}
                  {p.estimated_fee_cad != null && Number(p.estimated_fee_cad) > 0 && (
                    <span>Est. fee ₹{Number(p.estimated_fee_cad).toLocaleString("en-IN")}</span>
                  )}
                  {p.chain_rule?.rule_code && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {p.chain_rule.rule_code}
                    </Badge>
                  )}
                </div>

                {(p.notes || p.chain_rule?.counselor_script) && (
                  <blockquote className="mt-2.5 border-l-2 border-amber-300 bg-amber-50/60 rounded-r-md px-3 py-2 text-xs text-amber-900">
                    <span className="block text-[10px] uppercase tracking-wide text-amber-700 font-medium mb-0.5">
                      Counselor talk-track
                    </span>
                    {p.notes || p.chain_rule?.counselor_script}
                  </blockquote>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
