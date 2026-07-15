"use client";

import { useState, FormEvent, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { writeAudit } from "@/lib/audit";
import { createCaseTasks } from "@/lib/taskEngine";
import { useAuth } from "@/lib/auth-context";

// Manager-level roles that may offer up to MAX_DISCOUNT_MANAGER
const MANAGER_ROLES = ["owner", "admin", "senior_advisor"] as const;
const MAX_DISCOUNT_MANAGER = 15; // %
const MAX_DISCOUNT_STAFF   = 10; // %

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Pre-select this client (bypass picker) */
  clientId?: string;
  /** When on a lead page, pass leadId — dialog will auto-resolve the client */
  defaultLeadId?: string | null;
  /** When on a client page, pass clientId directly */
  defaultClientId?: string | null;
  onCreated?: (caseId: string) => void;
}

export function NewCaseDialog({ open, onOpenChange, clientId, defaultLeadId, defaultClientId, onCreated }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  // Resolved client id: explicit prop wins, then defaultClientId, then resolved from lead
  const [resolvedClientId, setResolvedClientId] = useState<string>(clientId ?? defaultClientId ?? "");
  const [resolvedLeadName, setResolvedLeadName] = useState<string | null>(null);
  const [leadNotConverted, setLeadNotConverted] = useState(false);

  const [form, setForm] = useState({
    client_id: clientId ?? defaultClientId ?? "",
    visa_type_id: "",
    visa_sub_type_id: "",
    base_fee_inr: 0,       // auto-filled from visa_types, display only
    discount_pct: 0,       // user-controlled, capped by role
    quoted_fee_inr: "",    // final fee = base * (1 - discount/100)
    priority: "normal",
  });

  // Discount cap based on role
  const maxDiscount = profile?.role && (MANAGER_ROLES as readonly string[]).includes(profile.role)
    ? MAX_DISCOUNT_MANAGER
    : MAX_DISCOUNT_STAFF;

  // Reset form when dialog opens
  useEffect(() => {
    if (!open) return;
    const baseClientId = clientId ?? defaultClientId ?? "";
    setForm({
      client_id: baseClientId,
      visa_type_id: "",
      visa_sub_type_id: "",
      base_fee_inr: 0,
      discount_pct: 0,
      quoted_fee_inr: "",
      priority: "normal",
    });
    setResolvedClientId(baseClientId);
    setResolvedLeadName(null);
    setLeadNotConverted(false);
  }, [open, clientId, defaultClientId]);

  // Auto-resolve client from a lead when defaultLeadId is given
  useEffect(() => {
    if (!open || !defaultLeadId || clientId || defaultClientId) return;
    (async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, full_name, client_id")
        .eq("id", defaultLeadId)
        .single();
      if (!data) return;
      setResolvedLeadName(data.full_name);
      if (data.client_id) {
        setResolvedClientId(data.client_id as string);
        setForm((f) => ({ ...f, client_id: data.client_id as string }));
        setLeadNotConverted(false);
      } else {
        setLeadNotConverted(true);
      }
    })();
  }, [open, defaultLeadId, clientId, defaultClientId]);

  // Active clients list (only shown when no client is locked in)
  const showClientPicker = !clientId && !defaultClientId;
  const { data: clients } = useQuery({
    queryKey: ["clients-active-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name").eq("is_active", true).order("full_name").limit(500);
      return data ?? [];
    },
    enabled: open && showClientPicker,
  });

  // Visa types with base fee
  const { data: visas } = useQuery({
    queryKey: ["visa-types-active-fee"],
    queryFn: async () =>
      (await supabase.from("visa_types").select("id, label, base_fee_inr").eq("is_active", true).order("label")).data ?? [],
    enabled: open,
  });

  // Sub-types for selected visa
  const { data: subs } = useQuery({
    queryKey: ["visa-sub", form.visa_type_id],
    queryFn: async () => {
      if (!form.visa_type_id) return [];
      const { data } = await supabase.from("visa_sub_types").select("id, label").eq("visa_type_id", form.visa_type_id).eq("is_active", true);
      return data ?? [];
    },
    enabled: !!form.visa_type_id,
  });

  // Auto-fill base fee when visa type is selected
  const handleVisaChange = (visaId: string) => {
    const visa = visas?.find((v) => v.id === visaId);
    const base = visa?.base_fee_inr ?? 0;
    const finalFee = base > 0 ? String(Math.round(base * (1 - form.discount_pct / 100))) : "";
    setForm((f) => ({
      ...f,
      visa_type_id: visaId,
      visa_sub_type_id: "",
      base_fee_inr: base,
      quoted_fee_inr: finalFee,
    }));
  };

  // Recompute final fee when discount changes
  const handleDiscountChange = (rawVal: string) => {
    let pct = Math.min(Math.max(Number(rawVal) || 0, 0), maxDiscount);
    const finalFee = form.base_fee_inr > 0
      ? String(Math.round(form.base_fee_inr * (1 - pct / 100)))
      : form.quoted_fee_inr;
    setForm((f) => ({ ...f, discount_pct: pct, quoted_fee_inr: finalFee }));
  };

  // Recompute discount when user manually edits final fee (override)
  const handleFeeChange = (val: string) => {
    setForm((f) => ({ ...f, quoted_fee_inr: val }));
  };

  const effectiveClientId = form.client_id || resolvedClientId;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!effectiveClientId || !form.visa_type_id) {
      toast.error("Client and visa type are required");
      return;
    }
    setSubmitting(true);
    const payload = {
      client_id: effectiveClientId,
      visa_type_id: form.visa_type_id,
      visa_sub_type_id: form.visa_sub_type_id || null,
      quoted_fee_inr: form.quoted_fee_inr ? Number(form.quoted_fee_inr) : 0,
      priority: form.priority,
      current_stage_code: "intake",
    };
    const { data, error } = await supabase.from("cases").insert(payload).select("id").single();
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void writeAudit({ action: "CREATE", entity_type: "cases", entity_id: data.id, changes: payload });
    void createCaseTasks(data.id, profile?.id ?? null, user?.id ?? null);
    void qc.invalidateQueries({ queryKey: ["cases-all"] });
    void qc.invalidateQueries({ queryKey: ["sidebar-badge-counts"] });
    toast.success("Case opened");
    onOpenChange(false);
    onCreated?.(data.id);
    if (!clientId && !defaultClientId) navigate(`/cases/${data.id}`);
  };

  // Savings amount display
  const savings = form.base_fee_inr > 0 && form.discount_pct > 0
    ? form.base_fee_inr - (Number(form.quoted_fee_inr) || 0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-navy">New Case</DialogTitle>
          {resolvedLeadName && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {leadNotConverted
                ? `⚠ "${resolvedLeadName}" hasn't been converted to a client yet — please select a client manually or convert the lead first.`
                : `Auto-linked from lead: ${resolvedLeadName}`}
            </p>
          )}
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Client picker */}
          {showClientPicker && !resolvedClientId ? (
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                <SelectContent>
                  {clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : resolvedClientId ? (
            <div className="space-y-1.5">
              <Label>Client *</Label>
              {showClientPicker ? (
                /* Allow changing even if auto-resolved from lead */
                <Select value={form.client_id || resolvedClientId} onValueChange={(v) => { setForm({ ...form, client_id: v }); setResolvedClientId(v); }}>
                  <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                  <SelectContent>
                    {clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                /* Locked — show name chip */
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/40 text-sm">
                  <span className="font-medium">
                    {clients?.find((c) => c.id === resolvedClientId)?.full_name ??
                      resolvedLeadName ?? "Client linked"}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">auto-filled</Badge>
                </div>
              )}
            </div>
          ) : null}

          {/* Visa type + sub-type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Visa type *</Label>
              <Select value={form.visa_type_id} onValueChange={handleVisaChange}>
                <SelectTrigger><SelectValue placeholder="Visa type" /></SelectTrigger>
                <SelectContent>
                  {visas?.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sub-type</Label>
              <Select value={form.visa_sub_type_id} onValueChange={(v) => setForm({ ...form, visa_sub_type_id: v })} disabled={!form.visa_type_id}>
                <SelectTrigger><SelectValue placeholder={form.visa_type_id ? "Sub-type" : "Pick visa first"} /></SelectTrigger>
                <SelectContent>
                  {subs?.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fee block */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fees</span>
              {form.base_fee_inr > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Standard: ₹{form.base_fee_inr.toLocaleString("en-IN")}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Discount */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  Discount
                  <span className="text-[10px] text-muted-foreground font-normal">
                    (max {maxDiscount}%)
                  </span>
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    max={maxDiscount}
                    step={1}
                    value={form.discount_pct || ""}
                    placeholder="0"
                    onChange={(e) => handleDiscountChange(e.target.value)}
                    className="pr-6"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                </div>
                {form.discount_pct >= maxDiscount && (
                  <p className="text-[10px] text-amber-600">Max discount for your role reached</p>
                )}
              </div>

              {/* Final quoted fee */}
              <div className="space-y-1.5">
                <Label>Quoted fee (INR)</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">₹</span>
                  <Input
                    type="number"
                    min={0}
                    value={form.quoted_fee_inr}
                    placeholder={form.base_fee_inr > 0 ? String(form.base_fee_inr) : "0"}
                    onChange={(e) => handleFeeChange(e.target.value)}
                    className="pl-6"
                  />
                </div>
              </div>
            </div>

            {/* Savings callout */}
            {savings > 0 && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded px-2.5 py-1.5">
                <span>🎉</span>
                <span>Client saves <strong>₹{savings.toLocaleString("en-IN")}</strong> ({form.discount_pct}% discount applied)</span>
              </div>
            )}
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting || (leadNotConverted && !form.client_id)} className="bg-primary hover:bg-primary/90">
              {submitting ? "Opening…" : "Open case"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
