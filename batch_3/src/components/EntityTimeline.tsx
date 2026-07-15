"use client";

/**
 * EntityTimeline
 *
 * A universal activity feed that renders all timeline events for a lead,
 * case, or client. Reads from the `activity_timeline` table.
 *
 * Also shows the legacy audit_log rows so nothing is lost during migration.
 *
 * Usage:
 *   <EntityTimeline leadId={id} />
 *   <EntityTimeline caseId={id} />
 *   <EntityTimeline clientId={id} />
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus, CheckCircle, ArrowRight, FileText, Phone, PhoneMissed,
  Upload, ShieldCheck, ClipboardList, CheckSquare, MessageCircle, Mail,
  DollarSign, Briefcase, AlertCircle, User, Info, Plus, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTimeIST, fmtRelative } from "@/lib/format";
import { TIMELINE_META } from "@/lib/timeline";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

// ---------- Icon map ----------
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  UserPlus, CheckCircle, ArrowRight, FileText, Phone, PhoneMissed,
  Upload, ShieldCheck, ClipboardList, CheckSquare, MessageCircle, Mail,
  DollarSign, Briefcase, AlertCircle, User, Info,
};

// ---------- Phase detection ----------
// Returns the "phase" an event belongs to, for separator rendering
function getPhase(eventType: string): "lead" | "client" | "application" {
  if (["case_created", "case_stage_change", "document_uploaded", "document_verified",
       "payment_received", "ircc_update"].includes(eventType)) return "application";
  if (["lead_converted", "client_created"].includes(eventType)) return "client";
  return "lead";
}

const PHASE_SEPARATOR_CONFIG = {
  client:      { label: "CLIENT PHASE",      color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  application: { label: "APPLICATION PHASE", color: "bg-blue-100 text-blue-800 border-blue-200" },
};

function PhaseSeparator({ phase }: { phase: "client" | "application" }) {
  const cfg = PHASE_SEPARATOR_CONFIG[phase];
  return (
    <div className="flex items-center gap-3 py-2 pl-[46px]">
      <span className={`text-[10px] font-semibold tracking-widest px-2.5 py-1 rounded-full border ${cfg.color}`}>
        ⬢ {cfg.label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ---------- Types ----------
interface TimelineEvent {
  id: string;
  event_type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  actor_id: string | null;
  actor_name: string | null;
  is_system: boolean;
  occurred_at: string;
  source: "timeline" | "audit";
}

interface Props {
  leadId?: string;
  caseId?: string;
  clientId?: string;
  /** Show a "Log note" quick-add box */
  allowNotes?: boolean;
}

// ---------- Component ----------
export function EntityTimeline({ leadId, caseId, clientId, allowNotes = true }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const entityKey = leadId ? ["timeline", "lead", leadId]
    : caseId ? ["timeline", "case", caseId]
    : ["timeline", "client", clientId];

  const { data: events = [], isLoading } = useQuery({
    queryKey: entityKey,
    enabled: !!(leadId || caseId || clientId),
    queryFn: async () => {
      // 1. Fetch activity_timeline rows
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any).from("activity_timeline")
        .select("id, event_type, title, body, metadata, actor_id, is_system, occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(100);

      if (leadId)   q = q.eq("lead_id", leadId);
      if (caseId)   q = q.eq("case_id", caseId);
      if (clientId) q = q.eq("client_id", clientId);

      const { data: timelineRows, error } = await q;
      if (error) console.warn("[EntityTimeline] fetch error", error.message);

      // 2. Fetch legacy audit_log rows for the same entity
      let auditQ = supabase.from("audit_log")
        .select("id, action, entity_type, entity_id, occurred_at, actor_id, changes")
        .order("occurred_at", { ascending: false })
        .limit(100);

      const entityType = leadId ? "leads" : caseId ? "cases" : "clients";
      const entityId   = leadId ?? caseId ?? clientId ?? "";
      auditQ = auditQ.eq("entity_type", entityType).eq("entity_id", entityId);
      const { data: auditRows } = await auditQ;

      // 3. Gather all actor IDs and batch-resolve names
      const allRows = [...(timelineRows ?? []), ...(auditRows ?? [])];
      const actorIds = Array.from(new Set(allRows.map((r: { actor_id: string | null }) => r.actor_id).filter(Boolean) as string[]));
      let actorMap = new Map<string, string>();
      if (actorIds.length > 0) {
        const { data: actors } = await supabase.from("staff_profiles").select("id, full_name").in("id", actorIds);
        actorMap = new Map((actors ?? []).map((a) => [a.id, a.full_name]));
      }

      // 4. Map timeline rows to unified events
      const timelineEvents: TimelineEvent[] = (timelineRows ?? []).map((r: {
        id: string; event_type: string; title: string; body: string | null;
        metadata: Record<string, unknown> | null; actor_id: string | null;
        is_system: boolean; occurred_at: string;
      }) => ({
        id: r.id,
        event_type: r.event_type,
        title: r.title,
        body: r.body,
        metadata: r.metadata,
        actor_id: r.actor_id,
        actor_name: r.actor_id ? (actorMap.get(r.actor_id) ?? "Unknown") : null,
        is_system: r.is_system,
        occurred_at: r.occurred_at,
        source: "timeline" as const,
      }));

      // 5. Map audit rows to unified events (only include those NOT already in timeline)
      // Build dedup keys from timeline events: event_type + 10-second timestamp bucket
      const timelineAuditIds = new Set<string>();
      timelineEvents.forEach(e => {
        const bucket = Math.floor(new Date(e.occurred_at).getTime() / 10000);
        timelineAuditIds.add(`${e.event_type}_${bucket}`);
      });
      const auditEvents: TimelineEvent[] = (auditRows ?? []).map((r: {
        id: string; action: string; entity_type: string; entity_id: string;
        occurred_at: string; actor_id: string | null; changes: Record<string, unknown> | null;
      }) => {
        const et = mapAuditAction(r.action, r.changes);
        return {
          id: `audit-${r.id}`,
          event_type: et.event_type,
          title: et.title,
          body: et.body,
          metadata: r.changes,
          actor_id: r.actor_id,
          actor_name: r.actor_id ? (actorMap.get(r.actor_id) ?? "Unknown") : "System",
          is_system: !r.actor_id,
          occurred_at: r.occurred_at,
          source: "audit" as const,
        };
      }).filter((e: TimelineEvent) => {
        const bucket = Math.floor(new Date(e.occurred_at).getTime() / 10000);
        return !timelineAuditIds.has(`${e.event_type}_${bucket}`);
      });

      // 6. Merge and sort
      const merged = [...timelineEvents, ...auditEvents];
      merged.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
      return merged;
    },
  });

  const saveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("activity_timeline").insert({
        event_type:  "note_added",
        title:       "Note",
        body:        noteText.trim(),
        lead_id:     leadId ?? null,
        case_id:     caseId ?? null,
        client_id:   clientId ?? null,
        actor_id:    user?.id ?? null,
        is_system:   false,
        occurred_at: new Date().toISOString(),
      });
      if (error) throw error;
      setNoteText("");
      setAddingNote(false);
      void qc.invalidateQueries({ queryKey: entityKey });
      toast.success("Note logged");
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading timeline…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Quick note entry */}
      {allowNotes && (
        <div className="card-surface p-3">
          {addingNote ? (
            <div className="space-y-2">
              <Textarea
                autoFocus
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Log a note, call outcome, promise made, or any context…"
                className="text-sm"
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => { setAddingNote(false); setNoteText(""); }}>Cancel</Button>
                <Button size="sm" onClick={saveNote} disabled={savingNote || !noteText.trim()}>
                  {savingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save note"}
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingNote(true)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-left"
            >
              <Plus className="h-3.5 w-3.5" />
              Log a note or call outcome…
            </button>
          )}
        </div>
      )}

      {/* Timeline feed */}
      {events.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No activity recorded yet.</div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border" />

          <div className="space-y-0">
            {events.map((evt, i) => {
              const thisPhase = getPhase(evt.event_type);
              const nextPhase = i < events.length - 1 ? getPhase(events[i + 1].event_type) : null;
              // Insert a phase separator AFTER an event when the NEXT event is in a different (earlier) phase
              // Timeline is newest-first, so "next" = older event
              const showSeparatorAfter =
                nextPhase !== null &&
                thisPhase !== nextPhase &&
                (thisPhase === "client" || thisPhase === "application");

              return (
                <div key={evt.id}>
                  <TimelineRow event={evt} isLast={i === events.length - 1} />
                  {showSeparatorAfter && (
                    <PhaseSeparator phase={thisPhase as "client" | "application"} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Single row ----------
function TimelineRow({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const meta = TIMELINE_META[event.event_type] ?? TIMELINE_META.custom;
  const IconComp = ICON_MAP[meta.icon] ?? Info;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn("flex gap-3 pb-4", isLast && "pb-0")}>
      {/* Icon bubble */}
      <div className={cn(
        "relative z-10 flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-semibold border-2 border-background",
        meta.color,
      )}>
        <IconComp className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-foreground">{event.title}</span>
          {event.actor_name && !event.is_system && (
            <span className="text-xs text-muted-foreground">by {event.actor_name}</span>
          )}
          {event.is_system && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">auto</span>
          )}
          <span
            className="text-[11px] text-muted-foreground/70 ml-auto cursor-default"
            title={fmtDateTimeIST(event.occurred_at)}
          >
            {fmtRelative(event.occurred_at)}
          </span>
        </div>

        {event.body && (
          <div className="mt-1">
            {event.body.length > 200 && !expanded ? (
              <>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.body.slice(0, 200)}…</p>
                <button className="text-xs text-primary hover:underline mt-0.5" onClick={() => setExpanded(true)}>
                  Show more
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.body}</p>
                {event.body.length > 200 && (
                  <button className="text-xs text-primary hover:underline mt-0.5" onClick={() => setExpanded(false)}>
                    Show less
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Metadata chips for stage_change */}
        {event.event_type === "stage_change" && event.metadata && (
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            {event.metadata.from && <span className="px-1.5 py-0.5 rounded bg-muted capitalize">{String(event.metadata.from).replace(/_/g, " ")}</span>}
            {event.metadata.from && event.metadata.to && <ArrowRight className="h-3 w-3" />}
            {event.metadata.to && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary capitalize">{String(event.metadata.to).replace(/_/g, " ")}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Map audit_log actions to timeline display ----------
function mapAuditAction(action: string, changes: Record<string, unknown> | null): {
  event_type: string; title: string; body: string | null;
} {
  const from = changes?.from as string | undefined;
  const to   = changes?.to   as string | undefined;

  switch (action.toUpperCase()) {
    case "CREATE":
      return { event_type: "lead_created",  title: "Record created",       body: null };
    case "CONVERT":
      return { event_type: "lead_converted", title: "Converted to client",  body: null };
    case "STAGE_CHANGE":
      return {
        event_type: "stage_change",
        title: from && to
          ? `Stage: ${from.replace(/_/g, " ")} → ${to.replace(/_/g, " ")}`
          : "Stage changed",
        body: (changes?.waiting_review_notes as string | undefined) ?? null,
      };
    case "UPDATE":
      return { event_type: "custom",        title: "Record updated",        body: null };
    case "UPLOAD":
      return { event_type: "document_uploaded", title: "Document uploaded", body: null };
    case "PAYMENT":
      return { event_type: "payment_received",  title: "Payment received",  body: null };
    default:
      return { event_type: "custom", title: action, body: null };
  }
}
