"use client";

// src/components/lead-detail/PathwayPlanCard.tsx
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import type { ApplicationRow, ProspectiveAppRow } from "@/lib/types";

interface Props {
  applications: ApplicationRow[];
  prospective: ProspectiveAppRow[];
  expanded?: boolean;
}

type Step = {
  status: "done" | "in_progress" | "prospective" | "future";
  title: string;
  subtitle: string;
};

const PALETTE: Record<Step["status"], { bg: string; text: string; subText: string; iconBg: string }> = {
  done:         { bg: "bg-emerald-50",  text: "text-emerald-900",  subText: "text-emerald-700",  iconBg: "bg-emerald-100 text-emerald-900" },
  in_progress:  { bg: "bg-pink-50",     text: "text-pink-900",      subText: "text-pink-700",     iconBg: "bg-pink-100 text-pink-900" },
  prospective:  { bg: "bg-amber-50",    text: "text-amber-900",     subText: "text-amber-700",    iconBg: "bg-amber-100 text-amber-900" },
  future:       { bg: "bg-slate-50",    text: "text-slate-700",     subText: "text-slate-500",    iconBg: "bg-slate-100 text-slate-700" },
};

export function PathwayPlanCard({ applications, prospective }: Props) {
  const steps: Step[] = buildSteps(applications, prospective);

  return (
    <Card className="p-4">
      <h3 className="font-semibold text-sm mb-3">Pathway plan</h3>
      {steps.length === 0 ? (
        <p className="text-sm text-muted-foreground">No applications or prospective items yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {steps.map((step, i) => {
            const palette = PALETTE[step.status];
            return (
              <div key={i} className="flex gap-2 items-start">
                <div className={`w-6 h-6 rounded-full ${palette.iconBg} flex items-center justify-center text-xs font-semibold shrink-0`}>
                  {step.status === "done" ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <div className={`flex-1 px-3 py-1.5 ${palette.bg} rounded-md`}>
                  <p className={`text-sm font-medium ${palette.text}`}>{step.title}</p>
                  <p className={`text-[10px] ${palette.subText}`}>{step.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function buildSteps(apps: ApplicationRow[], prosp: ProspectiveAppRow[]): Step[] {
  const out: Step[] = [];

  apps.forEach(a => {
    const name = a.title || a.visa_type_name || a.application_type || a.current_stage_code || "Application";
    const stage = a.stage || a.current_stage_code || "in_progress";
    if (a.outcome === "approved") {
      out.push({
        status: "done",
        title: `${name} approved`,
        subtitle: a.decision_date
          ? new Date(a.decision_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
          : "Approved",
      });
    } else if (a.outcome === "refused") {
      out.push({
        status: "in_progress",
        title: `${name} refused — reapply`,
        subtitle: a.decision_date ? new Date(a.decision_date).toLocaleDateString("en-IN") : "",
      });
    } else {
      out.push({
        status: "in_progress",
        title: `${name} — in progress`,
        subtitle: `Stage: ${stage}${a.checklist_step ? ` · step ${a.checklist_step}/7` : ""}`,
      });
    }
  });

  prosp
    .sort((a, b) => new Date(a.trigger_date).getTime() - new Date(b.trigger_date).getTime())
    .forEach(p => {
      out.push({
        status: "prospective",
        title: `${labelFor(p.target_application_type)} — chain-triggered`,
        subtitle: `Triggers ${new Date(p.trigger_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`,
      });
    });

  return out;
}

function labelFor(t: string) {
  const map: Record<string, string> = {
    sp: "Study Permit", study_permit: "Study Permit",
    pgwp: "PGWP", sowp: "SOWP", bowp: "BOWP",
    work_permit: "Work Permit", work_permit_lmia: "Work Permit (LMIA)",
    pr: "PR", citizenship: "Citizenship",
    ee_profile_setup: "EE profile setup", pnp_scan: "PNP scan",
    pr_eligibility_scan: "PR scan", arrival_checklist: "Arrival checklist",
    sponsorship_scan: "Sponsorship review", pnp_nomination: "PNP nomination",
    reapply_assessment: "Reapply/reconsider",
  };
  return map[t] || t;
}
