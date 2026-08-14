"use client";

/**
 * CaseCockpit — everything about an application on one screen.
 *
 * Backlog F1. Replaces the crude 10-segment progress bar and sits at the top of the
 * Overview tab. The ten tabs remain the drill-down; this only summarises and links.
 *
 * RULES OBSERVED (see Study2PR_vs_CaseEasy_Visto_2026-08-12.md §4):
 *  - No new tables, no new columns. Every field below was verified against live
 *    `study2pr-prod` information_schema on 2026-08-12, not inferred from app code.
 *  - INR only. `cases.quoted_govt_fee_cad` is deliberately NOT shown here — mixing
 *    currencies on one screen is the hazard behind backlog A2.
 *  - Tasks read `status_code`, never `status`. Live values: open · done · dismissed ·
 *    completed (2 rows, deprecated). Open = 'open' only.
 *  - `case_documents` carries BOTH `expires_on` and `expires_at`. `expiry_items` is the
 *    engine's own table and is the authority for the Expiring panel.
 *  - Terminal stages (approved/refused/withdrawn/closed, sort_order >= 70) are NOT
 *    steps on the rail. They are an outcome badge — a rail that walks through
 *    "Refused" on the way to "Closed" would be a lie.
 */

import { useMemo } from "react";
import { Link } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, CheckSquare, Clock, FileText, IndianRupee,
  MessageCircle, ShieldAlert, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateIST, fmtDateTimeIST, fmtMoney, fmtRelative } from "@/lib/format";

/* ------------------------------------------------------------------ types */

export interface CockpitCase {
  id: string;
  case_code: string | null;
  client_id: string;
  visa_type_id: string;
  current_stage_code: string | null;
  stage_entered_at: string | null;
  created_at: string;
  submitted_at: string | null;
  decision_at: string | null;
  target_submission_date: string | null;
  outcome: string | null;
  priority: string | null;
  risk_level: string | null;
  quoted_fee_inr: number | null;
  total_invoiced_inr: number | null;
  total_paid_inr: number | null;
  uci_number: string | null;
  ircc_file_number: string | null;
  ircc_status: string | null;
  case_manager_id: string | null;
  client?: { id: string; full_name: string; email: string | null; phone: string | null } | null;
}

interface StageRef { code: string; label: string; sort_order: number; is_terminal: boolean | null }
interface CockpitTask { id: string; title: string; status_code: string | null; priority: string | null; due_at: string | null }
interface CockpitFamily { id: string; is_included_on_current_case: boolean | null }
interface StaffRow { id: string; full_name: string }

const TERMINAL_FROM = 70; // sort_order of 'approved'; everything at or above is an ending

/* ------------------------------------------------------------------ helpers */

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function daysUntil(dateOnly: string | null | undefined): number | null {
  if (!dateOnly) return null;
  const ms = new Date(`${dateOnly}T00:00:00`).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.ceil(ms / 86_400_000);
}

function Panel({
  title, icon, href, hrefLabel, children,
}: {
  title: string;
  icon: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-surface p-4 flex flex-col min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <h3 className="font-display text-[11px] uppercase tracking-wider">{title}</h3>
        </div>
        {href && (
          <Link to={href} className="text-[11px] text-accent hover:underline shrink-0">
            {hrefLabel ?? "Open"} →
          </Link>
        )}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  // Deliberately says what to do, not "No data". With 1 document and 0 assessments in
  // production, empty is the common case — the empty state IS the product right now.
  return <p className="text-xs text-muted-foreground leading-relaxed">{children}</p>;
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm tabular-nums ${warn ? "text-destructive font-semibold" : "font-medium"}`}>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ component */

export function CaseCockpit({
  caseRow, stages, tasks, family, staff,
}: {
  caseRow: CockpitCase;
  stages: StageRef[] | undefined;
  tasks: CockpitTask[] | undefined;
  family: CockpitFamily[] | undefined;
  staff: StaffRow[] | undefined;
}) {
  const caseId = caseRow.id;

  /* --- programme code, for the checklist lookup ------------------------- */
  const { data: visaCode } = useQuery({
    queryKey: ["cockpit-visa-code", caseRow.visa_type_id],
    enabled: !!caseRow.visa_type_id,
    queryFn: async () => {
      const { data } = await supabase.from("visa_types").select("code").eq("id", caseRow.visa_type_id).maybeSingle();
      return data?.code ?? null;
    },
  });

  /* --- documents -------------------------------------------------------- */
  const { data: docs } = useQuery({
    queryKey: ["cockpit-docs", caseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("case_documents")
        .select("id, status, title")
        .eq("case_id", caseId)
        .eq("is_deleted", false);
      return (data ?? []) as { id: string; status: string | null; title: string | null }[];
    },
  });

  /* --- how many documents the programme actually asks for ---------------
   * E4/F-list: document_checklist_rules keys on visa_type_code (text) and the codes
   * do not all match live programme codes. So we show "of M" ONLY when a checklist
   * genuinely exists for this code, and otherwise say so out loud. Do not fake a
   * denominator. */
  const { data: checklistCount } = useQuery({
    queryKey: ["cockpit-checklist-count", visaCode],
    enabled: !!visaCode,
    queryFn: async () => {
      const { count } = await supabase
        .from("document_checklist_rules")
        .select("id", { count: "exact", head: true })
        .eq("visa_type_code", visaCode!)
        .eq("is_active", true);
      return count ?? 0;
    },
  });

  /* --- expiry engine ---------------------------------------------------- */
  const { data: expiring } = useQuery({
    queryKey: ["cockpit-expiry", caseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("expiry_items")
        .select("id, label, item_type, expires_on")
        .eq("case_id", caseId)
        .eq("is_active", true)
        .order("expires_on", { ascending: true })
        .limit(4);
      return (data ?? []) as { id: string; label: string | null; item_type: string | null; expires_on: string | null }[];
    },
  });

  /* --- last contact with this client ------------------------------------ */
  const { data: lastMsg } = useQuery({
    queryKey: ["cockpit-last-message", caseRow.client_id],
    enabled: !!caseRow.client_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, channel, direction, created_at")
        .eq("client_id", caseRow.client_id)
        .order("created_at", { ascending: false })
        .limit(1);
      return (data ?? [])[0] as { id: string; channel: string | null; direction: string | null; created_at: string } | undefined;
    },
  });

  /* --- portal linkage --------------------------------------------------- */
  const { data: portalLinked } = useQuery({
    queryKey: ["cockpit-portal", caseRow.client_id],
    enabled: !!caseRow.client_id,
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("portal_user_id").eq("id", caseRow.client_id).maybeSingle();
      return !!data?.portal_user_id;
    },
  });

  /* --- last five timeline events ---------------------------------------- */
  const { data: recent } = useQuery({
    queryKey: ["cockpit-recent", caseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_timeline")
        .select("id, title, event_type, occurred_at")
        .eq("case_id", caseId)
        .order("occurred_at", { ascending: false })
        .limit(5);
      return (data ?? []) as { id: string; title: string | null; event_type: string | null; occurred_at: string }[];
    },
  });

  /* ------------------------------------------------------------ derived */

  const journey = useMemo(() => (stages ?? []).filter(s => s.sort_order < TERMINAL_FROM).sort((a, b) => a.sort_order - b.sort_order), [stages]);
  const currentStage = useMemo(() => (stages ?? []).find(s => s.code === caseRow.current_stage_code), [stages, caseRow.current_stage_code]);
  const isTerminal = !!currentStage && currentStage.sort_order >= TERMINAL_FROM;
  const currentIdx = journey.findIndex(s => s.code === caseRow.current_stage_code);

  const openTasks = useMemo(
    () => (tasks ?? [])
      .filter(t => t.status_code === "open")
      .sort((a, b) => (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999")),
    [tasks],
  );
  const nextTask = openTasks[0];
  const nextOverdue = nextTask?.due_at ? new Date(nextTask.due_at).getTime() < Date.now() : false;

  const quoted = Number(caseRow.quoted_fee_inr ?? 0);
  const invoiced = Number(caseRow.total_invoiced_inr ?? 0);
  const paid = Number(caseRow.total_paid_inr ?? 0);
  const due = invoiced - paid;

  const docTotal = docs?.length ?? 0;
  const docRejected = docs?.filter(d => d.status === "rejected").length ?? 0;
  const docVerified = docs?.filter(d => d.status === "verified" || d.status === "approved").length ?? 0;
  const hasChecklist = (checklistCount ?? 0) > 0;
  const docPct = hasChecklist ? Math.min(100, Math.round((docTotal / (checklistCount || 1)) * 100)) : 0;

  const familyIncluded = (family ?? []).filter(f => f.is_included_on_current_case).length;
  const managerName = staff?.find(s => s.id === caseRow.case_manager_id)?.full_name ?? "Unassigned";

  const ageDays = daysSince(caseRow.created_at);
  const stageDays = daysSince(caseRow.stage_entered_at ?? caseRow.created_at);
  const targetIn = daysUntil(caseRow.target_submission_date);

  /* ------------------------------------------------------------ render */

  return (
    <div className="space-y-4">
      {/* ── identity strip ─────────────────────────────────────────────── */}
      <div className="card-surface p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs mb-4">
          <span className="text-muted-foreground">UCI <b className="font-mono text-foreground">{caseRow.uci_number || "—"}</b></span>
          <span className="text-muted-foreground">IRCC file <b className="font-mono text-foreground">{caseRow.ircc_file_number || "—"}</b></span>
          <span className="text-muted-foreground">Opened <b className="text-foreground">{fmtDateIST(caseRow.created_at)}</b>{ageDays !== null && ` · ${ageDays}d ago`}</span>
          <span className="text-muted-foreground">Counsellor <b className="text-foreground">{managerName}</b></span>
          {caseRow.submitted_at && <span className="text-muted-foreground">Submitted <b className="text-foreground">{fmtDateIST(caseRow.submitted_at)}</b></span>}
          {caseRow.decision_at && <span className="text-muted-foreground">Decided <b className="text-foreground">{fmtDateIST(caseRow.decision_at)}</b></span>}
        </div>

        {/* stage rail — journey stages only; endings are a badge, not a step */}
        {journey.length > 0 && (
          <div className="flex gap-1.5">
            {journey.map((s, i) => {
              const done = !isTerminal && currentIdx >= 0 && i < currentIdx;
              const here = !isTerminal && i === currentIdx;
              return (
                <div key={s.code} className="flex-1 min-w-0" title={s.label}>
                  <div className={`h-2 rounded-full transition-colors ${here ? "bg-accent" : done || isTerminal ? "bg-primary" : "bg-muted"}`} />
                  <div className={`text-[10px] uppercase tracking-wider mt-1.5 truncate ${here ? "text-accent font-semibold" : "text-muted-foreground"}`}>
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-3.5">
          {isTerminal ? (
            <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wide">
              {currentStage?.label ?? caseRow.current_stage_code}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              In <b className="text-foreground">{currentStage?.label ?? caseRow.current_stage_code ?? "—"}</b>
              {stageDays !== null && ` for ${stageDays} day${stageDays === 1 ? "" : "s"}`}
            </span>
          )}
          {caseRow.target_submission_date && (
            <span className={`text-xs ${targetIn !== null && targetIn < 0 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
              · Target submission {fmtDateIST(caseRow.target_submission_date)}
              {targetIn !== null && (targetIn < 0 ? ` (${Math.abs(targetIn)}d overdue)` : ` (in ${targetIn}d)`)}
            </span>
          )}
          {caseRow.ircc_status && <span className="text-xs text-muted-foreground">· IRCC: {caseRow.ircc_status}</span>}
        </div>
      </div>

      {/* ── top row: what to do, money, who ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Panel title="Next action" icon={<CheckSquare className="h-3.5 w-3.5" />} href={`/tasks?case=${caseId}`} hrefLabel="All tasks">
          {!nextTask ? (
            <Empty>No open tasks. Move the stage, or add one from the Tasks tab.</Empty>
          ) : (
            <>
              <div className="flex items-start gap-2">
                {nextOverdue && <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-snug">{nextTask.title}</div>
                  <div className={`text-xs mt-0.5 ${nextOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {nextTask.due_at ? `Due ${fmtDateTimeIST(nextTask.due_at)} · ${fmtRelative(nextTask.due_at)}` : "No due date"}
                    {nextTask.priority ? ` · ${nextTask.priority}` : ""}
                  </div>
                </div>
              </div>
              {openTasks.length > 1 && (
                <div className="text-xs text-muted-foreground mt-2.5 pt-2.5 border-t border-border">
                  + {openTasks.length - 1} more open task{openTasks.length - 1 === 1 ? "" : "s"}
                </div>
              )}
            </>
          )}
        </Panel>

        <Panel title="Money (INR)" icon={<IndianRupee className="h-3.5 w-3.5" />} href={`/cases/${caseId}`} hrefLabel="Finance tab">
          <Row label="Quoted" value={fmtMoney(quoted, "INR")} />
          <Row label="Invoiced" value={fmtMoney(invoiced, "INR")} />
          <Row label="Paid" value={fmtMoney(paid, "INR")} />
          <div className="mt-1.5 pt-1.5 border-t border-border">
            <Row label="Outstanding" value={fmtMoney(due, "INR")} warn={due > 0} />
          </div>
          {invoiced === 0 && quoted > 0 && (
            <p className="text-[11px] text-muted-foreground mt-2">Quoted but never invoiced — generate an invoice.</p>
          )}
        </Panel>

        <Panel title="Client" icon={<MessageCircle className="h-3.5 w-3.5" />} href={caseRow.client ? `/clients/${caseRow.client.id}` : undefined} hrefLabel="Profile">
          <div className="text-sm font-medium truncate">{caseRow.client?.full_name ?? "—"}</div>
          <div className="text-xs text-muted-foreground truncate">{caseRow.client?.phone || caseRow.client?.email || "No contact on file"}</div>
          <div className="mt-2 space-y-0.5">
            <div className="text-xs text-muted-foreground">
              Last contact:{" "}
              {lastMsg
                ? <b className="text-foreground">{fmtRelative(lastMsg.created_at)}{lastMsg.channel ? ` · ${lastMsg.channel}` : ""}</b>
                : <b className="text-foreground">never</b>}
            </div>
            <div className="text-xs text-muted-foreground">
              Portal: <b className={portalLinked ? "text-foreground" : "text-muted-foreground"}>{portalLinked ? "linked" : "not linked"}</b>
            </div>
          </div>
        </Panel>
      </div>

      {/* ── second row: documents, family, expiring ────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Panel title="Documents" icon={<FileText className="h-3.5 w-3.5" />} href={`/documents?case=${caseId}`} hrefLabel="Docs tab">
          {hasChecklist ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums">{docTotal}</span>
                <span className="text-sm text-muted-foreground">of {checklistCount} on the checklist</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${docPct}%` }} />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums">{docTotal}</span>
                <span className="text-sm text-muted-foreground">uploaded</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                No checklist configured for <span className="font-mono">{visaCode ?? "this programme"}</span> —{" "}
                <Link to="/admin/document-checklists" className="text-accent hover:underline">set one up</Link> to see “N of M”.
              </p>
            </>
          )}
          <div className="flex gap-3 mt-2.5 text-xs">
            <span className="text-muted-foreground">{docVerified} verified</span>
            {docRejected > 0 && <span className="text-destructive font-medium">{docRejected} rejected</span>}
          </div>
        </Panel>

        <Panel title="Family" icon={<Users className="h-3.5 w-3.5" />} href={`/cases/${caseId}`} hrefLabel="Family tab">
          {!family || family.length === 0 ? (
            <Empty>No family members on file. Add them on the client profile — they drive the checklist.</Empty>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums">{familyIncluded}</span>
                <span className="text-sm text-muted-foreground">included on this application</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">{family.length} on file in total</p>
            </>
          )}
        </Panel>

        <Panel title="Expiring" icon={<ShieldAlert className="h-3.5 w-3.5" />} href="/admin/expiry" hrefLabel="Expiry rules">
          {!expiring || expiring.length === 0 ? (
            <Empty>Nothing tracked. Add an expiry date when uploading a passport, LOA or permit and the engine will chase it.</Empty>
          ) : (
            <ul className="space-y-1.5">
              {expiring.map(e => {
                const d = daysUntil(e.expires_on);
                const soon = d !== null && d <= 60;
                return (
                  <li key={e.id} className="flex items-baseline justify-between gap-3">
                    <span className="text-xs truncate">{e.label || e.item_type || "Item"}</span>
                    <span className={`text-xs tabular-nums shrink-0 ${soon ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                      {fmtDateIST(e.expires_on)}{d !== null && d >= 0 ? ` · ${d}d` : d !== null ? " · expired" : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── recent activity ────────────────────────────────────────────── */}
      <Panel title="Recent" icon={<Clock className="h-3.5 w-3.5" />}>
        {!recent || recent.length === 0 ? (
          <Empty>Nothing on the timeline yet.</Empty>
        ) : (
          <ul className="divide-y divide-border -my-1">
            {recent.map(r => (
              <li key={r.id} className="flex items-baseline justify-between gap-4 py-1.5">
                <span className="text-xs truncate">{r.title || r.event_type || "Event"}</span>
                <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">{fmtRelative(r.occurred_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
