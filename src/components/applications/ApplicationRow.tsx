"use client";

// src/components/applications/ApplicationRow.tsx
import { Badge } from "@/components/ui/badge";
import { CaseQuickActionsMenu } from "./CaseQuickActionsMenu";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtRelative } from "@/lib/format";
import { Link as LinkIcon, Clock, User as UserIcon, Activity } from "lucide-react";
import type { ApplicationRow as AppRowType } from "@/lib/types";

export type RowContext = "lead_detail" | "applications_page" | "manager_drill";

interface Props {
  app: AppRowType;
  context: RowContext;
  showFamilyContext?: boolean;
  onUpdated?: (updated: Partial<AppRowType>) => void;
  onClick?: () => void;
}

function stageColor(stage: string | null | undefined): string {
  switch (stage) {
    case "approved":   return "bg-emerald-100 text-emerald-900";
    case "refused":    return "bg-red-100 text-red-900";
    case "withdrawn":  return "bg-gray-100 text-gray-700";
    case "submitted":  return "bg-blue-100 text-blue-900";
    case "checklist_sent":
    case "checklist sent": return "bg-purple-100 text-purple-900";
    default:           return "bg-amber-100 text-amber-900";
  }
}

function fmtINR(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(n);
}

// ── Hover popover content: recent activity + stage + next task + assignee ──
function CaseHoverContent({ app, stage }: { app: AppRowType; stage: string }) {
  const caseRef = app.case_number || app.case_ref || app.id.slice(0, 8);
  const { data: events, isLoading } = useQuery({
    queryKey: ["case-hover-activity", app.id],
    staleTime: 30_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("activity_timeline")
        .select("id, event_type, title, occurred_at")
        .eq("case_id", app.id)
        .order("occurred_at", { ascending: false })
        .limit(5);
      return (data ?? []) as { id: string; event_type: string; title: string; occurred_at: string }[];
    },
  });

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{caseRef}</span>
        <Badge className={`${stageColor(stage)} text-[10px]`}>{stage.replace(/_/g, " ")}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-1.5 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <UserIcon className="h-3.5 w-3.5" />
          <span>Working on it: <span className="text-foreground font-medium">{app.assigned_to_name || "Unassigned"}</span></span>
        </div>
        <div className="flex items-start gap-1.5 text-muted-foreground">
          <Clock className="h-3.5 w-3.5 mt-0.5" />
          <span>
            Next task:{" "}
            {app.next_task ? (
              <span className="text-foreground font-medium">
                {app.next_task.title}
                {app.next_task.due_at ? ` · ${fmtRelative(app.next_task.due_at)}` : ""}
              </span>
            ) : <span className="italic">none open</span>}
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
          <Activity className="h-3 w-3" /> Recent activity
        </div>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : !events || events.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No recent activity logged.</p>
        ) : (
          <ul className="space-y-1">
            {events.map((e) => (
              <li key={e.id} className="text-xs flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
                <span className="flex-1">
                  <span className="text-foreground">{e.title}</span>
                  <span className="text-muted-foreground"> · {fmtRelative(e.occurred_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ApplicationRow({ app, context, showFamilyContext, onUpdated, onClick }: Props) {
  const isChainSpawned = !!app.source_prospective_application_id;
  const checklistTotal = 7;
  const checklistStep = app.checklist_step || 0;
  const paid = app.paid_amount || 0;
  const fee = app.fee || app.quoted_fee_inr || 0;
  const stage = app.stage || app.current_stage_code || "new";
  const caseRef = app.case_number || app.case_ref || app.id.slice(0, 8);

  return (
    <div
      className="flex items-center gap-2 py-2 border-b last:border-0 hover:bg-muted/50 -mx-2 px-2 rounded group"
      role="row"
    >
      {/* Case number + chain badge — hover reveals recent activity */}
      <div className="w-28 shrink-0">
        <HoverCard openDelay={150} closeDelay={80}>
          <HoverCardTrigger asChild>
            <button
              onClick={onClick}
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              {caseRef}
              {isChainSpawned && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-400 text-amber-700">
                  <LinkIcon className="w-2 h-2 mr-0.5" /> Chain
                </Badge>
              )}
            </button>
          </HoverCardTrigger>
          <HoverCardContent align="start" className="w-80">
            <CaseHoverContent app={app} stage={stage} />
          </HoverCardContent>
        </HoverCard>
      </div>

      {context !== "lead_detail" && (
        <div className="flex-1 min-w-[140px]">
          <p className="text-sm font-medium truncate">{app.client_name || "—"}</p>
          {showFamilyContext && app.family_unit_name && (
            <p className="text-[10px] text-muted-foreground truncate">↳ {app.family_unit_name}</p>
          )}
        </div>
      )}

      <div className="flex-1 min-w-[120px]">
        <p className="text-sm truncate">{app.visa_type_name || app.application_type || "—"}</p>
        {app.country && (
          <p className="text-[10px] text-muted-foreground">{app.country}</p>
        )}
      </div>

      <Badge className={`${stageColor(stage)} text-[10px]`}>
        {stage.replace(/_/g, " ")}
      </Badge>

      {/* Next task */}
      <div className="w-32 shrink-0 hidden lg:block">
        {app.next_task ? (
          <>
            <p className="text-[11px] font-medium truncate">{app.next_task.title}</p>
            {app.next_task.due_at && (
              <p className="text-[10px] text-muted-foreground">{fmtRelative(app.next_task.due_at)}</p>
            )}
          </>
        ) : (
          <p className="text-[10px] text-muted-foreground/60 italic">No task</p>
        )}
      </div>

      <div className="w-16 shrink-0 text-right hidden md:block">
        <p className="text-[10px] text-muted-foreground">
          {checklistStep}/{checklistTotal}
        </p>
        <div className="h-1 bg-slate-200 rounded-full overflow-hidden mt-0.5">
          <div
            className="h-full bg-blue-500"
            style={{ width: `${(checklistStep / checklistTotal) * 100}%` }}
          />
        </div>
      </div>

      <div className="w-28 shrink-0 text-right hidden md:block">
        <p className="text-[11px] font-medium">{fmtINR(paid)}</p>
        <p className="text-[10px] text-muted-foreground">of {fmtINR(fee)}</p>
      </div>

      {context !== "lead_detail" && (
        <div className="w-24 shrink-0">
          <p className="text-[11px] truncate">{app.assigned_to_name || "—"}</p>
        </div>
      )}

      <CaseQuickActionsMenu app={app} onUpdated={onUpdated || (() => {})} />
    </div>
  );
}
