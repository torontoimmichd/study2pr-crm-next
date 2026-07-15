"use client";

/**
 * ManagerDigest.tsx
 * Owner/Admin-only daily summary view.
 * Shows: overdue tasks by staff, lead flags, stuck cases, overdue invoices, recent conversions.
 */

import { Link } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutList, Clock, UserX, Briefcase, IndianRupee, TrendingUp, ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { fmtRelative, fmtDateIST, fmtMoney } from "@/lib/format";
import { LeadStatusPill } from "@/components/StatusPill";

// ─── helpers ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function daysAgo(d: number) {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
}
function daysFromNow(d: number) {
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString();
}
function weeksAgo(w: number) {
  return new Date(Date.now() - w * 7 * 24 * 60 * 60 * 1000).toISOString();
}

// ─── component ───────────────────────────────────────────────────────────────

export default function ManagerDigest() {
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div>
      <PageHeader
        title="Manager Digest"
        subtitle={today}
      />

      <div className="p-6 space-y-6 max-w-[1400px]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OverdueTasksByStaff />
          <LeadFlagSummary />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StuckCases />
          <OverdueInvoices />
        </div>
        <RecentConversions />
      </div>
    </div>
  );
}

// ─── Overdue tasks by staff ───────────────────────────────────────────────────

function OverdueTasksByStaff() {
  const { data, isLoading } = useQuery({
    queryKey: ["digest-overdue-tasks"],
    queryFn: async () => {
      const { data: tasks } = await db
        .from("tasks")
        .select("id, title, due_at, assigned_to, lead_id, case_id")
        .is("completed_at", null)
        .not("due_at", "is", null)
        .lt("due_at", new Date().toISOString())
        .order("due_at", { ascending: true })
        .limit(200);

      if (!tasks?.length) return [];

      const staffIds = Array.from(new Set(tasks.map((t: { assigned_to: string | null }) => t.assigned_to).filter(Boolean) as string[]));
      let staffMap = new Map<string, string>();
      if (staffIds.length) {
        const { data: sr } = await supabase.from("staff_profiles").select("id, full_name").in("id", staffIds);
        staffMap = new Map((sr ?? []).map((s) => [s.id, s.full_name]));
      }

      // Group by staff
      const byStaff = new Map<string, { name: string; tasks: typeof tasks }>();
      for (const t of tasks) {
        const key = t.assigned_to ?? "__unassigned";
        const name = t.assigned_to ? staffMap.get(t.assigned_to) ?? "Unknown" : "Unassigned";
        if (!byStaff.has(key)) byStaff.set(key, { name, tasks: [] });
        byStaff.get(key)!.tasks.push(t);
      }

      return Array.from(byStaff.values()).sort((a, b) => b.tasks.length - a.tasks.length);
    },
  });

  return (
    <Section title="Overdue Tasks by Staff" icon={<Clock className="h-4 w-4 text-destructive" />} count={data?.reduce((s, g) => s + g.tasks.length, 0)}>
      {isLoading ? <Skeleton /> : !data?.length ? (
        <p className="text-sm text-muted-foreground">No overdue tasks.</p>
      ) : (
        <div className="space-y-3">
          {data.map((group) => (
            <div key={group.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{group.name}</span>
                <span className="text-xs text-destructive font-medium">{group.tasks.length} overdue</span>
              </div>
              <div className="space-y-1 pl-2 border-l-2 border-destructive/20">
                {group.tasks.slice(0, 3).map((t: { id: string; title: string; due_at: string; lead_id: string | null; case_id: string | null }) => (
                  <div key={t.id} className="flex items-center justify-between text-xs">
                    <span className="text-foreground truncate max-w-[200px]">{t.title}</span>
                    <span className="text-muted-foreground shrink-0 ml-2">{fmtRelative(t.due_at)}</span>
                  </div>
                ))}
                {group.tasks.length > 3 && (
                  <Link to="/tasks?filter=overdue" className="text-xs text-accent hover:underline">
                    +{group.tasks.length - 3} more →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ─── Lead flag summary ────────────────────────────────────────────────────────

function LeadFlagSummary() {
  const { data, isLoading } = useQuery({
    queryKey: ["digest-lead-flags"],
    queryFn: async () => {
      const [noCall, stale, noTask] = await Promise.all([
        db.from("leads").select("id, full_name", { count: "exact" })
          .eq("lifecycle_state", "new_enquiry")
          .lt("created_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()),
        db.from("leads").select("id, full_name", { count: "exact" })
          .in("lifecycle_state", ["contacted", "assessed", "proposal_sent", "negotiating"])
          .lt("updated_at", daysAgo(3)),
        db.from("leads").select("id, full_name")
          .in("lifecycle_state", ["new_enquiry", "contacted", "assessed", "proposal_sent"])
          .limit(500),
      ]);

      // find leads with no open task
      let noTaskCount = 0;
      if (noTask.data?.length) {
        const ids = noTask.data.map((l: { id: string }) => l.id);
        const { data: openTasks } = await supabase.from("tasks").select("lead_id").in("lead_id", ids).is("completed_at", null).eq("status_code", "open");
        const withTask = new Set((openTasks ?? []).map((t) => t.lead_id));
        noTaskCount = ids.filter((id: string) => !withTask.has(id)).length;
      }

      return {
        noCallSla: noCall.count ?? 0,
        staleLeads: stale.count ?? 0,
        noTask: noTaskCount,
        noCallSamples: (noCall.data ?? []).slice(0, 5),
        staleSamples: (stale.data ?? []).slice(0, 5),
      };
    },
  });

  return (
    <Section title="Lead Health Flags" icon={<UserX className="h-4 w-4 text-orange-500" />}>
      {isLoading ? <Skeleton /> : !data ? null : (
        <div className="space-y-4">
          <FlagRow
            label="New leads — SLA breach (not called in 2h)"
            count={data.noCallSla}
            severity="critical"
            samples={data.noCallSamples}
            linkTo="/leads?status=new_enquiry"
            leadLinkFn={(l) => `/leads/${l.id}`}
          />
          <FlagRow
            label="Active leads — no update in 3+ days"
            count={data.staleLeads}
            severity="warning"
            samples={data.staleSamples}
            linkTo="/leads"
            leadLinkFn={(l) => `/leads/${l.id}`}
          />
          <div className="flex items-center justify-between py-2 border-t border-border">
            <span className="text-sm text-muted-foreground">Active leads with no open task</span>
            <span className={`text-sm font-semibold ${data.noTask > 0 ? "text-orange-500" : "text-success"}`}>
              {data.noTask}
            </span>
          </div>
        </div>
      )}
    </Section>
  );
}

// ─── Stuck cases ──────────────────────────────────────────────────────────────

function StuckCases() {
  const { data, isLoading } = useQuery({
    queryKey: ["digest-stuck-cases"],
    queryFn: async () => {
      const { data: cases } = await supabase
        .from("cases")
        .select("id, case_code, client_id, current_stage_code, updated_at, target_submission_date, priority")
        .eq("is_archived", false)
        .lt("updated_at", weeksAgo(3))
        .order("updated_at", { ascending: true })
        .limit(20);

      if (!cases?.length) return [];

      const clientIds = Array.from(new Set(cases.map((c) => c.client_id)));
      const { data: clients } = await supabase.from("clients").select("id, full_name").in("id", clientIds);
      const cMap = new Map((clients ?? []).map((c) => [c.id, c.full_name]));

      return cases.map((c) => ({ ...c, client_name: cMap.get(c.client_id) ?? "—" }));
    },
  });

  return (
    <Section title="Stuck Cases (3+ weeks idle)" icon={<Briefcase className="h-4 w-4 text-yellow-600" />} count={data?.length}>
      {isLoading ? <Skeleton /> : !data?.length ? (
        <p className="text-sm text-muted-foreground">All cases updated within 3 weeks.</p>
      ) : (
        <div className="space-y-2">
          {data.map((c) => (
            <Link
              key={c.id}
              to={`/cases/${c.id}`}
              className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/40 transition-colors group"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{c.client_name}</div>
                <div className="text-xs text-muted-foreground capitalize">{c.current_stage_code?.replace(/_/g, " ")} · {c.case_code}</div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <div className="text-xs text-yellow-600">{fmtRelative(c.updated_at ?? "")}</div>
                {c.target_submission_date && (
                  <div className="text-[11px] text-muted-foreground">target {fmtDateIST(c.target_submission_date)}</div>
                )}
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}

// ─── Overdue invoices ─────────────────────────────────────────────────────────

function OverdueInvoices() {
  const { data, isLoading } = useQuery({
    queryKey: ["digest-overdue-invoices"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data: invs } = await db
        .from("invoices")
        .select("id, invoice_number, total, currency, due_date, status, client_id, case_id")
        .in("status", ["sent", "overdue"])
        .not("due_date", "is", null)
        .lt("due_date", today)
        .order("due_date", { ascending: true })
        .limit(20);

      if (!invs?.length) return { items: [], total: 0 };

      const clientIds = Array.from(new Set(invs.map((i: { client_id: string }) => i.client_id).filter(Boolean) as string[]));
      const { data: clients } = await supabase.from("clients").select("id, full_name").in("id", clientIds);
      const cMap = new Map((clients ?? []).map((c) => [c.id, c.full_name]));

      const totalInr = invs.filter((i: { currency: string }) => i.currency === "INR").reduce((s: number, i: { total: number }) => s + Number(i.total), 0);

      return {
        items: invs.map((i: { id: string; invoice_number: string; total: number; currency: string; due_date: string; client_id: string; case_id: string }) => ({
          ...i,
          client_name: cMap.get(i.client_id) ?? "—",
        })),
        total: totalInr,
      };
    },
  });

  return (
    <Section title="Overdue Invoices" icon={<IndianRupee className="h-4 w-4 text-destructive" />} count={data?.items?.length}>
      {isLoading ? <Skeleton /> : !data?.items?.length ? (
        <p className="text-sm text-muted-foreground">No overdue invoices.</p>
      ) : (
        <div className="space-y-2">
          {data.total > 0 && (
            <div className="text-sm font-semibold text-destructive mb-3">
              Total outstanding (INR): {fmtMoney(data.total, "INR")}
            </div>
          )}
          {data.items.map((inv: { id: string; invoice_number: string; total: number; currency: string; due_date: string; client_name: string; case_id: string }) => (
            <Link
              key={inv.id}
              to={`/cases/${inv.case_id}`}
              className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/40 transition-colors group"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{inv.client_name}</div>
                <div className="text-xs text-muted-foreground">{inv.invoice_number}</div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <div className="text-sm font-medium text-destructive">{fmtMoney(Number(inv.total), inv.currency)}</div>
                <div className="text-[11px] text-muted-foreground">due {fmtDateIST(inv.due_date)}</div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}

// ─── Recent conversions ───────────────────────────────────────────────────────

function RecentConversions() {
  const { data, isLoading } = useQuery({
    queryKey: ["digest-conversions"],
    queryFn: async () => {
      const { data: leads } = await db
        .from("leads")
        .select("id, full_name, converted_at, converted_client_id, source_code")
        .eq("lifecycle_state", "converted")
        .gte("converted_at", daysAgo(30))
        .order("converted_at", { ascending: false })
        .limit(10);
      return leads ?? [];
    },
  });

  if (!data?.length && !isLoading) return null;

  return (
    <Section title="Conversions — last 30 days" icon={<TrendingUp className="h-4 w-4 text-success" />} count={data?.length}>
      {isLoading ? <Skeleton /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {data!.map((l: { id: string; full_name: string; converted_at: string; converted_client_id: string; source_code: string }) => (
            <Link
              key={l.id}
              to={`/clients/${l.converted_client_id}`}
              className="flex items-center justify-between py-2 px-3 rounded-md bg-success/5 border border-success/20 hover:bg-success/10 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{l.full_name}</div>
                <div className="text-xs text-muted-foreground">{fmtRelative(l.converted_at)}</div>
              </div>
              <LeadStatusPill status="converted" />
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}

// ─── shared sub-components ────────────────────────────────────────────────────

function Section({
  title, icon, count, children,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="card-surface p-5 space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-display text-base text-navy">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive/15 text-destructive text-[10px] font-bold">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function FlagRow({
  label, count, severity, samples, linkTo, leadLinkFn,
}: {
  label: string;
  count: number;
  severity: "critical" | "warning";
  samples: { id: string; full_name: string }[];
  linkTo: string;
  leadLinkFn: (l: { id: string; full_name: string }) => string;
}) {
  const color = severity === "critical" ? "text-destructive" : "text-yellow-600";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Link to={linkTo} className={`text-sm font-semibold ${color} hover:underline`}>{count}</Link>
      </div>
      {count > 0 && samples.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {samples.map((l) => (
            <Link key={l.id} to={leadLinkFn(l)} className="text-xs px-2 py-0.5 rounded-full bg-muted hover:bg-muted/70 text-foreground truncate max-w-[120px]">
              {l.full_name}
            </Link>
          ))}
          {count > samples.length && (
            <Link to={linkTo} className="text-xs text-accent hover:underline">+{count - samples.length} more</Link>
          )}
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-muted rounded" />)}
    </div>
  );
}

// suppress unused
LayoutList;
