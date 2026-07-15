"use client";

// src/components/applications/MarkOutcomePopover.tsx
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
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
  outcome: "approved" | "refused";
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

  async function submit() {
    setBusy(true);
    try {
      // Try the mark_case_outcome RPC first, fall back to direct update
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("mark_case_outcome", {
        p_case_id: caseId,
        p_outcome: outcome,
        p_decision_date: decisionDate,
        p_study_end_date: anchors.study_end_date || null,
        p_document_expiry_date: anchors.document_expiry_date || null,
        p_pgwp_expiry_date: anchors.pgwp_expiry_date || null,
        p_landing_date: anchors.landing_date || null,
        p_first_canadian_work_day: anchors.first_canadian_work_day || null,
      });

      if (error) {
        // Fallback: direct update on cases table
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: fallbackErr } = await (supabase as any)
          .from("cases")
          .update({ outcome, current_stage_code: outcome })
          .eq("id", caseId);
        if (fallbackErr) throw fallbackErr;
      }

      toast.success(outcome === "approved" ? "Marked approved" : "Marked refused");
      onSuccess(decisionDate);
    } catch (e) {
      console.error(e);
      toast.error("Failed to mark outcome");
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
        <h4 className="font-medium text-sm mb-2">
          Mark {outcome === "approved" ? "approved" : "refused"}
        </h4>
        <div className="space-y-2">
          <div>
            <Label htmlFor="dd" className="text-xs">Decision date</Label>
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
