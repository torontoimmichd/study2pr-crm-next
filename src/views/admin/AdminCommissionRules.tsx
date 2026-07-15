"use client";

/**
 * AdminCommissionRules.tsx
 * Manage commission rule definitions — triggers, rates, and eligible roles.
 * Route: /admin/commission-rules  (owner + admin only)
 *
 * commission_rules table columns:
 *   id uuid PK, code text UNIQUE, label text, description text,
 *   trigger_event text, calc_type text (percentage|fixed),
 *   amount numeric, applies_to_roles text[], is_active bool, sort_order int,
 *   created_at timestamptz
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, DollarSign, ToggleLeft, ToggleRight, Percent, Hash } from "lucide-react";
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
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const db = supabase as any;

const TRIGGER_LABELS: Record<string, string> = {
  lead_converted:    "Lead Converted",
  case_closed:       "Case Closed",
  payment_received:  "Payment Received",
  referral_signed:   "Referral Signed",
  milestone_reached: "Milestone Reached",
};

const ROLE_LABELS: Record<string, string> = {
  owner:              "Owner",
  admin:              "Admin",
  senior_advisor:     "Senior Advisor",
  case_manager:       "Case Manager",
  document_specialist:"Document Specialist",
  support:            "Support",
  accountant:         "Accountant",
};

const ALL_ROLES = Object.keys(ROLE_LABELS);

interface CommissionRule {
  id: string;
  code: string;
  label: string;
  description: string | null;
  trigger_event: string;
  calc_type: string; // "percentage" | "fixed"
  amount: number;
  applies_to_roles: string[];
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
}

export default function AdminCommissionRules() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CommissionRule | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<CommissionRule | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["admin-commission-rules"],
    queryFn: async () => {
      const { data, error } = await db
        .from("commission_rules")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CommissionRule[];
    },
  });

  const toggleActive = async (rule: CommissionRule) => {
    const next = !rule.is_active;
    const { error } = await db
      .from("commission_rules")
      .update({ is_active: next })
      .eq("id", rule.id);
    if (error) { toast.error(error.message); return; }
    toast.success(next ? "Rule activated" : "Rule paused");
    await writeAudit({ action: "UPDATE", entity_type: "commission_rules", entity_id: rule.id, changes: { is_active: next } });
    qc.invalidateQueries({ queryKey: ["admin-commission-rules"] });
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await db.from("commission_rules").delete().eq("id", deleting.id);
    if (error) { toast.error(error.message); return; }
    await writeAudit({ action: "DELETE", entity_type: "commission_rules", entity_id: deleting.id, changes: { code: deleting.code } });
    toast.success("Rule deleted");
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["admin-commission-rules"] });
  };

  return (
    <>
      <AdminPageHeader
        title="Commission Rules"
        subtitle="Define when commissions are earned, the calculation method, and which staff roles are eligible."
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add Rule
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        {/* Summary stats */}
        {rules.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total rules" value={rules.length} />
            <StatCard label="Active rules" value={rules.filter((r) => r.is_active).length} />
            <StatCard label="% rules" value={rules.filter((r) => r.calc_type === "percentage").length} />
            <StatCard label="Fixed amount rules" value={rules.filter((r) => r.calc_type === "fixed").length} />
          </div>
        )}

        <div className="card-surface overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground animate-pulse">Loading rules…</div>
          ) : rules.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <DollarSign className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No commission rules yet</p>
              <p className="mt-1 opacity-70">Add a rule to start tracking commissions automatically.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Code", "Label", "Trigger", "Rate", "Roles", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rules.map((rule) => (
                  <tr key={rule.id} className={cn("hover:bg-muted/30 transition-colors", !rule.is_active && "opacity-50")}>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{rule.code}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{rule.label}</div>
                      {rule.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{rule.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-accent/20 px-2 py-0.5 rounded-full">
                        {TRIGGER_LABELS[rule.trigger_event] ?? rule.trigger_event}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      {rule.calc_type === "percentage" ? (
                        <span className="flex items-center gap-1">
                          <Percent className="h-3 w-3 text-primary" />
                          {rule.amount}%
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3 text-primary" />
                          {fmtMoney(rule.amount)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {(rule.applies_to_roles ?? []).length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">All roles</span>
                        ) : (
                          (rule.applies_to_roles ?? []).map((r) => (
                            <span key={r} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                              {ROLE_LABELS[r] ?? r}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => void toggleActive(rule)}
                        className={cn("flex items-center gap-1.5 text-xs font-medium transition-colors",
                          rule.is_active ? "text-success" : "text-muted-foreground")}
                      >
                        {rule.is_active
                          ? <ToggleRight className="h-4 w-4" />
                          : <ToggleLeft className="h-4 w-4" />}
                        {rule.is_active ? "Active" : "Paused"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(rule)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleting(rule)}>
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

        {/* How commissions work */}
        <details className="card-surface p-4 cursor-pointer">
          <summary className="text-sm font-medium text-muted-foreground">How commission rules work</summary>
          <div className="mt-3 text-sm text-muted-foreground space-y-2">
            <p>Commission rules define <strong>when</strong> a commission is earned and <strong>how much</strong>.</p>
            <p><strong>Trigger events:</strong> Lead Converted (lead becomes client), Case Closed (case marked as approved/closed), Payment Received (invoice fully paid), or Referral Signed (referral partner conversion).</p>
            <p><strong>Rate types:</strong> Percentage calculates the commission as a % of the invoice amount. Fixed gives a flat INR amount per trigger.</p>
            <p><strong>Roles:</strong> Leave empty to apply to all roles. Select specific roles to restrict eligibility.</p>
            <p>Commission records in the <code className="bg-muted px-1 rounded">commissions</code> table use the rule <code className="bg-muted px-1 rounded">code</code> to link back here.</p>
          </div>
        </details>
      </div>

      {(editing || adding) && (
        <CommissionRuleDialog
          rule={editing}
          open
          onClose={() => { setEditing(null); setAdding(false); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-commission-rules"] })}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete rule "${deleting?.label}"?`}
        description="Existing commission records that reference this rule code will be unaffected. New commissions will no longer use this rule."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-surface p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function CommissionRuleDialog({
  rule,
  open,
  onClose,
  onSaved,
}: {
  rule: CommissionRule | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!rule;
  const [code, setCode] = useState(rule?.code ?? "");
  const [label, setLabel] = useState(rule?.label ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [triggerEvent, setTriggerEvent] = useState(rule?.trigger_event ?? "case_closed");
  const [calcType, setCalcType] = useState<"percentage" | "fixed">(
    (rule?.calc_type as "percentage" | "fixed") ?? "percentage"
  );
  const [amount, setAmount] = useState(String(rule?.amount ?? ""));
  const [selectedRoles, setSelectedRoles] = useState<string[]>(rule?.applies_to_roles ?? []);
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSave = async () => {
    if (!code.trim() || !label.trim()) {
      toast.error("Code and label are required");
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      toast.error("Amount must be a valid non-negative number");
      return;
    }
    if (calcType === "percentage" && parsedAmount > 100) {
      toast.error("Percentage cannot exceed 100%");
      return;
    }

    setSaving(true);
    const payload = {
      code: code.trim().toLowerCase().replace(/\s+/g, "_"),
      label: label.trim(),
      description: description.trim() || null,
      trigger_event: triggerEvent,
      calc_type: calcType,
      amount: parsedAmount,
      applies_to_roles: selectedRoles,
      is_active: isActive,
    };

    if (isEdit) {
      const { error } = await db.from("commission_rules").update(payload).eq("id", rule!.id);
      if (error) {
        toast.error("Save failed: " + error.message);
        setSaving(false);
        return;
      }
      await writeAudit({ action: "UPDATE", entity_type: "commission_rules", entity_id: rule!.id, changes: payload });
      toast.success("Rule updated");
    } else {
      const { error } = await db.from("commission_rules").insert(payload);
      if (error) {
        toast.error("Create failed: " + error.message);
        setSaving(false);
        return;
      }
      await writeAudit({ action: "CREATE", entity_type: "commission_rules", entity_id: payload.code, changes: payload });
      toast.success("Commission rule created");
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit: ${rule!.label}` : "New Commission Rule"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Code *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isEdit}
                placeholder="case_close"
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Unique identifier, auto-lowercased</p>
            </div>
            <div>
              <Label>Label *</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Case Closed Bonus"
              />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — explain when this applies"
              rows={2}
              className="resize-none"
            />
          </div>

          <div>
            <Label>Trigger Event</Label>
            <Select value={triggerEvent} onValueChange={setTriggerEvent}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Calculation Type</Label>
              <Select value={calcType} onValueChange={(v) => setCalcType(v as "percentage" | "fixed")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{calcType === "percentage" ? "Percentage %" : "Amount (₹)"}</Label>
              <Input
                type="number"
                min="0"
                max={calcType === "percentage" ? "100" : undefined}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={calcType === "percentage" ? "e.g. 5" : "e.g. 5000"}
              />
            </div>
          </div>

          <div>
            <Label className="block mb-2">Eligible Roles <span className="text-muted-foreground font-normal">(leave blank for all)</span></Label>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                    selectedRoles.includes(role)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="rule-active" />
            <Label htmlFor="rule-active" className="cursor-pointer">Active</Label>
            <span className="text-xs text-muted-foreground">{isActive ? "Rule is live" : "Rule is paused — won't generate commissions"}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
