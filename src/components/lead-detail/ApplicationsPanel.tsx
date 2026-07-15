"use client";

// src/components/lead-detail/ApplicationsPanel.tsx
// Applications & chain pipeline — with family relationship visual

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Link as LinkIcon, ArrowRight, Users } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import type { ApplicationRow, ProspectiveAppRow } from "@/lib/types";

interface Props {
  applications: ApplicationRow[];
  prospective: ProspectiveAppRow[];
  currentLeadId: string;
  expanded?: boolean;
}

const STAGE_PALETTE: Record<string, { bg: string; text: string; bar: string }> = {
  new: { bg: "bg-blue-50", text: "text-blue-900", bar: "bg-blue-500" },
  onboarding: { bg: "bg-sky-50", text: "text-sky-900", bar: "bg-sky-500" },
  checklist_sent: { bg: "bg-pink-50", text: "text-pink-900", bar: "bg-pink-500" },
  docs_collection: { bg: "bg-pink-50", text: "text-pink-900", bar: "bg-pink-500" },
  documents_collection: { bg: "bg-pink-50", text: "text-pink-900", bar: "bg-pink-500" },
  application_prep: { bg: "bg-purple-50", text: "text-purple-900", bar: "bg-purple-500" },
  preparation: { bg: "bg-purple-50", text: "text-purple-900", bar: "bg-purple-500" },
  submitted: { bg: "bg-indigo-50", text: "text-indigo-900", bar: "bg-indigo-500" },
  processing: { bg: "bg-blue-50", text: "text-blue-900", bar: "bg-blue-500" },
  approved: { bg: "bg-emerald-50", text: "text-emerald-900", bar: "bg-emerald-500" },
  refused: { bg: "bg-red-50", text: "text-red-900", bar: "bg-red-500" },
};

const ROLE_LABEL: Record<string, string> = {
  spouse: "Spouse",
  partner: "Partner",
  child: "Child / Dependent",
  dependent: "Dependent",
  parent: "Parent",
  sibling: "Sibling",
  co_applicant: "Co-applicant",
};

const ROLE_COLORS: Record<string, string> = {
  spouse: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200",
  partner: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200",
  child: "bg-sky-100 text-sky-900 border-sky-200",
  dependent: "bg-sky-100 text-sky-900 border-sky-200",
  parent: "bg-violet-100 text-violet-900 border-violet-200",
  sibling: "bg-teal-100 text-teal-900 border-teal-200",
  co_applicant: "bg-orange-100 text-orange-900 border-orange-200",
};

const STAGE_STEP_TOTAL = 7;

function fmtINR(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(n);
}

function labelFor(type: string) {
  const labels: Record<string, string> = {
    sp: "Study Permit", study_permit: "Study Permit",
    pgwp: "Post-Graduation Work Permit", sowp: "Spouse Open Work Permit",
    work_permit: "Work Permit", work_permit_lmia: "Work Permit (LMIA)",
    bowp: "Bridging Open Work Permit", pr: "Permanent Residence",
    ee_profile_setup: "Express Entry profile setup", pnp_scan: "PNP eligibility scan",
    pr_eligibility_scan: "PR eligibility scan", citizenship: "Canadian Citizenship",
    sponsorship_scan: "Sponsorship review", pnp_nomination: "PNP nomination",
    arrival_checklist: "Arrival checklist", reapply_assessment: "Reapply/reconsideration",
  };
  return labels[type] || type;
}

interface AppCardProps {
  app: ApplicationRow;
  isPrimary: boolean;
  isLast?: boolean;
  hasSiblings?: boolean;
}

function AppCard({ app, isPrimary, isLast, hasSiblings }: AppCardProps) {
  const navigate = useNavigate();
  const stage = app.stage || app.current_stage_code || "new";
  const stageKey = stage.toLowerCase().replace(/\s+/g, "_");
  const palette = STAGE_PALETTE[stageKey] || STAGE_PALETTE.new;
  const stepNum = app.checklist_step || 0;
  const pct = Math.round((stepNum / STAGE_STEP_TOTAL) * 100);
  const fee = app.fee || app.quoted_fee_inr || 0;
  const paid = app.paid_amount || 0;
  const paidPct = fee ? Math.round((paid / fee) * 100) : 0;
  const caseRef = app.case_number || app.case_ref || app.id.slice(0, 8);
  const role = app.for_family_role?.toLowerCase() ?? null;

  return (
    <div className={`relative flex gap-0 ${!isPrimary ? "pl-6" : ""}`}>
      {/* Family tree connector */}
      {!isPrimary && (
        <div className="absolute left-0 top-0 bottom-0 flex flex-col items-center" style={{ width: 24 }}>
          {/* Vertical line going up */}
          <div className={`w-px bg-slate-300 ${isLast ? "h-1/2" : "h-full"} absolute top-0 left-[11px]`} />
          {/* Horizontal branch */}
          <div className="w-3 h-px bg-slate-300 absolute top-[22px] left-[11px]" />
        </div>
      )}

      <div
        className={`flex-1 border rounded-md p-3 mb-2 last:mb-0 transition-colors hover:bg-muted/40 ${
          isPrimary
            ? "border-primary/20 bg-primary/5"
            : "border-border"
        }`}
      >
        <div className="flex flex-wrap gap-3 items-center">
          {/* Ref + type */}
          <div style={{ minWidth: 110 }}>
            <p className="text-xs font-semibold text-blue-700">{caseRef}</p>
            <div className="flex items-center gap-1 flex-wrap mt-0.5">
              {isPrimary ? (
                <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-medium">
                  Primary applicant
                </span>
              ) : role ? (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${ROLE_COLORS[role] || "bg-slate-100 text-slate-700"}`}>
                  ↳ {ROLE_LABEL[role] || role}
                </span>
              ) : (
                <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                  ↳ Family member
                </span>
              )}
            </div>
          </div>

          {/* Title + destination */}
          <div className="flex-1 min-w-[120px]">
            <p className="text-sm font-medium truncate">{app.title || app.visa_type_name || "—"}</p>
            <p className="text-[10px] text-muted-foreground">
              {app.destination || app.country || "Canada"}
              {app.application_type ? ` · ${app.application_type.toUpperCase()}` : ""}
              {app.estimated_processing_weeks ? ` · ~${app.estimated_processing_weeks}w` : ""}
            </p>
          </div>

          {/* Stage badge */}
          <div>
            <Badge className={`${palette.bg} ${palette.text} font-medium`}>
              {stage.replace(/_/g, " ")}
            </Badge>
          </div>

          {/* Progress bar */}
          <div style={{ minWidth: 90 }}>
            <div className="bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div className={`${palette.bar} h-full`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{stepNum}/{STAGE_STEP_TOTAL} steps</p>
          </div>

          {/* Fee */}
          <div style={{ minWidth: 100 }}>
            <p className="text-xs">{paidPct}% paid</p>
            <p className="text-[10px] text-muted-foreground">{fmtINR(paid)} / {fmtINR(fee)}</p>
          </div>

          {/* Action */}
          <Button size="sm" variant="ghost" onClick={() => navigate(`/cases/${app.id}`)}>
            Open <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ApplicationsPanel({ applications, prospective, currentLeadId }: Props) {
  if (applications.length === 0 && prospective.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-muted-foreground">No applications yet. Convert the lead to start.</p>
      </Card>
    );
  }

  // Split into primary (this lead's own) and related (family members on same family unit)
  const primary = applications.filter(a => a.lead_id === currentLeadId || a.client_id === currentLeadId);
  const related = applications.filter(a => a.lead_id !== currentLeadId && a.client_id !== currentLeadId);

  // If we can't distinguish, show all as primary
  const showAll = primary.length === 0;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Applications &amp; chain pipeline</h3>
          {related.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <Users className="w-3 h-3" /> Family unit
            </span>
          )}
        </div>
        <Button size="sm" variant="outline">
          <Plus className="w-3 h-3 mr-1" />Add application
        </Button>
      </div>

      {/* Active applications — grouped (primary first, then related family members) */}
      {showAll ? (
        /* Can't distinguish primary from family — flat list */
        applications.map(app => (
          <AppCard key={app.id} app={app} isPrimary={true} />
        ))
      ) : (
        <div>
          {primary.map(app => (
            <AppCard key={app.id} app={app} isPrimary={true} hasSiblings={related.length > 0} />
          ))}
          {related.map((app, idx) => (
            <AppCard
              key={app.id}
              app={app}
              isPrimary={false}
              isLast={idx === related.length - 1}
            />
          ))}
        </div>
      )}

      {/* Prospective / chain pipeline rows */}
      {prospective.map(p => (
        <div
          key={p.id}
          className="border border-dashed border-amber-400 bg-amber-50/60 rounded-md p-3 mb-2 last:mb-0"
        >
          <div className="flex flex-wrap gap-3 items-center">
            <div style={{ minWidth: 110 }}>
              <p className="text-xs font-semibold text-amber-900 flex items-center gap-1">
                <LinkIcon className="w-3 h-3" /> PROSPECTIVE
              </p>
              <p className="text-[10px] text-amber-800">
                {p.target_application_type?.toUpperCase()} · {p.for_person_type}
              </p>
            </div>
            <div className="flex-1 min-w-[120px]">
              <p className="text-sm font-medium text-amber-900 truncate">
                {labelFor(p.target_application_type)}
              </p>
              <p className="text-[10px] text-amber-800">
                {(p as unknown as Record<string, unknown>)?.chain_rule
                  ? ((p as unknown as Record<string, Record<string, unknown>>).chain_rule?.description as string ?? "Auto-triggered by chain rule")
                  : "Auto-triggered by chain rule"}
              </p>
            </div>
            <div>
              <Badge className="bg-amber-200 text-amber-900 font-medium">Pending action</Badge>
            </div>
            <div style={{ minWidth: 100 }}>
              <p className="text-xs text-amber-900">
                Triggers {new Date(p.trigger_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
              </p>
              {p.expires_on && (
                <p className="text-[10px] text-amber-800">
                  SLA {new Date(p.expires_on).toLocaleDateString("en-IN")}
                </p>
              )}
            </div>
            <div style={{ minWidth: 100 }}>
              <p className="text-xs text-amber-900">
                {p.estimated_fee_cad ? `~CAD ${p.estimated_fee_cad.toLocaleString()}` : "Fee TBD"}
              </p>
              <p className="text-[10px] text-amber-800">Not quoted yet</p>
            </div>
            <Button size="sm" variant="outline" className="border-amber-400 text-amber-900 hover:bg-amber-100">
              Review <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      ))}
    </Card>
  );
}
