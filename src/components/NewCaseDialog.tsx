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
import { Textarea } from "@/components/ui/textarea";
import { Briefcase, DollarSign, Globe, User, UserCog } from "lucide-react";
import { toast } from "sonner";
import { writeAudit } from "@/lib/audit";
import { createCaseTasks } from "@/lib/taskEngine";
import { useAuth } from "@/lib/auth-context";

// Manager-level roles that may offer up to MAX_DISCOUNT_MANAGER
const MANAGER_ROLES = ["owner", "admin", "senior_advisor", "senior_counsellor", "manager"] as const;
const MAX_DISCOUNT_MANAGER = 15; // %
const MAX_DISCOUNT_STAFF   = 10; // %

const DISCOUNT_CATS = [
  { value: "discount", label: "Discount", max: 10 },
  { value: "staff", label: "Staff", max: 30 },
  { value: "staff_member", label: "Staff Member", max: 60 },
];

const GOVT_FEE_OPTIONS = [
  { value: "client", label: "Client Pays" },
  { value: "company", label: "Company Covers" },
  { value: "split", label: "Split 50/50" },
];

function defaultSubmissionDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().split("T")[0];
}

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
  const [leadPrefill, setLeadPrefill] = useState<{
    family_unit_id: string | null;
    notes: string | null;
    country_of_interest: string | null;
  } | null>(null);

  const [clientSummary, setClientSummary] = useState<{
    full_name: string | null;
    email: string | null;
    phone: string | null;
    country_of_citizenship: string | null;
  } | null>(null);

  const [form, setForm] = useState({
    client_id: clientId ?? defaultClientId ?? "",
    visa_type_id: "",
    visa_sub_type_id: "",
    destination_country: "",
    application_type: "single",
    case_manager_id: profile?.id ?? "",
    filing_officer_id: "",
    submission_date: defaultSubmissionDate(),
    base_fee_inr: 0,       // auto-filled from visa_types, display only
    discount_cat: "discount",
    discount_pct: 0,
    quoted_fee_inr: "",
    govt_fee_by: "client",
    notes: "",
    payment_plan_enabled: false,
    payment_stages: [{ amount: "", note: "Booking / advance", due_date: "" }],
    priority: "normal",
  });

  // Discount cap based on role
  const maxDiscount = profile?.role && (MANAGER_ROLES as readonly string[]).includes(profile.role)
    ? MAX_DISCOUNT_MANAGER
    : MAX_DISCOUNT_STAFF;

  const selectedDiscount = DISCOUNT_CATS.find((item) => item.value === form.discount_cat);
  const totalDue = Math.round((Number(form.quoted_fee_inr || form.base_fee_inr || 0)) * (1 - Math.min(form.discount_pct, selectedDiscount?.max ?? maxDiscount) / 100));

  // Reset form when dialog opens
  useEffect(() => {
    if (!open) return;
    const baseClientId = clientId ?? defaultClientId ?? "";
    setForm({
      client_id: baseClientId,
      visa_type_id: "",
      visa_sub_type_id: "",
      destination_country: "",
      application_type: "single",
      case_manager_id: profile?.id ?? "",
      filing_officer_id: "",
      submission_date: defaultSubmissionDate(),
      base_fee_inr: 0,
      discount_cat: "discount",
      discount_pct: 0,
      quoted_fee_inr: "",
      govt_fee_by: "client",
      notes: "",
      payment_plan_enabled: false,
      payment_stages: [{ amount: "", note: "Booking / advance", due_date: "" }],
      priority: "normal",
    });
    setResolvedClientId(baseClientId);
    setResolvedLeadName(null);
    setLeadPrefill(null);
    setClientSummary(null);
    setLeadNotConverted(false);
  }, [open, clientId, defaultClientId]);

  // Auto-resolve client from a lead when defaultLeadId is given
  useEffect(() => {
    if (!open || !defaultLeadId || clientId || defaultClientId) return;
    (async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, full_name, converted_client_id, interested_visa_type_id, interested_visa_sub_type_id, family_unit_id, notes, country_of_interest")
        .eq("id", defaultLeadId)
        .single();
      if (!data) return;
      setResolvedLeadName(data.full_name);
      setLeadPrefill({
        family_unit_id: data.family_unit_id ?? null,
        notes: data.notes ?? null,
        country_of_interest: data.country_of_interest ?? null,
      });
      setForm((f) => ({
        ...f,
        visa_type_id: data.interested_visa_type_id ?? f.visa_type_id,
        visa_sub_type_id: data.interested_visa_sub_type_id ?? f.visa_sub_type_id,
        destination_country: data.country_of_interest ?? f.destination_country,
        notes: data.notes ?? f.notes,
      }));
      if (data.converted_client_id) {
        setResolvedClientId(data.converted_client_id);
        setForm((f) => ({ ...f, client_id: data.converted_client_id }));
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
      const { data } = await supabase.from("clients").select("id, full_name, email, phone, country_of_citizenship").eq("is_active", true).order("full_name").limit(500);
      return data ?? [];
    },
    enabled: open && showClientPicker,
  });

  // Visa types with base fee
  const { data: visas } = useQuery({
    queryKey: ["visa-types-active-fee"],
    queryFn: async () =>
      (await supabase.from("visa_types").select("id, label, base_fee_inr, destination_country").eq("is_active", true).order("label")).data ?? [],
    enabled: open,
  });

  const effectiveClientId = form.client_id || resolvedClientId;
  const { data: selectedClient } = useQuery({
    queryKey: ["client-summary", effectiveClientId],
    enabled: open && !!effectiveClientId,
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("full_name, email, phone, country_of_citizenship").eq("id", effectiveClientId).maybeSingle();
      return data ?? null;
    },
  });

  useEffect(() => {
    if (selectedClient) setClientSummary(selectedClient);
  }, [selectedClient]);

  const { data: staffList } = useQuery({
    queryKey: ["staff-active", user?.id],
    enabled: open && !!user,
    queryFn: async () => {
      const { data } = await supabase.from("staff_profiles").select("id, full_name, role").eq("is_active", true).order("full_name");
      return (data ?? []) as { id: string; full_name: string; role: string }[];
    },
  });

  const destinationCountries = Array.from(new Set((visas ?? []).map((visa) => visa.destination_country).filter(Boolean))) as string[];
  const filteredVisas = (visas ?? []).filter((visa) => !form.destination_country || form.destination_country === "__any__" || visa.destination_country === form.destination_country || !visa.destination_country);

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

  useEffect(() => {
    if (!open || !visas || !form.visa_type_id) return;
    const visa = visas.find((v) => v.id === form.visa_type_id);
    const base = visa?.base_fee_inr ?? 0;
    if (base <= 0) return;
    setForm((f) => ({
      ...f,
      base_fee_inr: f.base_fee_inr || base,
      quoted_fee_inr: f.quoted_fee_inr || String(Math.round(base * (1 - f.discount_pct / 100))),
    }));
  }, [form.visa_type_id, open, visas]);

  // Recompute final fee when discount changes
  const handleDiscountChange = (rawVal: string) => {
    const cap = selectedDiscount?.max ?? maxDiscount;
    const pct = Math.min(Math.max(Number(rawVal) || 0, 0), cap);
    const finalFee = form.base_fee_inr > 0
      ? String(Math.round(form.base_fee_inr * (1 - pct / 100)))
      : form.quoted_fee_inr;
    setForm((f) => ({ ...f, discount_pct: pct, quoted_fee_inr: finalFee }));
  };

  // Recompute discount when user manually edits final fee (override)
  const handleFeeChange = (val: string) => {
    setForm((f) => ({ ...f, quoted_fee_inr: val }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!effectiveClientId || !form.destination_country || !form.visa_type_id || !form.case_manager_id || !form.filing_officer_id) {
      toast.error("Client, destination, visa type, Case Manager and Filing Officer are required");
      return;
    }
    const selectedMaxDiscount = selectedDiscount?.max ?? maxDiscount;
    if (form.discount_pct > selectedMaxDiscount) {
      toast.error(`Discount cannot exceed ${selectedMaxDiscount}% for this category`);
      return;
    }
    if (form.base_fee_inr > 0 && Number(form.quoted_fee_inr || 0) < form.base_fee_inr) {
      toast.error(`Quoted fee cannot be below the base fee of ₹${form.base_fee_inr.toLocaleString("en-IN")}`);
      return;
    }
    setSubmitting(true);
    const paymentStages = form.payment_stages
      .map((stage) => ({ amount: Number(stage.amount || 0), note: stage.note.trim(), due_date: stage.due_date || null }))
      .filter((stage) => stage.amount > 0 || stage.note || stage.due_date);
    if (form.payment_plan_enabled && (paymentStages.length === 0 || paymentStages.some((stage) => stage.amount <= 0))) {
      toast.error("Every payment stage needs an amount");
      setSubmitting(false);
      return;
    }
    const applicationNotes = [
      form.notes.trim(),
      form.application_type !== "single" ? `Application type: ${form.application_type}` : null,
      `Discount: ${form.discount_cat} (${form.discount_pct}%)`,
      form.govt_fee_by !== "client" ? `Govt fee: ${form.govt_fee_by}` : null,
      leadPrefill?.notes && !form.notes.trim() ? `Lead notes: ${leadPrefill.notes}` : null,
    ].filter(Boolean).join(" | ");
    const payload = {
      client_id: effectiveClientId,
      visa_type_id: form.visa_type_id,
      visa_sub_type_id: form.visa_sub_type_id || null,
      quoted_fee_inr: totalDue || 0,
      priority: form.priority,
      family_unit_id: leadPrefill?.family_unit_id ?? null,
      notes: applicationNotes || null,
      case_manager_id: form.case_manager_id,
      senior_advisor_id: form.filing_officer_id,
      target_submission_date: form.submission_date || null,
      payment_plan_enabled: form.payment_plan_enabled,
      payment_stages: form.payment_plan_enabled ? paymentStages : null,
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
    ? form.base_fee_inr - totalDue
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-navy flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" /> New Application
          </DialogTitle>
          {resolvedLeadName && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {leadNotConverted
                ? `⚠ "${resolvedLeadName}" hasn't been converted to a client yet — please select a client manually or convert the lead first.`
                : `Auto-linked from lead: ${resolvedLeadName}`}
            </p>
          )}
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {leadPrefill && (
            <div className="rounded-lg border border-sky-200 bg-sky-50/80 p-3 text-xs text-sky-950">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">Lead data loaded</span>
                {leadPrefill.family_unit_id && <Badge variant="secondary" className="text-[10px]">family linked</Badge>}
              </div>
              <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1 text-sky-900/80">
                <span>Destination: {leadPrefill.country_of_interest || "Not captured"}</span>
                <span>Notes: {leadPrefill.notes ? "Included in application notes" : "No notes on lead"}</span>
              </div>
            </div>
          )}
          {/* Client */}
          <fieldset className="border border-border rounded-lg p-3">
            <legend className="px-1.5 text-xs font-semibold flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-teal-600" /> Client
            </legend>
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
                      clientSummary?.full_name ?? resolvedLeadName ?? "Client linked"}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">auto-filled</Badge>
                </div>
              )}
            </div>
          ) : null}
          {effectiveClientId && (clientSummary || leadPrefill) && (
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
              <div><span className="block text-[10px] uppercase tracking-wide">Full name</span><span className="font-medium text-foreground">{clientSummary?.full_name ?? resolvedLeadName ?? "-"}</span></div>
              <div><span className="block text-[10px] uppercase tracking-wide">Email</span><span className="font-medium text-foreground">{clientSummary?.email ?? "-"}</span></div>
              <div><span className="block text-[10px] uppercase tracking-wide">Phone</span><span className="font-medium text-foreground">{clientSummary?.phone ?? "-"}</span></div>
              <div><span className="block text-[10px] uppercase tracking-wide">Citizenship</span><span className="font-medium text-foreground">{clientSummary?.country_of_citizenship ?? "-"}</span></div>
            </div>
          )}
          </fieldset>

          {/* Visa */}
          <fieldset className="border border-border rounded-lg p-3">
            <legend className="px-1.5 text-xs font-semibold flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-blue-600" /> Visa
            </legend>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label>Destination *</Label>
              <Select value={form.destination_country} onValueChange={(value) => setForm({ ...form, destination_country: value, visa_type_id: "", visa_sub_type_id: "", base_fee_inr: 0, quoted_fee_inr: "" })}>
                <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
                <SelectContent>
                  {destinationCountries.map((country) => <SelectItem key={country} value={country}>{country}</SelectItem>)}
                  <SelectItem value="__any__">Any / Not filtered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Visa type *</Label>
              <Select value={form.visa_type_id} onValueChange={handleVisaChange}>
                <SelectTrigger><SelectValue placeholder="Visa type" /></SelectTrigger>
                <SelectContent>
                  {filteredVisas.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}{v.base_fee_inr ? ` (₹${Number(v.base_fee_inr).toLocaleString("en-IN")})` : ""}</SelectItem>)}
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
            <div className="space-y-1.5">
              <Label>Application Type</Label>
              <div className="flex gap-1">
                {(["single", "family", "group"] as const).map((type) => (
                  <Button key={type} type="button" size="sm" variant={form.application_type === type ? "default" : "outline"} className="capitalize px-3" onClick={() => setForm({ ...form, application_type: type })}>{type}</Button>
                ))}
              </div>
            </div>
          </div>
          </fieldset>

          {/* Assignment */}
          <fieldset className="border border-border rounded-lg p-3">
            <legend className="px-1.5 text-xs font-semibold flex items-center gap-1.5">
              <UserCog className="h-3.5 w-3.5 text-purple-600" /> Assignment
            </legend>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Case Manager *</Label>
                <Select value={form.case_manager_id} onValueChange={(value) => setForm({ ...form, case_manager_id: value })}>
                  <SelectTrigger><SelectValue placeholder={staffList === undefined ? "Loading..." : "Select manager"} /></SelectTrigger>
                  <SelectContent>{(staffList ?? []).filter((staff) => ["owner", "admin", "senior_advisor", "case_manager", "senior_counsellor", "visa_expert", "manager", "counselor"].includes(staff.role)).map((staff) => <SelectItem key={staff.id} value={staff.id}>{staff.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Filing Officer *</Label>
                <Select value={form.filing_officer_id} onValueChange={(value) => setForm({ ...form, filing_officer_id: value })}>
                  <SelectTrigger><SelectValue placeholder={staffList === undefined ? "Loading..." : "Select officer"} /></SelectTrigger>
                  <SelectContent>{(staffList ?? []).filter((staff) => ["owner", "admin", "senior_advisor", "senior_counsellor", "manager", "filing_officer"].includes(staff.role)).map((staff) => <SelectItem key={staff.id} value={staff.id}>{staff.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Submission Target</Label>
                <Input type="date" value={form.submission_date} onChange={(e) => setForm({ ...form, submission_date: e.target.value })} />
              </div>
            </div>
          </fieldset>

          {/* Fees & payment */}
          <fieldset className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            <legend className="px-1.5 text-xs font-semibold flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-orange-500" /> Fees & Payment
            </legend>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fees</span>
              {form.base_fee_inr > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Standard: ₹{form.base_fee_inr.toLocaleString("en-IN")}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Discount */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  Discount
                  <span className="text-[10px] text-muted-foreground font-normal">(max {selectedDiscount?.max ?? maxDiscount}%)</span>
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    max={selectedDiscount?.max ?? maxDiscount}
                    step={1}
                    value={form.discount_pct || ""}
                    placeholder="0"
                    onChange={(e) => handleDiscountChange(e.target.value)}
                    className="pr-6"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Discount Category</Label>
                <Select value={form.discount_cat} onValueChange={(value) => setForm({ ...form, discount_cat: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DISCOUNT_CATS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label} (max {item.max}%)</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Govt Fee Paid By</Label>
                <Select value={form.govt_fee_by} onValueChange={(value) => setForm({ ...form, govt_fee_by: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GOVT_FEE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
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
          </fieldset>

          <fieldset className="border border-border rounded-lg p-3 space-y-3">
            <legend className="px-1.5 text-xs font-semibold">Payment Plan</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.payment_plan_enabled} onChange={(e) => setForm({ ...form, payment_plan_enabled: e.target.checked })} className="h-4 w-4 accent-primary" />
              Split into payment stages <span className="text-xs text-muted-foreground">(up to 3)</span>
            </label>
            {form.payment_plan_enabled && form.payment_stages.map((stage, index) => (
              <div key={index} className="grid grid-cols-3 gap-2">
                <Input type="number" min="0" placeholder="Amount" value={stage.amount} onChange={(e) => setForm({ ...form, payment_stages: form.payment_stages.map((item, i) => i === index ? { ...item, amount: e.target.value } : item) })} />
                <Input placeholder="Note" value={stage.note} onChange={(e) => setForm({ ...form, payment_stages: form.payment_stages.map((item, i) => i === index ? { ...item, note: e.target.value } : item) })} />
                <Input type="date" value={stage.due_date} onChange={(e) => setForm({ ...form, payment_stages: form.payment_stages.map((item, i) => i === index ? { ...item, due_date: e.target.value } : item) })} />
              </div>
            ))}
            {form.payment_plan_enabled && form.payment_stages.length < 3 && <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, payment_stages: [...form.payment_stages, { amount: "", note: "", due_date: "" }] })}>+ Add stage</Button>}
          </fieldset>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={leadPrefill?.notes ? "Lead notes are already loaded" : "Add application notes..."} rows={3} />
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
