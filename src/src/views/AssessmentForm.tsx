"use client";

/**
 * Public assessment questionnaire (/assessment) — no login needed.
 * Produces the payload contract documented in sql/22 and inserts into
 * `assessments` (status 'submitted') → engine auto-scores + creates a
 * review task. Conditional sections per locked spec: spouse only if
 * married/common-law, work section only if has experience, gap-reason
 * prompt when Grade 10 finished after age 16 / Grade 12 after 18.
 */

import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const STEPS = ["About you", "Education", "Language", "Work", "Travel & visas", "Family", "Funds & plans"] as const;

type Job = { title: string; noc: string; country: string; start: string; end: string; type: string };
type Refusal = { country: string; visa_type: string; date: string; reason: string };
type Degree = { type: string; duration_years: string; country: string; institution: string; grade: string; year: string };

export default function AssessmentForm() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  // personal
  const [p, setP] = useState({ full_name: "", dob: "", phone: "", email: "", marital_status: "single" });
  // education
  const [edu, setEdu] = useState({ grade10_age: "", grade12_age: "", grade12_pct: "", reappears: "no", gap_reason: "" });
  const [bachelors, setBachelors] = useState<Degree[]>([]);
  const [postgrads, setPostgrads] = useState<Degree[]>([]);
  // language
  const [lang, setLang] = useState({ test: "none", test_date: "", listening: "", reading: "", writing: "", speaking: "", overall: "" });
  // work
  const [hasWork, setHasWork] = useState("no");
  const [jobs, setJobs] = useState<Job[]>([]);
  // travel
  const [travel, setTravel] = useState({ visited_before: "no", in_canada: "no", canada_status: "" });
  const [refusals, setRefusals] = useState<Refusal[]>([]);
  // family
  const [fam, setFam] = useState({ spouse_name: "", spouse_dob: "", children_count: "0", parents_country: "", parents_income_bucket: "", parents_occupation: "" });
  // funds
  const [funds, setFunds] = useState({ amount_cad: "", source: "family", provinces: "", why_canada: "", future_plans: "" });

  const gapPrompt =
    (edu.grade10_age !== "" && Number(edu.grade10_age) > 16) ||
    (edu.grade12_age !== "" && Number(edu.grade12_age) > 18);
  const married = p.marital_status === "married" || p.marital_status === "common-law";

  const validateStep = (): string | null => {
    if (step === 0) {
      if (!p.full_name.trim()) return "Please enter your full name";
      if (!p.dob) return "Please enter your date of birth";
      if (!p.phone.trim()) return "Please enter your phone number";
    }
    if (step === 1 && gapPrompt && !edu.gap_reason.trim())
      return "Please explain the education gap (or write 'no gap')";
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) { toast.error(err); return; }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = async () => {
    const err = validateStep();
    if (err) { toast.error(err); return; }
    setBusy(true);
    const payload = {
      personal: p,
      education: {
        grade10_age: edu.grade10_age, grade12_age: edu.grade12_age, grade12_pct: edu.grade12_pct,
        reappears: edu.reappears === "yes", gap_reason: edu.gap_reason || null,
        bachelors, postgrads,
      },
      language: lang,
      work: hasWork === "yes" ? jobs : [],
      travel: {
        visits: travel.visited_before === "yes" ? [{ country: "yes", year: "", purpose: "", duration: "" }] : [],
        refusals,
        prior_canada_apps: [],
        in_canada: travel.in_canada === "yes",
        canada_status: travel.canada_status || null,
      },
      family: {
        spouse: married ? { name: fam.spouse_name, dob: fam.spouse_dob } : null,
        children: Array.from({ length: Number(fam.children_count) || 0 }, () => ({})),
        parents_country: fam.parents_country, parents_income_bucket: fam.parents_income_bucket,
        parents_occupation: fam.parents_occupation,
      },
      funds: {
        amount_cad: funds.amount_cad, currency: "CAD", source: funds.source,
        provinces: funds.provinces ? funds.provinces.split(",").map((x) => x.trim()) : [],
        why_canada: funds.why_canada, future_plans: funds.future_plans,
      },
    };
    const { error } = await supabase.from("assessments").insert({ status: "submitted", payload });
    setBusy(false);
    if (error) { toast.error("Submission failed: " + error.message); return; }
    setDone(true);
  };

  const degreeEditor = (list: Degree[], set: (d: Degree[]) => void, kind: string, types: string[]) => (
    <div className="space-y-2">
      {list.map((d, i) => (
        <div key={i} className="border border-border rounded-md p-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium">{kind} {i + 1}</span>
            <Button variant="ghost" size="icon" onClick={() => set(list.filter((_, j) => j !== i))}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={d.type} onValueChange={(v) => set(list.map((x, j) => j === i ? { ...x, type: v } : x))}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>{types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Duration (years)" value={d.duration_years}
                   onChange={(e) => set(list.map((x, j) => j === i ? { ...x, duration_years: e.target.value } : x))} />
            <Input placeholder="Institution" value={d.institution}
                   onChange={(e) => set(list.map((x, j) => j === i ? { ...x, institution: e.target.value } : x))} />
            <Input placeholder="Final grade / %" value={d.grade}
                   onChange={(e) => set(list.map((x, j) => j === i ? { ...x, grade: e.target.value } : x))} />
            <Input placeholder="Country" value={d.country}
                   onChange={(e) => set(list.map((x, j) => j === i ? { ...x, country: e.target.value } : x))} />
            <Input placeholder="Year completed" value={d.year}
                   onChange={(e) => set(list.map((x, j) => j === i ? { ...x, year: e.target.value } : x))} />
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => set([...list, { type: "", duration_years: "", country: "", institution: "", grade: "", year: "" }])}>
        <Plus className="h-3.5 w-3.5" /> Add {kind}
      </Button>
    </div>
  );

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="card-surface max-w-md w-full p-8 text-center space-y-3">
          <CheckCircle2 className="h-10 w-10 mx-auto text-green-600" />
          <h1 className="font-display text-xl text-navy">Assessment received!</h1>
          <p className="text-sm text-muted-foreground">
            Thank you, {p.full_name.split(" ")[0]}. Our team is evaluating your profile against
            every program we handle and will contact you within 24 hours on {p.phone}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center space-y-1">
          <h1 className="font-display text-2xl text-navy">Free Eligibility Assessment</h1>
          <p className="text-sm text-muted-foreground">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>

        <div className="card-surface p-6 space-y-4">
          {step === 0 && (
            <>
              <div className="space-y-1.5"><Label>Full name *</Label>
                <Input value={p.full_name} onChange={(e) => setP({ ...p, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Date of birth *</Label>
                  <Input type="date" value={p.dob} onChange={(e) => setP({ ...p, dob: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Marital status</Label>
                  <Select value={p.marital_status} onValueChange={(v) => setP({ ...p, marital_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["single","married","common-law","separated","divorced","widowed"].map((m) =>
                        <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Phone (WhatsApp) *</Label>
                  <Input value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Email</Label>
                  <Input type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} /></div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label>Age at Grade 10</Label>
                  <Input type="number" value={edu.grade10_age} onChange={(e) => setEdu({ ...edu, grade10_age: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Age at Grade 12</Label>
                  <Input type="number" value={edu.grade12_age} onChange={(e) => setEdu({ ...edu, grade12_age: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Grade 12 %</Label>
                  <Input type="number" value={edu.grade12_pct} onChange={(e) => setEdu({ ...edu, grade12_pct: e.target.value })} /></div>
              </div>
              {gapPrompt && (
                <div className="space-y-1.5 border-l-2 border-amber-400 pl-3">
                  <Label>We noticed a gap in your education timeline — please explain briefly *</Label>
                  <Textarea rows={2} value={edu.gap_reason} onChange={(e) => setEdu({ ...edu, gap_reason: e.target.value })}
                            placeholder="e.g. family reasons, health, work — or write 'no gap'" />
                </div>
              )}
              <div className="space-y-1.5"><Label>Any re-appears / backlogs after Grade 12?</Label>
                <Select value={edu.reappears} onValueChange={(v) => setEdu({ ...edu, reappears: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="no">No</SelectItem><SelectItem value="yes">Yes</SelectItem></SelectContent>
                </Select></div>
              <Label className="pt-2 block">Bachelor degree(s)</Label>
              {degreeEditor(bachelors, setBachelors, "Bachelor", ["B.Tech","B.Sc","B.A","B.Com","BBA","MBBS","BDS","LLB","B.Arch","Other"])}
              <Label className="pt-2 block">Postgraduate degree(s)</Label>
              {degreeEditor(postgrads, setPostgrads, "Postgraduate", ["Masters","MBA","MA","MSc","PhD","PG Diploma","Other"])}
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-1.5"><Label>Language test taken</Label>
                <Select value={lang.test} onValueChange={(v) => setLang({ ...lang, test: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["none","ielts","pte","celpip","tef","tcf"].map((t) =>
                      <SelectItem key={t} value={t}>{t === "none" ? "Not yet" : t.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select></div>
              {lang.test !== "none" && (
                <>
                  <div className="space-y-1.5"><Label>Test date</Label>
                    <Input type="date" value={lang.test_date} onChange={(e) => setLang({ ...lang, test_date: e.target.value })} /></div>
                  <div className="grid grid-cols-5 gap-2">
                    {(["listening","reading","writing","speaking","overall"] as const).map((k) => (
                      <div key={k} className="space-y-1.5">
                        <Label className="capitalize text-xs">{k}</Label>
                        <Input type="number" step="0.5" value={lang[k]} onChange={(e) => setLang({ ...lang, [k]: e.target.value })} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-1.5"><Label>Do you have work experience?</Label>
                <Select value={hasWork} onValueChange={setHasWork}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="no">No</SelectItem><SelectItem value="yes">Yes</SelectItem></SelectContent>
                </Select></div>
              {hasWork === "yes" && (
                <div className="space-y-2">
                  {jobs.map((j, i) => (
                    <div key={i} className="border border-border rounded-md p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium">Job {i + 1}</span>
                        <Button variant="ghost" size="icon" onClick={() => setJobs(jobs.filter((_, x) => x !== i))}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Job title" value={j.title} onChange={(e) => setJobs(jobs.map((x, y) => y === i ? { ...x, title: e.target.value } : x))} />
                        <Input placeholder="Country" value={j.country} onChange={(e) => setJobs(jobs.map((x, y) => y === i ? { ...x, country: e.target.value } : x))} />
                        <Input type="date" placeholder="Start" value={j.start} onChange={(e) => setJobs(jobs.map((x, y) => y === i ? { ...x, start: e.target.value } : x))} />
                        <Input type="date" placeholder="End (blank = current)" value={j.end} onChange={(e) => setJobs(jobs.map((x, y) => y === i ? { ...x, end: e.target.value } : x))} />
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm"
                          onClick={() => setJobs([...jobs, { title: "", noc: "", country: "", start: "", end: "", type: "full-time" }])}>
                    <Plus className="h-3.5 w-3.5" /> Add job
                  </Button>
                </div>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Travelled abroad before?</Label>
                  <Select value={travel.visited_before} onValueChange={(v) => setTravel({ ...travel, visited_before: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="no">No</SelectItem><SelectItem value="yes">Yes</SelectItem></SelectContent>
                  </Select></div>
                <div className="space-y-1.5"><Label>Currently in Canada?</Label>
                  <Select value={travel.in_canada} onValueChange={(v) => setTravel({ ...travel, in_canada: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="no">No</SelectItem><SelectItem value="yes">Yes</SelectItem></SelectContent>
                  </Select></div>
              </div>
              {travel.in_canada === "yes" && (
                <div className="space-y-1.5"><Label>Current Canadian status</Label>
                  <Select value={travel.canada_status} onValueChange={(v) => setTravel({ ...travel, canada_status: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                    <SelectContent>{["visitor","study","work","PR","other"].map((s) =>
                      <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select></div>
              )}
              <Label className="pt-2 block">Visa refusals from ANY country (be honest — this protects your case)</Label>
              <div className="space-y-2">
                {refusals.map((r, i) => (
                  <div key={i} className="border border-border rounded-md p-3 grid grid-cols-2 gap-2">
                    <Input placeholder="Country" value={r.country} onChange={(e) => setRefusals(refusals.map((x, y) => y === i ? { ...x, country: e.target.value } : x))} />
                    <Input placeholder="Visa type" value={r.visa_type} onChange={(e) => setRefusals(refusals.map((x, y) => y === i ? { ...x, visa_type: e.target.value } : x))} />
                    <Input type="date" value={r.date} onChange={(e) => setRefusals(refusals.map((x, y) => y === i ? { ...x, date: e.target.value } : x))} />
                    <div className="flex gap-1">
                      <Input placeholder="Reason (if known)" value={r.reason} onChange={(e) => setRefusals(refusals.map((x, y) => y === i ? { ...x, reason: e.target.value } : x))} />
                      <Button variant="ghost" size="icon" onClick={() => setRefusals(refusals.filter((_, x) => x !== i))}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm"
                        onClick={() => setRefusals([...refusals, { country: "", visa_type: "", date: "", reason: "" }])}>
                  <Plus className="h-3.5 w-3.5" /> Add refusal
                </Button>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              {married && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Spouse name</Label>
                    <Input value={fam.spouse_name} onChange={(e) => setFam({ ...fam, spouse_name: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Spouse date of birth</Label>
                    <Input type="date" value={fam.spouse_dob} onChange={(e) => setFam({ ...fam, spouse_dob: e.target.value })} /></div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label>Dependant children</Label>
                  <Input type="number" min={0} value={fam.children_count} onChange={(e) => setFam({ ...fam, children_count: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Parents&apos; occupation</Label>
                  <Input value={fam.parents_occupation} onChange={(e) => setFam({ ...fam, parents_occupation: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Parents&apos; annual income</Label>
                  <Select value={fam.parents_income_bucket} onValueChange={(v) => setFam({ ...fam, parents_income_bucket: v })}>
                    <SelectTrigger><SelectValue placeholder="Range" /></SelectTrigger>
                    <SelectContent>{["< ₹5 lakh","₹5-10 lakh","₹10-25 lakh","₹25 lakh+"].map((b) =>
                      <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select></div>
              </div>
            </>
          )}

          {step === 6 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Funds available (CAD)</Label>
                  <Input type="number" value={funds.amount_cad} onChange={(e) => setFunds({ ...funds, amount_cad: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Source of funds</Label>
                  <Select value={funds.source} onValueChange={(v) => setFunds({ ...funds, source: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["family","loan","employer","scholarship","property sale","business","other"].map((s) =>
                      <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select></div>
              </div>
              <div className="space-y-1.5"><Label>Preferred provinces (comma-separated, optional)</Label>
                <Input placeholder="e.g. Ontario, BC" value={funds.provinces} onChange={(e) => setFunds({ ...funds, provinces: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Why Canada?</Label>
                <Textarea rows={2} maxLength={300} value={funds.why_canada} onChange={(e) => setFunds({ ...funds, why_canada: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Your plans after study / work / PR</Label>
                <Textarea rows={2} value={funds.future_plans} onChange={(e) => setFunds({ ...funds, future_plans: e.target.value })} /></div>
            </>
          )}
        </div>

        <div className="flex justify-between">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>Next <ArrowRight className="h-4 w-4" /></Button>
          ) : (
            <Button onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Submit assessment"}</Button>
          )}
        </div>
      </div>
    </div>
  );
}
