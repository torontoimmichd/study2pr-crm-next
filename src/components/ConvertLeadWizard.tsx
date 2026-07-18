"use client";

/**
 * ConvertLeadWizard.tsx
 * Single-scroll lead → Client + Case conversion dialog.
 * Sections: Client Info · Visa Details · Family Members · Assignment · Fees & Payment
 *
 * FIX (2026-07-12): neither `case_number` nor `case_ref` is a real column on
 * `cases`. Verified against Study2PR_Supabase_Schema.sql (create table cases:
 * `case_code text unique`) and against 10+ live pages that already read
 * `case_code` successfully (Calls.tsx, Calendar.tsx, Tasks.tsx, StaffDailyView.tsx,
 * ExecutiveDashboard.tsx). There's also a BEFORE INSERT trigger
 * (trg_cases_code / gen_case_code) that auto-generates case_code from the visa
 * type + year + sequence if it's left null — so the client no longer needs to
 * invent a reference string at all; we just read back whatever the DB generated.
 * (supabase as any) kept as a harmless safety net for schema-cache typing.
 *
 * FIX 2 (2026-07-12): the uq_clients_source_lead guard index means a second
 * "Convert" click on a lead that already produced a client (e.g. an earlier
 * attempt that crashed after the client insert but before the case insert)
 * now throws "duplicate key value violates unique constraint". Handled by
 * looking up an existing client for this lead first and reusing/updating it
 * instead of always inserting a new one.
 *
 * FIX 3 (2026-07-12): the stage query selected from a table called
 * `case_stages` which doesn't exist (real table is `case_stages_ref` — see
 * Cases.tsx/CaseDetail.tsx which already query it correctly), so it silently
 * returned nothing and fell back to a hardcoded "onboarding" stage code that
 * also isn't a real row in case_stages_ref → FK violation on insert. Fixed to
 * query case_stages_ref and fall back to "intake" (the schema's own default
 * and what NewCaseDialog.tsx already uses safely).
 *
 * FIX 4 (2026-07-12): Case Manager / Filing Officer dropdowns sometimes
 * rendered empty because the staff query fired before the auth session had
 * finished hydrating, got treated as anonymous by the staff_profiles RLS
 * lockdown policy, and silently returned zero rows (cached that way for the
 * rest of the dialog's life). Fixed by gating the query on the user being
 * loaded. Both fields are now also required in the UI, since a blank
 * assignment was the thing making conversions look "randomly broken".
 */

import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2, ArrowRight, Briefcase, User, Globe, Users, UserCog, DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { writeAudit } from "@/lib/audit";
import { writeTimeline } from "@/lib/timeline";
import { createCaseTasks } from "@/lib/taskEngine";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  country_of_residence: string | null;
  country_of_interest?: string | null;
  notes: string | null;
  interested_visa_type_id: string | null;
  lifecycle_state: string;
  enquiry_client_id?: string | null; // set when this lead is a repeat enquiry from an existing client
}

interface Props {
  lead: Lead;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConverted?: (clientId: string, caseId: string) => void;
}

interface Applicant {
  name: string;
  relationship: string;
  notes: string;
  visaTypeId: string;
  fee: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DISCOUNT_CATS = [
  { value: "discount",     label: "Discount",     max: 10 },
  { value: "staff",        label: "Staff",        max: 30 },
  { value: "staff_member", label: "Staff Member", max: 60 },
];

const GOVT_FEE_OPTIONS = [
  { value: "client",  label: "Client Pays" },
  { value: "company", label: "Company Covers" },
  { value: "split",   label: "Split 50/50" },
];

const RELATIONSHIPS = [
  "Primary Applicant", "Spouse", "Child", "Parent", "Sibling", "Other",
];

function defaultSubmissionDate() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ConvertLeadWizard({ lead, open, onOpenChange, onConverted }: Props) {
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const { user, profile } = useAuth();
  const [busy, setBusy]   = useState(false);
  const [done, setDone]   = useState(false);

  const [createdClientId, setCreatedClientId] = useState("");
  const [createdCaseId,   setCreatedCaseId]   = useState("");
  const [createdCaseRef,  setCreatedCaseRef]  = useState("");

  // Client info
  const [clientName,    setClientName]    = useState(lead.full_name);
  const [clientEmail,   setClientEmail]   = useState(lead.email ?? "");
  const [clientPhone,   setClientPhone]   = useState(lead.phone ?? "");
  const [clientCountry, setClientCountry] = useState(lead.country_of_residence ?? "");

  // Visa details
  const [destinationCountry, setDestinationCountry] = useState(lead.country_of_interest ?? "");
  const [visaTypeId,    setVisaTypeId]    = useState(lead.interested_visa_type_id ?? "");
  const [visaSubTypeId, setVisaSubTypeId] = useState("");
  const [baseFee,       setBaseFee]       = useState(0);
  const [applicationType, setApplicationType] = useState<"single" | "family" | "group">("single");

  // Applicants
  const [applicants, setApplicants] = useState<Applicant[]>([{
    name: lead.full_name, relationship: "Primary Applicant",
    notes: "", visaTypeId: lead.interested_visa_type_id ?? "", fee: "",
  }]);
  const [activeTab, setActiveTab] = useState("0");

  const setNumApplicants = (n: number) => {
    const arr = [...applicants];
    while (arr.length < n) arr.push({ name: "", relationship: "Spouse", notes: "", visaTypeId, fee: String(baseFee || "") });
    setApplicants(arr.slice(0, n));
  };

  const updateApplicant = (idx: number, field: keyof Applicant, val: string) =>
    setApplicants(prev => prev.map((a, i) => i === idx ? { ...a, [field]: val } : a));

  // Assignment
  const [caseManager,    setCaseManager]    = useState(profile?.id ?? "");
  const [filingOfficer,  setFilingOfficer]  = useState("");
  const [submissionDate, setSubmissionDate] = useState(defaultSubmissionDate());

  // Fees
  const [discountCat, setDiscountCat] = useState("discount");
  const [discountPct, setDiscountPct] = useState("");
  const [govtFeeBy,   setGovtFeeBy]   = useState("client");
  const [quotedFee,   setQuotedFee]   = useState("");

  // Payment stages (optional, max 3)
  const [stagesEnabled, setStagesEnabled] = useState(false);
  const [stages, setStages] = useState<{ amount: string; note: string; due_date: string }[]>([
    { amount: "", note: "Booking / advance", due_date: "" },
  ]);
  const addStage = () =>
    setStages((prev) => (prev.length >= 3 ? prev : [...prev, { amount: "", note: "", due_date: "" }]));
  const removeStage = (idx: number) => setStages((prev) => prev.filter((_, i) => i !== idx));
  const updateStage = (idx: number, patch: Partial<{ amount: string; note: string; due_date: string }>) =>
    setStages((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  const stagesTotal = useMemo(
    () => stages.reduce((s, st) => s + Number(st.amount || 0), 0),
    [stages],
  );

  const maxDiscount = DISCOUNT_CATS.find(d => d.value === discountCat)?.max ?? 20;

  const totalDue = useMemo(() => {
    if (applicationType === "single") {
      const base = Number(quotedFee || baseFee || 0);
      const disc = Math.min(Number(discountPct || 0), maxDiscount) / 100;
      return Math.round(base * (1 - disc));
    }
    return applicants.reduce((s, a) => s + Number(a.fee || 0), 0);
  }, [quotedFee, baseFee, discountPct, maxDiscount, applicationType, applicants]);

  // Queries
  const { data: visaTypes } = useQuery({
    queryKey: ["visa-types-active-fee"],
    queryFn: async () => {
      const { data } = await supabase
        .from("visa_types")
        .select("id, label, base_fee_inr, destination_country")
        .eq("is_active", true).order("label");
      return (data ?? []) as { id: string; label: string; base_fee_inr: number | null; destination_country: string | null }[];
    },
  });

  const filteredVisaTypes = useMemo(() => {
    if (!visaTypes) return [];
    if (!destinationCountry || destinationCountry === "__any__") return visaTypes;
    return visaTypes.filter(v => !v.destination_country || v.destination_country === destinationCountry);
  }, [visaTypes, destinationCountry]);

  const destCountries = useMemo(() => {
    const seen = new Set<string>(); const result: string[] = [];
    (visaTypes ?? []).forEach(v => { if (v.destination_country && !seen.has(v.destination_country)) { seen.add(v.destination_country); result.push(v.destination_country); } });
    return result.sort();
  }, [visaTypes]);

  const { data: visaSubTypes } = useQuery({
    queryKey: ["visa-sub", visaTypeId], enabled: !!visaTypeId,
    queryFn: async () => {
      const { data } = await supabase.from("visa_sub_types").select("id, label").eq("visa_type_id", visaTypeId).eq("is_active", true).order("label");
      return (data ?? []) as { id: string; label: string }[];
    },
  });

  const { data: staffList } = useQuery({
    queryKey: ["staff-active", user?.id],
    enabled: open && !!user,
    queryFn: async () => {
      const { data } = await supabase.from("staff_profiles").select("id, full_name, role").eq("is_active", true).order("full_name");
      return (data ?? []) as { id: string; full_name: string; role: string }[];
    },
  });

  const { data: defaultStage } = useQuery({
    queryKey: ["default-case-stage"],
    queryFn: async () => {
      const { data } = await supabase.from("case_stages_ref").select("code").order("sort_order", { ascending: true }).limit(1).maybeSingle();
      return data?.code ?? "intake";
    },
  });

  const handleVisaTypeChange = (id: string) => {
    const vt = visaTypes?.find(v => v.id === id);
    const fee = vt?.base_fee_inr ?? 0;
    setVisaTypeId(id); setVisaSubTypeId(""); setBaseFee(fee);
    if (fee > 0) setQuotedFee(String(fee));
    setApplicants(prev => prev.map((a, i) => i === 0 ? { ...a, visaTypeId: id, fee: fee > 0 ? String(fee) : a.fee } : a));
  };

  // Auto-fill base fee + Quoted fee from the visa type carried over from the
  // lead (which is already selected when the wizard opens).
  useEffect(() => {
    if (!visaTypes || !visaTypeId) return;
    const vt = visaTypes.find(v => v.id === visaTypeId);
    const fee = vt?.base_fee_inr ?? 0;
    if (fee > 0) {
      setBaseFee(fee);
      setQuotedFee(prev => (prev && Number(prev) > 0 ? prev : String(fee)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visaTypes, visaTypeId]);

  const handleConvert = async () => {
    if (!clientName.trim()) { toast.error("Client name is required"); return; }
    if (!visaTypeId)        { toast.error("Please select a visa type"); return; }
    if (!caseManager)       { toast.error("Please select a Case Manager"); return; }
    if (!filingOfficer)     { toast.error("Please select a Filing Officer"); return; }

    // Quoted fee can be increased above the base fee but never reduced below it.
    if (applicationType === "single" && baseFee > 0 && Number(quotedFee || 0) < baseFee) {
      toast.error(`Quoted fee cannot be below the base fee of ₹${baseFee.toLocaleString("en-IN")}`);
      return;
    }

    // If payment stages are enabled, they must be filled in.
    const cleanStages = stages
      .map(s => ({ amount: Number(s.amount || 0), note: s.note.trim(), due_date: s.due_date || null }))
      .filter(s => s.amount > 0 || s.note || s.due_date);
    if (stagesEnabled) {
      if (cleanStages.length === 0) { toast.error("Add at least one payment stage or turn stages off"); return; }
      if (cleanStages.some(s => s.amount <= 0)) { toast.error("Every payment stage needs an amount"); return; }
    }

    setBusy(true);
    try {
      // Repeat enquiry: this lead is already linked to an existing client
      // (matched by phone/email on creation, or via the client's "New enquiry"
      // button). Reuse that client and just add a new application — never create
      // a duplicate person.
      let linkedClient: { id: string } | null = null;
      if (lead.enquiry_client_id) {
        const { data: lc } = await supabase
          .from("clients")
          .select("id")
          .eq("id", lead.enquiry_client_id)
          .maybeSingle();
        if (lc) linkedClient = lc;
      }

      // Next: reuse a client already created for THIS lead (leftover from an
      // earlier attempt that crashed after the client insert but before the
      // case) — the uq_clients_source_lead guard blocks a second insert here.
      if (!linkedClient) {
        const { data: bySource } = await supabase
          .from("clients")
          .select("id")
          .eq("source_lead_id", lead.id)
          .maybeSingle();
        if (bySource) linkedClient = bySource;
      }

      // Final safety net: even if this lead was never explicitly linked, match an
      // existing client by phone or email so a repeat enquiry never creates a
      // duplicate person.
      if (!linkedClient) {
        const emailKey = (clientEmail || lead.email || "").trim();
        const phoneKey = (clientPhone || lead.phone || "").replace(/\D/g, "");
        const ors: string[] = [];
        if (emailKey.length >= 4) ors.push(`email.ilike.%${emailKey}%`);
        if (phoneKey.length >= 6) ors.push(`phone.ilike.%${phoneKey}%`);
        if (ors.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: byContact } = await (supabase as any)
            .from("clients")
            .select("id")
            .or(ors.join(","))
            .limit(1);
          if (byContact && byContact[0]) linkedClient = { id: byContact[0].id };
        }
      }

      const existingClient = linkedClient;

      let client: { id: string };
      if (existingClient) {
        const { data: updated, error: updateErr } = await supabase
          .from("clients")
          .update({ full_name: clientName.trim(), email: clientEmail.trim() || null, phone: clientPhone.trim() || null, country_of_citizenship: clientCountry || null, is_active: true })
          .eq("id", existingClient.id)
          .select("id").single();
        if (updateErr || !updated) { toast.error(updateErr?.message ?? "Failed to update existing client"); setBusy(false); return; }
        client = updated;
      } else {
        const { data: created, error: clientErr } = await supabase
          .from("clients")
          .insert({ full_name: clientName.trim(), email: clientEmail.trim() || null, phone: clientPhone.trim() || null, country_of_citizenship: clientCountry || null, source_lead_id: lead.id, is_active: true })
          .select("id").single();
        if (clientErr || !created) { toast.error(clientErr?.message ?? "Failed to create client"); setBusy(false); return; }
        client = created;
      }

      const extraNotes = [
        applicationType !== "single" ? `Type: ${applicationType}` : null,
        govtFeeBy !== "client" ? `Govt fee: ${govtFeeBy}` : null,
        applicants.length > 1 ? `Members: ${applicants.map(a => `${a.name} (${a.relationship})`).join(", ")}` : null,
        lead.notes ? `Lead notes: ${lead.notes}` : null,
      ].filter(Boolean).join(" | ");

      // case_code is auto-generated by the DB trigger trg_cases_code — do not send it.
      // (supabase as any) bypasses TypeScript schema-cache typing as a safety net.
      const { data: caseRow, error: caseErr } = await (supabase as any)
        .from("cases")
        .insert({
          client_id: client.id,
          visa_type_id: visaTypeId, visa_sub_type_id: visaSubTypeId || null,
          current_stage_code: defaultStage ?? "intake",
          case_manager_id: caseManager,
          senior_advisor_id: filingOfficer,
          quoted_fee_inr: totalDue || null,
          notes: extraNotes || null, is_archived: false,
          payment_plan_enabled: stagesEnabled,
          payment_stages: stagesEnabled ? cleanStages : null,
        })
        .select("id, case_code").single();
      if (caseErr || !caseRow) { toast.error(caseErr?.message ?? "Failed to create case"); setBusy(false); return; }
      const caseRef = caseRow.case_code ?? caseRow.id.slice(0, 8);

      await supabase.from("leads").update({ lifecycle_state: "converted", converted_client_id: client.id, converted_at: new Date().toISOString() }).eq("id", lead.id);

      void writeAudit({ action: "CONVERT", entity_type: "leads",   entity_id: lead.id,    changes: { converted_client_id: client.id, case_id: caseRow.id } });
      void writeAudit({ action: "CREATE",  entity_type: "clients", entity_id: client.id,  changes: { from_lead: lead.id } });
      void writeAudit({ action: "CREATE",  entity_type: "cases",   entity_id: caseRow.id, changes: { case_code: caseRef } });
      void writeTimeline({ event_type: "lead_converted", title: `Lead converted — Case ${caseRef} created`, lead_id: lead.id, case_id: caseRow.id, client_id: client.id, is_system: false });
      void createCaseTasks(caseRow.id, caseManager || profile?.id || null, user?.id || null);

      void qc.invalidateQueries({ queryKey: ["leads-list"] });
      void qc.invalidateQueries({ queryKey: ["leads-counts"] });
      void qc.invalidateQueries({ queryKey: ["cases-all"] });
      void qc.invalidateQueries({ queryKey: ["sidebar-badge-counts"] });

      setCreatedClientId(client.id); setCreatedCaseId(caseRow.id); setCreatedCaseRef(caseRef);
      setDone(true); onConverted?.(client.id, caseRow.id);
    } catch (err) {
      console.error(err); toast.error("Unexpected error. Please try again.");
    } finally { setBusy(false); }
  };

  const initials = (name: string) => name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  // ─── Compact field helpers ──────────────────────────────────────────────────
  const L = ({ children }: { children: React.ReactNode }) => (
    <Label className="text-[11px] font-medium text-muted-foreground leading-none">{children}</Label>
  );

  return (
    <Dialog open={open} onOpenChange={v => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden max-h-[92vh] flex flex-col">

        {/* Slim header */}
        <div className="px-4 py-2.5 border-b border-border bg-card shrink-0 flex items-center gap-3">
          <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Briefcase className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-sm leading-tight">Convert Lead → Client + Application</h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
            <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-semibold text-[10px] flex items-center justify-center">{initials(lead.full_name || "?")}</span>
            <span className="font-medium text-foreground">{lead.full_name}</span>
            <span>· {lead.phone ?? "no phone"} · {lead.email ?? "no email"}</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {done ? (
            <div className="text-center space-y-3 py-6">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <div>
                <h3 className="font-semibold text-lg">Conversion complete!</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Case <span className="font-mono font-semibold">{createdCaseRef}</span> created. Tasks auto-assigned.
                </p>
              </div>
              <div className="flex gap-2 justify-center pt-1">
                <Button size="sm" variant="outline" onClick={() => navigate(`/clients/${createdClientId}`)}>Open client profile</Button>
                <Button size="sm" onClick={() => navigate(`/cases/${createdCaseId}`)}>
                  Open case <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* 1 · Client */}
              <fieldset className="border border-border rounded-lg p-3">
                <legend className="px-1.5 text-xs font-semibold flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-teal-600" /> Client
                </legend>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <L>Full Name *</L>
                    <Input value={clientName} onChange={e => setClientName(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <L>Email</L>
                    <Input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <L>Phone</L>
                    <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <L>Citizenship</L>
                    <Input value={clientCountry} onChange={e => setClientCountry(e.target.value)} placeholder="e.g. India" className="h-8 text-sm" />
                  </div>
                </div>
              </fieldset>

              {/* 2 · Visa */}
              <fieldset className="border border-border rounded-lg p-3">
                <legend className="px-1.5 text-xs font-semibold flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-blue-600" /> Visa
                </legend>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {destCountries.length > 0 && (
                    <div className="space-y-1">
                      <L>Destination *</L>
                      <Select value={destinationCountry} onValueChange={v => { setDestinationCountry(v); setVisaTypeId(""); setBaseFee(0); setQuotedFee(""); }}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Country…" /></SelectTrigger>
                        <SelectContent>
                          {destCountries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          <SelectItem value="__any__">Any / Not filtered</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1">
                    <L>Visa Type *</L>
                    <Select value={visaTypeId} onValueChange={handleVisaTypeChange}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Visa / program…" /></SelectTrigger>
                      <SelectContent>
                        {filteredVisaTypes.map(v => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.label}{v.base_fee_inr ? ` (₹${v.base_fee_inr.toLocaleString("en-IN")})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {visaSubTypes && visaSubTypes.length > 0 && (
                    <div className="space-y-1">
                      <L>Sub-type</L>
                      <Select value={visaSubTypeId} onValueChange={setVisaSubTypeId}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Stream…" /></SelectTrigger>
                        <SelectContent>{visaSubTypes.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1">
                    <L>Application Type</L>
                    <div className="flex gap-1">
                      {(["single", "family", "group"] as const).map(type => (
                        <button key={type} type="button"
                          onClick={() => { setApplicationType(type); if (type === "single") setNumApplicants(1); else if (applicants.length < 2) setNumApplicants(2); }}
                          className={cn("px-2.5 h-8 rounded-md border text-xs font-medium transition-colors",
                            applicationType === type ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/40")}
                        >
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* 3 · Family members */}
              {(applicationType === "family" || applicationType === "group") && (
                <fieldset className="border border-border rounded-lg p-3">
                  <legend className="px-1.5 text-xs font-semibold flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-teal-600" /> Members
                    <span className="font-normal text-muted-foreground">— total ₹{totalDue.toLocaleString("en-IN")}</span>
                  </legend>
                  <div className="flex items-center gap-2 mb-2">
                    <L>Applicants</L>
                    <Select value={String(applicants.length)} onValueChange={v => setNumApplicants(Number(v))}>
                      <SelectTrigger className="w-16 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{[2,3,4,5,6,7,8].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="h-7">{applicants.map((_, i) => <TabsTrigger key={i} value={String(i)} className="text-[11px] px-2.5 h-6">{i === 0 ? "Primary" : `#${i+1}`}</TabsTrigger>)}</TabsList>
                    {applicants.map((a, i) => (
                      <TabsContent key={i} value={String(i)} className="pt-2">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div className="space-y-1">
                            <L>Full Name *</L>
                            <Input value={a.name} onChange={e => updateApplicant(i, "name", e.target.value)} placeholder={i === 0 ? lead.full_name : "Full name"} className="h-8 text-sm" />
                          </div>
                          <div className="space-y-1">
                            <L>Relationship</L>
                            <Select value={a.relationship} onValueChange={v => updateApplicant(i, "relationship", v)}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>{RELATIONSHIPS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <L>Visa Type *</L>
                            <Select value={a.visaTypeId} onValueChange={v => updateApplicant(i, "visaTypeId", v)}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                              <SelectContent>{(visaTypes ?? []).map(v => <SelectItem key={v.id} value={v.id}>{v.label}{v.base_fee_inr ? ` (₹${v.base_fee_inr.toLocaleString("en-IN")})` : ""}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <L>Service Fee (₹)</L>
                            <Input type="number" value={a.fee} onChange={e => updateApplicant(i, "fee", e.target.value)} placeholder="0" className="h-8 text-sm" />
                          </div>
                          <div className="col-span-2 md:col-span-4 space-y-1">
                            <L>Notes</L>
                            <Textarea value={a.notes} onChange={e => updateApplicant(i, "notes", e.target.value)} placeholder="Notes for this applicant…" rows={1} className="resize-none text-sm min-h-[32px]" />
                          </div>
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </fieldset>
              )}

              {/* 4 · Assignment */}
              <fieldset className="border border-border rounded-lg p-3">
                <legend className="px-1.5 text-xs font-semibold flex items-center gap-1.5">
                  <UserCog className="h-3.5 w-3.5 text-purple-600" /> Assignment
                </legend>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <L>Case Manager *</L>
                    <Select value={caseManager} onValueChange={setCaseManager}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={staffList === undefined ? "Loading…" : "Select…"} /></SelectTrigger>
                      <SelectContent>{(staffList ?? []).filter(s => ["owner","admin","senior_advisor","case_manager","senior_counsellor","visa_expert","manager","counselor"].includes(s.role)).map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <L>Filing Officer *</L>
                    <Select value={filingOfficer} onValueChange={setFilingOfficer}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={staffList === undefined ? "Loading…" : "Select…"} /></SelectTrigger>
                      <SelectContent>
                        {(staffList ?? []).filter(s => ["owner","admin","senior_advisor","senior_counsellor","manager"].includes(s.role)).map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <L>Submission Target</L>
                    <input type="date" value={submissionDate} onChange={e => setSubmissionDate(e.target.value)}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>
              </fieldset>

              {/* 5 · Fees */}
              <fieldset className="border border-border rounded-lg p-3">
                <legend className="px-1.5 text-xs font-semibold flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-orange-500" /> Fees & Payment
                </legend>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <L>Quoted fee (₹){baseFee > 0 ? ` · base ₹${baseFee.toLocaleString("en-IN")}` : ""}</L>
                    <Input
                      type="number"
                      min={baseFee || 0}
                      value={quotedFee}
                      onChange={e => setQuotedFee(e.target.value)}
                      onBlur={() => { if (baseFee > 0 && Number(quotedFee || 0) < baseFee) setQuotedFee(String(baseFee)); }}
                      placeholder="150000"
                      className="h-8 text-sm"
                    />
                    {baseFee > 0 && (
                      <p className="text-[10px] text-muted-foreground">Can be increased, not reduced below base.</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <L>Discount % (max {maxDiscount}%)</L>
                    <Input type="number" min="0" max={maxDiscount} value={discountPct}
                      onChange={e => setDiscountPct(String(Math.min(Number(e.target.value), maxDiscount)))} placeholder="0" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <L>Discount Category</L>
                    <Select value={discountCat} onValueChange={setDiscountCat}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{DISCOUNT_CATS.map(d => <SelectItem key={d.value} value={d.value}>{d.label} (max {d.max}%)</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <L>Govt Fee Paid By</L>
                    <Select value={govtFeeBy} onValueChange={setGovtFeeBy}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{GOVT_FEE_OPTIONS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </fieldset>

              {/* 6 · Payment stages (optional, max 3) */}
              <fieldset className="border border-border rounded-lg p-3">
                <legend className="px-1.5 text-xs font-semibold flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> Payment Plan
                </legend>
                <label className="flex items-center gap-2 cursor-pointer select-none mb-2">
                  <input
                    type="checkbox"
                    checked={stagesEnabled}
                    onChange={e => setStagesEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  <span className="text-xs font-medium">Split into payment stages</span>
                  <span className="text-[11px] text-muted-foreground">(up to 3 — amount, note & date each)</span>
                </label>

                {stagesEnabled && (
                  <div className="space-y-2">
                    {stages.map((st, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1.5fr_1fr_auto] gap-2 items-end">
                        <div className="space-y-1">
                          {i === 0 && <L>Amount (₹)</L>}
                          <Input type="number" min="0" value={st.amount} onChange={e => updateStage(i, { amount: e.target.value })} placeholder="0" className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          {i === 0 && <L>Note</L>}
                          <Input value={st.note} onChange={e => updateStage(i, { note: e.target.value })} placeholder="e.g. On filing" className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          {i === 0 && <L>Due date</L>}
                          <input type="date" value={st.due_date} onChange={e => updateStage(i, { due_date: e.target.value })}
                            className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                        </div>
                        <Button type="button" size="sm" variant="ghost" className="h-8 text-muted-foreground hover:text-destructive" onClick={() => removeStage(i)} disabled={stages.length === 1}>
                          <span className="text-lg leading-none">×</span>
                        </Button>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-1">
                      <Button type="button" size="sm" variant="outline" onClick={addStage} disabled={stages.length >= 3}>
                        + Add stage
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Stages total: <span className="font-semibold text-foreground">₹{stagesTotal.toLocaleString("en-IN")}</span>
                        {stagesTotal > 0 && stagesTotal !== totalDue && (
                          <span className="text-amber-600 ml-1">(≠ total due ₹{totalDue.toLocaleString("en-IN")})</span>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </fieldset>
            </>
          )}
        </div>

        {/* Footer with live total */}
        {!done && (
          <div className="px-4 py-2.5 border-t border-border bg-card shrink-0 flex items-center justify-between">
            <div className="text-sm">
              <span className="text-muted-foreground">Total due: </span>
              <span className="font-bold text-primary">₹{totalDue.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
              <Button size="sm" onClick={() => void handleConvert()} disabled={busy || !visaTypeId || !clientName.trim() || !caseManager || !filingOfficer} className="min-w-[100px]">
                {busy ? "Converting…" : "Convert"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
