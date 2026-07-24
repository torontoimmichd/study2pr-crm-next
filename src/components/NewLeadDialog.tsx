"use client";

import { useState, FormEvent, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { writeAudit } from "@/lib/audit";
import { writeTimeline } from "@/lib/timeline";
import { createLeadTasks } from "@/lib/taskEngine";
import { useAuth } from "@/lib/auth-context";
import { Trash2, UserPlus, Users } from "lucide-react";

// ── Family member draft ────────────────────────────────────────────────────────
type FamilyRole = "spouse" | "partner" | "child" | "parent" | "sibling";

interface FamilyMemberDraft {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: FamilyRole;
  visa_type_id: string;
  note: string;
}

const BLANK_MEMBER = (visaTypeId: string): FamilyMemberDraft => ({
  id: crypto.randomUUID(),
  name: "",
  phone: "",
  email: "",
  role: "spouse",
  visa_type_id: visaTypeId,
  note: "",
});

// ── Country → dial code ───────────────────────────────────────────────────────
const COUNTRY_DIAL: Record<string, string> = {
  "India": "+91", "Canada": "+1", "USA": "+1", "United States": "+1",
  "United Kingdom": "+44", "UK": "+44", "New Zealand": "+64", "Australia": "+61",
  "Pakistan": "+92", "Bangladesh": "+880", "Sri Lanka": "+94", "Nepal": "+977",
  "Philippines": "+63", "China": "+86", "Indonesia": "+62", "Malaysia": "+60",
  "Vietnam": "+84", "Singapore": "+65", "Thailand": "+66", "UAE": "+971",
  "Saudi Arabia": "+966", "South Korea": "+82", "Korea": "+82", "Iran": "+98",
  "Nigeria": "+234", "Kenya": "+254", "Ghana": "+233", "Egypt": "+20",
  "Ethiopia": "+251", "Mexico": "+52", "Brazil": "+55", "Jamaica": "+1-876",
  "Trinidad": "+1-868", "Germany": "+49", "France": "+33",
};

const COUNTRIES = [
  "India", "Canada", "USA", "United Kingdom", "New Zealand", "Australia",
  "Pakistan", "Bangladesh", "Sri Lanka", "Nepal", "Philippines", "China",
  "Indonesia", "Malaysia", "Vietnam", "Singapore", "Thailand", "UAE",
  "Saudi Arabia", "South Korea", "Iran", "Nigeria", "Kenya", "Ghana",
  "Egypt", "Ethiopia", "Mexico", "Brazil", "Germany", "France",
  "Jamaica", "Trinidad and Tobago", "Other",
];

// Destination countries for visa filtering
const DESTINATION_COUNTRIES = [
  "Canada", "Australia", "United Kingdom", "United States", "Germany",
  "New Zealand", "Ireland", "France", "Netherlands", "Other",
];

// Sources that require a contact name
const SOURCES_WITH_NAME = ["referral", "previous_customer", "word_of_mouth"];

const ALL_DIAL_CODES = Array.from(new Set(Object.values(COUNTRY_DIAL))).sort((a, b) => {
  const priority = ["+91", "+1", "+44", "+61", "+64"];
  const ai = priority.indexOf(a), bi = priority.indexOf(b);
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1; if (bi !== -1) return 1;
  return a.localeCompare(b);
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
  /** When provided, this lead is logged as a NEW enquiry for an existing client. */
  linkedClient?: { id: string; full_name: string; email?: string | null; phone?: string | null; country_of_residence?: string | null } | null;
}

const BLANK_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  dial_code: "+91",
  phone_local: "",
  nationality: "",
  country_of_residence: "",
  country_of_interest: "",
  interested_category_id: "",
  interested_visa_type_id: "",
  interested_visa_sub_type_id: "",
  source_code: "",
  source_person_name: "",   // for referral / previous customer name
  agent_partner_id: "",     // for agent partner source
  referral_partner_id: "",
  notes: "",
};

export function NewLeadDialog({ open, onOpenChange, onCreated, linkedClient }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [hasFamily, setHasFamily] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberDraft[]>([]);

  useEffect(() => {
    if (!open) {
      setForm(BLANK_FORM);
      setHasFamily(false);
      setFamilyMembers([]);
      return;
    }
    // Opening as a repeat enquiry for an existing client → prefill contact info.
    if (linkedClient) {
      const parts = (linkedClient.full_name ?? "").trim().split(/\s+/);
      const rawPhone = (linkedClient.phone ?? "").trim();
      const dialMatch = rawPhone.match(/^(\+\d{1,3})[\s-]?(.*)$/);
      setForm((f) => ({
        ...f,
        first_name: parts[0] ?? "",
        last_name: parts.slice(1).join(" "),
        email: linkedClient.email ?? "",
        dial_code: dialMatch ? dialMatch[1] : f.dial_code,
        phone_local: dialMatch ? dialMatch[2] : rawPhone,
        country_of_residence: linkedClient.country_of_residence ?? "",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const addFamilyMember = () => {
    setFamilyMembers(prev => [...prev, BLANK_MEMBER(form.interested_visa_type_id)]);
  };

  const removeFamilyMember = (id: string) => {
    setFamilyMembers(prev => prev.filter(m => m.id !== id));
  };

  const updateFamilyMember = (id: string, patch: Partial<FamilyMemberDraft>) => {
    setFamilyMembers(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  };

  // Auto-set dial code when country of residence changes
  const handleCountryChange = (country: string) => {
    const dial = COUNTRY_DIAL[country] ?? form.dial_code;
    setForm((f) => ({ ...f, country_of_residence: country, dial_code: dial }));
  };

  // When country of interest changes, clear category + visa type
  const handleDestinationChange = (country: string) => {
    setForm((f) => ({ ...f, country_of_interest: country, interested_category_id: "", interested_visa_type_id: "", interested_visa_sub_type_id: "" }));
  };

  // When category changes, clear visa type
  const handleCategoryChange = (id: string) => {
    setForm((f) => ({ ...f, interested_category_id: id, interested_visa_type_id: "", interested_visa_sub_type_id: "" }));
  };

  // When visa type changes, clear sub-type
  const handleVisaTypeChange = (id: string) => {
    setForm((f) => ({ ...f, interested_visa_type_id: id, interested_visa_sub_type_id: "" }));
  };

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: allVisaTypes } = useQuery({
    queryKey: ["visa-types-active-cat"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("visa_types")
        .select("id, label, destination_country, category_id")
        .eq("is_active", true)
        .order("label");
      return (data ?? []) as { id: string; label: string; destination_country: string | null; category_id: string | null }[];
    },
  });

  const { data: countryList } = useQuery({
    queryKey: ["countries-active"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("countries")
        .select("code, label")
        .eq("is_active", true)
        .order("sort_order");
      return (data ?? []) as { code: string; label: string }[];
    },
  });

  const { data: categoryList } = useQuery({
    queryKey: ["visa-categories-active"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("visa_categories")
        .select("id, label")
        .eq("is_active", true)
        .order("sort_order");
      return (data ?? []) as { id: string; label: string }[];
    },
  });

  // Fallback destination options if the countries table is empty
  const destinationOptions = (countryList && countryList.length > 0)
    ? countryList.map((c) => c.label)
    : DESTINATION_COUNTRIES;

  const { data: allSubTypes } = useQuery({
    queryKey: ["visa-sub-types-active"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("visa_sub_types")
        .select("id, label, visa_type_id")
        .eq("is_active", true)
        .order("label");
      return (data ?? []) as { id: string; label: string; visa_type_id: string }[];
    },
  });

  const { data: sources } = useQuery({
    queryKey: ["lead-sources-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lead_sources")
        .select("code, label")
        .eq("is_active", true)
        .order("sort_order");
      return data ?? [];
    },
  });

  const { data: referralPartners } = useQuery({
    queryKey: ["referral-partners-active"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("referral_partners")
        .select("id, name, company")
        .eq("is_active", true)
        .order("name");
      return (data ?? []) as { id: string; name: string; company: string | null }[];
    },
  });

  const { data: agentPartners } = useQuery({
    queryKey: ["agent-partners-active"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("agent_partners")
        .select("id, name, company")
        .eq("is_active", true)
        .order("name");
      return (data ?? []) as { id: string; name: string; company: string | null }[];
    },
  });

  // ── Derived: sub-types filtered by country of interest AND category ───────
  const visaTypes = allVisaTypes?.filter((v) => {
    const okCountry = !form.country_of_interest || !v.destination_country
      || v.destination_country.toLowerCase() === form.country_of_interest.toLowerCase();
    const okCategory = !form.interested_category_id || v.category_id === form.interested_category_id;
    return okCountry && okCategory;
  }) ?? [];

  // Streams for the selected sub-type
  const subTypes = allSubTypes?.filter((s) => s.visa_type_id === form.interested_visa_type_id) ?? [];

  // ── Existing-client match (repeat enquiry) ────────────────────────────────
  const [matchedClient, setMatchedClient] = useState<{ id: string; full_name: string } | null>(null);
  useEffect(() => {
    // Forced link (opened from a client's "New enquiry" button) always wins.
    if (linkedClient) { setMatchedClient({ id: linkedClient.id, full_name: linkedClient.full_name }); return; }
    const email = form.email.trim();
    const phoneDigits = form.phone_local.replace(/\D/g, "");
    if (email.length < 4 && phoneDigits.length < 6) { setMatchedClient(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = (supabase as any).from("clients").select("id, full_name, email, phone").limit(1);
        if (email.length >= 4 && phoneDigits.length >= 6) {
          q = q.or(`email.ilike.%${email}%,phone.ilike.%${phoneDigits}%`);
        } else if (email.length >= 4) {
          q = q.ilike("email", `%${email}%`);
        } else {
          q = q.ilike("phone", `%${phoneDigits}%`);
        }
        const { data } = await q;
        if (!cancelled) setMatchedClient(data && data[0] ? { id: data[0].id, full_name: data[0].full_name } : null);
      } catch {
        if (!cancelled) setMatchedClient(null);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.email, form.phone_local]);

  // Whether the current source needs a person name
  const needsPersonName = SOURCES_WITH_NAME.includes(form.source_code);
  const isAgentPartner = form.source_code === "agent_partner";

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.first_name.trim()) { toast.error("First name is required"); return; }
    if (!form.last_name.trim()) { toast.error("Last name is required"); return; }
    if (!form.country_of_residence) { toast.error("Country of residence is required"); return; }
    if (!form.nationality) { toast.error("Nationality is required"); return; }
    if (!form.source_code) { toast.error("Pick a source"); return; }
    if (!form.notes.trim()) { toast.error("Notes are required — add initial context for this lead"); return; }

    const combined = `${form.dial_code} ${form.phone_local.trim()}`;
    const digitsOnly = combined.replace(/\D/g, "");
    if (!form.phone_local.trim()) { toast.error("Phone number is required"); return; }
    if (digitsOnly.length < 10) { toast.error("Phone number must have at least 10 digits"); return; }

    if (isAgentPartner && !form.agent_partner_id) {
      toast.error("Please select the agent partner"); return;
    }

    setSubmitting(true);
    const fullName = `${form.first_name.trim()} ${form.last_name.trim()}`;

    const payload = {
      full_name: fullName,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: combined,
      nationality: form.nationality || null,
      country_of_residence: form.country_of_residence || null,
      country_of_interest: form.country_of_interest || null,
      interested_country: form.country_of_interest || null,
      interested_category_id: form.interested_category_id || null,
      interested_visa_type_id: form.interested_visa_type_id || null,
      interested_visa_sub_type_id: form.interested_visa_sub_type_id || null,
      enquiry_client_id: matchedClient?.id || null,
      source_code: form.source_code,
      source_person_name: (needsPersonName || isAgentPartner) ? (form.source_person_name.trim() || null) : null,
      agent_partner_id: isAgentPartner ? (form.agent_partner_id || null) : null,
      referral_partner_id: form.referral_partner_id || null,
      notes: form.notes.trim() || null,
      lifecycle_state: "new_enquiry",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase.from("leads").insert(payload as any).select("id").single();
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }

    void writeAudit({ action: "CREATE", entity_type: "leads", entity_id: data.id, changes: payload });
    void writeTimeline({
      event_type: "lead_created",
      title: `Lead created — ${fullName}`,
      body: null,
      metadata: { source: payload.source_code, country: payload.country_of_residence },
      lead_id: data.id,
      is_system: false,
    });
    void createLeadTasks(data.id, profile?.id ?? null, user?.id ?? null);
    // Creation note → categorised notes panel as a 'general' note (not just the leads.notes blob)
    if (payload.notes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void (supabase as any).from("entity_notes").insert({
        lead_id: data.id, note_type: "general", body: payload.notes,
        is_locked: false, created_by: user?.id ?? null,
      });
    }

    // Create family unit and add members if requested
    if (hasFamily && familyMembers.length > 0) {
      try {
        // Create the family unit
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: unitData } = await (supabase as any)
          .from("family_units")
          .insert({ unit_name: `${fullName} family` })
          .select("id")
          .single();

        if (unitData?.id) {
          // Tag the primary lead
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("leads")
            .update({ family_unit_id: unitData.id, family_role: "primary" })
            .eq("id", data.id);

          // Insert each family member as a lead
          for (const member of familyMembers) {
            if (!member.name.trim()) continue;
            const memberPayload = {
              full_name: member.name.trim(),
              first_name: member.name.trim().split(" ")[0] ?? member.name.trim(),
              last_name: member.name.trim().split(" ").slice(1).join(" ") || null,
              phone: member.phone.trim() || null,
              email: member.email.trim() || null,
              family_unit_id: unitData.id,
              family_role: member.role,
              interested_visa_type_id: member.visa_type_id || null,
              notes: member.note.trim() || null,
              lifecycle_state: "new_enquiry",
              source_code: form.source_code,
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: memberRow } = await (supabase as any)
              .from("leads").insert(memberPayload as any).select("id").single();
            if (memberRow?.id) {
              void writeAudit({ action: "CREATE", entity_type: "leads", entity_id: memberRow.id, changes: memberPayload });
              void writeTimeline({
                event_type: "lead_created",
                title: `Lead created — ${member.name.trim()} (${member.role})`,
                body: null,
                metadata: { source: memberPayload.source_code, family_of: fullName },
                lead_id: memberRow.id,
                is_system: false,
              });
              if (memberPayload.notes) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                void (supabase as any).from("entity_notes").insert({
                  lead_id: memberRow.id, note_type: "general", body: memberPayload.notes,
                  is_locked: false, created_by: user?.id ?? null,
                });
              }
            }
          }
        }
      } catch (familyErr) {
        console.warn("[NewLeadDialog] family unit creation error", familyErr);
        // Non-fatal — lead was already created
      }
    }

    void qc.invalidateQueries({ queryKey: ["leads-counts"] });
    void qc.invalidateQueries({ queryKey: ["leads-list"] });
    void qc.invalidateQueries({ queryKey: ["sidebar-badge-counts"] });
    toast.success("Lead created — opening profile…");
    onOpenChange(false);
    onCreated?.(data.id);
    // Auto-navigate to the new lead's detail page
    navigate(`/leads/${data.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-navy">New Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3 pb-1">

          {/* First + Last name (both mandatory) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead-first-name">First name *</Label>
              <Input
                id="lead-first-name"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                placeholder="Ravi"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-last-name">Last name *</Label>
              <Input
                id="lead-last-name"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                placeholder="Sharma"
                required
              />
            </div>
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-phone">
                Phone * <span className="text-muted-foreground font-normal text-[11px]">(min 10 digits)</span>
              </Label>
              <div className="flex gap-1.5">
                <Select
                  value={form.dial_code}
                  onValueChange={(v) => setForm((f) => ({ ...f, dial_code: v }))}
                >
                  <SelectTrigger className="w-[82px] shrink-0 text-sm px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {ALL_DIAL_CODES.map((code) => (
                      <SelectItem key={code} value={code}>{code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="lead-phone"
                  value={form.phone_local}
                  onChange={(e) => setForm((f) => ({ ...f, phone_local: e.target.value }))}
                  placeholder="98765 43210"
                  className="flex-1"
                  required
                />
              </div>
            </div>
          </div>

          {/* Existing-client match — this is a repeat enquiry */}
          {matchedClient && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <Users className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                Matches existing client <span className="font-semibold">{matchedClient.full_name}</span>.
                This will be logged as a <span className="font-semibold">new enquiry</span> for that client —
                converting it later adds a new application to them (no duplicate client is created).
              </div>
            </div>
          )}

          {/* Country of residence (mandatory) + Nationality (mandatory) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Country of residence *</Label>
              <Select value={form.country_of_residence} onValueChange={handleCountryChange}>
                <SelectTrigger><SelectValue placeholder="Where do they live?" /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nationality *</Label>
              <Select value={form.nationality} onValueChange={(v) => setForm({ ...form, nationality: v })}>
                <SelectTrigger><SelectValue placeholder="Passport country" /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Visa interest: Country → Category → Sub-type */}
          <div className="grid grid-cols-2 gap-3">
            {/* Country of interest (destination) */}
            <div className="space-y-1.5">
              <Label>Country of interest <span className="text-muted-foreground font-normal">(destination)</span></Label>
              <Select value={form.country_of_interest} onValueChange={handleDestinationChange}>
                <SelectTrigger><SelectValue placeholder="Where do they want to go?" /></SelectTrigger>
                <SelectContent>
                  {destinationOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Visa category */}
            <div className="space-y-1.5">
              <Label>Visa category</Label>
              <Select
                value={form.interested_category_id}
                onValueChange={handleCategoryChange}
                disabled={!form.country_of_interest}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.country_of_interest ? "Study / Visit / Work…" : "Pick country first"} />
                </SelectTrigger>
                <SelectContent>
                  {(categoryList ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Sub-type (the specific visa/service) */}
            <div className="space-y-1.5">
              <Label>Sub-type</Label>
              <Select
                value={form.interested_visa_type_id}
                onValueChange={handleVisaTypeChange}
                disabled={!form.interested_category_id || visaTypes.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !form.interested_category_id ? "Pick category first"
                    : visaTypes.length === 0 ? "None for this country/category"
                    : "Select sub-type"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {visaTypes.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Optional stream — only if the sub-type has streams */}
            {subTypes.length > 0 && (
              <div className="space-y-1.5">
                <Label>Stream <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Select
                  value={form.interested_visa_sub_type_id}
                  onValueChange={(v) => setForm({ ...form, interested_visa_sub_type_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select stream…" /></SelectTrigger>
                  <SelectContent>
                    {subTypes.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Source */}
          <div className="space-y-1.5">
            <Label>Source *</Label>
            <Select
              value={form.source_code}
              onValueChange={(v) => setForm({ ...form, source_code: v, source_person_name: "", agent_partner_id: "" })}
            >
              <SelectTrigger><SelectValue placeholder="How did they find us?" /></SelectTrigger>
              <SelectContent>
                {sources?.map((s) => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}
                {/* Agent partner always available even if not in lead_sources */}
                {!sources?.find((s) => s.code === "agent_partner") && (
                  <SelectItem value="agent_partner">Agent / Partner</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Referral / previous customer → person name */}
          {needsPersonName && (
            <div className="space-y-1.5">
              <Label htmlFor="source-person-name">
                {form.source_code === "previous_customer" ? "Previous client name" : "Referred by (name)"}
              </Label>
              <Input
                id="source-person-name"
                value={form.source_person_name}
                onChange={(e) => setForm({ ...form, source_person_name: e.target.value })}
                placeholder="Enter the name…"
              />
            </div>
          )}

          {/* Agent partner source → pick from partners list */}
          {isAgentPartner && (
            <div className="space-y-1.5">
              <Label>Agent / Partner *</Label>
              {agentPartners && agentPartners.length > 0 ? (
                <Select
                  value={form.agent_partner_id}
                  onValueChange={(v) => setForm({ ...form, agent_partner_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select agent partner…" /></SelectTrigger>
                  <SelectContent>
                    {agentPartners.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}{p.company ? ` — ${p.company}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  No agent partners configured. Add them in Admin → Agent Partners.
                </p>
              )}
              {/* Also allow free-text name for agent not in the system */}
              <Input
                className="mt-1.5"
                value={form.source_person_name}
                onChange={(e) => setForm({ ...form, source_person_name: e.target.value })}
                placeholder="Agent contact name (optional)"
              />
            </div>
          )}

          {/* Referral partner (existing system) */}
          {referralPartners && referralPartners.length > 0 && (
            <div className="space-y-1.5">
              <Label>Referral partner <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select
                value={form.referral_partner_id}
                onValueChange={(v) => setForm({ ...form, referral_partner_id: v === "__none__" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Select referral partner…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {referralPartners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.company ? ` (${p.company})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="lead-notes">Notes <span className="text-destructive">*</span></Label>
            <Textarea
              id="lead-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Required — initial context, what the client asked, next step…"
              required
            />
          </div>

          {/* Has family members checkbox */}
          <div className="border rounded-md p-3 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasFamily}
                onChange={(e) => {
                  setHasFamily(e.target.checked);
                  if (e.target.checked && familyMembers.length === 0) {
                    setFamilyMembers([BLANK_MEMBER(form.interested_visa_type_id)]);
                  }
                }}
                className="w-4 h-4 rounded border-border accent-primary"
              />
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Has family members</span>
                <span className="text-[11px] text-muted-foreground">(add them to the same family unit)</span>
              </div>
            </label>

            {hasFamily && (
              <div className="space-y-3">
                {familyMembers.map((member, idx) => (
                  <div key={member.id} className="border border-dashed rounded-md p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Member {idx + 1}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => removeFamilyMember(member.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Name + Role */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Full name *</Label>
                        <Input
                          value={member.name}
                          onChange={(e) => updateFamilyMember(member.id, { name: e.target.value })}
                          placeholder="Full name"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Relationship</Label>
                        <Select
                          value={member.role}
                          onValueChange={(v) => updateFamilyMember(member.id, { role: v as FamilyRole })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="spouse">Spouse</SelectItem>
                            <SelectItem value="partner">Partner</SelectItem>
                            <SelectItem value="child">Child / Dependent</SelectItem>
                            <SelectItem value="parent">Parent</SelectItem>
                            <SelectItem value="sibling">Sibling</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Phone + Email */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Phone</Label>
                        <Input
                          value={member.phone}
                          onChange={(e) => updateFamilyMember(member.id, { phone: e.target.value })}
                          placeholder="+91 98765 43210"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Email</Label>
                        <Input
                          type="email"
                          value={member.email}
                          onChange={(e) => updateFamilyMember(member.id, { email: e.target.value })}
                          placeholder="email@example.com"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    {/* Visa interest (auto-filled from lead) */}
                    <div className="space-y-1">
                      <Label className="text-xs">
                        Visa interest
                        {form.interested_visa_type_id && (
                          <span className="text-[10px] text-muted-foreground ml-1">(auto-filled from lead)</span>
                        )}
                      </Label>
                      <Select
                        value={member.visa_type_id}
                        onValueChange={(v) => updateFamilyMember(member.id, { visa_type_id: v })}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select visa type…" />
                        </SelectTrigger>
                        <SelectContent>
                          {(allVisaTypes ?? []).map((v) => (
                            <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Relationship note */}
                    <div className="space-y-1">
                      <Label className="text-xs">Relationship note</Label>
                      <Input
                        value={member.note}
                        onChange={(e) => updateFamilyMember(member.id, { note: e.target.value })}
                        placeholder="e.g. Spouse joining on SOWP, 2 children included"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed"
                  onClick={addFamilyMember}
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                  Add another member
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-primary hover:bg-primary/90">
              {submitting ? "Saving…" : "Create lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
