"use client";

// src/components/lead-detail/KpiStrip.tsx
import { Card } from "@/components/ui/card";
import type { Lead, ProspectiveAppRow, ChainTask } from "@/lib/types";

interface Props {
  lead: Lead;
  prospective: ProspectiveAppRow[];
  nextAction: ChainTask | null;
}

function formatINR(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0
  }).format(n);
}

function slaRemaining(dueAt: string | null | undefined) {
  if (!dueAt) return { label: "—", color: "" };
  const ms = new Date(dueAt).getTime() - Date.now();
  const days = Math.ceil(ms / 86400000);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, color: "text-red-700" };
  if (days <= 1) return { label: `${days}d`, color: "text-red-700" };
  if (days <= 3) return { label: `${days} days`, color: "text-amber-700" };
  return { label: `${days} days`, color: "text-emerald-700" };
}

export function KpiStrip({ lead, prospective, nextAction }: Props) {
  const familyLTV = prospective.reduce((sum, p) => sum + (p.estimated_fee_cad || 0), 0);
  const sla = slaRemaining(nextAction?.sla_due_at);
  const serviceFee = lead.service_fee ?? lead.quoted_fee_inr ?? null;

  const tiles = [
    { label: "Open activities", value: String(lead.open_activities_count ?? 0) },
    { label: "Open pipelines", value: String(lead.open_cases_count ?? 0) },
    {
      label: "Days in stage",
      value: String(Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 86400000))
    },
    { label: "Quoted fee", value: formatINR(serviceFee) },
    {
      label: "Family LTV (est.)",
      value: familyLTV > 0 ? `CAD ${familyLTV.toLocaleString()}` : "—",
      valueClass: "text-emerald-700"
    },
    { label: "Chain SLA", value: sla.label, valueClass: sla.color },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mt-3">
      {tiles.map(t => (
        <Card key={t.label} className="p-3 bg-slate-50 border-slate-200">
          <p className="text-xs text-muted-foreground">{t.label}</p>
          <p className={`text-lg font-semibold mt-1 ${t.valueClass || ""}`}>{t.value}</p>
        </Card>
      ))}
    </div>
  );
}
