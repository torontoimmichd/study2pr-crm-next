"use client";

/**
 * CaseProtectionFlags.tsx
 * Shows actionable warning flags for active cases that need attention.
 * Used on the Executive Dashboard.
 *
 * Flags:
 *   1. Case not updated in 3+ weeks
 *   2. Submission deadline within 14 days
 *   3. High/urgent priority cases with no open task
 *   4. Cases with overdue invoices
 */

import { Link } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, CalendarClock, Clock, IndianRupee, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtRelative, fmtDateIST } from "@/lib/format";

// ─── helpers ─────────────────────────────────────────────────────────────────

function weeksAgo(w: number) {
  return new Date(Date.now() - w * 7 * 24 * 60 * 60 * 1000).toISOString();
}
function daysFromNow(d: number) {
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── types ────────────────────────────────────────────────────────────────────

interface CaseFlag {
  id: string;
  caseId: string;
  caseCode: string;
  clientName: string;
  label: string;
  detail: string;
  severity: "critical" | "warning" | "info";
}

// ─── component ───────────────────────────────────────────────────────────────

export function CaseProtectionFlags() {
  const { data: flags = [], isLoading } = useQuery({
    queryKey: ["case-protection-flags"],
    queryFn: async (): Promise<CaseFlag[]> => {
      const results: CaseFlag[] = [];

      // Fetch all active cases + client names in one go
      const { data: activeCases } = await supabase
        .from("cases")
        .select("id, case_code, client_id, current_stage_code, priority, target_submission_date, risk_level, updated_at, created_at")
        .eq("is_archived", false)
        .limit(500);

      if (!activeCases || activeCases.length === 0) return [];

      const clientIds = Array.from(new Set(activeCases.map((c) => c.client_id)));
      const { data: clients } = await supabase.from("clients").select("id, full_name").in("id", clientIds);
      const clientMap = new Map((clients ?? []).map((c) => [c.id, c.full_name]));

      const caseIds = activeCases.map((c) => c.id);

      // ── 1. Case not updated in 3+ weeks ──────────────────────────────────
      const threeWeeksAgo = weeksAgo(3);
      activeCases
        .filter((c) => (c.updated_at ?? c.created_at) < threeWeeksAgo)
        .slice(0, 15)
        .forEach((c) => {
          results.push({
            id: `stale-case-${c.id}`,
            caseId: c.id,
            caseCode: c.case_code ?? c.id.slice(0, 8),
            clientName: clientMap.get(c.client_id) ?? "Unknown",
            label: "No update for 3+ weeks",
            detail: `Last updated ${fmtRelative(c.updated_at ?? c.created_at)}`,
            severity: "warning",
          });
        });

      // ── 2. Submission deadline within 14 days ─────────────────────────────
      const today = new Date().toISOString().slice(0, 10);
      const in14 = daysFromNow(14).slice(0, 10);
      activeCases
        .filter((c) => c.target_submission_date && c.target_submission_date >= today && c.target_submission_date <= in14)
        .slice(0, 15)
        .forEach((c) => {
          results.push({
            id: `deadline-${c.id}`,
            caseId: c.id,
            caseCode: c.case_code ?? c.id.slice(0, 8),
            clientName: clientMap.get(c.client_id) ?? "Unknown",
            label: "Submission deadline approaching",
            detail: `Target: ${fmtDateIST(c.target_submission_date)} — within 14 days`,
            severity: c.target_submission_date <= daysFromNow(7).slice(0, 10) ? "critical" : "warning",
          });
        });

      // ── 3. High/urgent cases with no open task ────────────────────────────
      const urgentCaseIds = activeCases
        .filter((c) => c.priority === "high" || c.priority === "urgent")
        .map((c) => c.id);

      if (urgentCaseIds.length > 0) {
        const { data: caseTasks } = await supabase
          .from("tasks")
          .select("case_id")
          .in("case_id", urgentCaseIds)
          .is("completed_at", null)
          .eq("status_code", "open");

        const casesWithTask = new Set((caseTasks ?? []).map((t) => t.case_id));
        activeCases
          .filter((c) => urgentCaseIds.includes(c.id) && !casesWithTask.has(c.id))
          .slice(0, 15)
          .forEach((c) => {
            results.push({
              id: `no-task-case-${c.id}`,
              caseId: c.id,
              caseCode: c.case_code ?? c.id.slice(0, 8),
              clientName: clientMap.get(c.client_id) ?? "Unknown",
              label: `${c.priority === "urgent" ? "Urgent" : "High-priority"} case with no task`,
              detail: "No open action item — someone should own the next step",
              severity: "info",
            });
          });
      }

      // ── 4. Cases with overdue unpaid invoices ─────────────────────────────
      const { data: overdueInvoices } = await db
        .from("invoices")
        .select("case_id, due_date")
        .in("case_id", caseIds)
        .in("status", ["sent", "overdue"])
        .lt("due_date", new Date().toISOString().slice(0, 10))
        .not("due_date", "is", null);

      const casesWithOverdue = new Set(
        (overdueInvoices ?? []).map((inv: { case_id: string }) => inv.case_id),
      );

      activeCases
        .filter((c) => casesWithOverdue.has(c.id))
        .slice(0, 15)
        .forEach((c) => {
          results.push({
            id: `overdue-invoice-${c.id}`,
            caseId: c.id,
            caseCode: c.case_code ?? c.id.slice(0, 8),
            clientName: clientMap.get(c.client_id) ?? "Unknown",
            label: "Overdue invoice",
            detail: "Payment is past due date — follow up required",
            severity: "critical",
          });
        });

      return results;
    },
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="card-surface p-5 animate-pulse">
        <div className="h-4 bg-muted rounded w-48 mb-4" />
        {[1, 2].map((i) => <div key={i} className="h-10 bg-muted rounded mb-2" />)}
      </div>
    );
  }

  if (flags.length === 0) {
    return (
      <div className="card-surface p-5">
        <h2 className="font-display text-base text-navy mb-3 flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          Application Protection Flags
        </h2>
        <p className="text-sm text-muted-foreground">All active cases are on track.</p>
      </div>
    );
  }

  const critical = flags.filter((f) => f.severity === "critical");
  const warning  = flags.filter((f) => f.severity === "warning");
  const info     = flags.filter((f) => f.severity === "info");

  return (
    <div className="card-surface p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-destructive" />
        <h2 className="font-display text-base text-navy">Application Protection Flags</h2>
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
          {flags.length}
        </span>
      </div>

      {critical.length > 0 && <CaseFlagSection title="Critical" items={critical} colorClass="border-destructive/50 bg-destructive/5" />}
      {warning.length > 0 && <CaseFlagSection title="Warnings" items={warning} colorClass="border-yellow-400/60 bg-yellow-50/50 dark:bg-yellow-900/10" />}
      {info.length > 0 && <CaseFlagSection title="Attention" items={info} colorClass="border-blue-300/60 bg-blue-50/50 dark:bg-blue-900/10" />}
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function CaseFlagSection({ title, items, colorClass }: { title: string; items: CaseFlag[]; colorClass: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">{title}</div>
      <div className="space-y-1.5">
        {items.map((flag) => (
          <Link
            key={flag.id}
            to={`/cases/${flag.caseId}`}
            className={`flex items-start gap-3 p-2.5 rounded-md border ${colorClass} hover:opacity-80 transition-opacity group`}
          >
            <CaseFlagIcon flag={flag} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground truncate">{flag.clientName}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-muted-foreground">{flag.caseCode}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="text-xs text-muted-foreground">{flag.label}</div>
              <div className="text-[11px] text-muted-foreground/70 mt-0.5">{flag.detail}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function CaseFlagIcon({ flag }: { flag: CaseFlag }) {
  if (flag.label.includes("invoice")) return <IndianRupee className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />;
  if (flag.label.includes("deadline")) return <CalendarClock className="h-3.5 w-3.5 text-yellow-600 shrink-0 mt-0.5" />;
  return <Clock className="h-3.5 w-3.5 text-yellow-600 shrink-0 mt-0.5" />;
}
