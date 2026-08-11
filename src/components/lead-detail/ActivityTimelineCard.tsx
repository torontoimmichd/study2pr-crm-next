"use client";

// src/components/lead-detail/ActivityTimelineCard.tsx
//
// Restyled 2026-08-11 to the reference layout: each event is a bordered row with
// a filled circular icon, a connecting rail down the left, and a right-aligned
// badge naming the event type. Nothing about the data changed.
import { Card } from "@/components/ui/card";
import { FileText, UserPlus, ListChecks, Link as LinkIcon, MessageSquare, AlertCircle } from "lucide-react";
import type { TimelineEvent } from "@/lib/types";

interface Props { events: TimelineEvent[]; }

// bg = filled circle behind a white glyph; badge = the pill on the right.
const ICON_BY_TYPE: Record<
  string,
  { Icon: React.ComponentType<{ className?: string }>; bg: string; badge: string; label: string }
> = {
  note_added:      { Icon: FileText,      bg: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 border-amber-200",     label: "Note Added" },
  lead_created:    { Icon: UserPlus,      bg: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Lead Created" },
  client_created:  { Icon: UserPlus,      bg: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Client Created" },
  lead_converted:  { Icon: UserPlus,      bg: "bg-teal-500",    badge: "bg-teal-50 text-teal-700 border-teal-200",         label: "Converted" },
  task_created:    { Icon: ListChecks,    bg: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 border-amber-200",      label: "Task Created" },
  task_completed:  { Icon: ListChecks,    bg: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Task Completed" },
  tasks_autoclosed:{ Icon: ListChecks,    bg: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Auto-closed" },
  stage_change:    { Icon: LinkIcon,      bg: "bg-indigo-500",  badge: "bg-indigo-50 text-indigo-700 border-indigo-200",   label: "Stage Change" },
  chain_fired:     { Icon: LinkIcon,      bg: "bg-blue-500",    badge: "bg-blue-50 text-blue-700 border-blue-200",         label: "Chain Fired" },
  message_sent:    { Icon: MessageSquare, bg: "bg-blue-500",    badge: "bg-blue-50 text-blue-700 border-blue-200",         label: "Message Sent" },
  sla_breach:      { Icon: AlertCircle,   bg: "bg-red-500",     badge: "bg-red-50 text-red-700 border-red-200",            label: "SLA Breach" },
  custom:          { Icon: FileText,      bg: "bg-slate-400",   badge: "bg-slate-50 text-slate-700 border-slate-200",      label: "Activity" },
};

export function ActivityTimelineCard({ events }: Props) {
  return (
    <Card className="p-5">
      <h3 className="font-semibold text-sm mb-4">Activity Timeline</h3>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="relative flex flex-col gap-3">
          {/* vertical rail behind the icons */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" aria-hidden />
          {events.map(e => {
            const mapping = ICON_BY_TYPE[e.event_type] || ICON_BY_TYPE.custom;
            const { Icon, bg, badge, label } = mapping;
            const desc = e.description || e.body || null;
            return (
              <div key={e.id} className="relative flex gap-3 items-start">
                <div
                  className={`w-8 h-8 rounded-full ${bg} text-white flex items-center justify-center shrink-0 ring-4 ring-background z-10`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0 rounded-lg border bg-card px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <p className="text-sm font-medium flex-1 min-w-0">{e.title}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${badge}`}>
                      {label}
                    </span>
                  </div>
                  {desc && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{desc}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                    By: {e.created_by || "System"} · {new Date(e.created_at).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
