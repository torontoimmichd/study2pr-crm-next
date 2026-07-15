"use client";

/**
 * StageTransitionWizard — v2
 *
 * Fixes applied vs v1:
 *   1. Single stage selection — click selected stage again to deselect
 *   2. Waiting: shows "Target date" (not "End date"); Start date renamed "From date"
 *   3. Waiting: "Other" reason reveals a free-text input
 *   4. Removed "Transition notes" — only "Review notes" remains
 *   5. Proposal Sent: service type + visa type picker, auto-filled fee, role-gated discount
 *   6. All saved values echoed into lead notes on save
 */

import { useState, useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

// ---------- Stage registry ----------

interface StageDefinition {
  value: string;
  label: string;
  group: "active" | "waiting" | "terminal";
  description: string;
}

const STAGES: StageDefinition[] = [
  { value: "new_enquiry",   label: "New Enquiry",   group: "active",   description: "Just arrived — not yet contacted" },
  { value: "contacted",     label: "Contacted",     group: "active",   description: "First contact made" },
  { value: "assessed",      label: "Assessed",      group: "active",   description: "Eligibility assessment done" },
  { value: "proposal_sent", label: "Proposal Sent", group: "active",   description: "Retainer proposal delivered" },
  { value: "negotiating",   label: "Negotiating",   group: "active",   description: "Discussing terms or objections" },
  { value: "waiting",       label: "Waiting",       group: "waiting",  description: "Lead not yet eligible — monitoring" },
  { value: "nurturing",     label: "Nurturing",     group: "waiting",  description: "Long-term contact cadence active" },
  { value: "cold",          label: "Cold",          group: "terminal", description: "Stopped responding — archived" },
  { value: "not_eligible",  label: "Not Eligible",  group: "terminal", description: "Does not qualify for any pathway" },
  { value: "lost",          label: "Lost",          group: "terminal", description: "Chose another firm or gave up" },
];

const STAGE_GROUPS: { key: "active" | "waiting" | "terminal"; label: string }[] = [
  { key: "active",   label: "Active Pipeline" },
  { key: "waiting",  label: "Holding" },
  { key: "terminal", label: "Terminal" },
];

const STAGE_COLOR: Record<string, string> = {
  new_enquiry:   "border-blue-400/50 hover:border-blue-500",
  contacted:     "border-indigo-400/50 hover:border-indigo-500",
  assessed:      "border-violet-400/50 hover:border-violet-500",
  proposal_sent: "border-amber-400/50 hover:border-amber-500",
  negotiating:   "border-orange-400/50 hover:border-orange-500",
  waiting:       "border-yellow-400/50 hover:border-yellow-500",
  nurturing:     "border-lime-400/50 hover:border-lime-500",
  cold:          "border-slate-400/50 hover:border-slate-500",
  not_eligible:  "border-red-400/50 hover:border-red-500",
  lost:          "border-rose-500/50 hover:border-rose-600",
};

// Discount caps by role
const DISCOUNT_CAP: Record<string, number> = {
  owner: 20,
  admin: 20,
  senior_advisor: 15,
  case_manager: 10,
  document_specialist: 10,
  support: 10,
  accountant: 0,
};

// ---------- Types ----------

export interface LeadStageData {
  lifecycle_state?: string;
  waiting_reason?: string | null;
  waiting_start_date?: string | null;
  waiting_end_date?: string | null;
  waiting_contact_frequency?: string | null;
  waiting_review_notes?: string | null;
  waiting_linked_milestone?: string | null;
  stage_metadata?: Record<string, unknown> | null;
  notes?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentStage: string;
  leadData?: LeadStageData;
  onTransition: (updates: Record<string, unknown>) => Promise<void>;
}

// ---------- Main wizard ----------

export function StageTransitionWizard({ open, onOpenChange, currentStage, leadData, onTransition }: Props) {
  const { profile } = useAuth();
  const [target, setTarget] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Reset when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTarget(null);
      setForm({});
    }
  }, [open]);

  const { data: visaTypes } = useQuery({
    queryKey: ["visa-types-active"],
    queryFn: async () => {
      const { data } = await supabase.from("visa_types").select("id, label").eq("is_active", true).order("label");
      return data ?? [];
    },
    enabled: open,
  });

  // For each visa type, track its stored fee
  const { data: visaFees } = useQuery({
    queryKey: ["visa-type-fees"],
    queryFn: async () => {
      const { data } = await supabase.from("visa_types").select("id, base_fee_inr").eq("is_active", true);
      const map: Record<string, number> = {};
      (data ?? []).forEach((v) => {
        if (v.base_fee_inr) map[v.id] = v.base_fee_inr;
      });
      return map;
    },
    enabled: open,
  });

  const handleSelectTarget = (stage: string) => {
    if (stage === currentStage) return;
    // Toggle: clicking the already-selected target deselects it
    if (stage === target) {
      setTarget(null);
      setForm({});
      return;
    }
    setTarget(stage);

    // Pre-fill existing data
    if (stage === "waiting" && leadData) {
      setForm({
        waiting_reason:            leadData.waiting_reason ?? "",
        waiting_start_date:        leadData.waiting_start_date ?? new Date().toISOString().slice(0, 10),
        waiting_end_date:          leadData.waiting_end_date ?? "",
        waiting_reason_other:      "",
        waiting_contact_frequency: leadData.waiting_contact_frequency ?? "monthly",
        waiting_review_notes:      leadData.waiting_review_notes ?? "",
        waiting_linked_milestone:  leadData.waiting_linked_milestone ?? "",
      });
    } else if (stage === "proposal_sent" && leadData?.stage_metadata) {
      const m = leadData.stage_metadata as Record<string, string>;
      setForm({
        proposal_date:      m.proposal_date ?? new Date().toISOString().slice(0, 10),
        visa_type_id:       m.visa_type_id ?? "",
        fee_quoted_inr:     String(m.fee_quoted_inr ?? ""),
        discount_pct:       String(m.discount_pct ?? "0"),
        services_included:  m.services_included ?? "",
        review_notes:       m.review_notes ?? "",
      });
    } else if (stage === "negotiating" && leadData?.stage_metadata) {
      const m = leadData.stage_metadata as Record<string, string>;
      setForm({
        objection_type:      m.objection_type ?? "",
        resolution_approach: m.resolution_approach ?? "",
        review_notes:        m.review_notes ?? "",
      });
    } else {
      setForm({ review_notes: "" });
    }
  };

  const validate = (): boolean => {
    if (!target) return false;

    if (target === "waiting") {
      const reason = form.waiting_reason;
      if (!reason) { toast.error("Waiting reason is required"); return false; }
      if (reason === "other" && !form.waiting_reason_other?.trim()) {
        toast.error("Please specify the 'Other' reason"); return false;
      }
      if (!form.waiting_start_date) { toast.error("From date is required"); return false; }
      if (!form.waiting_contact_frequency) { toast.error("Contact frequency is required"); return false; }
      if (!form.waiting_review_notes || form.waiting_review_notes.length < 20) {
        toast.error("Review notes must be at least 20 characters"); return false;
      }
    }

    if (target === "proposal_sent") {
      if (!form.proposal_date) { toast.error("Proposal date is required"); return false; }
      if (!form.visa_type_id) { toast.error("Service / visa type is required"); return false; }
      if (!form.fee_quoted_inr || isNaN(Number(form.fee_quoted_inr))) {
        toast.error("Fee is required"); return false;
      }
      const disc = Number(form.discount_pct ?? 0);
      const cap = DISCOUNT_CAP[profile?.role ?? "case_manager"] ?? 10;
      if (disc > cap) {
        toast.error(`Your role can offer max ${cap}% discount`); return false;
      }
    }

    if (target === "negotiating") {
      if (!form.objection_type) { toast.error("Objection type is required"); return false; }
    }

    return true;
  };

  const buildNoteEntry = (): string => {
    if (!target) return "";
    const targetLabel = STAGES.find((s) => s.value === target)?.label ?? target;
    const ts = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
    const lines: string[] = [`[${ts}] Stage → ${targetLabel}`];

    if (target === "waiting") {
      const reasonLabels: Record<string, string> = {
        ielts_pending: "IELTS / Language test pending",
        work_experience_incomplete: "Work experience incomplete",
        funds_arrangement: "Funds arrangement in progress",
        spouse_wp_pr_pending: "Spouse WP / PR pending",
        pnp_intake_not_open: "PNP intake not open",
        family_decision_pending: "Family decision pending",
        graduation_pending: "Graduation pending",
        permit_expiry_awaited: "Permit expiry awaited",
        crs_score_improvement: "CRS score improvement in progress",
        medical_police_clearance: "Medical / Police clearance pending",
        other: form.waiting_reason_other || "Other",
      };
      lines.push(`Reason: ${reasonLabels[form.waiting_reason] ?? form.waiting_reason}`);
      lines.push(`From: ${form.waiting_start_date}${form.waiting_end_date ? ` → Target: ${form.waiting_end_date}` : ""}`);
      lines.push(`Contact frequency: ${form.waiting_contact_frequency}`);
      if (form.waiting_linked_milestone) lines.push(`Milestone: ${form.waiting_linked_milestone}`);
      lines.push(`Notes: ${form.waiting_review_notes}`);
    } else if (target === "proposal_sent") {
      const visaLabel = visaTypes?.find((v) => v.id === form.visa_type_id)?.label ?? form.visa_type_id;
      const disc = Number(form.discount_pct ?? 0);
      const base = Number(form.fee_quoted_inr);
      const final = Math.round(base * (1 - disc / 100));
      lines.push(`Service: ${visaLabel}`);
      lines.push(`Fee: ₹${base.toLocaleString()}${disc > 0 ? ` (${disc}% discount → ₹${final.toLocaleString()})` : ""}`);
      lines.push(`Proposal date: ${form.proposal_date}`);
      if (form.services_included) lines.push(`Services: ${form.services_included}`);
      if (form.review_notes) lines.push(`Notes: ${form.review_notes}`);
    } else if (target === "negotiating") {
      lines.push(`Objection: ${form.objection_type.replace(/_/g, " ")}`);
      if (form.resolution_approach) lines.push(`Approach: ${form.resolution_approach}`);
      if (form.review_notes) lines.push(`Notes: ${form.review_notes}`);
    } else {
      if (form.review_notes) lines.push(`Notes: ${form.review_notes}`);
    }

    return lines.join("\n");
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = { lifecycle_state: target };

      if (target === "waiting") {
        const effectiveReason = form.waiting_reason === "other"
          ? `other:${form.waiting_reason_other}`
          : form.waiting_reason;
        updates.waiting_reason            = effectiveReason || null;
        updates.waiting_start_date        = form.waiting_start_date || null;
        updates.waiting_end_date          = form.waiting_end_date || null;
        updates.waiting_contact_frequency = form.waiting_contact_frequency || null;
        updates.waiting_review_notes      = form.waiting_review_notes || null;
        updates.waiting_linked_milestone  = form.waiting_linked_milestone || null;
        updates.stage_metadata = {
          reason_other:   form.waiting_reason === "other" ? form.waiting_reason_other : null,
          review_notes:   form.waiting_review_notes ?? null,
        };
      } else if (target === "proposal_sent") {
        const base = Number(form.fee_quoted_inr);
        const disc = Number(form.discount_pct ?? 0);
        updates.stage_metadata = {
          proposal_date:    form.proposal_date,
          visa_type_id:     form.visa_type_id,
          fee_quoted_inr:   base,
          discount_pct:     disc,
          fee_final_inr:    Math.round(base * (1 - disc / 100)),
          services_included: form.services_included,
          review_notes:     form.review_notes ?? null,
        };
      } else if (target === "negotiating") {
        updates.stage_metadata = {
          objection_type:      form.objection_type,
          resolution_approach: form.resolution_approach ?? null,
          review_notes:        form.review_notes ?? null,
        };
      } else {
        updates.stage_metadata = { review_notes: form.review_notes ?? null };
      }

      // Append note entry to lead notes
      const noteEntry = buildNoteEntry();
      if (noteEntry) {
        const existing = (leadData?.notes ?? "").trim();
        updates.notes = existing ? `${existing}\n\n${noteEntry}` : noteEntry;
      }

      await onTransition(updates);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const targetDef = STAGES.find((s) => s.value === target);
  const discountCap = DISCOUNT_CAP[profile?.role ?? "case_manager"] ?? 10;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-navy">Move Pipeline Stage</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Current: <span className="font-medium text-foreground capitalize">{currentStage.replace(/_/g, " ")}</span>
            {target
              ? <>{" → "}<span className="font-medium text-primary capitalize">{target.replace(/_/g, " ")}</span></>
              : <span className="text-muted-foreground"> — select a target below</span>}
          </p>
        </DialogHeader>

        {/* Stage grid */}
        <div className="space-y-4">
          {STAGE_GROUPS.map(({ key, label }) => (
            <div key={key}>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">{label}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {STAGES.filter((s) => s.group === key).map((stage) => {
                  const isCurrent = stage.value === currentStage;
                  const isTarget  = stage.value === target;
                  return (
                    <button
                      key={stage.value}
                      onClick={() => handleSelectTarget(stage.value)}
                      disabled={isCurrent}
                      title={isCurrent ? "Current stage" : isTarget ? "Click to deselect" : stage.description}
                      className={cn(
                        "relative text-left px-3 py-2.5 rounded-lg border text-sm transition-all",
                        isCurrent
                          ? "border-gold/70 bg-gold/10 text-gold-foreground cursor-default ring-2 ring-gold/30"
                          : isTarget
                          ? "border-primary bg-primary/10 text-primary font-medium ring-2 ring-primary/30"
                          : cn("bg-card hover:bg-muted/60 text-foreground cursor-pointer", STAGE_COLOR[stage.value] ?? "border-border"),
                      )}
                    >
                      {isCurrent && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-gold absolute top-2 right-2" />
                      )}
                      {isTarget && (
                        <X className="h-3 w-3 text-primary/60 absolute top-2 right-2" />
                      )}
                      <div className="font-medium text-[13px] pr-5">{stage.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{stage.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Stage-specific required fields */}
        {target && (
          <>
            <Separator />
            <div className="space-y-4">
              <div className="text-sm font-semibold text-foreground">
                Required info for <span className="text-primary">{targetDef?.label}</span>
              </div>

              {target === "waiting"       && <WaitingFields       form={form} setForm={setForm} />}
              {target === "proposal_sent" && (
                <ProposalSentFields
                  form={form}
                  setForm={setForm}
                  visaTypes={visaTypes ?? []}
                  visaFees={visaFees ?? {}}
                  discountCap={discountCap}
                />
              )}
              {target === "negotiating"   && <NegotiatingFields   form={form} setForm={setForm} />}

              {/* Review notes for all stages */}
              {!["waiting", "proposal_sent", "negotiating"].includes(target) && (
                <div className="space-y-1.5">
                  <Label htmlFor="tz-review-notes">
                    Review notes
                    {["cold","not_eligible","lost"].includes(target) && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </Label>
                  <Textarea
                    id="tz-review-notes"
                    rows={3}
                    value={form.review_notes ?? ""}
                    onChange={(e) => setForm({ ...form, review_notes: e.target.value })}
                    placeholder={`Why is this lead moving to "${targetDef?.label}"? Any context for teammates…`}
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={saving} className="bg-primary hover:bg-primary/90">
                {saving ? "Moving…" : `Confirm → ${targetDef?.label}`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Stage-specific field sets ----------

function WaitingFields({ form, setForm }: { form: Record<string, string>; setForm: (f: Record<string, string>) => void }) {
  const set = (k: string, v: string) => setForm({ ...form, [k]: v });
  const showOtherInput = form.waiting_reason === "other";

  return (
    <div className="space-y-3 p-4 bg-yellow-50/60 dark:bg-yellow-950/20 rounded-lg border border-yellow-200/60 dark:border-yellow-800/40">
      <div className="text-[11px] uppercase tracking-widest text-yellow-700 dark:text-yellow-300 font-semibold">Waiting Period (Required)</div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Waiting reason *</Label>
          <Select value={form.waiting_reason ?? ""} onValueChange={(v) => set("waiting_reason", v)}>
            <SelectTrigger><SelectValue placeholder="Select reason…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ielts_pending">IELTS / Language test pending</SelectItem>
              <SelectItem value="work_experience_incomplete">Work experience incomplete</SelectItem>
              <SelectItem value="funds_arrangement">Funds arrangement in progress</SelectItem>
              <SelectItem value="spouse_wp_pr_pending">Spouse WP / PR pending</SelectItem>
              <SelectItem value="pnp_intake_not_open">PNP intake not open</SelectItem>
              <SelectItem value="family_decision_pending">Family decision pending</SelectItem>
              <SelectItem value="graduation_pending">Graduation pending</SelectItem>
              <SelectItem value="permit_expiry_awaited">Permit expiry awaited</SelectItem>
              <SelectItem value="crs_score_improvement">CRS score improvement in progress</SelectItem>
              <SelectItem value="medical_police_clearance">Medical / Police clearance pending</SelectItem>
              <SelectItem value="other">Other…</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showOtherInput && (
          <div className="col-span-2 space-y-1.5">
            <Label>Specify reason *</Label>
            <Input
              value={form.waiting_reason_other ?? ""}
              onChange={(e) => set("waiting_reason_other", e.target.value)}
              placeholder="Describe the reason…"
              autoFocus
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>From date *</Label>
          <Input type="date" value={form.waiting_start_date ?? ""} onChange={(e) => set("waiting_start_date", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Target date <span className="text-muted-foreground font-normal">(when condition resolves)</span></Label>
          <Input type="date" value={form.waiting_end_date ?? ""} onChange={(e) => set("waiting_end_date", e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>Contact frequency *</Label>
          <Select value={form.waiting_contact_frequency ?? ""} onValueChange={(v) => set("waiting_contact_frequency", v)}>
            <SelectTrigger><SelectValue placeholder="How often?" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="bi_weekly">Bi-weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Linked milestone <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            value={form.waiting_linked_milestone ?? ""}
            onChange={(e) => set("waiting_linked_milestone", e.target.value)}
            placeholder="e.g. IELTS result April 2025"
          />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label>
            Review notes * <span className="text-muted-foreground font-normal">(min 20 chars — plan for when the period ends)</span>
          </Label>
          <Textarea
            rows={3}
            value={form.waiting_review_notes ?? ""}
            onChange={(e) => set("waiting_review_notes", e.target.value)}
            placeholder="What outcome are we waiting for, what's the plan when it happens?"
          />
          <div className="text-[11px] text-muted-foreground text-right">
            {(form.waiting_review_notes ?? "").length} / 20 min chars
          </div>
        </div>
      </div>
    </div>
  );
}

interface ProposalSentFieldsProps {
  form: Record<string, string>;
  setForm: (f: Record<string, string>) => void;
  visaTypes: { id: string; label: string }[];
  visaFees: Record<string, number>;
  discountCap: number;
}

function ProposalSentFields({ form, setForm, visaTypes, visaFees, discountCap }: ProposalSentFieldsProps) {
  const set = (k: string, v: string) => setForm({ ...form, [k]: v });

  const handleVisaSelect = (id: string) => {
    const fee = visaFees[id];
    setForm({
      ...form,
      visa_type_id: id,
      fee_quoted_inr: fee ? String(fee) : form.fee_quoted_inr,
      discount_pct: form.discount_pct || "0",
    });
  };

  const base    = Number(form.fee_quoted_inr || 0);
  const disc    = Math.min(Number(form.discount_pct || 0), discountCap);
  const final   = base > 0 ? Math.round(base * (1 - disc / 100)) : 0;

  return (
    <div className="space-y-3 p-4 bg-amber-50/60 dark:bg-amber-950/20 rounded-lg border border-amber-200/60 dark:border-amber-800/40">
      <div className="text-[11px] uppercase tracking-widest text-amber-700 dark:text-amber-300 font-semibold">Proposal Details (Required)</div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Proposal date *</Label>
          <Input type="date" value={form.proposal_date ?? ""} onChange={(e) => set("proposal_date", e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>Service / Visa type *</Label>
          <Select value={form.visa_type_id ?? ""} onValueChange={handleVisaSelect}>
            <SelectTrigger><SelectValue placeholder="Select service…" /></SelectTrigger>
            <SelectContent>
              {visaTypes.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Base fee (INR) *</Label>
          <Input
            type="number"
            min="0"
            step="500"
            value={form.fee_quoted_inr ?? ""}
            onChange={(e) => set("fee_quoted_inr", e.target.value)}
            placeholder="e.g. 150000"
          />
        </div>

        <div className="space-y-1.5">
          <Label>
            Discount %
            <span className="text-muted-foreground font-normal ml-1">(max {discountCap}% for your role)</span>
          </Label>
          <Input
            type="number"
            min="0"
            max={discountCap}
            step="1"
            value={form.discount_pct ?? "0"}
            onChange={(e) => {
              const v = Math.min(Number(e.target.value), discountCap);
              set("discount_pct", String(v));
            }}
          />
        </div>

        {base > 0 && (
          <div className="col-span-2 flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Final fee:</span>
            <span className="font-semibold text-foreground">₹{final.toLocaleString()}</span>
            {disc > 0 && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                {disc}% off
              </span>
            )}
          </div>
        )}

        <div className="col-span-2 space-y-1.5">
          <Label>Services included <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Textarea
            rows={2}
            value={form.services_included ?? ""}
            onChange={(e) => set("services_included", e.target.value)}
            placeholder="e.g. Study Permit application, Document prep, Pre-departure counseling…"
          />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label>Review notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Textarea
            rows={2}
            value={form.review_notes ?? ""}
            onChange={(e) => set("review_notes", e.target.value)}
            placeholder="Any follow-up context or next steps after sending the proposal…"
          />
        </div>
      </div>
    </div>
  );
}

function NegotiatingFields({ form, setForm }: { form: Record<string, string>; setForm: (f: Record<string, string>) => void }) {
  const set = (k: string, v: string) => setForm({ ...form, [k]: v });
  return (
    <div className="space-y-3 p-4 bg-orange-50/60 dark:bg-orange-950/20 rounded-lg border border-orange-200/60 dark:border-orange-800/40">
      <div className="text-[11px] uppercase tracking-widest text-orange-700 dark:text-orange-300 font-semibold">Negotiation Context (Required)</div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Objection type *</Label>
          <Select value={form.objection_type ?? ""} onValueChange={(v) => set("objection_type", v)}>
            <SelectTrigger><SelectValue placeholder="What is the client's concern?" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fee_too_high">Fee too high</SelectItem>
              <SelectItem value="timeline_too_long">Timeline too long</SelectItem>
              <SelectItem value="service_scope">Service scope unclear or insufficient</SelectItem>
              <SelectItem value="competitor_offer">Competitor offer on the table</SelectItem>
              <SelectItem value="success_guarantee">Asking for success guarantee</SelectItem>
              <SelectItem value="family_approval">Waiting for family approval</SelectItem>
              <SelectItem value="financial_timing">Financial timing issue</SelectItem>
              <SelectItem value="other">Other objection</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Resolution approach <span className="text-muted-foreground font-normal">(optional but encouraged)</span></Label>
          <Textarea
            rows={2}
            value={form.resolution_approach ?? ""}
            onChange={(e) => set("resolution_approach", e.target.value)}
            placeholder="How are you planning to address this objection?"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Review notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Textarea
            rows={2}
            value={form.review_notes ?? ""}
            onChange={(e) => set("review_notes", e.target.value)}
            placeholder="Any additional context for the team…"
          />
        </div>
      </div>
    </div>
  );
}
