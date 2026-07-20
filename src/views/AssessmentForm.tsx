"use client";

// src/views/AssessmentForm.tsx — v2 2026-07-18 DYNAMIC
// Public /assessment now renders whatever form is active+default in
// assessment_forms (built in Admin → Assessment Forms). Edits go live
// instantly — no code changes ever needed.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Question {
  key: string; label: string; type: string;
  required?: boolean; options?: string[];
  show_if?: { key: string; equals: string } | null;
}
interface Section { title: string; questions: Question[] }
interface FormRow { code: string; title: string; description: string | null; sections: Section[] }

function visible(q: Question, answers: Record<string, unknown>): boolean {
  if (!q.show_if || !q.show_if.key) return true;
  const v = answers[q.show_if.key];
  const target = q.show_if.equals;
  if (target === ">0") return Number(v ?? 0) > 0;
  return String(v ?? "") === target;
}

export default function AssessmentForm() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const { data: form, isLoading, error } = useQuery({
    queryKey: ["public-assessment-form"],
    queryFn: async () => {
      const { data, error } = await db.from("assessment_forms")
        .select("code, title, description, sections")
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as FormRow | null;
    },
    retry: false,
  });

  const sections = useMemo(
    () => (form?.sections ?? []).filter((s) => s.questions.some((q) => visible(q, answers))),
    [form, answers]
  );
  const current = sections[step];
  const isLast = step >= sections.length - 1;

  const setA = (key: string, value: unknown) => setAnswers((a) => ({ ...a, [key]: value }));

  const validate = (): boolean => {
    for (const q of current?.questions ?? []) {
      if (!visible(q, answers)) continue;
      if (q.required && (answers[q.key] == null || String(answers[q.key]).trim() === "")) {
        toast.error(`Please fill: ${q.label}`);
        return false;
      }
    }
    return true;
  };

  const next = () => { if (validate()) setStep((s) => s + 1); };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    const payload = { form_code: form?.code, submitted_at: new Date().toISOString(), ...answers };
    const { error: insErr } = await db.from("assessments").insert({ status: "submitted", form_code: form?.code ?? null, payload });
    setBusy(false);
    if (insErr) { toast.error("Submission failed: " + insErr.message); return; }
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-surface p-10 max-w-md text-center">
          <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-4" />
          <h1 className="font-display text-2xl text-navy">Thank you!</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Your assessment has been received. Our counselors will review it and contact you shortly with the programs you qualify for.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  if (error || !form || sections.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-surface p-10 max-w-md text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">Assessment temporarily unavailable</p>
          <p className="text-xs text-muted-foreground mt-1">Please contact us directly and we will assess you over a call.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 flex items-start justify-center">
      <div className="w-full max-w-xl space-y-4 py-6">
        <div className="text-center">
          <h1 className="font-display text-2xl text-navy">{form.title}</h1>
          {form.description && <p className="text-sm text-muted-foreground mt-1">{form.description}</p>}
        </div>

        {/* progress */}
        <div className="flex gap-1.5">
          {sections.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        <div className="card-surface p-6 space-y-4">
          <h2 className="font-semibold text-navy">{current.title}</h2>
          {current.questions.filter((q) => visible(q, answers)).map((q) => (
            <div key={q.key} className="space-y-1.5">
              <Label>{q.label}{q.required && <span className="text-destructive"> *</span>}</Label>
              {q.type === "textarea" ? (
                <Textarea value={String(answers[q.key] ?? "")} onChange={(e) => setA(q.key, e.target.value)} />
              ) : q.type === "select" ? (
                <Select value={String(answers[q.key] ?? "")} onValueChange={(v) => setA(q.key, v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {(q.options ?? []).map((o) => (
                      <SelectItem key={o} value={o}>{o.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : q.type === "yes_no" ? (
                <div className="flex gap-2">
                  {["yes", "no"].map((v) => (
                    <button key={v} type="button"
                      onClick={() => setA(q.key, v)}
                      className={`px-4 py-2 rounded-md border text-sm capitalize transition-colors ${answers[q.key] === v ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/40"}`}>
                      {v}
                    </button>
                  ))}
                </div>
              ) : (
                <Input
                  type={q.type === "number" ? "number" : q.type === "date" ? "date" : q.type === "email" ? "email" : q.type === "phone" ? "tel" : "text"}
                  value={String(answers[q.key] ?? "")}
                  onChange={(e) => setA(q.key, q.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {isLast ? (
            <Button onClick={() => void submit()} disabled={busy}>
              {busy ? "Submitting…" : "Submit assessment"}
            </Button>
          ) : (
            <Button onClick={next}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
          )}
        </div>
      </div>
    </div>
  );
}
