"use client";

// src/components/applications/MarkOutcomePopover.tsx
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Archive, CheckCircle2, CircleSlash2, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ANCHOR_FIELDS_BY_TYPE: Record<string, Array<{ key: string; label: string }>> = {
  study_permit: [{ key: "study_end_date", label: "Study end date" }, { key: "document_expiry_date", label: "Permit expiry" }],
  sp: [{ key: "study_end_date", label: "Study end date" }, { key: "document_expiry_date", label: "Permit expiry" }],
  pgwp: [{ key: "pgwp_expiry_date", label: "PGWP expiry" }, { key: "first_canadian_work_day", label: "Work start date" }],
  sowp: [{ key: "document_expiry_date", label: "Permit expiry" }, { key: "first_canadian_work_day", label: "Work start date" }],
  work_permit: [{ key: "document_expiry_date", label: "Permit expiry" }, { key: "first_canadian_work_day", label: "Work start date" }],
  pr: [{ key: "landing_date", label: "Landing date" }],
};

interface Props {
  caseId: string;
  applicationType: string;
  outcome: "approved" | "refused" | "withdrawn" | "closed";
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: (decisionDate: string) => void;
}

export function MarkOutcomePopover({ caseId, applicationType, outcome, open, onOpenChange, onSuccess }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [decisionDate, setDecisionDate] = useState(today);
  const [anchors, setAnchors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const anchorFields = outcome === "approved"
    ? (ANCHOR_FIELDS_BY_TYPE[applicationType.toLowerCase()] || [])
    : [];
  const outcomeMeta = {
    approved: { label: "approved", description: "IRCC approved this application.", icon: CheckCircle2, color: "text-emerald-600" },
    refused: { label: "refused", description: "IRCC refused this application. An outcome review will be opened.", icon: XCircle, color: "text-red-600" },
    withdrawn: { label: "withdrawn", description: "The client withdrew this application before a decision.", icon: CircleSlash2, color: "text-slate-600" },
    closed: { label: "closed", description: "This file is finished without a decision, for example because the client went quiet or went elsewhere.", icon: Archive, color: "text-amber-600" },
  }[outcome];

  async function submit() {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("mark_case_outcome", {
        p_case_id: caseId,
        p_outcome: outcome,
        p_decision_date: decisionDate,
        p_study_end_date: anchors.study_end_date || null,
        p_document_expiry_date: anchors.document_expiry_date || null,
        p_pgwp_expiry_date: anchors.pgwp_expiry_date || null,
        p_landing_date: anchors.landing_date || null,
        p_first_canadian_work_day: anchors.first_canadian_work_day || null,
      });
      if (error) throw error;

      toast.success(`Application marked ${outcomeMeta.label}`);
      onSuccess(decisionDate);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to mark outcome. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <span />
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <h4 className="font-medium text-sm mb-1 flex items-center gap-2">
          <outcomeMeta.icon className={`h-4 w-4 ${outcomeMeta.color}`} />
          Mark {outcomeMeta.label}
        </h4>
        <p className="text-xs text-muted-foreground mb-3">{outcomeMeta.description}</p>
        <div className="space-y-2">
          <div>
            <Label htmlFor="dd" className="text-xs">{outcome === "approved" || outcome === "refused" ? "Decision date" : "Recorded date"}</Label>
            <Input id="dd" type="date" value={decisionDate} onChange={e => setDecisionDate(e.target.value)} />
          </div>
          {anchorFields.map(f => (
            <div key={f.key}>
              <Label htmlFor={f.key} className="text-xs">{f.label}</Label>
              <Input
                id={f.key}
                type="date"
                value={anchors[f.key] || ""}
                onChange={e => setAnchors(prev => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          {outcome === "approved" && anchorFields.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              These dates anchor chain rules for downstream applications.
            </p>
          )}
          <Button onClick={submit} disabled={busy} className="w-full" size="sm">
            {busy && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
            Confirm
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
