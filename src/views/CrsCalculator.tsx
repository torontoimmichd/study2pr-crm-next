"use client";

/**
 * CrsCalculator.tsx
 * Express Entry Comprehensive Ranking System (CRS) score estimator.
 * Public route: /crs-calculator  (no auth required)
 * Also linked from LeadDetail for quick assessment.
 *
 * Based on IRCC official CRS grid — accurate as of 2024.
 * All point values from: https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/criteria-comprehensive-ranking-system/grid.html
 */

import { useState, useMemo } from "react";
import { Calculator, ChevronRight, Info, BarChart3, Crown, Users, Briefcase, Globe, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// ─── CRS Point Tables ───────────────────────────────────────────────────────

// A. Core / Human Capital — Age
const AGE_POINTS: Record<string, [number, number]> = {
  // [single, with spouse]
  "17":   [0, 0], "18": [99, 90], "19": [105, 95], "20": [110, 100],
  "21":   [110, 100], "22": [110, 100], "23": [110, 100], "24": [110, 100],
  "25":   [110, 100], "26": [110, 100], "27": [110, 100], "28": [110, 100],
  "29":   [110, 100], "30": [105, 95], "31": [99, 90], "32": [94, 85],
  "33":   [88, 80], "34": [83, 75], "35": [77, 70], "36": [72, 65],
  "37":   [66, 60], "38": [61, 55], "39": [55, 50], "40": [50, 45],
  "41":   [39, 35], "42": [28, 25], "43": [17, 15], "44": [6, 5],
  "45+":  [0, 0],
};

// A. Education level points
const EDU_POINTS: Record<string, [number, number]> = {
  // [single, with spouse]
  "less_than_secondary":  [0, 0],
  "secondary":            [28, 28],
  "one_year_post":        [84, 84],
  "two_year_post":        [91, 91],
  "bachelors":            [112, 112],
  "two_or_more_post":     [119, 119],
  "masters":              [126, 126],
  "phd":                  [140, 140],
};

// A. Canadian work experience points
const CA_EXP_POINTS: Record<string, [number, number]> = {
  "0": [0, 0], "1": [40, 35], "2": [53, 46], "3": [64, 56], "4": [72, 63], "5+": [80, 70],
};

// A. First official language (CLB) — max per skill
function firstLangPoints(clb: number, withSpouse: boolean): number {
  if (clb >= 10) return withSpouse ? 32 : 34;
  if (clb === 9)  return withSpouse ? 29 : 31;
  if (clb === 8)  return withSpouse ? 22 : 23;
  if (clb === 7)  return withSpouse ? 16 : 17;
  if (clb === 6)  return withSpouse ? 8  : 9;
  if (clb === 5)  return withSpouse ? 6  : 6;
  if (clb <= 4)   return 0;
  return 0;
}

// A. Second official language (CLB)
function secondLangPoints(clb: number): number {
  if (clb >= 5) return 6;
  return 0; // min CLB 5 required
}

// B. Spouse factors
const SPOUSE_EDU_POINTS: Record<string, number> = {
  "less_than_secondary": 0, "secondary": 2, "one_year_post": 6, "two_year_post": 7,
  "bachelors": 8, "two_or_more_post": 9, "masters": 10, "phd": 10,
};
function spouseLangPoints(clb: number): number {
  if (clb >= 9) return 5;
  if (clb === 8) return 4; if (clb === 7) return 3; if (clb === 6) return 2; if (clb === 5) return 1; return 0;
}
const SPOUSE_CA_EXP: Record<string, number> = {
  "0": 0, "1": 5, "2": 7, "3": 8, "4": 9, "5+": 10,
};

// C. Skill transferability (max 100 pts total)
function calcTransferability(
  firstLangClb: number,
  caExpYears: string,
  eduLevel: string,
  foreignExpYears: string,
  certTrade: boolean,
): number {
  let pts = 0;
  const hasPostSec = !["less_than_secondary", "secondary"].includes(eduLevel);
  const caExp = parseInt(caExpYears) || 0;
  const fExp = parseInt(foreignExpYears) || 0;
  const langGood = firstLangClb >= 7;
  const langExcellent = firstLangClb >= 9;

  // Education + language
  if (hasPostSec && langExcellent) pts += 25;
  else if (hasPostSec && langGood) pts += 13;

  // Education + Canadian experience
  if (hasPostSec && caExp >= 2) pts += 25;
  else if (hasPostSec && caExp === 1) pts += 13;

  // Foreign experience + language
  if (fExp >= 3 && langExcellent) pts += 25;
  else if ((fExp >= 3 || fExp === 1 || fExp === 2) && langGood) pts += 13;

  // Foreign experience + Canadian experience
  if (fExp >= 3 && caExp >= 2) pts += 25;
  else if ((fExp >= 1) && caExp >= 1) pts += 13;

  // Trade certificate + language
  if (certTrade && langExcellent) pts += 25;
  else if (certTrade && langGood) pts += 13;

  return Math.min(pts, 100);
}

// D. Additional points
const PROVINCIAL_NOMINATION = 600;
const ARRANGED_EMPLOYMENT_NOC_00 = 200;
const ARRANGED_EMPLOYMENT_OTHER = 50;
const CANADIAN_EDUCATION_PG = 15;
const CANADIAN_EDUCATION_THREE_PLUS = 30;
const SIBLING_IN_CANADA = 15;
const FRENCH_STRONG = 50; // CLB 7+ in both FR skills, CLB < 5 in EN
const FRENCH_MODERATE = 25; // CLB 7+ in both FR skills + CLB 5+ EN

// ─── Helpers ────────────────────────────────────────────────────────────────

const AGE_OPTIONS = [
  ...["18","19","20","21","22","23","24","25","26","27","28","29","30",
      "31","32","33","34","35","36","37","38","39","40","41","42","43","44"].map(a => ({ v: a, l: a })),
  { v: "45+", l: "45 or older" },
];

const EDU_OPTIONS = [
  { v: "less_than_secondary",  l: "Less than secondary (high school)" },
  { v: "secondary",            l: "Secondary diploma (high school)" },
  { v: "one_year_post",        l: "1-year post-secondary" },
  { v: "two_year_post",        l: "2-year post-secondary" },
  { v: "bachelors",            l: "Bachelor's degree" },
  { v: "two_or_more_post",     l: "2+ post-secondary (one 3+ years)" },
  { v: "masters",              l: "Master's degree" },
  { v: "phd",                  l: "Doctoral degree (PhD)" },
];

const EXP_OPTIONS = [
  { v: "0", l: "None" }, { v: "1", l: "1 year" }, { v: "2", l: "2 years" },
  { v: "3", l: "3 years" }, { v: "4", l: "4 years" }, { v: "5+", l: "5 years or more" },
];

const CLB_OPTIONS = [
  { v: "0", l: "Below CLB 4 (not eligible)" }, { v: "4", l: "CLB 4" },
  { v: "5", l: "CLB 5" }, { v: "6", l: "CLB 6" }, { v: "7", l: "CLB 7" },
  { v: "8", l: "CLB 8" }, { v: "9", l: "CLB 9" }, { v: "10", l: "CLB 10+" },
];

const RECENT_CUTOFFS = [
  { date: "Jan 2025", score: 527 }, { date: "Dec 2024", score: 524 },
  { date: "Nov 2024", score: 521 }, { date: "Oct 2024", score: 519 },
  { date: "Sep 2024", score: 525 }, { date: "Jun 2024", score: 529 },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function CrsCalculator() {
  // Core factors
  const [age, setAge] = useState("30");
  const [hasSpouse, setHasSpouse] = useState(false);
  const [eduLevel, setEduLevel] = useState("bachelors");
  const [caExpYears, setCaExpYears] = useState("1");
  const [foreignExpYears, setForeignExpYears] = useState("2");
  const [firstLangClb, setFirstLangClb] = useState("8");
  const [secondLangClb, setSecondLangClb] = useState("0");

  // Spouse
  const [spouseEdu, setSpouseEdu] = useState("secondary");
  const [spouseLangClb, setSpouseLangClb] = useState("0");
  const [spouseCaExp, setSpouseCaExp] = useState("0");

  // Additional
  const [hasPnp, setHasPnp] = useState(false);
  const [hasJobOfferNoc00, setHasJobOfferNoc00] = useState(false);
  const [hasJobOfferOther, setHasJobOfferOther] = useState(false);
  const [canEducationYears, setCanEducationYears] = useState("0");
  const [siblingInCanada, setSiblingInCanada] = useState(false);
  const [certTrade, setCertTrade] = useState(false);
  const [frenchClb, setFrenchClb] = useState("0");

  // Calculation
  const result = useMemo(() => {
    const ws = hasSpouse;
    const clb = parseInt(firstLangClb) || 0;
    const sec = parseInt(secondLangClb) || 0;
    const frc = parseInt(frenchClb) || 0;

    // A — Core / Human Capital
    const ageKey = age in AGE_POINTS ? age : "45+";
    const ageIdx = ws ? 1 : 0;
    const aPts = {
      age:         (AGE_POINTS[ageKey] ?? [0, 0])[ageIdx],
      edu:         (EDU_POINTS[eduLevel] ?? [0, 0])[0],
      firstLang:   firstLangPoints(clb, ws) * 4,   // 4 skills × skill pts
      secondLang:  secondLangPoints(sec) * 4,
      caExp:       (CA_EXP_POINTS[caExpYears] ?? [0, 0])[ws ? 1 : 0],
    };
    const aTotal = aPts.age + aPts.edu + aPts.firstLang + aPts.secondLang + aPts.caExp;

    // B — Spouse factors
    let bTotal = 0;
    if (ws) {
      bTotal = (SPOUSE_EDU_POINTS[spouseEdu] ?? 0)
             + spouseLangPoints(parseInt(spouseLangClb) || 0) * 4
             + (SPOUSE_CA_EXP[spouseCaExp] ?? 0);
    }

    // C — Skill transferability
    const cTotal = calcTransferability(clb, caExpYears, eduLevel, foreignExpYears, certTrade);

    // D — Additional
    let dTotal = 0;
    if (hasPnp)             dTotal += PROVINCIAL_NOMINATION;
    if (hasJobOfferNoc00)   dTotal += ARRANGED_EMPLOYMENT_NOC_00;
    else if (hasJobOfferOther) dTotal += ARRANGED_EMPLOYMENT_OTHER;
    const canEdYrs = parseInt(canEducationYears) || 0;
    if (canEdYrs >= 3)      dTotal += CANADIAN_EDUCATION_THREE_PLUS;
    else if (canEdYrs > 0)  dTotal += CANADIAN_EDUCATION_PG;
    if (siblingInCanada)    dTotal += SIBLING_IN_CANADA;
    // French bonus
    if (frc >= 7) {
      if (clb >= 5) dTotal += FRENCH_MODERATE;
      else          dTotal += FRENCH_STRONG;
    }

    const total = Math.min(aTotal + bTotal + cTotal + dTotal, hasPnp ? 1200 : 600);

    return {
      sections: { a: aTotal, b: bTotal, c: cTotal, d: dTotal },
      subA: aPts,
      total,
    };
  }, [age, hasSpouse, eduLevel, caExpYears, foreignExpYears, firstLangClb, secondLangClb,
      spouseEdu, spouseLangClb, spouseCaExp, hasPnp, hasJobOfferNoc00, hasJobOfferOther,
      canEducationYears, siblingInCanada, certTrade, frenchClb]);

  const { total, sections, subA } = result;

  const scoreColor = total >= 480 ? "text-success" : total >= 430 ? "text-warning" : "text-destructive";
  const scoreBg    = total >= 480 ? "from-success/10" : total >= 430 ? "from-warning/10" : "from-destructive/10";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 pt-6">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-2">
            <Calculator className="h-4 w-4" />
            Express Entry — CRS Score Estimator
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Comprehensive Ranking System Calculator</h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm">
            Estimate your CRS score for Canadian Express Entry. Based on the official IRCC grid.
            <span className="block mt-1 text-xs opacity-70">For informational purposes only — use IRCC's official tool for precise scores.</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Form */}
          <div className="lg:col-span-2 space-y-4">

            {/* Basic */}
            <Section icon={<Users className="h-4 w-4" />} title="Core Profile" color="blue">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Age">
                  <Select value={age} onValueChange={setAge}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AGE_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Education Level">
                  <Select value={eduLevel} onValueChange={setEduLevel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EDU_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Switch checked={hasSpouse} onCheckedChange={setHasSpouse} id="has-spouse" />
                <Label htmlFor="has-spouse">I have a spouse / common-law partner</Label>
              </div>
            </Section>

            {/* Language */}
            <Section icon={<Globe className="h-4 w-4" />} title="Language Proficiency" color="purple">
              <p className="text-xs text-muted-foreground mb-3">Enter your CLB (Canadian Language Benchmark) — averaged across listening, reading, writing, speaking.</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="First Official Language (CLB avg)" hint="English (IELTS/CELPIP) or French (TEF)">
                  <Select value={firstLangClb} onValueChange={setFirstLangClb}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CLB_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Second Official Language (CLB avg)" hint="Leave at 0 if not tested">
                  <Select value={secondLangClb} onValueChange={setSecondLangClb}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CLB_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="French CLB (for French bonus)" hint="TEF/TCF score if applicable">
                  <Select value={frenchClb} onValueChange={setFrenchClb}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CLB_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
            </Section>

            {/* Work Experience */}
            <Section icon={<Briefcase className="h-4 w-4" />} title="Work Experience" color="green">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Canadian Work Experience">
                  <Select value={caExpYears} onValueChange={setCaExpYears}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EXP_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Foreign Work Experience">
                  <Select value={foreignExpYears} onValueChange={setForeignExpYears}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EXP_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Switch checked={certTrade} onCheckedChange={setCertTrade} id="trade-cert" />
                <Label htmlFor="trade-cert" className="text-sm">I have a Canadian trade certificate (Red Seal)</Label>
              </div>
            </Section>

            {/* Spouse Factors */}
            {hasSpouse && (
              <Section icon={<Users className="h-4 w-4" />} title="Spouse / Partner Factors" color="amber">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Spouse Education">
                    <Select value={spouseEdu} onValueChange={setSpouseEdu}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{EDU_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Spouse Language (CLB avg)">
                    <Select value={spouseLangClb} onValueChange={setSpouseLangClb}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CLB_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Spouse Canadian Work Experience">
                    <Select value={spouseCaExp} onValueChange={setSpouseCaExp}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{EXP_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
              </Section>
            )}

            {/* Additional Factors */}
            <Section icon={<Star className="h-4 w-4" />} title="Additional Points" color="gold">
              <div className="grid gap-3">
                <div className="flex items-start gap-2">
                  <Switch checked={hasPnp} onCheckedChange={setHasPnp} id="pnp" />
                  <div>
                    <Label htmlFor="pnp" className="text-sm font-medium">Provincial Nomination (PNP) +600 pts</Label>
                    <p className="text-xs text-muted-foreground">Nominated by a province through Express Entry-aligned stream</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Switch checked={hasJobOfferNoc00} onCheckedChange={(v) => { setHasJobOfferNoc00(v); if (v) setHasJobOfferOther(false); }} id="job-00" />
                  <div>
                    <Label htmlFor="job-00" className="text-sm font-medium">Job Offer — NOC 00 (Senior Managers) +200 pts</Label>
                    <p className="text-xs text-muted-foreground">LMIA-backed or exempt offer for NOC TEER 0 — Major Group 00</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Switch checked={hasJobOfferOther} onCheckedChange={(v) => { setHasJobOfferOther(v); if (v) setHasJobOfferNoc00(false); }} id="job-other" />
                  <div>
                    <Label htmlFor="job-other" className="text-sm font-medium">Job Offer — Other NOC +50 pts</Label>
                    <p className="text-xs text-muted-foreground">LMIA-backed or exempt offer for any other NOC TEER 0/1/2/3</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Switch checked={siblingInCanada} onCheckedChange={setSiblingInCanada} id="sibling" />
                  <div>
                    <Label htmlFor="sibling" className="text-sm font-medium">Sibling in Canada +15 pts</Label>
                    <p className="text-xs text-muted-foreground">Canadian citizen or PR sibling (includes half-siblings)</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm">Canadian study (years at a post-secondary institution)</Label>
                  <Select value={canEducationYears} onValueChange={setCanEducationYears}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">None</SelectItem>
                      <SelectItem value="1">1–2 years (+15 pts)</SelectItem>
                      <SelectItem value="3">3+ years (+30 pts)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Section>
          </div>

          {/* Right: Score card */}
          <div className="space-y-4">
            {/* Big score */}
            <div className={cn("card-surface p-6 text-center bg-gradient-to-br", scoreBg, "to-background border-2",
              total >= 480 ? "border-success/30" : total >= 430 ? "border-warning/30" : "border-destructive/30"
            )}>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Estimated CRS Score</div>
              <div className={cn("text-6xl font-black mt-2", scoreColor)}>{total}</div>
              <div className="text-xs text-muted-foreground mt-1">out of 600{hasPnp ? " (PNP: 1200)" : ""}</div>
              <div className={cn("mt-3 text-sm font-semibold",
                total >= 480 ? "text-success" : total >= 430 ? "text-warning" : "text-destructive"
              )}>
                {total >= 480 ? "✓ Competitive score" : total >= 430 ? "⚡ Moderate — keep improving" : "📈 Needs improvement"}
              </div>
            </div>

            {/* Section breakdown */}
            <div className="card-surface p-4 space-y-3">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Score Breakdown</div>
              {[
                { label: "A — Core / Human Capital",       pts: sections.a, max: hasSpouse ? 460 : 500 },
                { label: "B — Spouse factors",             pts: sections.b, max: 40, hide: !hasSpouse },
                { label: "C — Skill transferability",      pts: sections.c, max: 100 },
                { label: "D — Additional factors",         pts: sections.d, max: 600 },
              ].filter(r => !r.hide).map(row => (
                <div key={row.label}>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{row.label}</span>
                    <span className="font-semibold text-foreground">{row.pts} / {row.max}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((row.pts / row.max) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="border-t border-border pt-3 flex justify-between text-sm font-bold">
                <span>Total</span>
                <span className={scoreColor}>{total}</span>
              </div>
            </div>

            {/* Sub-section for A */}
            <div className="card-surface p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Section A detail</div>
              <div className="space-y-1.5 text-xs">
                {[
                  { l: "Age",                     v: subA.age },
                  { l: "Education",               v: subA.edu },
                  { l: "First language (×4)",     v: subA.firstLang },
                  { l: "Second language (×4)",    v: subA.secondLang },
                  { l: "Canadian work exp.",      v: subA.caExp },
                ].map(r => (
                  <div key={r.l} className="flex justify-between">
                    <span className="text-muted-foreground">{r.l}</span>
                    <span className="font-medium">{r.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent draws */}
            <div className="card-surface p-4">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground mb-3">
                <BarChart3 className="h-3.5 w-3.5" />
                Recent Draw Cutoffs
              </div>
              <div className="space-y-1.5">
                {RECENT_CUTOFFS.map(c => (
                  <div key={c.date} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{c.date}</span>
                    <span className={cn("font-semibold", total >= c.score ? "text-success" : "text-muted-foreground")}>
                      {c.score} {total >= c.score ? "✓" : ""}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-3">† All-program draws. Program-specific draws may have different cutoffs.</p>
            </div>

            {/* Tips */}
            <div className="card-surface p-4 bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-primary mb-2">
                <Info className="h-4 w-4" />
                Top ways to improve
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                {parseInt(firstLangClb) < 9 && <li className="flex gap-1.5"><ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />Improve language to CLB 9+ for big transferability gains</li>}
                {caExpYears === "0" && <li className="flex gap-1.5"><ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />1 year of Canadian work experience adds significant points</li>}
                {!hasPnp && <li className="flex gap-1.5"><ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />A Provincial Nomination adds 600 pts — near-guaranteed ITA</li>}
                {!hasJobOfferNoc00 && !hasJobOfferOther && <li className="flex gap-1.5"><ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />A valid job offer adds 50–200 pts</li>}
                {parseInt(secondLangClb) < 5 && <li className="flex gap-1.5"><ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />Test in your second language (CLB 5+) for extra points</li>}
                {canEducationYears === "0" && <li className="flex gap-1.5"><ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />Canadian post-secondary study adds 15–30 bonus points</li>}
              </ul>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-6">
          This calculator is an estimate. Actual CRS scores are calculated by IRCC and may differ. Always verify with an RCIC or at canada.ca.
        </p>
      </div>
    </div>
  );
}

function Section({
  icon, title, color, children,
}: {
  icon: React.ReactNode;
  title: string;
  color: "blue" | "purple" | "green" | "amber" | "gold";
  children: React.ReactNode;
}) {
  const colorMap = {
    blue:   "border-blue-400/30 bg-blue-50/30",
    purple: "border-purple-400/30 bg-purple-50/30",
    green:  "border-green-400/30 bg-green-50/30",
    amber:  "border-amber-400/30 bg-amber-50/30",
    gold:   "border-yellow-400/30 bg-yellow-50/30",
  };
  const iconMap = {
    blue:   "text-blue-600",
    purple: "text-purple-600",
    green:  "text-green-600",
    amber:  "text-amber-600",
    gold:   "text-yellow-600",
  };
  return (
    <div className={cn("card-surface p-5 border", colorMap[color])}>
      <div className={cn("flex items-center gap-2 font-semibold text-sm mb-4", iconMap[color])}>
        {icon}{title}
      </div>
      {children}
    </div>
  );
}

function Field({
  label, hint, children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs font-medium mb-1 block">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
