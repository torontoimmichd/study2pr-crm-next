"use client";

import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { AlarmClock, PhoneMissed, CalendarX2, Flame, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { TableSkeleton } from "@/components/TableSkeleton";
import { fmtRelative, fmtDateTimeIST } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// ─── types ────────────────────────────────────────────────────────────────────

interface StaffRow {
  counselor_name: string;
  assigned_to: string | null;
  active_leads: number;
  leads_no_next_action: number;
  leads_overdue: number;
  first_response_breaches: number;
  untouched_3d: number;
  untouched_7d: number;
  worst_untouched_days: number;
  avg_days_since_touch: number;
}

interface LeadRow {
  lead_id: string;
  full_name: string;
  stage: string;
  counselor_name: string | null;
  last_touch_at: string | null;
  days_since_touch: number;
  next_action_at: string | null;
  open_tasks: number;
  overdue_tasks: number;
  no_next_action: boolean;
  next_action_overdue: boolean;
  first_response_breached: boolean;
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function FollowupIntegrity() {
  const [untouchedDays, setUntouchedDays] = useState("3");
  const [staffFilter, setStaffFilter] = useState("__all");

  const { data: staff, isLoading: staffLoading } = useQuery({
    queryKey: ["fi-staff"],
    queryFn: async (): Promise<StaffRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("v_followup_integrity_by_staff")
        .select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["fi-leads", staffFilter],
    queryFn: async (): Promise<LeadRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from("v_followup_integrity")
        .select("*")
        .order("days_since_touch", { ascending: false })
        .limit(300);
      if (staffFilter !== "__all") q = q.eq("assigned_to", staffFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const threshold = Number(untouchedDays);
  const totals = (staff ?? []).reduce(
    (a, s) => ({
      active: a.active + s.active_leads,
      noNext: a.noNext + s.leads_no_next_action,
      overdue: a.overdue + s.leads_overdue,
      breaches: a.breaches + s.first_response_breaches,
    }),
    { active: 0, noNext: 0, overdue: 0, breaches: 0 },
  );
  const untouchedCount = (leads ?? []).filter((l) => l.days_since_touch >= threshold).length;
  const problemLeads = (leads ?? []).filter(
    (l) => l.no_next_action || l.next_action_overdue || l.first_response_breached || l.days_since_touch >= threshold,
  );

  return (
    <>
      <PageHeader
        title="Follow-up Integrity"
        subtitle="Every active lead must have a next action. This page shows where that promise is broken."
        actions={
          <div className="flex items-center gap-2">
            <Select value={untouchedDays} onValueChange={setUntouchedDays}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">Untouched 2+ days</SelectItem>
                <SelectItem value="3">Untouched 3+ days</SelectItem>
                <SelectItem value="5">Untouched 5+ days</SelectItem>
                <SelectItem value="7">Untouched 7+ days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="All counselors" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All counselors</SelectItem>
                {(staff ?? []).filter((s) => s.assigned_to).map((s) => (
                  <SelectItem key={s.assigned_to} value={s.assigned_to as string}>{s.counselor_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi icon={<Users className="w-4 h-4" />} label="Active leads" value={totals.active} tone="default" />
          <Kpi icon={<CalendarX2 className="w-4 h-4" />} label="No next action" value={totals.noNext} tone={totals.noNext > 0 ? "red" : "green"} />
          <Kpi icon={<AlarmClock className="w-4 h-4" />} label="Next action overdue" value={totals.overdue} tone={totals.overdue > 0 ? "red" : "green"} />
          <Kpi icon={<PhoneMissed className="w-4 h-4" />} label="1st-response breaches" value={totals.breaches} tone={totals.breaches > 0 ? "red" : "green"} />
          <Kpi icon={<Flame className="w-4 h-4" />} label={`Untouched ${threshold}+ days`} value={untouchedCount} tone={untouchedCount > 0 ? "amber" : "green"} />
        </div>

        {/* Counselor scoreboard */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Counselor scoreboard</h2>
          {staffLoading ? <TableSkeleton rows={3} /> : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-2">Counselor</th>
                    <th className="px-4 py-2 text-right">Active</th>
                    <th className="px-4 py-2 text-right">No next action</th>
                    <th className="px-4 py-2 text-right">Overdue</th>
                    <th className="px-4 py-2 text-right">1st-resp. breach</th>
                    <th className="px-4 py-2 text-right">Untouched 3d/7d</th>
                    <th className="px-4 py-2 text-right">Worst (days)</th>
                    <th className="px-4 py-2 text-right">Avg (days)</th>
                  </tr>
                </thead>
                <tbody>
                  {(staff ?? []).map((s) => (
                    <tr key={s.assigned_to ?? "unassigned"} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{s.counselor_name}</td>
                      <td className="px-4 py-2 text-right">{s.active_leads}</td>
                      <td className={`px-4 py-2 text-right ${s.leads_no_next_action > 0 ? "text-destructive font-semibold" : ""}`}>{s.leads_no_next_action}</td>
                      <td className={`px-4 py-2 text-right ${s.leads_overdue > 0 ? "text-destructive font-semibold" : ""}`}>{s.leads_overdue}</td>
                      <td className={`px-4 py-2 text-right ${s.first_response_breaches > 0 ? "text-destructive font-semibold" : ""}`}>{s.first_response_breaches}</td>
                      <td className="px-4 py-2 text-right">{s.untouched_3d} / {s.untouched_7d}</td>
                      <td className="px-4 py-2 text-right">{s.worst_untouched_days}</td>
                      <td className="px-4 py-2 text-right">{s.avg_days_since_touch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Problem leads */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">
            Leads needing attention ({problemLeads.length})
          </h2>
          {leadsLoading ? <TableSkeleton rows={6} /> : problemLeads.length === 0 ? (
            <div className="rounded-lg border border-border p-8 text-center text-muted-foreground">
              Every active lead has a scheduled next action. Discipline: perfect.
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-2">Lead</th>
                    <th className="px-4 py-2">Stage</th>
                    <th className="px-4 py-2">Counselor</th>
                    <th className="px-4 py-2">Last touch</th>
                    <th className="px-4 py-2">Next action</th>
                    <th className="px-4 py-2">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {problemLeads.map((l) => (
                    <tr key={l.lead_id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <Link to={`/leads/${l.lead_id}`} className="font-medium text-primary hover:underline">
                          {l.full_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 capitalize">{(l.stage ?? "").replace(/_/g, " ")}</td>
                      <td className="px-4 py-2">{l.counselor_name ?? <span className="text-muted-foreground">Unassigned</span>}</td>
                      <td className="px-4 py-2" title={fmtDateTimeIST(l.last_touch_at)}>
                        {fmtRelative(l.last_touch_at)}
                        <span className="text-muted-foreground"> ({l.days_since_touch}d)</span>
                      </td>
                      <td className="px-4 py-2">
                        {l.next_action_at ? fmtDateTimeIST(l.next_action_at) : <span className="text-destructive font-medium">none scheduled</span>}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {l.no_next_action && <Badge variant="destructive">No next action</Badge>}
                          {l.next_action_overdue && <Badge variant="destructive">Overdue</Badge>}
                          {l.first_response_breached && <Badge variant="destructive">1st response missed</Badge>}
                          {l.days_since_touch >= threshold && <Badge variant="secondary">Untouched {l.days_since_touch}d</Badge>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

// ─── small KPI card ───────────────────────────────────────────────────────────

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "default" | "red" | "amber" | "green" }) {
  const toneClass =
    tone === "red" ? "text-destructive" :
    tone === "amber" ? "text-amber-600" :
    tone === "green" ? "text-emerald-600" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}
