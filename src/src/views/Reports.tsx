"use client";

/**
 * Reports.tsx
 * Business intelligence reports for owners, admins, and senior advisors.
 * Route: /reports
 *
 * Sections:
 * 1. Lead pipeline — funnel by stage, new leads per month, by source pie
 * 2. Conversion — lead→client conversion rate, avg time to convert
 * 3. Case pipeline — cases by stage bar
 * 4. Staff performance — tasks completed, calls made, cases managed
 * 5. Revenue — monthly trend (mirrored from Finance but condensed)
 * 6. Referral partners — leads per partner
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { TrendingUp, Users, Briefcase, CheckSquare, Phone as PhoneIcon, DollarSign, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { fmtMoney } from "@/lib/format";

const db = supabase as any;

const COLORS = ["hsl(var(--primary))", "hsl(var(--gold))", "hsl(var(--accent))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))"];

function monthsAgoIso(n: number) {
  const d = new Date(); d.setMonth(d.getMonth() - n, 1); d.setHours(0,0,0,0); return d.toISOString();
}

export default function Reports() {
  return (
    <div>
      <PageHeader title="Reports" subtitle="Business intelligence across leads, cases, staff, and revenue" />
      <div className="p-6 space-y-8">
        <LeadFunnelSection />
        <LeadsBySourceSection />
        <MonthlyLeadsTrendSection />
        <ConversionSection />
        <CasePipelineSection />
        <StaffPerformanceSection />
        <ReferralPartnersSection />
        <RevenueTrendSection />
      </div>
    </div>
  );
}

// ─── 1. Lead Funnel ──────────────────────────────────────────────────────────

// PHASE2 lifecycle_state values — must match leads.lifecycle_state CHECK constraint
const STAGE_ORDER = [
  "new_enquiry", "contacted", "assessed", "proposal_sent", "negotiating",
  "waiting", "nurturing", "converted", "cold", "not_eligible", "lost",
];

const STAGE_LABELS: Record<string, string> = {
  new_enquiry:   "New Enquiry",
  contacted:     "Contacted",
  assessed:      "Assessed",
  proposal_sent: "Proposal Sent",
  negotiating:   "Negotiating",
  waiting:       "Waiting",
  nurturing:     "Nurturing",
  converted:     "Converted",
  cold:          "Cold",
  not_eligible:  "Not Eligible",
  lost:          "Lost",
};

function LeadFunnelSection() {
  const { data } = useQuery({
    queryKey: ["report-lead-funnel"],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("lifecycle_state");
      const counts: Record<string, number> = {};
      (data ?? []).forEach((l: any) => { counts[l.lifecycle_state] = (counts[l.lifecycle_state] ?? 0) + 1; });
      return STAGE_ORDER.map((s) => ({ stage: STAGE_LABELS[s] ?? s, count: counts[s] ?? 0 })).filter((r) => r.count > 0);
    },
  });

  return (
    <Section icon={<Users className="h-5 w-5" />} title="Lead Pipeline by Stage">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data ?? []} layout="vertical" margin={{ left: 100, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="stage" tick={{ fontSize: 12 }} width={100} />
            <Tooltip />
            <Bar dataKey="count" name="Leads" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

// ─── 2. Leads by Source ───────────────────────────────────────────────────────

function LeadsBySourceSection() {
  const { data } = useQuery({
    queryKey: ["report-leads-by-source"],
    queryFn: async () => {
      const { data: leads } = await supabase.from("leads").select("source_code");
      const { data: sources } = await supabase.from("lead_sources").select("code, label");
      const labelMap = new Map((sources ?? []).map((s: any) => [s.code, s.label]));
      const counts: Record<string, number> = {};
      (leads ?? []).forEach((l: any) => { const key = l.source_code ?? "unknown"; counts[key] = (counts[key] ?? 0) + 1; });
      return Object.entries(counts)
        .map(([code, value]) => ({ name: labelMap.get(code) ?? code, value }))
        .sort((a, b) => b.value - a.value);
    },
  });

  return (
    <Section icon={<TrendingUp className="h-5 w-5" />} title="Leads by Source">
      <div className="flex items-center gap-8">
        <div className="h-52 w-52 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data ?? []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={false}>
                {(data ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-2">
          {(data ?? []).slice(0, 8).map((d, i) => (
            <div key={d.name} className="flex items-center gap-2 text-sm">
              <div className="h-3 w-3 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="text-muted-foreground">{d.name}</span>
              <span className="font-semibold ml-auto pl-4">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── 3. Monthly Leads Trend ───────────────────────────────────────────────────

function MonthlyLeadsTrendSection() {
  const { data } = useQuery({
    queryKey: ["report-monthly-leads"],
    queryFn: async () => {
      const start = monthsAgoIso(11);
      const { data } = await supabase.from("leads").select("created_at").gte("created_at", start);
      const buckets: Record<string, number> = {};
      for (let i = 11; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i, 1);
        buckets[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
      }
      (data ?? []).forEach((l: any) => {
        if (!l.created_at) return;
        const d = new Date(l.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (key in buckets) buckets[key]++;
      });
      return Object.entries(buckets).map(([month, value]) => ({
        month: month.slice(5) + "/" + month.slice(2, 4), value,
      }));
    },
  });

  return (
    <Section icon={<TrendingUp className="h-5 w-5" />} title="New Leads — Last 12 Months">
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data ?? []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="value" name="New leads" stroke={COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

// ─── 4. Conversion Metrics ───────────────────────────────────────────────────

function ConversionSection() {
  const { data } = useQuery({
    queryKey: ["report-conversion"],
    queryFn: async () => {
      const { data: leads } = await supabase
        .from("leads")
        .select("lifecycle_state, created_at, converted_at");
      const total = (leads ?? []).length;
      const converted = (leads ?? []).filter((l: any) => l.lifecycle_state === "converted");
      const lost = (leads ?? []).filter((l: any) => ["lost","cold","not_eligible"].includes(l.lifecycle_state)).length;

      const times = converted
        .filter((l: any) => l.created_at && l.converted_at)
        .map((l: any) => (new Date(l.converted_at).getTime() - new Date(l.created_at).getTime()) / 86400000);
      const avgDays = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;

      return { total, converted: converted.length, lost, avgDays, rate: total ? Math.round((converted.length / total) * 100) : 0 };
    },
  });

  return (
    <Section icon={<UserCheck className="h-5 w-5" />} title="Lead Conversion">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Total leads" value={data?.total ?? 0} />
        <KpiCard label="Converted" value={data?.converted ?? 0} color="text-success" />
        <KpiCard label="Conversion rate" value={`${data?.rate ?? 0}%`} color="text-primary" />
        <KpiCard label="Avg days to convert" value={data?.avgDays !== null ? `${data?.avgDays}d` : "—"} />
      </div>
    </Section>
  );
}

// ─── 5. Case Pipeline ────────────────────────────────────────────────────────

function CasePipelineSection() {
  const { data } = useQuery({
    queryKey: ["report-case-pipeline"],
    queryFn: async () => {
      const { data: cases } = await supabase.from("cases").select("current_stage_code").eq("is_archived", false);
      const { data: stages } = await supabase.from("case_stages_ref").select("code, label").order("sort_order");
      const counts: Record<string, number> = {};
      (cases ?? []).forEach((c: any) => { counts[c.current_stage_code] = (counts[c.current_stage_code] ?? 0) + 1; });
      return (stages ?? []).map((s: any) => ({ stage: s.label, count: counts[s.code] ?? 0 })).filter((r) => r.count > 0);
    },
  });

  return (
    <Section icon={<Briefcase className="h-5 w-5" />} title="Case Pipeline by Stage">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data ?? []} layout="vertical" margin={{ left: 110, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="stage" tick={{ fontSize: 12 }} width={110} />
            <Tooltip />
            <Bar dataKey="count" name="Cases" fill={COLORS[1]} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

// ─── 6. Staff Performance ────────────────────────────────────────────────────

function StaffPerformanceSection() {
  const { data } = useQuery({
    queryKey: ["report-staff-perf"],
    queryFn: async () => {
      const [staffRes, tasksRes, callsRes, casesRes] = await Promise.all([
        supabase.from("staff_profiles").select("id, full_name, role").eq("is_active", true),
        db.from("tasks").select("assigned_to, status_code"),
        db.from("call_logs").select("staff_id"),
        supabase.from("cases").select("case_manager_id").eq("is_archived", false),
      ]);

      const staff = (staffRes.data ?? []) as { id: string; full_name: string; role: string }[];
      const tasks = (tasksRes.data ?? []) as { assigned_to: string | null; status_code: string }[];
      const calls = (callsRes.data ?? []) as { staff_id: string | null }[];
      const cases = (casesRes.data ?? []) as { case_manager_id: string | null }[];

      return staff.map((s) => ({
        name: s.full_name,
        role: s.role.replace(/_/g, " "),
        openTasks:  tasks.filter((t) => t.assigned_to === s.id && t.status_code !== "done").length,
        doneTasks:  tasks.filter((t) => t.assigned_to === s.id && t.status_code === "done").length,
        calls:      calls.filter((c) => c.staff_id === s.id).length,
        activeCases: cases.filter((c) => c.case_manager_id === s.id).length,
      })).filter((s) => s.openTasks + s.doneTasks + s.calls + s.activeCases > 0)
         .sort((a, b) => b.activeCases - a.activeCases);
    },
  });

  return (
    <Section icon={<CheckSquare className="h-5 w-5" />} title="Staff Performance">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Staff member", "Role", "Active cases", "Open tasks", "Tasks done", "Calls logged"].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(data ?? []).map((s) => (
              <tr key={s.name} className="hover:bg-muted/20">
                <td className="px-3 py-2.5 font-medium">{s.name}</td>
                <td className="px-3 py-2.5 text-muted-foreground capitalize">{s.role}</td>
                <td className="px-3 py-2.5 font-semibold text-primary">{s.activeCases}</td>
                <td className="px-3 py-2.5 text-warning">{s.openTasks}</td>
                <td className="px-3 py-2.5 text-success">{s.doneTasks}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{s.calls}</td>
              </tr>
            ))}
            {(data ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">No activity data yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ─── 7. Referral Partners ─────────────────────────────────────────────────────

function ReferralPartnersSection() {
  const { data } = useQuery({
    queryKey: ["report-referral-partners"],
    queryFn: async () => {
      const { data: partners } = await db.from("referral_partners").select("id, name").eq("is_active", true);
      if (!partners || partners.length === 0) return [];
      const { data: leads } = await db.from("leads").select("referral_partner_id, lifecycle_state")
        .in("referral_partner_id", partners.map((p: any) => p.id));
      const partnerMap = new Map((partners ?? []).map((p: any) => [p.id, p.name]));
      const counts: Record<string, { total: number; converted: number }> = {};
      (leads ?? []).forEach((l: any) => {
        if (!l.referral_partner_id) return;
        if (!counts[l.referral_partner_id]) counts[l.referral_partner_id] = { total: 0, converted: 0 };
        counts[l.referral_partner_id].total++;
        if (l.lifecycle_state === "converted") counts[l.referral_partner_id].converted++;
      });
      return Object.entries(counts)
        .map(([id, v]) => ({ name: partnerMap.get(id) ?? id, ...v, rate: v.total ? Math.round((v.converted / v.total) * 100) : 0 }))
        .sort((a, b) => b.total - a.total);
    },
  });

  if (!data || data.length === 0) return null;

  return (
    <Section icon={<UserCheck className="h-5 w-5" />} title="Referral Partner Performance">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Partner", "Leads referred", "Converted", "Conversion rate"].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((p) => (
              <tr key={p.name} className="hover:bg-muted/20">
                <td className="px-3 py-2.5 font-medium">{p.name}</td>
                <td className="px-3 py-2.5">{p.total}</td>
                <td className="px-3 py-2.5 text-success">{p.converted}</td>
                <td className="px-3 py-2.5 font-semibold">{p.rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ─── 8. Revenue Trend ─────────────────────────────────────────────────────────

function RevenueTrendSection() {
  const { data } = useQuery({
    queryKey: ["report-revenue-trend"],
    queryFn: async () => {
      const start = monthsAgoIso(11);
      const { data } = await supabase.from("payments").select("amount, paid_at, status").gte("paid_at", start).eq("status", "succeeded");
      const buckets: Record<string, number> = {};
      for (let i = 11; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i, 1);
        buckets[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
      }
      (data ?? []).forEach((p: any) => {
        if (!p.paid_at) return;
        const d = new Date(p.paid_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (key in buckets) buckets[key] += Number(p.amount ?? 0);
      });
      return Object.entries(buckets).map(([month, value]) => ({ month: month.slice(5) + "/" + month.slice(2, 4), value: Math.round(value) }));
    },
  });

  const total = useMemo(() => (data ?? []).reduce((s, d) => s + d.value, 0), [data]);

  return (
    <Section icon={<DollarSign className="h-5 w-5" />} title={`Revenue — Last 12 Months (Total: ${fmtMoney(total)})`}>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data ?? []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => fmtMoney(v)} />
            <Bar dataKey="value" name="Revenue" fill={COLORS[3]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card-surface p-5">
      <div className="flex items-center gap-2 mb-4 font-semibold text-sm text-primary">
        {icon}{title}
      </div>
      {children}
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-4 text-center">
      <div className={`text-3xl font-bold ${color ?? ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
