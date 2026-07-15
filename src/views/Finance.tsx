"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { Download, IndianRupee, FileText, Wallet, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { TableSkeleton } from "@/components/TableSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { fmtDateIST, fmtMoney } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--gold))", "hsl(var(--success))", "hsl(var(--destructive))", "hsl(var(--warning))"];

function startOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}
function monthsAgoIso(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n, 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function Finance() {
  // ---- Stats ----
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["finance-stats"],
    queryFn: async () => {
      const monthStart = startOfMonthIso();
      const [paymentsMtd, outstanding, commissionsDue, activeCases] = await Promise.all([
        supabase.from("payments").select("amount, currency").gte("paid_at", monthStart).eq("status", "succeeded").limit(5000),
        supabase.from("invoices").select("total, paid_total, currency").in("status", ["sent", "partial", "overdue"]).limit(5000),
        supabase.from("commissions").select("amount_inr").eq("status", "accrued").limit(5000),
        supabase.from("cases").select("quoted_fee_inr").eq("is_archived", false).limit(5000),
      ]);

      const revenueByCcy: Record<string, number> = {};
      paymentsMtd.data?.forEach((p) => {
        revenueByCcy[p.currency] = (revenueByCcy[p.currency] ?? 0) + Number(p.amount ?? 0);
      });
      const outstandingByCcy: Record<string, number> = {};
      outstanding.data?.forEach((inv) => {
        const due = Number(inv.total ?? 0) - Number(inv.paid_total ?? 0);
        if (due > 0) outstandingByCcy[inv.currency] = (outstandingByCcy[inv.currency] ?? 0) + due;
      });
      const commissionsTotal = (commissionsDue.data ?? []).reduce((s, c) => s + Number(c.amount_inr ?? 0), 0);
      const totalCases = activeCases.data?.length ?? 0;
      const avgFee = totalCases ? (activeCases.data ?? []).reduce((s, c) => s + Number(c.quoted_fee_inr ?? 0), 0) / totalCases : 0;
      return { revenueByCcy, outstandingByCcy, commissionsTotal, activeCasesCount: totalCases, avgFee };
    },
  });

  // ---- Recent payments ----
  const { data: recentPayments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["finance-recent-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, currency, paid_at, provider, provider_reference, invoice_id, status")
        .order("paid_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      const invoiceIds = Array.from(new Set((data ?? []).map((p) => p.invoice_id).filter(Boolean) as string[]));
      const { data: invs } = invoiceIds.length
        ? await supabase.from("invoices").select("id, invoice_number, client_id, case_id").in("id", invoiceIds)
        : { data: [] };
      const clientIds = Array.from(new Set((invs ?? []).map((i) => i.client_id).filter(Boolean) as string[]));
      const { data: clients } = clientIds.length
        ? await supabase.from("clients").select("id, full_name").in("id", clientIds)
        : { data: [] };
      const invMap = new Map((invs ?? []).map((i) => [i.id, i]));
      const cliMap = new Map((clients ?? []).map((c) => [c.id, c.full_name]));
      return (data ?? []).map((p) => {
        const inv = p.invoice_id ? invMap.get(p.invoice_id) : null;
        return {
          ...p,
          invoice_number: inv?.invoice_number ?? "—",
          client_name: inv?.client_id ? cliMap.get(inv.client_id) ?? "—" : "—",
          case_id: inv?.case_id ?? null,
        };
      });
    },
  });

  // ---- Outstanding invoices ----
  const { data: outstandingInvoices, isLoading: invLoading } = useQuery({
    queryKey: ["finance-outstanding"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, total, paid_total, currency, due_date, status, client_id, case_id, issued_at")
        .in("status", ["sent", "partial", "overdue", "draft"])
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(50);
      if (error) throw error;
      const clientIds = Array.from(new Set((data ?? []).map((i) => i.client_id).filter(Boolean) as string[]));
      const { data: clients } = clientIds.length
        ? await supabase.from("clients").select("id, full_name").in("id", clientIds)
        : { data: [] };
      const map = new Map((clients ?? []).map((c) => [c.id, c.full_name]));
      return (data ?? []).map((i) => ({ ...i, client_name: map.get(i.client_id) ?? "—" }));
    },
  });

  // ---- Commission ledger ----
  const { data: commissionLedger, isLoading: comLoading } = useQuery({
    queryKey: ["finance-commissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commissions")
        .select("id, amount_inr, status, earned_at, paid_at, staff_id, case_id, rule_code, payout_reference")
        .order("earned_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const staffIds = Array.from(new Set((data ?? []).map((c) => c.staff_id).filter(Boolean) as string[]));
      const { data: staff } = staffIds.length
        ? await supabase.from("staff_profiles").select("id, full_name").in("id", staffIds)
        : { data: [] };
      const map = new Map((staff ?? []).map((s) => [s.id, s.full_name]));
      return (data ?? []).map((c) => ({ ...c, staff_name: c.staff_id ? map.get(c.staff_id) ?? "—" : "—" }));
    },
  });

  // ---- Revenue trend (last 12 months) ----
  const { data: trend } = useQuery({
    queryKey: ["finance-trend"],
    queryFn: async () => {
      const start = monthsAgoIso(11);
      const { data, error } = await supabase
        .from("payments")
        .select("amount, currency, paid_at, status")
        .gte("paid_at", start)
        .eq("status", "succeeded")
        .limit(10000);
      if (error) throw error;
      const buckets: Record<string, number> = {};
      // seed last 12 months
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        buckets[key] = 0;
      }
      (data ?? []).forEach((p) => {
        if (!p.paid_at) return;
        const d = new Date(p.paid_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (key in buckets) buckets[key] += Number(p.amount ?? 0);
      });
      return Object.entries(buckets).map(([month, value]) => ({
        month: month.slice(5) + "/" + month.slice(2, 4),
        value: Math.round(value),
      }));
    },
  });

  // ---- Revenue by visa type ----
  const { data: byVisa } = useQuery({
    queryKey: ["finance-by-visa"],
    queryFn: async () => {
      const { data: invs } = await supabase
        .from("invoices")
        .select("paid_total, case_id")
        .gt("paid_total", 0)
        .limit(5000);
      const caseIds = Array.from(new Set((invs ?? []).map((i) => i.case_id).filter(Boolean) as string[]));
      const { data: cases } = caseIds.length
        ? await supabase.from("cases").select("id, visa_type_id").in("id", caseIds)
        : { data: [] };
      const visaIds = Array.from(new Set((cases ?? []).map((c) => c.visa_type_id).filter(Boolean) as string[]));
      const { data: visas } = visaIds.length
        ? await supabase.from("visa_types").select("id, label").in("id", visaIds)
        : { data: [] };
      const caseToVisa = new Map((cases ?? []).map((c) => [c.id, c.visa_type_id]));
      const visaLabel = new Map((visas ?? []).map((v) => [v.id, v.label]));
      const sums: Record<string, number> = {};
      (invs ?? []).forEach((inv) => {
        const visaId = inv.case_id ? caseToVisa.get(inv.case_id) : null;
        const label = visaId ? visaLabel.get(visaId) ?? "Other" : "Other";
        sums[label] = (sums[label] ?? 0) + Number(inv.paid_total ?? 0);
      });
      return Object.entries(sums)
        .map(([name, value]) => ({ name, value: Math.round(value) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
    },
  });

  // ---- Top advisors ----
  const { data: topAdvisors } = useQuery({
    queryKey: ["finance-top-advisors"],
    queryFn: async () => {
      const { data: invs } = await supabase
        .from("invoices")
        .select("paid_total, case_id")
        .gt("paid_total", 0)
        .limit(5000);
      const caseIds = Array.from(new Set((invs ?? []).map((i) => i.case_id).filter(Boolean) as string[]));
      const { data: cases } = caseIds.length
        ? await supabase.from("cases").select("id, case_manager_id, senior_advisor_id").in("id", caseIds)
        : { data: [] };
      const advisorIds = Array.from(
        new Set(
          (cases ?? []).flatMap((c) => [c.case_manager_id, c.senior_advisor_id]).filter(Boolean) as string[],
        ),
      );
      const { data: staff } = advisorIds.length
        ? await supabase.from("staff_profiles").select("id, full_name").in("id", advisorIds)
        : { data: [] };
      const caseAdvisor = new Map((cases ?? []).map((c) => [c.id, c.case_manager_id ?? c.senior_advisor_id]));
      const staffName = new Map((staff ?? []).map((s) => [s.id, s.full_name]));
      const sums: Record<string, number> = {};
      (invs ?? []).forEach((inv) => {
        const aid = inv.case_id ? caseAdvisor.get(inv.case_id) : null;
        const name = aid ? staffName.get(aid) ?? "Unassigned" : "Unassigned";
        sums[name] = (sums[name] ?? 0) + Number(inv.paid_total ?? 0);
      });
      return Object.entries(sums)
        .map(([name, value]) => ({ name, value: Math.round(value) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
    },
  });

  const exportPayments = async () => {
    const { data } = await supabase
      .from("payments")
      .select("id, amount, currency, status, paid_at, provider, provider_reference, invoice_id, notes")
      .order("paid_at", { ascending: false })
      .limit(5000);
    downloadCsv(
      `payments-${new Date().toISOString().slice(0, 10)}.csv`,
      ["ID", "Amount", "Currency", "Status", "Paid at", "Provider", "Reference", "Invoice ID", "Notes"],
      (data ?? []).map((p) => [p.id, p.amount, p.currency, p.status ?? "", p.paid_at ?? "", p.provider ?? "", p.provider_reference ?? "", p.invoice_id ?? "", p.notes ?? ""]),
    );
  };

  const exportInvoices = async () => {
    const { data } = await supabase
      .from("invoices")
      .select("id, invoice_number, client_id, case_id, currency, subtotal, tax, total, paid_total, status, issued_at, due_date")
      .order("issued_at", { ascending: false })
      .limit(5000);
    downloadCsv(
      `invoices-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Number", "Client ID", "Case ID", "Currency", "Subtotal", "Tax", "Total", "Paid", "Status", "Issued", "Due"],
      (data ?? []).map((i) => [i.invoice_number, i.client_id, i.case_id ?? "", i.currency, i.subtotal, i.tax ?? 0, i.total, i.paid_total ?? 0, i.status ?? "", i.issued_at ?? "", i.due_date ?? ""]),
    );
  };

  const exportCommissions = async () => {
    const { data } = await supabase
      .from("commissions")
      .select("id, amount_inr, status, earned_at, paid_at, staff_id, case_id, rule_code, payout_reference, notes")
      .order("earned_at", { ascending: false })
      .limit(5000);
    downloadCsv(
      `commissions-${new Date().toISOString().slice(0, 10)}.csv`,
      ["ID", "Amount INR", "Status", "Earned at", "Paid at", "Staff ID", "Case ID", "Rule", "Payout ref", "Notes"],
      (data ?? []).map((c) => [c.id, c.amount_inr, c.status ?? "", c.earned_at ?? "", c.paid_at ?? "", c.staff_id ?? "", c.case_id ?? "", c.rule_code ?? "", c.payout_reference ?? "", c.notes ?? ""]),
    );
  };

  const revenueLine = useMemo(
    () =>
      stats
        ? Object.entries(stats.revenueByCcy)
            .map(([c, v]) => fmtMoney(v, c))
            .join(" · ") || "—"
        : "—",
    [stats],
  );
  const outstandingLine = useMemo(
    () =>
      stats
        ? Object.entries(stats.outstandingByCcy)
            .map(([c, v]) => fmtMoney(v, c))
            .join(" · ") || "—"
        : "—",
    [stats],
  );

  return (
    <div>
      <PageHeader
        title="Finance"
        subtitle="Revenue, outstanding invoices, and commissions"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportPayments}>
              <Download className="h-3.5 w-3.5" /> Payments
            </Button>
            <Button variant="outline" size="sm" onClick={exportInvoices}>
              <Download className="h-3.5 w-3.5" /> Invoices
            </Button>
            <Button variant="outline" size="sm" onClick={exportCommissions}>
              <Download className="h-3.5 w-3.5" /> Commissions
            </Button>
          </>
        }
      />

      <div className="p-6 space-y-6 max-w-[1600px]">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Revenue MTD" value={statsLoading ? "—" : revenueLine} icon={<IndianRupee className="h-4 w-4" />} />
          <StatCard label="Outstanding" value={statsLoading ? "—" : outstandingLine} icon={<FileText className="h-4 w-4" />} />
          <StatCard label="Commissions due" value={statsLoading ? "—" : fmtMoney(stats?.commissionsTotal ?? 0)} icon={<Wallet className="h-4 w-4" />} />
          <StatCard
            label="Active cases × avg fee"
            value={statsLoading ? "—" : `${stats?.activeCasesCount ?? 0} × ${fmtMoney(Math.round(stats?.avgFee ?? 0))}`}
            icon={<TrendingUp className="h-4 w-4" />}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card-surface p-5 lg:col-span-2">
            <h2 className="font-display text-lg text-navy mb-4">Revenue trend (12 months)</h2>
            <div className="h-64">
              {!trend ? (
                <div className="h-full bg-muted rounded animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => fmtMoney(v)}
                    />
                    <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--gold))" }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className="card-surface p-5">
            <h2 className="font-display text-lg text-navy mb-4">Revenue by visa type</h2>
            <div className="h-64">
              {!byVisa ? (
                <div className="h-full bg-muted rounded animate-pulse" />
              ) : byVisa.length === 0 ? (
                <p className="text-sm text-muted-foreground">No paid invoices yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byVisa} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {byVisa.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => fmtMoney(v)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="card-surface p-5">
          <h2 className="font-display text-lg text-navy mb-4">Top advisors by revenue</h2>
          <div className="h-64">
            {!topAdvisors ? (
              <div className="h-full bg-muted rounded animate-pulse" />
            ) : topAdvisors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No revenue data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topAdvisors} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={120} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => fmtMoney(v)}
                  />
                  <Bar dataKey="value" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent payments */}
        <div className="card-surface p-5">
          <h2 className="font-display text-lg text-navy mb-4">Recent payments</h2>
          {paymentsLoading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : !recentPayments || recentPayments.length === 0 ? (
            <EmptyState title="No payments yet" description="Payments recorded against invoices will show here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 px-2">Paid at</th>
                    <th className="py-2 px-2">Client</th>
                    <th className="py-2 px-2">Invoice</th>
                    <th className="py-2 px-2 text-right">Amount</th>
                    <th className="py-2 px-2">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((p) => (
                    <tr key={p.id} className="border-b border-border/60 hover:bg-muted/40">
                      <td className="py-2 px-2 text-muted-foreground">{fmtDateIST(p.paid_at)}</td>
                      <td className="py-2 px-2">
                        {p.case_id ? (
                          <Link to={`/cases/${p.case_id}`} className="hover:text-accent">{p.client_name}</Link>
                        ) : (
                          p.client_name
                        )}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{p.invoice_number}</td>
                      <td className="py-2 px-2 text-right font-medium">{fmtMoney(Number(p.amount), p.currency)}</td>
                      <td className="py-2 px-2 text-muted-foreground capitalize">{p.provider ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Outstanding invoices */}
        <div className="card-surface p-5">
          <h2 className="font-display text-lg text-navy mb-4">Outstanding invoices</h2>
          {invLoading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : !outstandingInvoices || outstandingInvoices.length === 0 ? (
            <EmptyState title="All clear" description="No unpaid invoices." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 px-2">Number</th>
                    <th className="py-2 px-2">Client</th>
                    <th className="py-2 px-2 text-right">Total</th>
                    <th className="py-2 px-2 text-right">Due</th>
                    <th className="py-2 px-2">Due date</th>
                    <th className="py-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingInvoices.map((i) => {
                    const due = Number(i.total ?? 0) - Number(i.paid_total ?? 0);
                    const overdue = i.due_date && new Date(i.due_date) < new Date();
                    return (
                      <tr key={i.id} className="border-b border-border/60 hover:bg-muted/40">
                        <td className="py-2 px-2">
                          {i.case_id ? (
                            <Link to={`/cases/${i.case_id}`} className="hover:text-accent font-medium">{i.invoice_number}</Link>
                          ) : (
                            <span className="font-medium">{i.invoice_number}</span>
                          )}
                        </td>
                        <td className="py-2 px-2">{i.client_name}</td>
                        <td className="py-2 px-2 text-right">{fmtMoney(Number(i.total), i.currency)}</td>
                        <td className={`py-2 px-2 text-right font-medium ${overdue ? "text-destructive" : ""}`}>
                          {fmtMoney(due, i.currency)}
                        </td>
                        <td className={`py-2 px-2 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                          {fmtDateIST(i.due_date)}
                        </td>
                        <td className="py-2 px-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                            overdue ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning-foreground"
                          }`}>
                            {overdue ? "overdue" : i.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Commission ledger */}
        <div className="card-surface p-5">
          <h2 className="font-display text-lg text-navy mb-4">Commission ledger</h2>
          {comLoading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : !commissionLedger || commissionLedger.length === 0 ? (
            <EmptyState title="No commissions yet" description="Commissions will appear once rules trigger." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 px-2">Earned</th>
                    <th className="py-2 px-2">Staff</th>
                    <th className="py-2 px-2">Rule</th>
                    <th className="py-2 px-2 text-right">Amount</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionLedger.map((c) => (
                    <tr key={c.id} className="border-b border-border/60 hover:bg-muted/40">
                      <td className="py-2 px-2 text-muted-foreground">{fmtDateIST(c.earned_at)}</td>
                      <td className="py-2 px-2 font-medium">{c.staff_name}</td>
                      <td className="py-2 px-2 text-muted-foreground">{c.rule_code ?? "—"}</td>
                      <td className="py-2 px-2 text-right font-medium">{fmtMoney(Number(c.amount_inr))}</td>
                      <td className="py-2 px-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                          c.status === "paid" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{fmtDateIST(c.paid_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
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
      <div className="stat-value mt-2 truncate">{value}</div>
    </div>
  );
}
