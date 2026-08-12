"use client";

// src/components/lead-detail/KpiStrip.tsx
//
// Restyled 2026-08-11 to the reference layout Gaurav supplied: fewer, larger
// tiles with a big tinted number, instead of six small grey boxes.
//
// 2026-08-11 (later) — Quoted fee and Family LTV REMOVED at Gaurav's request.
// Family LTV summed prospective_applications.estimated_fee_cad, i.e. a CAD
// figure sitting beside INR numbers on the same strip. That is the same
// currency-mixing hazard sql/73 was written to avoid: a reader has no way to
// tell which unit a tile is in. Quoted fee belongs on the application, not on
// the lead. Four tiles remain.
import { Card } from "@/components/ui/card";
import type { ApplicationRow, Lead, ProspectiveAppRow, ChainTask } from "@/lib/types";

interface Props {
  lead: Lead;
  application: ApplicationRow | null;
  prospective: ProspectiveAppRow[];
  nextAction: ChainTask | null;
}

// formatINR removed with the Quoted fee tile. `application` and `prospective`
// stay on Props so the caller needs no change; they are simply unused now.

function slaRemaining(dueAt: string | null | undefined) {
  if (!dueAt) return { label: "—", tone: "slate" as const };
  const ms = new Date(dueAt).getTime() - Date.now();
  const days = Math.ceil(ms / 86400000);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: "red" as const };
  if (days <= 1) return { label: `${days}d`, tone: "red" as const };
  if (days <= 3) return { label: `${days} days`, tone: "amber" as const };
  return { label: `${days} days`, tone: "emerald" as const };
}

type Tone = "indigo" | "emerald" | "violet" | "amber" | "red" | "slate";

// Soft tinted surface + a strong number, matching the reference tiles.
const TONE: Record<Tone, { card: string; value: string }> = {
  indigo:  { card: "bg-indigo-50/70 border-indigo-100",   value: "text-indigo-600" },
  emerald: { card: "bg-emerald-50/70 border-emerald-100", value: "text-emerald-600" },
  violet:  { card: "bg-violet-50/70 border-violet-100",   value: "text-violet-600" },
  amber:   { card: "bg-amber-50/70 border-amber-100",     value: "text-amber-700" },
  red:     { card: "bg-red-50/70 border-red-100",         value: "text-red-600" },
  slate:   { card: "bg-slate-50 border-slate-200",        value: "text-slate-700" },
};

export function KpiStrip({ lead, nextAction }: Props) {
  const sla = slaRemaining(nextAction?.sla_due_at);
  const daysInStage = Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 86400000);

  const tiles: Array<{ label: string; value: string; tone: Tone }> = [
    { label: "Open activities", value: String(lead.open_activities_count ?? 0), tone: "indigo" },
    { label: "Open pipelines",  value: String(lead.open_cases_count ?? 0),      tone: "emerald" },
    { label: "Days in stage",   value: String(daysInStage),                     tone: "violet" },
    { label: "Chain SLA",       value: sla.label,                               tone: sla.tone },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
      {tiles.map(t => {
        const tone = TONE[t.tone];
        return (
          <Card key={t.label} className={`px-4 py-5 text-center border ${tone.card}`}>
            <p className={`text-2xl font-semibold leading-none tracking-tight ${tone.value}`}>
              {t.value}
            </p>
            <p className="text-xs text-muted-foreground mt-2">{t.label}</p>
          </Card>
        );
      })}
    </div>
  );
}
