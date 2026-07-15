"use client";

/**
 * IntakeForm.tsx
 * Public-facing multi-step lead intake questionnaire.
 * Accessible at /intake — no login required.
 * Submits directly to the leads table with source_code = "web_form".
 *
 * Steps:
 *  1. Contact info
 *  2. Background (citizenship, residence, education)
 *  3. Work experience & language
 *  4. Immigration goal
 *  5. Review & submit
 */

import { useState, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Crown, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { writeTimeline } from "@/lib/timeline";

// ─── constants ────────────────────────────────────────────────────────────────

const COUNTRIES = [
  "India", "Pakistan", "Bangladesh", "Sri Lanka", "Nepal", "Nigeria", "Philippines",
  "China", "USA", "United Kingdom", "Canada", "Australia", "UAE", "Saudi Arabia",
  "Kenya", "Ghana", "Mexico", "Brazil", "South Korea", "Iran", "Egypt", "Ethiopia",
  "Vietnam", "Indonesia", "Malaysia", "Singapore", "Jamaica", "Trinidad and Tobago",
  "Other",
];

const DEST_COUNTRIES = ["Canada", "Australia", "United Kingdom", "USA", "Germany", "New Zealand", "Other"];

const EDUCATION_LEVELS = [
  "Secondary / High school", "Diploma / Certificate", "Bachelor's degree",
  "Post-graduate diploma", "Master's degree", "PhD / Doctorate", "Professional degree (MD, JD, etc.)",
];

const WORK_EXP_OPTIONS = [
  "None", "Less than 1 year", "1–2 years", "3–5 years", "6–10 years", "10+ years",
];

const LANG_PROFICIENCY = ["None", "Basic", "Intermediate", "Advanced", "Native / Fluent"];

const VISA_GOALS = [
  "Permanent Residency (PR)",
  "Work Permit",
  "Student Visa",
  "Visitor / Tourist Visa",
  "Family Sponsorship",
  "Business / Investor Visa",
  "Refugee / Asylum",
  "Not sure yet — need guidance",
];

const TOTAL_STEPS = 5;

// ─── form state ───────────────────────────────────────────────────────────────

interface FormState {
  // Step 1: Contact
  full_name: string;
  email: string;
  phone: string;
  // Step 2: Background
  country_of_citizenship: string;
  country_of_residence: string;
  date_of_birth: string;
  education_level: string;
  // Step 3: Work & Language
  work_experience: string;
  english_proficiency: string;
  ielts_score: string;
  french_proficiency: string;
  // Step 4: Goals
  destination_country: string;
  visa_goal: string;
  crs_score: string;
  notes: string;
}

const EMPTY: FormState = {
  full_name: "", email: "", phone: "",
  country_of_citizenship: "", country_of_residence: "", date_of_birth: "", education_level: "",
  work_experience: "", english_proficiency: "", ielts_score: "", french_proficiency: "",
  destination_country: "", visa_goal: "", crs_score: "", notes: "",
};

// ─── component ───────────────────────────────────────────────────────────────

export default function IntakeForm() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const canProceed = (): boolean => {
    if (step === 1) return !!form.full_name.trim() && !!form.phone.trim() && form.phone.replace(/\D/g, "").length >= 10;
    if (step === 2) return !!form.country_of_citizenship && !!form.country_of_residence;
    if (step === 3) return true; // optional fields
    if (step === 4) return !!form.destination_country && !!form.visa_goal;
    return true;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const assessment_data = {
      education_level: form.education_level,
      work_experience: form.work_experience,
      english_proficiency: form.english_proficiency,
      ielts_score: form.ielts_score || null,
      french_proficiency: form.french_proficiency,
      visa_goal: form.visa_goal,
      date_of_birth: form.date_of_birth || null,
    };

    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim(),
      country_of_residence: form.country_of_residence || null,
      country_of_interest: form.destination_country || null,
      notes: form.notes.trim() || null,
      source_code: "web_form",
      lifecycle_state: "new_enquiry",
      crs_score: form.crs_score ? Number(form.crs_score) : null,
      assessment_data,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from("leads").insert(payload).select("id").single();
    setSubmitting(false);

    if (error) {
      toast.error("Submission failed. Please try again or call us directly.");
      return;
    }

    void writeTimeline({
      event_type: "lead_created",
      title: `Web form enquiry — ${payload.full_name}`,
      body: payload.notes ?? null,
      metadata: { source: "web_form", destination: form.destination_country, visa_goal: form.visa_goal },
      lead_id: data.id,
      is_system: true,
    });

    setSubmitted(true);
  };

  if (submitted) return <SuccessScreen name={form.full_name.split(" ")[0]} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy/5 via-background to-gold/5 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gold shadow-lg mb-3">
            <Crown className="h-6 w-6 text-gold-foreground" />
          </div>
          <h1 className="font-display text-2xl text-navy">Study2PR</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Free Immigration Assessment</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-1 mb-6">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1 rounded-full transition-all ${i + 1 <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        <form onSubmit={submit}>
          <div className="card-surface p-6 space-y-5">
            {/* Step labels */}
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                Step {step} of {TOTAL_STEPS}
              </div>
              <h2 className="font-display text-lg text-navy mt-1">
                {step === 1 && "Your contact details"}
                {step === 2 && "Your background"}
                {step === 3 && "Work & language"}
                {step === 4 && "Your immigration goal"}
                {step === 5 && "Review & submit"}
              </h2>
            </div>

            {/* Step 1 */}
            {step === 1 && (
              <div className="space-y-4">
                <Field label="Full name *">
                  <Input value={form.full_name} onChange={(e) => set({ full_name: e.target.value })} placeholder="As on your passport" required />
                </Field>
                <Field label="Email address">
                  <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="we'll send your assessment here" />
                </Field>
                <Field label="Phone number * (WhatsApp preferred)">
                  <Input type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+91 98765 43210" required />
                  {form.phone && form.phone.replace(/\D/g, "").length < 10 && (
                    <p className="text-xs text-destructive mt-1">Please enter at least 10 digits</p>
                  )}
                </Field>
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div className="space-y-4">
                <Field label="Country of citizenship *">
                  <Select value={form.country_of_citizenship} onValueChange={(v) => set({ country_of_citizenship: v })}>
                    <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Current country of residence *">
                  <Select value={form.country_of_residence} onValueChange={(v) => set({ country_of_residence: v })}>
                    <SelectTrigger><SelectValue placeholder="Where do you live now?" /></SelectTrigger>
                    <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Date of birth">
                  <Input type="date" value={form.date_of_birth} onChange={(e) => set({ date_of_birth: e.target.value })} />
                </Field>
                <Field label="Highest education level">
                  <Select value={form.education_level} onValueChange={(v) => set({ education_level: v })}>
                    <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                    <SelectContent>{EDUCATION_LEVELS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div className="space-y-4">
                <Field label="Total skilled work experience">
                  <Select value={form.work_experience} onValueChange={(v) => set({ work_experience: v })}>
                    <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                    <SelectContent>{WORK_EXP_OPTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="English proficiency">
                  <Select value={form.english_proficiency} onValueChange={(v) => set({ english_proficiency: v })}>
                    <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                    <SelectContent>{LANG_PROFICIENCY.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="IELTS overall band score (if taken)">
                  <Input
                    type="number" min={0} max={9} step={0.5}
                    value={form.ielts_score}
                    onChange={(e) => set({ ielts_score: e.target.value })}
                    placeholder="e.g. 7.5"
                  />
                </Field>
                <Field label="French proficiency">
                  <Select value={form.french_proficiency} onValueChange={(v) => set({ french_proficiency: v })}>
                    <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                    <SelectContent>{LANG_PROFICIENCY.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="CRS score (if known)">
                  <Input
                    type="number" min={0} max={1200}
                    value={form.crs_score}
                    onChange={(e) => set({ crs_score: e.target.value })}
                    placeholder="e.g. 480"
                  />
                </Field>
              </div>
            )}

            {/* Step 4 */}
            {step === 4 && (
              <div className="space-y-4">
                <Field label="Where do you want to immigrate? *">
                  <Select value={form.destination_country} onValueChange={(v) => set({ destination_country: v })}>
                    <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                    <SelectContent>{DEST_COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="What type of visa / pathway are you interested in? *">
                  <Select value={form.visa_goal} onValueChange={(v) => set({ visa_goal: v })}>
                    <SelectTrigger><SelectValue placeholder="Select pathway" /></SelectTrigger>
                    <SelectContent>{VISA_GOALS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Anything else you'd like us to know?">
                  <Textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => set({ notes: e.target.value })}
                    placeholder="Dependants, special circumstances, timeline urgency…"
                  />
                </Field>
              </div>
            )}

            {/* Step 5 — Review */}
            {step === 5 && (
              <div className="space-y-3 text-sm">
                <ReviewRow label="Name" value={form.full_name} />
                <ReviewRow label="Email" value={form.email || "Not provided"} />
                <ReviewRow label="Phone" value={form.phone} />
                <ReviewRow label="Citizenship" value={form.country_of_citizenship} />
                <ReviewRow label="Residence" value={form.country_of_residence} />
                <ReviewRow label="Education" value={form.education_level} />
                <ReviewRow label="Work exp." value={form.work_experience} />
                <ReviewRow label="English" value={form.english_proficiency} />
                {form.ielts_score && <ReviewRow label="IELTS" value={form.ielts_score} />}
                {form.crs_score && <ReviewRow label="CRS score" value={form.crs_score} />}
                <ReviewRow label="Destination" value={form.destination_country} />
                <ReviewRow label="Pathway" value={form.visa_goal} />
                {form.notes && <ReviewRow label="Notes" value={form.notes} />}

                <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                  By submitting, you agree to be contacted by Study2PR Immigration Consulting regarding your application.
                  Your information is kept strictly confidential.
                </p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-4 gap-3">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" />Back
              </Button>
            ) : <div />}

            {step < TOTAL_STEPS ? (
              <Button
                type="button"
                disabled={!canProceed()}
                onClick={() => setStep((s) => s + 1)}
                className="bg-primary hover:bg-primary/90"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={submitting}
                className="bg-gold hover:bg-gold/90 text-gold-foreground"
              >
                {submitting ? "Submitting…" : "Submit my assessment"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border last:border-0">
      <span className="text-muted-foreground shrink-0 w-28">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );
}

function SuccessScreen({ name }: { name: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy/5 via-background to-gold/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 mx-auto">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <div>
          <h1 className="font-display text-2xl text-navy">Thank you, {name}!</h1>
          <p className="text-muted-foreground mt-2 leading-relaxed">
            Your assessment has been received. One of our advisors will review your profile and
            reach out within <strong>2 business hours</strong> to discuss your options.
          </p>
        </div>
        <div className="card-surface p-5 text-sm text-left space-y-2">
          <div className="font-medium text-navy">What happens next?</div>
          <div className="flex gap-2 text-muted-foreground"><span className="shrink-0">1.</span>Your advisor reviews your profile</div>
          <div className="flex gap-2 text-muted-foreground"><span className="shrink-0">2.</span>You receive a call or WhatsApp message</div>
          <div className="flex gap-2 text-muted-foreground"><span className="shrink-0">3.</span>Free consultation to discuss your pathway</div>
        </div>
        <p className="text-xs text-muted-foreground">Study2PR Immigration Consulting · All information kept strictly confidential</p>
      </div>
    </div>
  );
}
