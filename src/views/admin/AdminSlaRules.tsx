"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Timer, Clock } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { writeAudit } from "@/lib/audit";

interface SlaRule {
  code: string;
  label: string;
  applies_to: string;
  target_minutes: number;
  office_hours_only: boolean | null;
  escalate_to_role: string | null;
  is_active: boolean | null;
}

const APPLIES_TO_OPTIONS = [
  { code: "lead", label: "Lead first response" },
  { code: "document", label: "Document review" },
  { code: "ircc_comm", label: "IRCC communication" },
  { code: "portal_msg", label: "Portal message" },
  { code: "task", label: "Generic task" },
];

const ROLE_OPTIONS = [
  { code: "owner", label: "Owner" },
  { code: "admin", label: "Admin" },
  { code: "senior_advisor", label: "Senior Advisor" },
  { code: "case_manager", label: "Case Manager" },
];

export default function AdminSlaRules() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<SlaRule | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<SlaRule | null>(null);

  const { data: rules, isLoading } = useQuery({
    queryKey: ["admin-sla-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_rules")
        .select("code, label, applies_to, target_minutes, office_hours_only, escalate_to_role, is_active")
        .order("applies_to")
        .order("target_minutes");
      if (error) throw error;
      return (data ?? []) as SlaRule[];
    },
  });

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("sla_rules").delete().eq("code", deleting.code);
    if (error) {
      toast.error("Delete failed: " + error.message);
      return;
    }
    await writeAudit({ action: "DELETE", entity_type: "sla_rules", entity_id: deleting.code, changes: { label: deleting.label } });
    toast.success("SLA rule deleted");
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["admin-sla-rules"] });
  };

  const formatMinutes = (m: number) => {
    if (m < 60) return `${m} min`;
    if (m % 60 === 0) return `${m / 60} hr`;
    return `${(m / 60).toFixed(1)} hr`;
  };

  return (
    <>
      <AdminPageHeader
        title="SLA Rules"
        subtitle="Service-level targets for response times. Rules respecting office hours pause overnight, on weekends, and on holidays."
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add SLA Rule
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        <div className="card-surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Applies To</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead>Office Hours Only</TableHead>
                <TableHead>Escalate To</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!isLoading && (!rules || rules.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    <Timer className="h-5 w-5 mx-auto mb-2 opacity-40" />
                    No SLA rules yet.
                  </TableCell>
                </TableRow>
              )}
              {rules?.map((r) => (
                <TableRow key={r.code}>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {APPLIES_TO_OPTIONS.find((o) => o.code === r.applies_to)?.label ?? r.applies_to}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMinutes(r.target_minutes)}</TableCell>
                  <TableCell>{r.office_hours_only ? "Yes" : "No"}</TableCell>
                  <TableCell className="text-sm capitalize">{r.escalate_to_role?.replace(/_/g, " ") ?? "—"}</TableCell>
                  <TableCell>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${r.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                      {r.is_active ? "Active" : "Paused"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleting(r)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Link to="/admin/office-hours" className="card-surface p-4 block hover:border-gold/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-secondary flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-gold" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">What office hours mean</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                SLA timers with "office hours only" pause outside business hours and on holidays. Edit them on the
                Office Hours page.
              </p>
            </div>
            <span className="text-xs text-gold">Configure →</span>
          </div>
        </Link>
      </div>

      {(editing || adding) && (
        <SlaRuleDialog
          rule={editing}
          open
          onClose={() => {
            setEditing(null);
            setAdding(false);
          }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-sla-rules"] })}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.label}?`}
        description="Removing this rule stops all SLA tracking for items it governed."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}

function SlaRuleDialog({
  rule,
  open,
  onClose,
  onSaved,
}: {
  rule: SlaRule | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!rule;
  const [code, setCode] = useState(rule?.code ?? "");
  const [label, setLabel] = useState(rule?.label ?? "");
  const [appliesTo, setAppliesTo] = useState(rule?.applies_to ?? "lead");
  const [targetMinutes, setTargetMinutes] = useState(rule?.target_minutes?.toString() ?? "60");
  const [officeOnly, setOfficeOnly] = useState(rule?.office_hours_only ?? true);
  const [escalateTo, setEscalateTo] = useState<string>(rule?.escalate_to_role ?? "none");
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!code.trim() || !label.trim() || !targetMinutes) {
      toast.error("Code, label, and target are required");
      return;
    }
    setSaving(true);
    const payload = {
      code: code.trim(),
      label: label.trim(),
      applies_to: appliesTo,
      target_minutes: Number(targetMinutes),
      office_hours_only: officeOnly,
      escalate_to_role: escalateTo === "none" ? null : escalateTo,
      is_active: isActive,
    };
    if (isEdit) {
      const { error } = await supabase.from("sla_rules").update(payload).eq("code", rule!.code);
      if (error) {
        toast.error("Save failed: " + error.message);
        setSaving(false);
        return;
      }
      await writeAudit({ action: "UPDATE", entity_type: "sla_rules", entity_id: rule!.code, changes: payload });
      toast.success("SLA rule updated");
    } else {
      const { error } = await supabase.from("sla_rules").insert(payload);
      if (error) {
        toast.error("Create failed: " + error.message);
        setSaving(false);
        return;
      }
      await writeAudit({ action: "CREATE", entity_type: "sla_rules", entity_id: payload.code, changes: payload });
      toast.success("SLA rule created");
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit: ${rule!.label}` : "Add SLA Rule"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} disabled={isEdit} placeholder="LEAD_FIRST_REPLY" />
            </div>
            <div>
              <Label>Label</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Lead first reply" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Applies To</Label>
              <Select value={appliesTo} onValueChange={setAppliesTo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APPLIES_TO_OPTIONS.map((o) => (
                    <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target (minutes)</Label>
              <Input type="number" value={targetMinutes} onChange={(e) => setTargetMinutes(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Escalate To</Label>
              <Select value={escalateTo} onValueChange={setEscalateTo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No escalation</SelectItem>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3 pb-1">
              <div className="flex items-center gap-2">
                <Switch checked={officeOnly} onCheckedChange={setOfficeOnly} id="oh" />
                <Label htmlFor="oh" className="cursor-pointer text-sm">Office hours only</Label>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <Switch checked={isActive} onCheckedChange={setIsActive} id="act" />
                <Label htmlFor="act" className="cursor-pointer text-sm">Active</Label>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
