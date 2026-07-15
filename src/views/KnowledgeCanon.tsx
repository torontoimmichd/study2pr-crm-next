"use client";

import { useState } from "react";
import { BookOpen, Search, ExternalLink, Clock, Users, FileText, Globe, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { PageHeader } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Program {
  code: string;
  name: string;
  category: string;
  description: string;
  processingTime: string;
  eligibility: string[];
  keyPoints: string[];
  url: string;
  tags: string[];
}

const PROGRAMS: Program[] = [
  {
    code: "EE-FSW",
    name: "Express Entry — Federal Skilled Worker",
    category: "Economic",
    description: "Points-based system for skilled workers with foreign work experience. Candidates are ranked by Comprehensive Ranking System (CRS) score.",
    processingTime: "~6 months (80th percentile)",
    eligibility: ["1 year skilled work experience", "Language CLB 7+", "Education credential assessment", "Min CRS score at draw"],
    keyPoints: ["CRS score determines invitation", "Draws held every 2 weeks", "ITA valid 60 days to apply", "eAPR submission online"],
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/works.html",
    tags: ["express entry", "fsw", "skilled worker", "points"],
  },
  {
    code: "EE-CEC",
    name: "Express Entry — Canadian Experience Class",
    category: "Economic",
    description: "For individuals with at least 1 year of skilled Canadian work experience in the last 3 years.",
    processingTime: "~6 months (80th percentile)",
    eligibility: ["1 year Canadian NOC 0/A/B work exp", "Language CLB 7 (NOC 0/A) or CLB 5 (NOC B)", "Must be in Canada or outside"],
    keyPoints: ["No LMIA required", "Canadian experience valued higher in CRS", "Preferred pathway for post-graduation workers", "Often selected in category-based draws"],
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/canadian-experience-class.html",
    tags: ["express entry", "cec", "canadian experience", "post-grad"],
  },
  {
    code: "EE-FST",
    name: "Express Entry — Federal Skilled Trades",
    category: "Economic",
    description: "For skilled tradespeople with a valid job offer or certificate of qualification in Canada.",
    processingTime: "~6 months (80th percentile)",
    eligibility: ["2 years skilled trades experience", "Language CLB 5 (speaking/listening) CLB 4 (reading/writing)", "Job offer or certificate of qualification"],
    keyPoints: ["NOC groups: 72, 73, 82, 83, 92, 93, or 632–638", "Job offer from max 2 employers", "Trade must be eligible in Canada"],
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/skilled-trades.html",
    tags: ["express entry", "trades", "fst", "skilled trades"],
  },
  {
    code: "PNP",
    name: "Provincial Nominee Program",
    category: "Economic",
    description: "Province or territory nominates candidates based on local labour market needs. Enhanced PNP nominees get 600 CRS points.",
    processingTime: "Varies by province: 3–18 months",
    eligibility: ["Meet province-specific criteria", "Intent to live in nominating province", "Some require job offer"],
    keyPoints: ["Each province has unique streams", "Enhanced streams align with Express Entry", "Base streams outside EE pool", "600 CRS bonus for EE-linked nominations"],
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/provincial-nominees.html",
    tags: ["pnp", "provincial nominee", "province", "oinp", "bcpnp", "sinp"],
  },
  {
    code: "SUV",
    name: "Start-Up Visa",
    category: "Economic",
    description: "For entrepreneurs with a qualifying business backed by a Canadian designated organization (VC, angel investor, or business incubator).",
    processingTime: "12–16 months",
    eligibility: ["Letter of support from designated org", "Language CLB 5+", "Enough settlement funds"],
    keyPoints: ["Max 5 founders per startup", "Business must be innovative with global potential", "Designated organizations listed by IRCC", "Provisional work permit available"],
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/start-visa.html",
    tags: ["startup", "entrepreneur", "business", "suv"],
  },
  {
    code: "CUAET",
    name: "Canada-Ukraine Authorization for Emergency Travel",
    category: "Humanitarian",
    description: "Temporary resident pathway for Ukrainians and their immediate family members fleeing the war. Includes open work permit.",
    processingTime: "Varies — stream ongoing",
    eligibility: ["Ukrainian citizen or family member", "Biometrics", "Medical exam if staying 6+ months"],
    keyPoints: ["3-year open work permit", "Open study permit for children", "Extended multiple times", "Pathway to PR via IRCC bridge programs"],
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/news/2022/03/canada-ukraine-authorization-for-emergency-travel.html",
    tags: ["ukraine", "cuaet", "humanitarian", "temporary"],
  },
  {
    code: "PGWP",
    name: "Post-Graduation Work Permit",
    category: "Temporary",
    description: "Open work permit for international students who completed a full-time program at a DLI in Canada.",
    processingTime: "~60 days (inside Canada)",
    eligibility: ["Graduated from DLI", "Full-time program 8+ months", "Apply within 180 days of graduation", "Valid study permit during studies"],
    keyPoints: ["Length tied to program length (max 3 years)", "Apply before study permit expires", "Open — work for any employer", "Key bridge to CEC pathway"],
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/work/after-graduation/about.html",
    tags: ["pgwp", "post-grad", "work permit", "study", "international student"],
  },
  {
    code: "LMIA",
    name: "Labour Market Impact Assessment",
    category: "Temporary",
    description: "Employer authorization from ESDC confirming no Canadian worker available for the position before hiring foreign national.",
    processingTime: "1–5 months depending on stream",
    eligibility: ["Canadian employer", "Advertised position per ESDC standards", "Positive LMIA required before work permit"],
    keyPoints: ["High-wage vs. Low-wage streams", "Global Talent Stream (2 week target)", "Agricultural worker exemptions", "LMIA exempt categories under CUSMA/other treaties"],
    url: "https://www.canada.ca/en/employment-social-development/services/foreign-workers.html",
    tags: ["lmia", "employer", "work permit", "esdc", "temporary foreign worker"],
  },
  {
    code: "SPOUSAL",
    name: "Spousal / Common-Law Sponsorship",
    category: "Family",
    description: "Canadian citizen or PR can sponsor their spouse, common-law partner, or conjugal partner for permanent residence.",
    processingTime: "~12 months (outland); ~12 months (inland)",
    eligibility: ["Sponsor is Canadian citizen/PR 18+", "Genuine relationship", "Sponsor meets income requirements (if sponsoring dependants)", "Sponsor not previously defaulted"],
    keyPoints: ["Inland applicants can get SOWP", "Outland applicants can continue living abroad", "Conditional PR for 2 years if relationship <2 years", "Right to appeal refusal at IAD"],
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/family-sponsorship/spouse-partner.html",
    tags: ["spousal", "family", "sponsorship", "spouse", "common-law", "conjugal"],
  },
  {
    code: "PR-CARD",
    name: "PR Card Renewal",
    category: "Status",
    description: "Permanent Resident card renewal for PRs who have met the 730-day residency obligation in the past 5 years.",
    processingTime: "~60–90 days",
    eligibility: ["Valid PR status", "730 days in Canada per 5 years", "No removal order"],
    keyPoints: ["Apply inside Canada only", "Travel document (PRTD) if outside Canada", "Include travel history with application", "Biometrics required if not collected recently"],
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/new-immigrants/pr-card/apply-renew-replace.html",
    tags: ["pr card", "permanent resident", "renewal", "residency obligation"],
  },
  {
    code: "CITIZENSHIP",
    name: "Citizenship Application",
    category: "Citizenship",
    description: "PRs who have met the physical presence requirement can apply to become Canadian citizens.",
    processingTime: "12–24 months",
    eligibility: ["1095 days physical presence in 5 years", "PR status", "Filed taxes as required", "Language CLB 4+", "Pass citizenship test (18–54)"],
    keyPoints: ["Travel abroad as PR counts as half-days", "Language requirement: 18–54 years", "Knowledge test waived if 55+", "Minors included in parent's application"],
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship/become-canadian-citizen/apply.html",
    tags: ["citizenship", "naturalization", "passport", "physical presence"],
  },
  {
    code: "VISITOR",
    name: "Visitor Visa / TRV",
    category: "Temporary",
    description: "Temporary Resident Visa for nationals of countries that require a visa to visit Canada as a tourist, visitor, or transit.",
    processingTime: "2–4 weeks (varies by country)",
    eligibility: ["Valid passport", "Ties to home country", "Sufficient funds", "No criminality"],
    keyPoints: ["Usually granted up to 10 years or passport expiry", "CBSA officer determines length of stay at entry", "eTA for visa-exempt travellers", "Super visa for parents and grandparents"],
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/apply-visitor-visa.html",
    tags: ["visitor visa", "trv", "tourist", "temporary resident", "eta"],
  },
];

const CATEGORIES = ["All", "Economic", "Family", "Temporary", "Humanitarian", "Status", "Citizenship"];

const CATEGORY_COLOR: Record<string, string> = {
  Economic: "bg-primary/10 text-primary",
  Family: "bg-gold/20 text-gold-foreground",
  Temporary: "bg-muted text-muted-foreground",
  Humanitarian: "bg-destructive/10 text-destructive",
  Status: "bg-success/10 text-success",
  Citizenship: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

export default function KnowledgeCanon() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = PROGRAMS.filter((p) => {
    const matchCat = category === "All" || p.category === category;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some((t) => t.includes(q));
    return matchCat && matchSearch;
  });

  return (
    <div>
      <PageHeader
        title="IRCC Canon"
        subtitle="Reference library of Canadian immigration programs, eligibility rules, and processing times"
      />

      <div className="p-6 space-y-5">
        {/* Search + filter */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-52 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search programs, codes, keywords…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs transition-colors border",
                  category === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Processing times are indicative only. Always verify at{" "}
          <a href="https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-processing-times.html"
            target="_blank" rel="noopener noreferrer"
            className="underline hover:text-foreground ml-1">
            IRCC Check Processing Times ↗
          </a>
        </div>

        {/* Program cards */}
        {filtered.length === 0 ? (
          <div className="card-surface p-12 text-center">
            <BookOpen className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">No programs match your search.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((p) => {
              const isOpen = expanded === p.code;
              return (
                <div key={p.code} className="card-surface overflow-hidden">
                  <button
                    className="w-full px-5 py-4 flex items-start gap-4 text-left hover:bg-muted/20 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : p.code)}
                  >
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 font-mono text-xs font-bold text-muted-foreground">
                      {p.code.split("-")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{p.name}</span>
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", CATEGORY_COLOR[p.category] ?? "bg-muted text-muted-foreground")}>
                          {p.category}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {p.processingTime}
                      </div>
                    </div>
                    <div className={cn("text-muted-foreground transition-transform shrink-0 mt-1", isOpen && "rotate-180")}>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 border-t border-border bg-muted/10">
                      <div className="grid md:grid-cols-2 gap-5 mt-4">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                            <Users className="h-3.5 w-3.5" /> Eligibility
                          </div>
                          <ul className="space-y-1.5">
                            {p.eligibility.map((e) => (
                              <li key={e} className="flex items-start gap-2 text-sm">
                                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                                {e}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                            <AlertCircle className="h-3.5 w-3.5" /> Key Points
                          </div>
                          <ul className="space-y-1.5">
                            {p.keyPoints.map((k) => (
                              <li key={k} className="flex items-start gap-2 text-sm">
                                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                {k}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-border flex items-center gap-3">
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                        >
                          <Globe className="h-3.5 w-3.5" />
                          Official IRCC page
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
