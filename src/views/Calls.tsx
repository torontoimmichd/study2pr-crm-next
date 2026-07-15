"use client";

import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Plus, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { fmtRelative, fmtDateTimeIST } from "@/lib/format";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogCallDialog } from "@/components/LogCallDialog";
import { useAuth } from "@/lib/auth-context";

// ─── types ────────────────────────────────────────────────────────────────────

interface CallRow {
  id: string;
  direction: string;
  outcome: string;
  duration_seconds: number | null;
  emotional_state: string | null;
  objection: string | null;
  promise_made: string | null;
  next_step: string | null;
  next_contact_at: string | null;
  notes: string | null;
  called_at: string;
  lead_id: string | null;
  case_id: string | null;
  staff_id: string | null;
  // resolved
  lead_name?: string | null;
  case_code?: string | null;
  case_client?: string | null;
  staff_name?: string | null;
}

// ─── label maps ───────────────────────────────────────────────────────────────

const OUTCOME_LABELS: Record<string, string> = {
  connected:          "Connected",
  connected_brief:    "Brief / VM",
  no_answer:          "No answer",
  busy:               "Busy",
  wrong_number:       "Wrong number",
  callback_requested: "Callback req.",
  disconnected:       "Disconnected",
};

const EMOTION_LABELS: Record<string, string> = {
  very_positive: "Very positive",
  positive:      "Positive",
  neutral:       "Neutral",
  hesitant:      "Hesitant",
  negative:      "Negative",
  very_negative: "Very negative",
};

const EMOTION_COLOR: Record<string, string> = {
  very_positive: "text-green-600",
  positive:      "text-green-500",
  neutral:       "text-muted-foreground",
  hesitant:      "text-yellow-600",
  negative:      "text-orange-600",
  very_negative: "text-destructive",
};

function fmtDuration(secs: number | null): string {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── component ───────────────────────────────────────────────────────────────

export default function Calls() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [outcomeFilter, setOutcomeFilter] = useState("__all");
  const [staffFilter, setStaffFilter] = useState("__all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: staff } = useQuery({
    queryKey: ["staff-active"],
    queryFn: async () => {
      const { data } = await supabase.from("staff_profiles").select("id, full_name").eq("is_active", true).order("full_name");
      return data ?? [];
    },
  });

  const { data: calls, isLoading } = useQuery({
    queryKey: ["call-logs", outcomeFilter, staffFilter],
    queryFn: async (): Promise<CallRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from("call_logs")
        .select("id, direction, outcome, duration_seconds, emotional_state, objection, promise_made, next_step, next_contact_at, notes, called_at, lead_id, case_id, staff_id")
        .order("called_at", { ascending: false })
        .limit(200);

      if (outcomeFilter !== "__all") q = q.eq("outcome", outcomeFilter);
      if (staffFilter !== "__all") q = q.eq("staff_id", staffFilter);

      const { data: rows } = await q;
      if (!rows || rows.length === 0) return [];

      // Resolve staff names
      const staffIds = Array.from(new Set(rows.map((r: CallRow) => r.staff_id).filter(Boolean) as string[]));
      let staffMap = new Map<string, string>();
      if (staffIds.length) {
        const { data: sr } = await supabase.from("staff_profiles").select("id, full_name").in("id", staffIds);
        staffMap = new Map((sr ?? []).map((s) => [s.id, s.full_name]));
      }

      // Resolve lead names
      const leadIds = Array.from(new Set(rows.map((r: CallRow) => r.lead_id).filter(Boolean) as string[]));
      let leadMap = new Map<string, string>();
      if (leadIds.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: lr } = await (supabase as any).from("leads").select("id, full_name").in("id", leadIds);
        leadMap = new Map((lr ?? []).map((l: { id: string; full_name: string }) => [l.id, l.full_name]));
      }

      // Resolve case codes + client names
      const caseIds = Array.from(new Set(rows.map((r: CallRow) => r.case_id).filter(Boolean) as string[]));
      let caseMap = new Map<string, { code: string; client: string }>();
      if (caseIds.length) {
        const { data: cr } = await supabase.from("cases").select("id, case_code, client_id").in("id", caseIds);
        const clientIds = Array.from(new Set((cr ?? []).map((c) => c.client_id)));
        const { data: cls } = clientIds.length
          ? await supabase.from("clients").select("id, full_name").in("id", clientIds)
          : { data: [] };
        const clMap = new Map((cls ?? []).map((c) => [c.id, c.full_name]));
        caseMap = new Map((cr ?? []).map((c) => [c.id, { code: c.case_code ?? c.id.slice(0, 8), client: clMap.get(c.client_id) ?? "—" }]));
      }

      return rows.map((r: CallRow) => ({
        ...r,
        staff_name: r.staff_id ? staffMap.get(r.staff_id) ?? null : null,
        lead_name: r.lead_id ? leadMap.get(r.lead_id) ?? null : null,
        case_code: r.case_id ? caseMap.get(r.case_id)?.code ?? null : null,
        case_client: r.case_id ? caseMap.get(r.case_id)?.client ?? null : null,
      }));
    },
  });

  const isConnected = (outcome: string) =>
    ["connected", "connected_brief", "callback_requested"].includes(outcome);

  return (
    <div>
      <PageHeader
        title="Call Log"
        subtitle="All calls logged across leads and cases"
        actions={
          <Button onClick={() => setDialogOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-1.5" /> Log call
          </Button>
        }
      />

      <div className="p-6 space-y-4 max-w-[1400px]">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue placeholder="All outcomes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All outcomes</SelectItem>
              {Object.entries(OUTCOME_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(profile?.role === "owner" || profile?.role === "admin" || profile?.role === "senior_advisor") && (
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue placeholder="All staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All staff</SelectItem>
                {staff?.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Table */}
        <div className="card-surface overflow-hidden">
          {isLoading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : !calls?.length ? (
            <div className="p-14 text-center">
              <Phone className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No calls logged yet.</p>
              <Button onClick={() => setDialogOpen(true)} className="mt-4 bg-primary hover:bg-primary/90" size="sm">
                Log your first call
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium w-8" />
                  <th className="text-left px-4 py-3 font-medium">Contact</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Outcome</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Notes / Next step</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Staff</th>
                  <th className="text-left px-4 py-3 font-medium">When</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Duration</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => {
                  const connected = isConnected(c.outcome);
                  return (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                      {/* Direction icon */}
                      <td className="px-4 py-3">
                        {c.outcome === "no_answer" || c.outcome === "busy" ? (
                          <PhoneMissed className="h-4 w-4 text-destructive" />
                        ) : c.direction === "inbound" ? (
                          <PhoneIncoming className="h-4 w-4 text-green-500" />
                        ) : (
                          <PhoneOutgoing className="h-4 w-4 text-primary" />
                        )}
                      </td>

                      {/* Contact (lead or case) */}
                      <td className="px-4 py-3">
                        {c.lead_name && c.lead_id && (
                          <Link to={`/leads/${c.lead_id}`} className="font-medium hover:text-accent block">{c.lead_name}</Link>
                        )}
                        {c.case_client && c.case_id && (
                          <Link to={`/cases/${c.case_id}`} className="font-medium hover:text-accent block">
                            {c.case_client} · <span className="text-muted-foreground text-xs">{c.case_code}</span>
                          </Link>
                        )}
                        {!c.lead_name && !c.case_client && (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                        {c.emotional_state && connected && (
                          <span className={`text-xs ${EMOTION_COLOR[c.emotional_state] ?? ""}`}>
                            {EMOTION_LABELS[c.emotional_state] ?? c.emotional_state}
                          </span>
                        )}
                      </td>

                      {/* Outcome */}
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${connected ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                          {OUTCOME_LABELS[c.outcome] ?? c.outcome}
                        </span>
                      </td>

                      {/* Notes / Next step */}
                      <td className="px-4 py-3 hidden md:table-cell max-w-xs">
                        {c.next_step && (
                          <div className="text-xs font-medium text-foreground line-clamp-1">→ {c.next_step}</div>
                        )}
                        {c.notes && (
                          <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{c.notes}</div>
                        )}
                        {c.next_contact_at && (
                          <div className="text-[11px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            Follow-up {fmtRelative(c.next_contact_at)}
                          </div>
                        )}
                        {!c.next_step && !c.notes && <span className="text-muted-foreground text-xs">—</span>}
                      </td>

                      {/* Staff */}
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                        {c.staff_name ?? "—"}
                      </td>

                      {/* When */}
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {fmtDateTimeIST(c.called_at)}
                        <div className="text-[11px] text-muted-foreground/60">{fmtRelative(c.called_at)}</div>
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground">
                        {fmtDuration(c.duration_seconds)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {calls && calls.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">{calls.length} call{calls.length !== 1 ? "s" : ""} shown</p>
        )}
      </div>

      <LogCallDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onLogged={() => void qc.invalidateQueries({ queryKey: ["call-logs"] })}
      />
    </div>
  );
}
