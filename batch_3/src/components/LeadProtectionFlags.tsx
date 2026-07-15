"use client";

/**
 * LeadProtectionFlags.tsx
 * Shows actionable warning flags for leads that need immediate attention.
 * Used on the Executive Dashboard.
 *
 * Flags:
 *   1. New enquiry not called within 2 hours (SLA breach)
 *   2. Lead with no activity for 3+ days
 *   3. Proposal sent with no decision for 7+ days
 *   4. Waiting period ending within 7 days
 *   5. Active lead with no open task
 */

import { Link } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, CalendarX, PhoneOff, CheckSquare, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtRelative } from "@/lib/format";

// ─── helpers ─────────────────────────────────────────────────────────────────

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}
function daysAgo(d: number) {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
}
function daysFromNow(d: number) {
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── flag item ────────────────────────────────────────────────────────────────

interface FlagItem {
  id: string;
  leadId: string;
  leadName: string;
  label: string;
  detail: string;
  severity: "critical" | "warning" | "info";
}

// ─── active states ────────────────────────────────────────────────────────────

// PHASE2 active lifecycle_state values — matches leads.lifecycle_state CHECK constraint
const ACTIVE_STATES = [
  "new_enquiry", "contacted", "assessed", "proposal_sent", "negotiating", "waiting",
];

// ─── component ───────────────────────────────────────────────────────────────

export function LeadProtectionFlags() {
  const { data: flags = [], isLoading } = useQuery({
    queryKey: ["lead-protection-flags"],
    queryFn: async (): Promise<FlagItem[]> => {
      const results: FlagItem[] = [];

      // ── 1. New enquiry not called within 2 hours ──────────────────────────
      const { data: uncalledNew } = await db
        .from("leads")
        .select("id, full_name, created_at")
        .eq("lifecycle_state", "new_enquiry")
        .lt("created_at", hoursAgo(2))
        .order("created_at", { ascending: true })
        .limit(20);

      (uncalledNew ?? []).forEach((l: { id: string; full_name: string; created_at: string }) => {
        results.push({
          id: `no-call-${l.id}`,
          leadId: l.id,
          leadName: l.full_name,
          label: "Not called within 2 hours",
          detail: `Enquired ${fmtRelative(l.created_at)} — first call SLA breached`,
          severity: "critical",
        });
      });

      // ── 2. Active leads with no activity in 3+ days ───────────────────────
      const { data: stale } = await db
        .from("leads")
        .select("id, full_name, updated_at, created_at")
        .in("lifecycle_state", ACTIVE_STATES.filter((s) => s !== "new_enquiry"))
        .lt("updated_at", daysAgo(3))
        .order("updated_at", { ascending: true })
        .limit(20);

      (stale ?? []).forEach((l: { id: string; full_name: string; updated_at: string | null; created_at: string }) => {
        results.push({
          id: `stale-${l.id}`,
          leadId: l.id,
          leadName: l.full_name,
          label: "No activity for 3+ days",
          detail: `Last updated ${fmtRelative(l.updated_at ?? l.created_at)}`,
          severity: "warning",
        });
      });

      // ── 3. Proposal sent with no decision for 7+ days ─────────────────────
      const { data: staleProp } = await db
        .from("leads")
        .select("id, full_name, updated_at")
        .eq("lifecycle_state", "proposal_sent")
        .lt("updated_at", daysAgo(7))
        .order("updated_at", { ascending: true })
        .limit(20);

      (staleProp ?? []).forEach((l: { id: string; full_name: string; updated_at: string | null }) => {
        results.push({
          id: `proposal-${l.id}`,
          leadId: l.id,
          leadName: l.full_name,
          label: "Proposal pending decision (7+ days)",
          detail: `No update since ${fmtRelative(l.updated_at ?? "")}`,
          severity: "warning",
        });
      });

      // ── 4. Waiting ends within 7 days ─────────────────────────────────────
      const today = new Date().toISOString().slice(0, 10);
      const in7 = daysFromNow(7).slice(0, 10);
      const { data: endingSoon } = await db
        .from("leads")
        .select("id, full_name, waiting_end_date")
        .eq("lifecycle_state", "waiting")
        .not("waiting_end_date", "is", null)
        .gte("waiting_end_date", today)
        .lte("waiting_end_date", in7)
        .order("waiting_end_date", { ascending: true })
        .limit(20);

      (endingSoon ?? []).forEach((l: { id: string; full_name: string; waiting_end_date: string }) => {
        results.push({
          id: `waiting-end-${l.id}`,
          leadId: l.id,
          leadName: l.full_name,
          label: "Waiting period ending soon",
          detail: `Target end: ${l.waiting_end_date} — follow up to plan next step`,
          severity: "info",
        });
      });

      // ── 5. Active leads with no open task ─────────────────────────────────
      const { data: activeLeads } = await db
        .from("leads")
        .select("id, full_name")
        .in("lifecycle_state", ACTIVE_STATES)
        .limit(500);

      if (activeLeads && activeLeads.length > 0) {
        const leadIds = (activeLeads as { id: string }[]).map((l) => l.id);
        const { data: openTasks } = await supabase
          .from("tasks")
          .select("lead_id")
          .in("lead_id", leadIds)
          .is("completed_at", null)
          .eq("status_code", "open");

        const leadsWithTask = new Set((openTasks ?? []).map((t) => t.lead_id));
        const noTaskLeads = (activeLeads as { id: string; full_name: string }[]).filter(
          (l) => !leadsWithTask.has(l.id),
        );

        noTaskLeads.slice(0, 20).forEach((l) => {
          results.push({
            id: `no-task-${l.id}`,
            leadId: l.id,
            leadName: l.full_name,
            label: "No open task",
            detail: "Lead is active but has no next action scheduled",
            severity: "info",
          });
        });
      }

      return results;
    },
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
  });

  if (isLoading) {
    return (
      <div className="card-surface p-5 animate-pulse">
        <div className="h-4 bg-muted rounded w-40 mb-4" />
        {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted rounded mb-2" />)}
      </div>
    );
  }

  const critical = flags.filter((f) => f.severity === "critical");
  const warning  = flags.filter((f) => f.severity === "warning");
  const info     = flags.filter((f) => f.severity === "info");

  if (flags.length === 0) {
    return (
      <div className="card-surface p-5">
        <h2 className="font-display text-base text-navy mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          Lead Protection Flags
        </h2>
        <p className="text-sm text-muted-foreground">All clear — no flags at this time.</p>
      </div>
    );
  }

  return (
    <div className="card-surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base text-navy flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Lead Protection Flags
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
            {flags.length}
          </span>
        </h2>
      </div>

      {critical.length > 0 && (
        <FlagSection title="Critical" items={critical} colorClass="border-destructive/50 bg-destructive/5" />
      )}
      {warning.length > 0 && (
        <FlagSection title="Warnings" items={warning} colorClass="border-yellow-400/60 bg-yellow-50/50 dark:bg-yellow-900/10" />
      )}
      {info.length > 0 && (
        <FlagSection title="Attention" items={info} colorClass="border-blue-300/60 bg-blue-50/50 dark:bg-blue-900/10" />
      )}
    </div>
  );
}

// ─── FlagSection ──────────────────────────────────────────────────────────────

function FlagSection({
  title,
  items,
  colorClass,
}: {
  title: string;
  items: FlagItem[];
  colorClass: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">{title}</div>
      <div className="space-y-1.5">
        {items.map((flag) => (
          <Link
            key={flag.id}
            to={`/leads/${flag.leadId}`}
            className={`flex items-start gap-3 p-2.5 rounded-md border ${colorClass} hover:opacity-80 transition-opacity group`}
          >
            <FlagIcon flag={flag} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground truncate">{flag.leadName}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
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

function FlagIcon({ flag }: { flag: FlagItem }) {
  if (flag.severity === "critical") return <PhoneOff className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />;
  if (flag.label.includes("task")) return <CheckSquare className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />;
  if (flag.label.includes("Waiting")) return <CalendarX className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />;
  return <Clock className="h-3.5 w-3.5 text-yellow-600 shrink-0 mt-0.5" />;
}
