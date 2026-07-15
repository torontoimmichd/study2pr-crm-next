"use client";

import { useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { Users, Activity, Award, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TableSkeleton } from "@/components/TableSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { fmtRelative, fmtMoney, initials, fmtDateIST } from "@/lib/format";
import type { StaffRole } from "@/lib/auth-context";

const ROLE_LABEL: Record<StaffRole, string> = {
  owner: "Owner",
  admin: "Admin",
  senior_advisor: "Senior advisor",
  case_manager: "Case manager",
  document_specialist: "Document specialist",
  support: "Support",
  accountant: "Accountant",
};

// Roles × modules permission matrix (mirrors AppSidebar visibility)
const PERMISSIONS: { module: string; roles: StaffRole[] }[] = [
  { module: "Dashboard", roles: ["owner", "admin", "senior_advisor", "case_manager", "document_specialist", "support", "accountant"] },
  { module: "Leads", roles: ["owner", "admin", "senior_advisor", "case_manager", "support"] },
  { module: "Clients", roles: ["owner", "admin", "senior_advisor", "case_manager", "document_specialist"] },
  { module: "Cases", roles: ["owner", "admin", "senior_advisor", "case_manager", "document_specialist"] },
  { module: "Tasks", roles: ["owner", "admin", "senior_advisor", "case_manager", "document_specialist", "support"] },
  { module: "Inbox", roles: ["owner", "admin", "senior_advisor", "case_manager"] },
  { module: "Messages", roles: ["owner", "admin", "senior_advisor", "case_manager", "support"] },
  { module: "Workflows", roles: ["owner", "admin", "senior_advisor"] },
  { module: "Finance", roles: ["owner", "admin", "accountant"] },
  { module: "HR / Team", roles: ["owner", "admin"] },
  { module: "Audit Log", roles: ["owner", "admin"] },
  { module: "Settings", roles: ["owner", "admin"] },
];

const ALL_ROLES: StaffRole[] = ["owner", "admin", "senior_advisor", "case_manager", "document_specialist", "support", "accountant"];

export default function HR() {
  const [tab, setTab] = useState("directory");

  // Stat cards
  const { data: stats } = useQuery({
    queryKey: ["hr-stats"],
    queryFn: async () => {
      const ninety = new Date();
      ninety.setDate(ninety.getDate() - 90);
      const [headcount, recent, openTasks, advisors] = await Promise.all([
        supabase.from("staff_profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("staff_profiles").select("id", { count: "exact", head: true }).gte("created_at", ninety.toISOString()),
        supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status_code", "done"),
        supabase.from("cases").select("case_manager_id").eq("is_archived", false).limit(5000),
      ]);
      const advisorCounts: Record<string, number> = {};
      (advisors.data ?? []).forEach((c) => {
        if (c.case_manager_id) advisorCounts[c.case_manager_id] = (advisorCounts[c.case_manager_id] ?? 0) + 1;
      });
      const advisorIds = Object.keys(advisorCounts);
      const avgCaseLoad = advisorIds.length ? Math.round((advisors.data?.length ?? 0) / advisorIds.length) : 0;
      return {
        headcount: headcount.count ?? 0,
        recentHires: recent.count ?? 0,
        openTasks: openTasks.count ?? 0,
        avgCaseLoad,
      };
    },
  });

  return (
    <div>
      <PageHeader title="HR / Team" subtitle="Headcount, performance, and access" />

      <div className="p-6 space-y-6 max-w-[1600px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active headcount" value={String(stats?.headcount ?? "—")} icon={<Users className="h-4 w-4" />} />
          <StatCard label="New hires (90d)" value={String(stats?.recentHires ?? "—")} icon={<Award className="h-4 w-4" />} />
          <StatCard label="Open tasks (team)" value={String(stats?.openTasks ?? "—")} icon={<Activity className="h-4 w-4" />} />
          <StatCard label="Avg case load / advisor" value={String(stats?.avgCaseLoad ?? "—")} icon={<ShieldCheck className="h-4 w-4" />} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="directory">Directory</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="permissions">Roles & permissions</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="directory" className="mt-4">
            <Directory />
          </TabsContent>
          <TabsContent value="performance" className="mt-4">
            <Performance />
          </TabsContent>
          <TabsContent value="permissions" className="mt-4">
            <PermissionsMatrix />
          </TabsContent>
          <TabsContent value="activity" className="mt-4">
            <StaffActivity />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Directory() {
  const { data, isLoading } = useQuery({
    queryKey: ["hr-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("id, full_name, email, role, phone, visa_specialties, is_active, last_login_at")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <TableSkeleton rows={6} cols={3} />;
  if (!data || data.length === 0) return <EmptyState title="No team members" description="Add staff in Admin → Staff & Roles." />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((s) => (
        <div key={s.id} className="card-surface p-5">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-base font-medium text-navy shrink-0">
              {initials(s.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium truncate">{s.full_name}</h3>
                {!s.is_active && (
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Inactive</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground capitalize">{ROLE_LABEL[s.role as StaffRole] ?? s.role.replace(/_/g, " ")}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{s.email}</p>
            </div>
          </div>
          {s.visa_specialties && s.visa_specialties.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {s.visa_specialties.slice(0, 4).map((v) => (
                <span key={v} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent">{v}</span>
              ))}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
            Last login: {s.last_login_at ? fmtRelative(s.last_login_at) : "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

function Performance() {
  const { data, isLoading } = useQuery({
    queryKey: ["hr-performance"],
    queryFn: async () => {
      const ninety = new Date();
      ninety.setDate(ninety.getDate() - 90);
      const ninetyIso = ninety.toISOString();

      const [staff, leads, cases, tasks, commissions, invoices] = await Promise.all([
        supabase.from("staff_profiles").select("id, full_name, role").eq("is_active", true),
        supabase.from("leads").select("assigned_to, lifecycle_state").gte("created_at", ninetyIso).limit(5000),
        supabase.from("cases").select("id, case_manager_id, senior_advisor_id").eq("is_archived", false).limit(5000),
        supabase.from("tasks").select("assigned_to, status_code, due_at, completed_at").gte("created_at", ninetyIso).limit(5000),
        supabase.from("commissions").select("staff_id, amount_inr").gte("earned_at", ninetyIso).limit(5000),
        supabase.from("invoices").select("paid_total, case_id").gt("paid_total", 0).limit(5000),
      ]);

      const caseAdvisor = new Map<string, string | null>(
        (cases.data ?? []).map((c) => [c.id, c.case_manager_id ?? c.senior_advisor_id ?? null]),
      );
      const advisorCount: Record<string, number> = {};
      (cases.data ?? []).forEach((c) => {
        const aid = c.case_manager_id ?? c.senior_advisor_id;
        if (aid) advisorCount[aid] = (advisorCount[aid] ?? 0) + 1;
      });

      const leadsByStaff: Record<string, { total: number; converted: number }> = {};
      (leads.data ?? []).forEach((l) => {
        if (!l.assigned_to) return;
        leadsByStaff[l.assigned_to] = leadsByStaff[l.assigned_to] ?? { total: 0, converted: 0 };
        leadsByStaff[l.assigned_to].total += 1;
        if (l.lifecycle_state === "converted") leadsByStaff[l.assigned_to].converted += 1;
      });

      const tasksByStaff: Record<string, { done: number; onTime: number }> = {};
      (tasks.data ?? []).forEach((t) => {
        if (!t.assigned_to || t.status_code !== "done" || !t.completed_at) return;
        tasksByStaff[t.assigned_to] = tasksByStaff[t.assigned_to] ?? { done: 0, onTime: 0 };
        tasksByStaff[t.assigned_to].done += 1;
        if (!t.due_at || new Date(t.completed_at) <= new Date(t.due_at)) {
          tasksByStaff[t.assigned_to].onTime += 1;
        }
      });

      const commissionsByStaff: Record<string, number> = {};
      (commissions.data ?? []).forEach((c) => {
        if (c.staff_id) commissionsByStaff[c.staff_id] = (commissionsByStaff[c.staff_id] ?? 0) + Number(c.amount_inr ?? 0);
      });

      const revenueByStaff: Record<string, number> = {};
      (invoices.data ?? []).forEach((inv) => {
        const aid = inv.case_id ? caseAdvisor.get(inv.case_id) : null;
        if (aid) revenueByStaff[aid] = (revenueByStaff[aid] ?? 0) + Number(inv.paid_total ?? 0);
      });

      return (staff.data ?? []).map((s) => {
        const l = leadsByStaff[s.id] ?? { total: 0, converted: 0 };
        const t = tasksByStaff[s.id] ?? { done: 0, onTime: 0 };
        return {
          ...s,
          casesHandled: advisorCount[s.id] ?? 0,
          conversionRate: l.total ? Math.round((l.converted / l.total) * 100) : 0,
          tasksDone: t.done,
          onTimePct: t.done ? Math.round((t.onTime / t.done) * 100) : 0,
          revenue: Math.round(revenueByStaff[s.id] ?? 0),
          commissions: Math.round(commissionsByStaff[s.id] ?? 0),
        };
      });
    },
  });

  if (isLoading) return <TableSkeleton rows={5} cols={6} />;
  if (!data || data.length === 0) return <EmptyState title="No data" description="Performance metrics will appear with team activity." />;

  return (
    <div className="card-surface p-5">
      <div className="text-xs text-muted-foreground mb-3">Last 90 days</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="py-2 px-2">Staff</th>
              <th className="py-2 px-2 text-right">Cases</th>
              <th className="py-2 px-2 text-right">Conversion</th>
              <th className="py-2 px-2 text-right">Tasks done</th>
              <th className="py-2 px-2 text-right">On-time %</th>
              <th className="py-2 px-2 text-right">Revenue</th>
              <th className="py-2 px-2 text-right">Commissions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id} className="border-b border-border/60 hover:bg-muted/40">
                <td className="py-2 px-2">
                  <div className="font-medium">{s.full_name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{ROLE_LABEL[s.role as StaffRole] ?? s.role.replace(/_/g, " ")}</div>
                </td>
                <td className="py-2 px-2 text-right">{s.casesHandled}</td>
                <td className="py-2 px-2 text-right">{s.conversionRate}%</td>
                <td className="py-2 px-2 text-right">{s.tasksDone}</td>
                <td className="py-2 px-2 text-right">
                  <span className={s.onTimePct >= 80 ? "text-success" : s.onTimePct >= 50 ? "text-warning-foreground" : "text-destructive"}>
                    {s.onTimePct}%
                  </span>
                </td>
                <td className="py-2 px-2 text-right font-medium">{fmtMoney(s.revenue)}</td>
                <td className="py-2 px-2 text-right">{fmtMoney(s.commissions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PermissionsMatrix() {
  return (
    <div className="card-surface p-5 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-border">
            <th className="py-2 px-2 text-xs text-muted-foreground">Module</th>
            {ALL_ROLES.map((r) => (
              <th key={r} className="py-2 px-2 text-xs text-muted-foreground text-center capitalize whitespace-nowrap">
                {ROLE_LABEL[r]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSIONS.map((row) => (
            <tr key={row.module} className="border-b border-border/60">
              <td className="py-2 px-2 font-medium">{row.module}</td>
              {ALL_ROLES.map((r) => (
                <td key={r} className="py-2 px-2 text-center">
                  {row.roles.includes(r) ? (
                    <span className="inline-flex h-5 w-5 rounded-full bg-success/15 text-success items-center justify-center text-xs">✓</span>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground mt-4">
        Read-only summary. Backend access is enforced via Supabase RLS policies — UI visibility mirrors those rules.
      </p>
    </div>
  );
}

function StaffActivity() {
  const { data, isLoading } = useQuery({
    queryKey: ["hr-activity"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("audit_log")
        .select("id, action, entity_type, entity_id, occurred_at, actor_id, changes")
        .eq("actor_type", "staff")
        .order("occurred_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const ids = Array.from(new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean) as string[]));
      const { data: staff } = ids.length
        ? await supabase.from("staff_profiles").select("id, full_name, role").in("id", ids)
        : { data: [] };
      const map = new Map((staff ?? []).map((s) => [s.id, s]));
      return (rows ?? []).map((r) => ({
        ...r,
        actor: r.actor_id ? map.get(r.actor_id) ?? null : null,
      }));
    },
  });

  if (isLoading) return <TableSkeleton rows={6} cols={1} />;
  if (!data || data.length === 0) return <EmptyState title="No activity" description="Staff actions will show here." />;

  return (
    <div className="card-surface p-5">
      <ol className="space-y-3">
        {data.map((a) => (
          <li key={a.id} className="flex items-start gap-3 text-sm">
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-navy shrink-0">
              {initials(a.actor?.full_name ?? "?")}
            </div>
            <div className="flex-1 min-w-0">
              <div>
                <span className="font-medium">{a.actor?.full_name ?? "Unknown user"}</span>{" "}
                <span className="text-muted-foreground">{a.action.toLowerCase().replace(/_/g, " ")}</span>{" "}
                <span>{a.entity_type.replace(/_/g, " ")}</span>
              </div>
              {a.actor?.role && (
                <div className="text-xs text-muted-foreground capitalize">{ROLE_LABEL[a.actor.role as StaffRole] ?? a.actor.role}</div>
              )}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{fmtRelative(a.occurred_at)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between">
        <div className="stat-label">{label}</div>
        <div className="h-7 w-7 rounded-md bg-muted text-navy flex items-center justify-center">{icon}</div>
      </div>
      <div className="stat-value mt-2">{value}</div>
    </div>
  );
}

// Avoid unused import warning
void Link;
void useMemo;
void fmtDateIST;
