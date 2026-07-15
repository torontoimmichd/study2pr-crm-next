"use client";

// src/components/lead-detail/ActivityTimelineCard.tsx
import { Card } from "@/components/ui/card";
import { FileText, UserPlus, ListChecks, Link as LinkIcon, MessageSquare, AlertCircle } from "lucide-react";
import type { TimelineEvent } from "@/lib/types";

interface Props { events: TimelineEvent[]; }

const ICON_BY_TYPE: Record<string, { Icon: React.ComponentType<{ className?: string }>; bg: string; text: string }> = {
  note_added:     { Icon: FileText,      bg: "bg-amber-100", text: "text-amber-900" },
  lead_created:   { Icon: UserPlus,      bg: "bg-emerald-100", text: "text-emerald-900" },
  client_created: { Icon: UserPlus,      bg: "bg-emerald-100", text: "text-emerald-900" },
  lead_converted: { Icon: UserPlus,      bg: "bg-teal-100", text: "text-teal-900" },
  task_created:   { Icon: ListChecks,    bg: "bg-amber-100", text: "text-amber-900" },
  task_completed: { Icon: ListChecks,    bg: "bg-emerald-100", text: "text-emerald-900" },
  chain_fired:    { Icon: LinkIcon,      bg: "bg-blue-100", text: "text-blue-900" },
  message_sent:   { Icon: MessageSquare, bg: "bg-blue-100", text: "text-blue-900" },
  sla_breach:     { Icon: AlertCircle,   bg: "bg-red-100", text: "text-red-900" },
  custom:         { Icon: FileText,      bg: "bg-slate-100", text: "text-slate-900" },
};

export function ActivityTimelineCard({ events }: Props) {
  return (
    <Card className="p-4">
      <h3 className="font-semibold text-sm mb-3">Activity timeline</h3>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {events.map(e => {
            const mapping = ICON_BY_TYPE[e.event_type] || ICON_BY_TYPE.note_added;
            const { Icon, bg, text } = mapping;
            const desc = e.description || e.body || null;
            return (
              <div key={e.id} className="flex gap-2">
                <div className={`w-6 h-6 rounded-full ${bg} ${text} flex items-center justify-center shrink-0`}>
                  <Icon className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{e.title}</p>
                  {desc && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{desc}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {e.created_by || "System"} · {new Date(e.created_at).toLocaleString("en-IN")}
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
