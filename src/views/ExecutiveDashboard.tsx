"use client";

// src/pages/ExecutiveDashboard.tsx
//
// Owner "Morning Dashboard" — rebuilt to the original mockup
// (Study2PR_Morning_Dashboard_Mockup.html). A 15-minute morning review:
//   • 5-KPI strip (money in, pipeline, at-risk, new inquiries, upsells)
//   • Needs Your Decision  (pending step-template edits)
//   • Cases At Risk        (overdue submissions + refusals)
//   • Upsell Engine        (pending prospective applications)
//   • Team Performance      (v_counselor_performance)
//   • Inquiries by Channel  (leads, last 24h)
//   • IRCC Emails Today
//   • Month-to-Date Summary
//
// Sections that depend on the (currently sparse) automation tables degrade to a
// friendly empty state instead of erroring.

import { useMemo, type ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import {
  IndianRupee, TrendingUp, TrendingDown, AlertTriangle, UserPlus, Sparkles,
  CheckCircle2, Clock, Mail, ArrowRight, ExternalLink, Gauge,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { fmtRelative } from "@/lib/format";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ── helpers ───────────────────────────────────────────────────────────────────
function inr(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "₹0";
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
function pct(part: number, whole: number): string {
  if (!whole) return "—";
  return `${Math.round((part / whole) * 1000) / 10}%`;
}
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function ExecutiveDashboard() {
  const { profile } = useAuth();

  // Date boundaries (local time)
  const B = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
    const startYesterday = new Date(startToday); startYesterday.setDate(startYesterday.getDate() - 1);
    const start7 = new Date(startToday); start7.setDate(start7.getDate() - 7);
    const start24h = new Date(now.getTime() - 24 * 3600 * 1000);
    const start30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const prevDayStart = new Date(startYesterday); prevDayStart.setDate(prevDayStart.getDate() - 7);
    const prevDayEnd = new Date(prevDayStart); prevDayEnd.setDate(prevDayEnd.getDate() + 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      iso: (d: Date) => d.toISOString(),
      startToday, startYesterday, start7, start24h, start30, prevDayStart, prevDayEnd, monthStart,
      todayStr: startToday.toISOString().slice(0, 10),
    };
  }, []);

  // ── KPI strip ───────────────────────────────────────────────────────────────
  const { data: kpi } = useQuery({
    queryKey: ["morning-kpis"],
    queryFn: async () => {
      const [payYest, payPrevWk, openCases, leads24, leads30, upsells] = await Promise.all([
        db.from("payments").select("amount, provider").gte("paid_at", B.iso(B.startYesterday)).lt("paid_at", B.iso(B.startToday)),
        db.from("payments").select("amount").gte("paid_at", B.iso(B.prevDayStart)).lt("paid_at", B.iso(B.prevDayEnd)),
        db.from("cases").select("quoted_fee_inr").eq("is_archived", false).is("outcome", null),
        supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", B.iso(B.start24h)),
        supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", B.iso(B.start30)),
        db.from("prospective_applications").select("estimated_fee_cad").eq("status", "converted_to_case").gte("client_decision_at", B.iso(B.start7)),
      ]);
      const yRows = (payYest.data ?? []) as { amount: number; provider: string | null }[];
      const moneyYesterday = yRows.reduce((s, r) => s + Number(r.amount || 0), 0);
      const methods = yRows.reduce((m, r) => { const k = r.provider || "other"; m[k] = (m[k] ?? 0) + 1; return m; }, {} as Record<string, number>);
      const moneyPrevWk = ((payPrevWk.data ?? []) as { amount: number }[]).reduce((s, r) => s + Number(r.amount || 0), 0);
      const openRows = (openCases.data ?? []) as { quoted_fee_inr: number | null }[];
      const pipeline = openRows.reduce((s, r) => s + Number(r.quoted_fee_inr || 0), 0);
      const upsRows = (upsells.data ?? []) as { estimated_fee_cad: number | null }[];
      return {
        moneyYesterday,
        moneyPayCount: yRows.length,
        methods,
        moneyDelta: moneyPrevWk > 0 ? Math.round(((moneyYesterday - moneyPrevWk) / moneyPrevWk) * 100) : null,
        pipeline,
        openCaseCount: openRows.length,
        newInquiries: leads24.count ?? 0,
        dailyAvg: Math.round(((leads30.count ?? 0) / 30) * 10) / 10,
        upsellCount: upsRows.length,
        upsellValueCad: upsRows.reduce((s, r) => s + Number(r.estimated_fee_cad || 0), 0),
      };
    },
  });

  // ── At-risk cases (overdue submissions + refusals) ────────────────────────────
  const { data: atRisk } = useQuery({
    queryKey: ["morning-at-risk"],
    queryFn: async () => {
      const [overdueRes, refusedRes] = await Promise.all([
        db.from("cases").select("id, case_code, client_id, target_submission_date, current_stage_code")
          .eq("is_archived", false).is("outcome", null).not("target_submission_date", "is", null)
          .lt("target_submission_date", B.todayStr).limit(10),
        db.from("cases").select("id, case_code, client_id, decision_date")
          .eq("outcome", "refused").order("decision_date", { ascending: false }).limit(10),
      ]);
      const overdue = (overdueRes.data ?? []) as { id: string; case_code: string | null; client_id: string; target_submission_date: string }[];
      const refused = (refusedRes.data ?? []) as { id: string; case_code: string | null; client_id: string; decision_date: string | null }[];
      const ids = Array.from(new Set([...overdue, ...refused].map((c) => c.client_id).filter(Boolean)));
      const nameMap = new Map<string, string>();
      if (ids.length) {
        const { data: cl } = await supabase.from("clients").select("id, full_name").in("id", ids);
        (cl ?? []).forEach((c) => nameMap.set(c.id, c.full_name));
      }
      const items = [
        ...overdue.map((c) => ({ id: c.id, ref: c.case_code, name: nameMap.get(c.client_id) ?? "—", reason: `Submission overdue since ${c.target_submission_date}`, kind: "overdue" as const })),
        ...refused.map((c) => ({ id: c.id, ref: c.case_code, name: nameMap.get(c.client_id) ?? "—", reason: `IRCC refusal${c.decision_date ? ` · ${fmtRelative(c.decision_date)}` : ""}`, kind: "refused" as const })),
      ];
      return { items, overdueCount: overdue.length, refusedCount: refused.length };
    },
  });

  // ── Needs Your Decision (pending step-template edits) ─────────────────────────
  const { data: decisions } = useQuery({
    queryKey: ["morning-decisions"],
    queryFn: async () => {
      const { data } = await db.from("step_template_edits")
        .select("id, proposed_at, proposed_by, proposed_change, status")
        .eq("status", "pending").order("proposed_at", { ascending: true }).limit(6);
      const rows = (data ?? []) as { id: string; proposed_at: string; proposed_by: string | null; proposed_change: unknown }[];
      const ids = Array.from(new Set(rows.map((r) => r.proposed_by).filter(Boolean) as string[]));
      const nameMap = new Map<string, string>();
      if (ids.length) {
        const { data: st } = await supabase.from("staff_profiles").select("id, full_name").in("id", ids);
        (st ?? []).forEach((s) => nameMap.set(s.id, s.full_name));
      }
      return rows.map((r) => {
        const change = (r.proposed_change ?? {}) as { title?: string; summary?: string; description?: string };
        return {
          id: r.id,
          who: r.proposed_by ? (nameMap.get(r.proposed_by) ?? "Staff") : "Staff",
          title: change.title || "Proposed workflow change",
          desc: change.summary || change.description || "Review the proposed change before publishing.",
          at: r.proposed_at,
        };
      });
    },
  });

  // ── Upsell Engine — pending prospective applications by target type ───────────
  const { data: upsellEngine } = useQuery({
    queryKey: ["morning-upsell-engine"],
    queryFn: async () => {
      const { data } = await db.from("prospective_applications")
        .select("target_application_type").eq("status", "pending_counselor_action").limit(500);
      const rows = (data ?? []) as { target_application_type: string | null }[];
      const byType = rows.reduce((m, r) => { const k = r.target_application_type || "Other"; m[k] = (m[k] ?? 0) + 1; return m; }, {} as Record<string, number>);
      return Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 4);
    },
  });

  // ── Team Performance ──────────────────────────────────────────────────────────
  const { data: team } = useQuery({
    queryKey: ["morning-team"],
    queryFn: async () => {
      const { data } = await db.from("v_counselor_performance").select("*");
      return ((data ?? []) as Record<string, unknown>[]).slice(0, 8);
    },
  });

  // ── Inquiries by channel (last 24h) ───────────────────────────────────────────
  const { data: channels } = useQuery({
    queryKey: ["morning-channels"],
    queryFn: async () => {
      const [leadRes, srcRes] = await Promise.all([
        supabase.from("leads").select("source_code").gte("created_at", B.iso(B.start24h)).limit(1000),
        supabase.from("lead_sources").select("code, label"),
      ]);
      const labelMap = new Map((srcRes.data ?? []).map((s) => [s.code, s.label]));
      const counts = ((leadRes.data ?? []) as { source_code: string | null }[]).reduce((m, r) => {
        const k = r.source_code || "unknown"; m[k] = (m[k] ?? 0) + 1; return m;
      }, {} as Record<string, number>);
      const total = Object.values(counts).reduce((s, n) => s + n, 0);
      return { list: Object.entries(counts).map(([code, n]) => ({ label: labelMap.get(code) ?? code, n })).sort((a, b) => b.n - a.n), total };
    },
  });

  // ── IRCC emails today ─────────────────────────────────────────────────────────
  const { data: ircc } = useQuery({
    queryKey: ["morning-ircc"],
    queryFn: async () => {
      const { data } = await db.from("ircc_emails")
        .select("id, subject, from_address, received_at, matched_case_id, action_due_at, requires_action")
        .gte("received_at", B.iso(B.startToday)).order("received_at", { ascending: false }).limit(8);
      return (data ?? []) as { id: string; subject: string | null; from_address: string | null; received_at: string; matched_case_id: string | null; action_due_at: string | null; requires_action: boolean | null }[];
    },
  });

  // ── Month-to-date summary ─────────────────────────────────────────────────────
  const { data: mtd } = useQuery({
    queryKey: ["morning-mtd"],
    queryFn: async () => {
      const m = B.iso(B.monthStart);
      const [inquiries, converted, casesMade, approvals, decisions2, payMtd, openC] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", m),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("lifecycle_state", "converted").gte("updated_at", m),
        db.from("cases").select("id", { count: "exact", head: true }).gte("created_at", m),
        db.from("cases").select("id", { count: "exact", head: true }).eq("outcome", "approved").gte("decision_date", m),
        db.from("cases").select("id", { count: "exact", head: true }).not("outcome", "is", null).gte("decision_date", m),
        db.from("payments").select("amount").gte("paid_at", m).limit(5000),
        db.from("cases").select("id", { count: "exact", head: true }).eq("is_archived", false).is("outcome", null),
      ]);
      const revenue = ((payMtd.data ?? []) as { amount: number }[]).reduce((s, r) => s + Number(r.amount || 0), 0);
      const inq = inquiries.count ?? 0, conv = converted.count ?? 0, appr = approvals.count ?? 0, dec = decisions2.count ?? 0;
      return {
        inquiries: inq, converted: conv, conversion: pct(conv, inq),
        applications: casesMade.count ?? 0, approvals: appr, successRate: pct(appr, dec),
        revenue, openCases: openC.count ?? 0,
      };
    },
  });

  const decisionCount = decisions?.length ?? 0;
  const riskCount = (atRisk?.overdueCount ?? 0) + (atRisk?.refusedCount ?? 0);

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-5">
      {/* Topbar */}
      <div className="flex items-center justify-between bg-card rounded-xl border border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-navy text-white flex items-center justify-center font-bold">S2</div>
          <div>
            <h1 className="font-display text-lg text-navy leading-tight">Morning Dashboard</h1>
            <p className="text-xs text-muted-foreground">Owner View · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-semibold text-navy text-sm">{greeting()}, {profile?.full_name?.split(" ")[0] ?? "there"}</p>
          <p className="text-xs text-muted-foreground">
            {decisionCount > 0 ? `${decisionCount} decision${decisionCount > 1 ? "s" : ""} need you` : "All decisions handled"}
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="Money Collected (Yesterday)" value={inr(kpi?.moneyYesterday ?? 0)} accent="ok"
          delta={kpi?.moneyDelta != null ? { up: kpi.moneyDelta >= 0, text: `${kpi.moneyDelta >= 0 ? "+" : ""}${kpi.moneyDelta}% vs last week` } : undefined}
          detail={`${kpi?.moneyPayCount ?? 0} payments${kpi?.methods && Object.keys(kpi.methods).length ? " · " + Object.entries(kpi.methods).map(([k, n]) => `${n} ${k}`).join(" · ") : ""}`} />
        <KpiCard label="Pipeline Value (Open)" value={inr(kpi?.pipeline ?? 0)} accent="default"
          detail={`${kpi?.openCaseCount ?? 0} open cases`} icon={<IndianRupee className="h-4 w-4" />} />
        <KpiCard label="Cases At Risk" value={String(riskCount)}
          accent={riskCount > 0 ? "alert" : "ok"}
          detail={`${atRisk?.overdueCount ?? 0} overdue docs · ${atRisk?.refusedCount ?? 0} refusal`} icon={<AlertTriangle className="h-4 w-4" />} />
        <KpiCard label="New Inquiries (24h)" value={String(kpi?.newInquiries ?? 0)}
          accent={(kpi?.newInquiries ?? 0) >= (kpi?.dailyAvg ?? 0) ? "ok" : "warn"}
          detail={`daily avg ${kpi?.dailyAvg ?? 0}`} icon={<UserPlus className="h-4 w-4" />} />
        <KpiCard label="Upsells Converted (This Wk)" value={String(kpi?.upsellCount ?? 0)} accent="default"
          detail={kpi?.upsellValueCad ? `~CAD ${Math.round(kpi.upsellValueCad).toLocaleString()}` : "chain engine"} icon={<Sparkles className="h-4 w-4" />} />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2/3 */}
        <div className="lg:col-span-2 space-y-5">
          {/* Needs Your Decision */}
          <Card title="Needs Your Decision" count={decisionCount} countTone={decisionCount > 0 ? "alert" : undefined}>
            {decisionCount === 0 ? (
              <Empty icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} text="All items handled. You can close the app." />
            ) : (
              <div className="space-y-2.5">
                {decisions!.map((d) => (
                  <div key={d.id} className="rounded-lg border-l-4 border-orange-400 bg-orange-50/60 px-3.5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700">Proposed by {d.who} · {fmtRelative(d.at)}</p>
                    <p className="font-semibold text-sm mt-0.5">{d.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{d.desc}</p>
                    <Link to="/admin/pending-approvals" className="inline-flex items-center gap-1 text-xs font-medium text-navy mt-2 hover:underline">
                      Review &amp; decide <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Cases At Risk */}
          <Card title="Cases At Risk" count={atRisk?.items.length ?? 0} countTone={(atRisk?.items.length ?? 0) > 0 ? "warn" : undefined}>
            {(atRisk?.items.length ?? 0) === 0 ? (
              <Empty icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} text="No cases at risk right now." />
            ) : (
              <div className="divide-y divide-border">
                {atRisk!.items.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 py-2.5">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${c.kind === "refused" ? "bg-red-500" : "bg-amber-500"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy truncate">{c.name} <span className="text-muted-foreground font-normal">· {c.ref ?? ""}</span></p>
                      <p className="text-xs text-muted-foreground">{c.reason}</p>
                    </div>
                    <Link to={`/cases/${c.id}`} className="text-xs font-medium px-2.5 py-1 rounded-md border border-navy/30 text-navy hover:bg-navy/5">Open</Link>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Team performance */}
          <Card title="Team Performance">
            {!team || team.length === 0 ? (
              <Empty text="No counselor performance data yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                      <th className="py-2 pr-3">Staff</th>
                      <th className="py-2 pr-3 text-right">Active cases</th>
                      <th className="py-2 pr-3 text-right">Chain 30d</th>
                      <th className="py-2 pr-3 text-right">SLA breaches</th>
                      <th className="py-2 pr-3 text-right">Revenue 90d</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium">{String(r.full_name ?? "—")}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{Number(r.active_cases ?? 0)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{Number(r.chain_tasks_on_time_30d ?? 0)}/{Number(r.chain_tasks_30d ?? 0)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{Number(r.sla_breaches_30d ?? 0)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{inr(Number(r.revenue_90d ?? 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right 1/3 */}
        <div className="space-y-5">
          {/* Upsell engine */}
          <Card title="Upsell Engine — This Week">
            {!upsellEngine || upsellEngine.length === 0 ? (
              <Empty text="No pending upsell opportunities." />
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {upsellEngine.map(([type, n]) => (
                  <div key={type} className="text-center rounded-lg bg-sky-50 border border-sky-100 py-3 px-2">
                    <div className="text-2xl font-bold text-navy">{n}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{type.replace(/_/g, " ")}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Inquiries by channel */}
          <Card title="Inquiries by Channel (24h)">
            {!channels || channels.total === 0 ? (
              <Empty text="No inquiries in the last 24h." />
            ) : (
              <div className="space-y-2">
                {channels.list.map((c) => (
                  <div key={c.label} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                    <span className="text-sm capitalize">{c.label}</span>
                    <span className="text-lg font-bold text-navy tabular-nums">{c.n}</span>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground pt-1">{channels.total} inquiries in the last 24 hours.</p>
              </div>
            )}
          </Card>

          {/* IRCC emails today */}
          <Card title="IRCC Emails Today" count={ircc?.length ?? 0}>
            {!ircc || ircc.length === 0 ? (
              <Empty icon={<Mail className="h-5 w-5 text-muted-foreground" />} text="No IRCC emails today." />
            ) : (
              <div className="divide-y divide-border">
                {ircc.map((e) => (
                  <div key={e.id} className="py-2.5 flex items-start gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.subject ?? "(no subject)"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {e.from_address ?? ""}{e.action_due_at ? ` · due ${fmtRelative(e.action_due_at)}` : ""}
                      </p>
                    </div>
                    {e.matched_case_id && (
                      <Link to={`/cases/${e.matched_case_id}`} className="text-[11px] text-navy hover:underline shrink-0">Open</Link>
                    )}
                  </div>
                ))}
                <Link to="/ircc" className="inline-flex items-center gap-1 text-xs text-navy hover:underline pt-2">
                  All IRCC emails <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Month-to-date */}
      <Card title="Month-to-Date Summary">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 text-center">
          <Stat label="New inquiries" value={String(mtd?.inquiries ?? 0)} />
          <Stat label="Paid / converted" value={String(mtd?.converted ?? 0)} />
          <Stat label="Conversion" value={mtd?.conversion ?? "—"} />
          <Stat label="Applications" value={String(mtd?.applications ?? 0)} />
          <Stat label="Approvals" value={String(mtd?.approvals ?? 0)} />
          <Stat label="Success rate" value={mtd?.successRate ?? "—"} />
          <Stat label="Revenue" value={inr(mtd?.revenue ?? 0)} />
          <Stat label="Open cases" value={String(mtd?.openCases ?? 0)} />
        </div>
      </Card>

      <p className="text-center text-xs text-muted-foreground pt-2 flex items-center justify-center gap-1.5">
        <Gauge className="h-3.5 w-3.5" /> Daily morning review target: 15 minutes
      </p>
    </div>
  );
}

// ── small presentational helpers ──────────────────────────────────────────────
function KpiCard({ label, value, detail, delta, accent = "default", icon }: {
  label: string; value: string; detail?: string;
  delta?: { up: boolean; text: string };
  accent?: "default" | "ok" | "warn" | "alert";
  icon?: ReactNode;
}) {
  const top = accent === "ok" ? "border-t-emerald-500" : accent === "warn" ? "border-t-amber-500" : accent === "alert" ? "border-t-red-500" : "border-t-blue-500";
  return (
    <div className={`bg-card rounded-xl border border-border border-t-[3px] ${top} px-4 py-3.5`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className="text-2xl font-bold text-navy mt-1 leading-tight">{value}</p>
      {delta && (
        <p className={`text-xs font-semibold mt-0.5 flex items-center gap-1 ${delta.up ? "text-emerald-600" : "text-red-600"}`}>
          {delta.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} {delta.text}
        </p>
      )}
      {detail && <p className="text-[11px] text-muted-foreground mt-1 truncate">{detail}</p>}
    </div>
  );
}

function Card({ title, count, countTone, children }: {
  title: string; count?: number; countTone?: "alert" | "warn"; children: ReactNode;
}) {
  const tone = countTone === "alert" ? "bg-red-500 text-white" : countTone === "warn" ? "bg-amber-400 text-amber-950" : "bg-navy text-white";
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm text-navy">{title}</h2>
        {count != null && count > 0 && <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${tone}`}>{count}</span>}
      </div>
      {children}
    </div>
  );
}

function Empty({ icon, text }: { icon?: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
      {icon}<span>{text}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 py-3 px-2">
      <p className="text-xl font-bold text-navy tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
