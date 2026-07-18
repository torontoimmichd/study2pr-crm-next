"use client";

// src/views/ExecutiveDashboard.tsx — v2 2026-07-18 (Gaurav's redesign)
//
// Owner "Morning Dashboard":
//   • 5-KPI strip (money in, pipeline, ENROLLMENTS TODAY, new inquiries, upsells)
//   • Daily Activity        (today's events from activity_timeline)
//   • Today's Enrollments   (applications created today)
//   • Shortcuts             (immigration portals + all PNP websites + mail)
//   • Team Performance · Upsell Engine · Inquiries by Channel · IRCC Emails · MTD
//
// REMOVED per Gaurav 2026-07-18: "Needs Your Decision" and "Cases At Risk".
// Sections that depend on sparse tables degrade to a friendly empty state.

import { useMemo, type ReactNode } from "react";
import { Link } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import {
  IndianRupee, TrendingUp, TrendingDown, UserPlus, Sparkles, GraduationCap,
  Clock, Mail, ExternalLink, Gauge, Activity, Link2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { fmtRelative } from "@/lib/format";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ── Shortcuts (edit labels/URLs here) ─────────────────────────────────────────
const PORTAL_LINKS: { label: string; url: string }[] = [
  { label: "PR Confirmation Portal (GCKey)", url: "https://prson-srpel.apps.cic.gc.ca/en/login" },
  { label: "IRCC Secure Account", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/account.html" },
  { label: "PR Portal — non Express Entry", url: "https://portal-portail.apps.cic.gc.ca/signin?lang=en" },
  { label: "Outlook Mail", url: "https://login.live.com/login.srf?wa=wsignin1.0&rpsnv=22&ct=1711498730&rver=7.0.6738.0&wp=MBI_SSL&wreply=https%3a%2f%2foutlook.live.com%2fowa%2f%3fcobrandid%3dab0455a0-8d03-46b9-b18b-df2f57b9e44c%26nlp%3d1%26deeplink%3dowa%252f%26RpsCsrfState%3dc27f5547-a3d2-0ef3-6c0e-28bd1747bfa1&id=292841&aadredir=1&CBCXT=out&lw=1&fl=dob%2cflname%2cwld&cobrandid=ab0455a0-8d03-46b9-b18b-df2f57b9e44c" },
  { label: "US Visa from Canada (appointments)", url: "https://ais.usvisa-info.com/en-ca/niv" },
  { label: "Australia Visa Processing Times", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-processing-times/global-visa-processing-times" },
];

const PNP_LINKS: { label: string; url: string }[] = [
  { label: "All PNPs — IRCC overview", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/provincial-nominees.html" },
  { label: "Ontario — OINP", url: "https://www.ontario.ca/page/ontario-immigrant-nominee-program-oinp" },
  { label: "British Columbia — BC PNP", url: "https://www.welcomebc.ca/Immigrate-to-B-C/B-C-Provincial-Nominee-Program" },
  { label: "Alberta — AAIP", url: "https://www.alberta.ca/aaip" },
  { label: "Saskatchewan — SINP", url: "https://www.saskatchewan.ca/residents/moving-to-saskatchewan/live-in-saskatchewan/by-immigrating/saskatchewan-immigrant-nominee-program" },
  { label: "Manitoba — MPNP", url: "https://immigratemanitoba.com/" },
  { label: "Nova Scotia — NSNP", url: "https://liveinnovascotia.com/" },
  { label: "New Brunswick", url: "https://www.welcomenb.ca/" },
  { label: "Prince Edward Island", url: "https://www.princeedwardisland.ca/en/topic/immigrate" },
  { label: "Newfoundland & Labrador", url: "https://www.gov.nl.ca/immigration/" },
  { label: "Yukon — YNP", url: "https://yukon.ca/en/immigrate-yukon" },
  { label: "Northwest Territories", url: "https://www.immigratenwt.ca/" },
  { label: "Quebec — Arrima", url: "https://www.quebec.ca/en/immigration" },
];

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

  // ── Today's enrollments (applications created today) ──────────────────────────
  const { data: enroll } = useQuery({
    queryKey: ["morning-enrollments"],
    queryFn: async () => {
      const { data } = await db.from("cases")
        .select("id, case_code, client_id, visa_type_id, created_at")
        .gte("created_at", B.iso(B.startToday))
        .order("created_at", { ascending: false }).limit(25);
      const rows = (data ?? []) as { id: string; case_code: string | null; client_id: string; visa_type_id: string | null; created_at: string }[];
      const cIds = Array.from(new Set(rows.map(r => r.client_id).filter(Boolean)));
      const vIds = Array.from(new Set(rows.map(r => r.visa_type_id).filter(Boolean) as string[]));
      const [cs, vs, convRes] = await Promise.all([
        cIds.length ? supabase.from("clients").select("id, full_name").in("id", cIds) : Promise.resolve({ data: [] }),
        vIds.length ? supabase.from("visa_types").select("id, label").in("id", vIds) : Promise.resolve({ data: [] }),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("lifecycle_state", "converted").gte("updated_at", B.iso(B.startToday)),
      ]);
      const cMap = new Map(((cs.data ?? []) as { id: string; full_name: string }[]).map(c => [c.id, c.full_name]));
      const vMap = new Map(((vs.data ?? []) as { id: string; label: string }[]).map(v => [v.id, v.label]));
      return {
        rows: rows.map(r => ({
          ...r,
          client_name: cMap.get(r.client_id) ?? "—",
          visa_label: r.visa_type_id ? (vMap.get(r.visa_type_id) ?? "—") : "—",
        })),
        convertedToday: convRes.count ?? 0,
      };
    },
  });

  // ── Daily activity (today's timeline events) ──────────────────────────────────
  const { data: activity } = useQuery({
    queryKey: ["morning-activity"],
    queryFn: async () => {
      const { data } = await db.from("activity_timeline")
        .select("id, event_type, title, body, case_id, lead_id, client_id, is_system, occurred_at")
        .gte("occurred_at", B.iso(B.startToday))
        .order("occurred_at", { ascending: false })
        .limit(20);
      return (data ?? []) as { id: string; event_type: string | null; title: string | null; body: string | null; case_id: string | null; lead_id: string | null; client_id: string | null; is_system: boolean | null; occurred_at: string }[];
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

  const enrollCount = enroll?.rows.length ?? 0;

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
            {enrollCount > 0 ? `${enrollCount} enrollment${enrollCount > 1 ? "s" : ""} today 🎉` : "No new enrollments yet today"}
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
        <KpiCard label="Enrollments (Today)" value={String(enrollCount)}
          accent={enrollCount > 0 ? "ok" : "default"}
          detail={`${enroll?.convertedToday ?? 0} leads converted today`} icon={<GraduationCap className="h-4 w-4" />} />
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
          {/* Daily activity */}
          <Card title="Daily Activity" count={activity?.length ?? 0}>
            {!activity || activity.length === 0 ? (
              <Empty icon={<Activity className="h-5 w-5 text-muted-foreground" />} text="No activity recorded yet today." />
            ) : (
              <div className="divide-y divide-border">
                {activity.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 py-2.5">
                    <span className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${a.is_system ? "bg-sky-400" : "bg-gold"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy truncate">{a.title ?? (a.event_type ?? "Event").replace(/_/g, " ")}</p>
                      {a.body && <p className="text-xs text-muted-foreground truncate">{a.body}</p>}
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">{fmtRelative(a.occurred_at)}</span>
                    {a.case_id ? (
                      <Link to={`/cases/${a.case_id}`} className="text-[11px] font-medium text-navy hover:underline shrink-0">Open</Link>
                    ) : a.lead_id ? (
                      <Link to={`/leads/${a.lead_id}`} className="text-[11px] font-medium text-navy hover:underline shrink-0">Open</Link>
                    ) : a.client_id ? (
                      <Link to={`/clients/${a.client_id}`} className="text-[11px] font-medium text-navy hover:underline shrink-0">Open</Link>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Today's enrollments */}
          <Card title="Today's Enrollments" count={enrollCount} countTone={undefined}>
            {enrollCount === 0 ? (
              <Empty icon={<GraduationCap className="h-5 w-5 text-muted-foreground" />} text="No new enrollments yet today." />
            ) : (
              <div className="divide-y divide-border">
                {enroll!.rows.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 py-2.5">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-emerald-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy truncate">{c.client_name} <span className="text-muted-foreground font-normal">· {c.case_code ?? ""}</span></p>
                      <p className="text-xs text-muted-foreground">{c.visa_label} · {fmtRelative(c.created_at)}</p>
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
          {/* Shortcuts */}
          <Card title="Shortcuts">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Portals</p>
            <div className="space-y-1">
              {PORTAL_LINKS.map((l) => (
                <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-navy hover:bg-gold-soft/40 transition-colors">
                  <Link2 className="h-3.5 w-3.5 text-gold shrink-0" />
                  <span className="flex-1 truncate">{l.label}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                </a>
              ))}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-3 mb-1.5">PNP Websites</p>
            <div className="space-y-1">
              {PNP_LINKS.map((l) => (
                <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-navy hover:bg-gold-soft/40 transition-colors">
                  <Link2 className="h-3.5 w-3.5 text-gold shrink-0" />
                  <span className="flex-1 truncate">{l.label}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                </a>
              ))}
            </div>
          </Card>

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
