"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { writeAudit } from "@/lib/audit";
import { toast } from "sonner";
import type { StepTemplate } from "@/views/Workflows";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step?: StepTemplate | null;
  visaSubTypeId: string;
  nextSortOrder: number;
  slaRules: { code: string; label: string; target_minutes: number }[];
  onSaved?: () => void;
}

const ROLES = [
  "owner",
  "admin",
  "senior_advisor",
  "case_manager",
  "document_specialist",
  "support",
  "accountant",
];

const STEP_TYPES = [
  { value: "task", label: "Task" },
  { value: "document", label: "Document" },
  { value: "email", label: "Email" },
  { value: "wait", label: "Wait" },
  { value: "condition", label: "Condition" },
];

export function StepTemplateDialog({
  open,
  onOpenChange,
  step,
  visaSubTypeId,
  nextSortOrder,
  slaRules,
  onSaved,
}: Props) {
  const isEdit = !!step;
  const [stepCode, setStepCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedRole, setAssignedRole] = useState<string>("none");
  const [slaCode, setSlaCode] = useState<string>("none");
  const [stepType, setStepType] = useState<string>("task");
  const [dueOffset, setDueOffset] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStepCode(step?.step_code ?? "");
      setTitle(step?.title ?? "");
      setDescription(step?.description ?? "");
      setAssignedRole(step?.assigned_role ?? "none");
      setSlaCode(step?.sla_rule_code ?? "none");
      setStepType(step?.step_type ?? "task");
      setDueOffset(step?.due_offset_days != null ? String(step.due_offset_days) : "");
      setSortOrder(step?.sort_order ?? nextSortOrder);
      setIsActive(step?.is_active ?? true);
    }
  }, [open, step, nextSortOrder]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!stepCode.trim()) {
      toast.error("Step code is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        visa_sub_type_id: visaSubTypeId,
        step_code: stepCode.trim(),
        title: title.trim(),
        description: description.trim() || null,
        assigned_role: assignedRole === "none" ? null : assignedRole,
        sla_rule_code: slaCode === "none" ? null : slaCode,
        step_type: stepType,
        due_offset_days: dueOffset.trim() === "" ? null : Number(dueOffset),
        sort_order: sortOrder,
        is_active: isActive,
      };

      if (isEdit && step) {
        const newVersion = (step.version ?? 1) + 1;
        const { error } = await supabase
          .from("step_templates")
          .update({ ...payload, version: newVersion } as never)
          .eq("id", step.id);
        if (error) throw error;

        // Record proposal as auto-approved
        const { data: userRes } = await supabase.auth.getUser();
        await supabase.from("step_template_edits").insert({
          step_template_id: step.id,
          proposed_by: userRes.user?.id ?? null,
          proposed_change: payload as never,
          status: "approved",
          reviewed_by: userRes.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          applied_version: newVersion,
        } as never);

        void writeAudit({
          action: "UPDATE",
          entity_type: "step_template",
          entity_id: step.id,
          changes: { ...payload, version: newVersion } as unknown as Record<string, unknown>,
        });
        toast.success("Step updated");
      } else {
        const { data, error } = await supabase
          .from("step_templates")
          .insert({ ...payload, version: 1 } as never)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (data?.id) {
          void writeAudit({
            action: "CREATE",
            entity_type: "step_template",
            entity_id: data.id,
            changes: payload as unknown as Record<string, unknown>,
          });
        }
        toast.success("Step created");
      }
      onSaved?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-navy">
            {isEdit ? `Edit step (v${step!.version ?? 1} → v${(step!.version ?? 1) + 1})` : "New step"}
          </DialogTitle>
          <DialogDescription>
            Steps are versioned — every edit increments the version and is recorded in edit history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="step-title">Title *</Label>
              <Input
                id="step-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Collect passport scan"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="step-order">Order</Label>
              <Input
                id="step-order"
                type="number"
                min={1}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="step-code">Step code *</Label>
            <Input
              id="step-code"
              value={stepCode}
              onChange={(e) => setStepCode(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
              placeholder="e.g. collect_passport"
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Stable identifier — lowercase, snake_case. Used by triggers and reports.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="step-desc">Description</Label>
            <Textarea
              id="step-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What needs to happen in this step? Any guidance for the assignee."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Step type</Label>
              <Select value={stepType} onValueChange={setStepType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STEP_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                What kind of work does this step represent.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="step-due">Due offset (days from stage entry)</Label>
              <Input
                id="step-due"
                type="number"
                min={0}
                value={dueOffset}
                onChange={(e) => setDueOffset(e.target.value)}
                placeholder="e.g. 3"
              />
              <p className="text-[11px] text-muted-foreground">
                Leave blank for no automatic due date.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assigned role</Label>
              <Select value={assignedRole} onValueChange={setAssignedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unassigned —</SelectItem>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>SLA rule</Label>
              <Select value={slaCode} onValueChange={setSlaCode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No SLA —</SelectItem>
                  {slaRules.map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.label} ({r.target_minutes}m)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-md bg-muted/40 border border-border">
            <div>
              <Label htmlFor="step-active" className="cursor-pointer">
                Active
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Inactive steps stay in history but are skipped on new cases.
              </p>
            </div>
            <Switch id="step-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create step"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
