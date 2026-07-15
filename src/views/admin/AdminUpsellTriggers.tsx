"use client";

/**
 * AdminUpsellTriggers.tsx
 * Define automatic upsell trigger rules — when the CRM should prompt staff
 * to offer additional services to an existing client.
 * Route: /admin/upsell-triggers  (owner + admin only)
 *
 * upsell_triggers table:
 *   id uuid PK, code text UNIQUE, label text, description text,
 *   trigger_type text, condition_value text, service_suggestion text,
 *   message_template text, is_active bool, created_at timestamptz
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Zap, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { writeAudit } from "@/lib/audit";
import { cn } from "@/lib/utils";

const db = supabase as any;

const TRIGGER_TYPE_LABELS: Record<string, string> = {
  case_stage_reached:     "Case reaches a stage",
  case_closed:            "Case closed / approved",
  visa_expiry_approaching:"Visa expiry approaching (days)",
  pr_eligible_soon:       "Applicant PR-eligible soon",
  study_permit_expiring:  "Study permit expiring",
  work_permit_expiring:   "Work permit expiring",
  crs_score_threshold:    "CRS score drops below threshold",
  manual:                 "Manual trigger only",
};

interface UpsellTrigger {
  id: string;
  code: string;
  label: string;
  description: string | null;
  trigger_type: string;
  condition_value: string | null;
  service_suggestion: string | null;
  message_template: string | null;
  is_active: boolean;
  created_at: string;
}

const EXAMPLE_MESSAGE = "Hi {client_name}, your {visa_type} is nearing an important milestone. We'd like to discuss {service_suggestion} with you. Would you like to schedule a call?";

export default function AdminUpsellTriggers() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<UpsellTrigger | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<UpsellTrigger | null>(null);

  const { data: triggers = [], isLoading } = useQuery({
    queryKey: ["admin-upsell-triggers"],
    queryFn: async () => {
      const { data, error } = await db
        .from("upsell_triggers")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as UpsellTrigger[];
    },
  });

  const toggleActive = async (trigger: UpsellTrigger) => {
    const next = !trigger.is_active;
    const { error } = await db.from("upsell_triggers").update({ is_active: next }).eq("id", trigger.id);
    if (error) { toast.error(error.message); return; }
    toast.success(next ? "Trigger activated" : "Trigger paused");
    await writeAudit({ action: "UPDATE", entity_type: "upsell_triggers", entity_id: trigger.id, changes: { is_active: next } });
    qc.invalidateQueries({ queryKey: ["admin-upsell-triggers"] });
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await db.from("upsell_triggers").delete().eq("id", deleting.id);
    if (error) { toast.error(error.message); return; }
    await writeAudit({ action: "DELETE", entity_type: "upsell_triggers", entity_id: deleting.id, changes: { code: deleting.code } });
    toast.success("Trigger deleted");
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["admin-upsell-triggers"] });
  };

  return (
    <>
      <AdminPageHeader
        title="Upsell Triggers"
        subtitle="Define rules that prompt staff to offer additional services to existing clients at the right moment."
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add Trigger
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        {/* Explainer */}
        <div className="card-surface p-4 bg-primary/5 border border-primary/20 text-sm">
          <div className="flex items-start gap-3">
            <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-muted-foreground">
              Upsell triggers tell advisors <strong className="text-foreground">when</strong> to proactively reach out with a relevant service upgrade.
              When a trigger fires (e.g., a study permit expiry approaching), it creates a task for the assigned advisor with the message template pre-filled.
              Use the <code className="bg-muted px-1 rounded text-xs">&#123;client_name&#125;</code>, <code className="bg-muted px-1 rounded text-xs">&#123;visa_type&#125;</code>, and <code className="bg-muted px-1 rounded text-xs">&#123;service_suggestion&#125;</code> placeholders in message templates.
            </div>
          </div>
        </div>

        <div className="card-surface overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground animate-pulse">Loading triggers…</div>
          ) : triggers.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No upsell triggers yet</p>
              <p className="mt-1 opacity-70">Add a trigger to start prompting advisors at the right moment.</p>
              <Button size="sm" className="mt-4" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4 mr-1" />Create first trigger
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Code", "Label / Service", "Trigger", "Condition", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {triggers.map((t) => (
                  <tr key={t.id} className={cn("hover:bg-muted/30 transition-colors", !t.is_active && "opacity-50")}>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.code}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{t.label}</div>
                      {t.service_suggestion && (
                        <div className="text-xs text-muted-foreground mt-0.5">↗ {t.service_suggestion}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-accent/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {TRIGGER_TYPE_LABELS[t.trigger_type] ?? t.trigger_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {t.condition_value ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => void toggleActive(t)}
                        className={cn("flex items-center gap-1.5 text-xs font-medium transition-colors",
                          t.is_active ? "text-success" : "text-muted-foreground")}
                      >
                        {t.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        {t.is_active ? "Active" : "Paused"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleting(t)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Template variables reference */}
        {triggers.length > 0 && (
          <details className="card-surface p-4">
            <summary className="text-sm font-medium cursor-pointer text-muted-foreground">Template variable reference</summary>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                ["&#123;client_name&#125;", "Full name of client"],
                ["&#123;visa_type&#125;", "Visa / permit type"],
                ["&#123;service_suggestion&#125;", "Suggested upsell service"],
                ["&#123;expiry_date&#125;", "Visa / permit expiry date"],
                ["&#123;case_ref&#125;", "Case reference number"],
                ["&#123;advisor_name&#125;", "Assigned advisor name"],
                ["&#123;days_remaining&#125;", "Days until expiry / milestone"],
                ["&#123;crs_score&#125;", "Client's current CRS score"],
              ].map(([v, d]) => (
                <div key={v} className="bg-muted/50 rounded p-2">
                  <code className="text-primary" dangerouslySetInnerHTML={{ __html: v }} />
                  <p className="text-muted-foreground mt-0.5">{d}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {(editing || adding) && (
        <UpsellTriggerDialog
          trigger={editing}
          open
          onClose={() => { setEditing(null); setAdding(false); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-upsell-triggers"] })}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete trigger "${deleting?.label}"?`}
        description="This trigger will stop firing. Existing tasks already created by this trigger are not affected."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}

function UpsellTriggerDialog({
  trigger,
  open,
  onClose,
  onSaved,
}: {
  trigger: UpsellTrigger | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!trigger;
  const [code, setCode] = useState(trigger?.code ?? "");
  const [label, setLabel] = useState(trigger?.label ?? "");
  const [description, setDescription] = useState(trigger?.description ?? "");
  const [triggerType, setTriggerType] = useState(trigger?.trigger_type ?? "case_closed");
  const [conditionValue, setConditionValue] = useState(trigger?.condition_value ?? "");
  const [serviceSuggestion, setServiceSuggestion] = useState(trigger?.service_suggestion ?? "");
  const [messageTemplate, setMessageTemplate] = useState(trigger?.message_template ?? EXAMPLE_MESSAGE);
  const [isActive, setIsActive] = useState(trigger?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!code.trim() || !label.trim()) {
      toast.error("Code and label are required");
      return;
    }
    setSaving(true);
    const payload = {
      code: code.trim().toLowerCase().replace(/\s+/g, "_"),
      label: label.trim(),
      description: description.trim() || null,
      trigger_type: triggerType,
      condition_value: conditionValue.trim() || null,
      service_suggestion: serviceSuggestion.trim() || null,
      message_template: messageTemplate.trim() || null,
      is_active: isActive,
    };

    if (isEdit) {
      const { error } = await db.from("upsell_triggers").update(payload).eq("id", trigger!.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      await writeAudit({ action: "UPDATE", entity_type: "upsell_triggers", entity_id: trigger!.id, changes: payload });
      toast.success("Trigger updated");
    } else {
      const { error } = await db.from("upsell_triggers").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      await writeAudit({ action: "CREATE", entity_type: "upsell_triggers", entity_id: payload.code, changes: payload });
      toast.success("Upsell trigger created");
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  const needsCondition = ["visa_expiry_approaching", "study_permit_expiring", "work_permit_expiring", "crs_score_threshold", "case_stage_reached"].includes(triggerType);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit: ${trigger!.label}` : "New Upsell Trigger"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Code *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isEdit}
                placeholder="study_permit_upsell"
                className="font-mono"
              />
            </div>
            <div>
              <Label>Label *</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Study Permit Extension" />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="resize-none" placeholder="When to use and what it does" />
          </div>

          <div>
            <Label>Trigger Type</Label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TRIGGER_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsCondition && (
            <div>
              <Label>
                Condition value
                <span className="text-muted-foreground font-normal ml-1 text-xs">
                  {triggerType.includes("expir") ? "(days before expiry)" :
                   triggerType === "crs_score_threshold" ? "(minimum CRS score)" :
                   triggerType === "case_stage_reached" ? "(stage code)" : ""}
                </span>
              </Label>
              <Input
                value={conditionValue}
                onChange={(e) => setConditionValue(e.target.value)}
                placeholder={
                  triggerType.includes("expir") ? "e.g. 90" :
                  triggerType === "crs_score_threshold" ? "e.g. 450" :
                  "e.g. pre_approval"
                }
              />
            </div>
          )}

          <div>
            <Label>Service suggestion</Label>
            <Input value={serviceSuggestion} onChange={(e) => setServiceSuggestion(e.target.value)} placeholder="e.g. Study Permit Extension, PR Application, PGWP" />
          </div>

          <div>
            <Label>Message template</Label>
            <Textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={4}
              className="resize-none font-mono text-xs"
              placeholder={EXAMPLE_MESSAGE}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Use &#123;client_name&#125;, &#123;visa_type&#125;, &#123;service_suggestion&#125;, &#123;days_remaining&#125; as placeholders
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="trigger-active" />
            <Label htmlFor="trigger-active" className="cursor-pointer">Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Trigger"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
