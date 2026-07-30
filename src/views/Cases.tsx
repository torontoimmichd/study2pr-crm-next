"use client";

// src/views/Cases.tsx
// v3 2026-07-27 — visual pass to match the Communications page.
// The data layer and the drag-and-drop logic are UNCHANGED from v2: same
// useCases() query, same optimistic stage update, same case_stage_history insert,
// same writeAudit call, same localStorage view persistence. Every stat below is
// derived from rows already fetched, so this adds zero database calls.

import { useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, LayoutGrid, Table as TableIcon, Briefcase, AlertTriangle, Flame, UserX, CalendarClock,
} from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Avatar";
import { PriorityPill, StatusPill } from "@/components/StatusPill";
import { fmtDateIST } from "@/lib/format";
import { TableSkeleton } from "@/components/TableSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { NewCaseDialog } from "@/components/NewCaseDialog";
import { writeAudit } from "@/lib/audit";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

// FIX 2026-07-18: view choice persists in localStorage — previously plain
// useState defaulting to "kanban", so every remount silently reset Table view.
const VIEW_STORAGE_KEY = "study2pr_cases_view";

function loadSavedView(): "kanban" | "table" {
  if (typeof window === "undefined") return "kanban";
  try {
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === "table" || saved === "kanban") return saved;
  } catch {
    // storage unavailable (private mode etc.) — fall through to default
  }
  return "kanban";
}

// Stable colour per stage column, cycled by position. Purely decorative.
const STAGE_ACCENT = [
  { dot: "bg-sky-500",     bar: "bg-sky-500/70" },
  { dot: "bg-violet-500",  bar: "bg-violet-500/70" },
  { dot: "bg-amber-500",   bar: "bg-amber-500/70" },
  { dot: "bg-emerald-500", bar: "bg-emerald-500/70" },
  { dot: "bg-rose-500",    bar: "bg-rose-500/70" },
  { dot: "bg-teal-500",    bar: "bg-teal-500/70" },
];

function isOverdue(d: string | null) {
  if (!d) return false;
  const t = new Date(d).getTime();
  return Number.isFinite(t) && t < Date.now();
}

function StatTile({
  label, value, icon, hint, tone,
}: { label: string; value: number | string; icon: React.ReactNode; hint?: string; tone?: "warn" | "danger" }) {
  const iconTone =
    tone === "danger" ? "bg-destructive/10 text-destructive"
    : tone === "warn" ? "bg-amber-500/10 text-amber-600"
    : "bg-muted text-muted-foreground";
  return (
    <div className="card-surface px-4 py-3 flex items-start gap-3">
      <div className={`mt-1 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${iconTone}`}>{icon}</div>
      <div className="min-w-0">
        <div className="stat-value leading-none">{value}</div>
        <div className="stat-label mt-1.5">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{hint}</div>}
      </div>
    </div>
  );
}

export default function Cases() {
  const [view, setView] = useState<"kanban" | "table">(loadSavedView);
  const [open, setOpen] = useState(false);

  const changeView = (v: "kanban" | "table") => {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      // non-fatal: view still switches for this session
    }
  };

  const { data: stages } = useQuery({
    queryKey: ["case-stages"],
    queryFn: async () => (await supabase.from("case_stages_ref").select("*").order("sort_order")).data ?? [],
  });

  const { data: cases } = useCases();

  const stats = useMemo(() => {
    const list = cases ?? [];
    return {
      total: list.length,
      overdue: list.filter((c) => isOverdue(c.target_submission_date)).length,
      high: list.filter((c) => (c.priority ?? "").toLowerCase() === "high" || (c.priority ?? "").toLowerCase() === "urgent").length,
      unassigned: list.filter((c) => !c.case_manager_id).length,
    };
  }, [cases]);

  return (
    <div>
      <PageHeader
        title="Applications"
        subtitle="Every live case, by stage"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border overflow-hidden">
              <button onClick={() => changeView("kanban")} className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${view === "kanban" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
                <LayoutGrid className="h-3.5 w-3.5" /> Kanban
              </button>
              <button onClick={() => changeView("table")} className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${view === "table" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
                <TableIcon className="h-3.5 w-3.5" /> Table
              </button>
            </div>
            <Button onClick={() => setOpen(true)} className="bg-primary hover:bg-primary/90"><Plus className="h-4 w-4 mr-1.5" />New Application</Button>
          </div>
        }
      />
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile label="Live applications" value={stats.total} icon={<Briefcase className="h-4 w-4" />} hint="not archived" />
          <StatTile label="Past target date" value={stats.overdue} icon={<AlertTriangle className="h-4 w-4" />}
            tone={stats.overdue > 0 ? "danger" : undefined} hint="submission overdue" />
          <StatTile label="High priority" value={stats.high} icon={<Flame className="h-4 w-4" />}
            tone={stats.high > 0 ? "warn" : undefined} hint="high or urgent" />
          <StatTile label="Unassigned" value={stats.unassigned} icon={<UserX className="h-4 w-4" />}
            tone={stats.unassigned > 0 ? "warn" : undefined} hint="no case manager" />
        </div>

        <div className="gold-rule" />

        {view === "kanban" ? <KanbanView stages={stages ?? []} /> : <TableView />}
      </div>
      <NewCaseDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

interface CaseRow {
  id: string;
  case_code: string | null;
  client_id: string;
  client_name?: string;
  visa_label?: string;
  current_stage_code: string | null;
  priority: string | null;
  case_manager_id: string | null;
  manager_name?: string | null;
  stage_entered_at: string | null;
  target_submission_date: string | null;
}

function useCases() {
  return useQuery({
    queryKey: ["cases-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cases")
        .select("id, case_code, client_id, current_stage_code, priority, case_manager_id, stage_entered_at, target_submission_date, visa_type_id")
        .eq("is_archived", false)
        .order("stage_entered_at", { ascending: false })
        .limit(500);
      const rows = data ?? [];
      const cIds = Array.from(new Set(rows.map(r => r.client_id)));
      const vIds = Array.from(new Set(rows.map(r => r.visa_type_id)));
      const sIds = Array.from(new Set(rows.map(r => r.case_manager_id).filter(Boolean) as string[]));
      const [cs, vs, ss] = await Promise.all([
        cIds.length ? supabase.from("clients").select("id, full_name").in("id", cIds) : Promise.resolve({ data: [] }),
        vIds.length ? supabase.from("visa_types").select("id, label").in("id", vIds) : Promise.resolve({ data: [] }),
        sIds.length ? supabase.from("staff_profiles").select("id, full_name").in("id", sIds) : Promise.resolve({ data: [] }),
      ]);
      const cMap = new Map(((cs.data ?? []) as { id: string; full_name: string }[]).map(c => [c.id, c.full_name]));
      const vMap = new Map(((vs.data ?? []) as { id: string; label: string }[]).map(v => [v.id, v.label]));
      const sMap = new Map(((ss.data ?? []) as { id: string; full_name: string }[]).map(s => [s.id, s.full_name]));
      return rows.map(r => ({
        ...r,
        client_name: cMap.get(r.client_id) ?? "—",
        visa_label: vMap.get(r.visa_type_id) ?? "—",
        manager_name: r.case_manager_id ? sMap.get(r.case_manager_id) : null,
      })) as CaseRow[];
    },
  });
}

function KanbanView({ stages }: { stages: { code: string; label: string; sort_order: number | null }[] }) {
  const { data: cases, isLoading, refetch } = useCases();
  const qc = useQueryClient();
  const { user } = useAuth();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  if (isLoading) return <TableSkeleton rows={4} cols={5} />;

  const onDragEnd = async (e: DragEndEvent) => {
    const caseId = String(e.active.id);
    const newStage = e.over?.id ? String(e.over.id) : null;
    if (!newStage) return;
    const c = cases?.find(x => x.id === caseId);
    if (!c || c.current_stage_code === newStage) return;
    const oldStage = c.current_stage_code;
    // Optimistic
    qc.setQueryData<CaseRow[]>(["cases-all"], (prev) => prev?.map(p => p.id === caseId ? { ...p, current_stage_code: newStage } : p));
    const { error } = await supabase.from("cases").update({ current_stage_code: newStage, stage_entered_at: new Date().toISOString() }).eq("id", caseId);
    if (error) {
      toast.error(error.message);
      void refetch();
      return;
    }
    // P1.2 — REMOVED (2026-07-30): duplicate stage-history write.
    // Trigger trg_cases_stage -> log_stage_change() inserts this row and now
    // records the actor via auth.uid(). Keeping both produced exactly two rows
    // per transition (verified: 36 rows = 18 trigger + 18 client).
    // FIDELITY NOTE: the cosmetic note='drag-drop' label is no longer written,
    // because a trigger cannot observe the UI origin. Nothing reads that value.
    void writeAudit({ action: "STAGE_CHANGE", entity_type: "cases", entity_id: caseId, changes: { from: oldStage, to: newStage } });
    toast.success(`Moved to ${newStage}`);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage, i) => {
          const inStage = cases?.filter(c => c.current_stage_code === stage.code) ?? [];
          return <KanbanColumn key={stage.code} stage={stage} cases={inStage} accent={STAGE_ACCENT[i % STAGE_ACCENT.length]} />;
        })}
      </div>
    </DndContext>
  );
}

function KanbanColumn({
  stage, cases, accent,
}: { stage: { code: string; label: string }; cases: CaseRow[]; accent: { dot: string; bar: string } }) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.code });
  const overdueHere = cases.filter(c => isOverdue(c.target_submission_date)).length;
  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 rounded-xl border bg-muted/30 overflow-hidden transition-all ${
        isOver ? "ring-2 ring-accent border-accent shadow-lg" : "border-border"
      }`}
    >
      <div className={`h-1 w-full ${accent.bar}`} />
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`h-2 w-2 rounded-full shrink-0 ${accent.dot}`} />
            <h3 className="font-medium text-sm capitalize truncate">{stage.label}</h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {overdueHere > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-destructive" title={`${overdueHere} past target date`}>
                <AlertTriangle className="h-3 w-3" />{overdueHere}
              </span>
            )}
            <span className="text-xs text-muted-foreground tabular-nums bg-card border border-border rounded-full px-1.5 py-0.5">
              {cases.length}
            </span>
          </div>
        </div>
        <div className="space-y-2 min-h-[100px]">
          {cases.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/60 text-center py-6 border border-dashed border-border rounded-md">
              Drop an application here
            </p>
          ) : (
            cases.map(c => <KanbanCard key={c.id} c={c} />)
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanCard({ c }: { c: CaseRow }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const overdue = isOverdue(c.target_submission_date);
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-card rounded-lg border p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${
        isDragging ? "opacity-50 rotate-1" : ""
      } ${overdue ? "border-destructive/40" : "border-border"}`}
    >
      <Link to={`/cases/${c.id}`} onClick={(e) => isDragging && e.preventDefault()} className="block">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{c.client_name}</div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">{c.visa_label}</div>
          </div>
          {c.manager_name ? <Avatar name={c.manager_name} size="sm" /> : null}
        </div>

        {c.case_code && (
          <div className="text-[10px] font-mono text-muted-foreground/70 mt-1.5">{c.case_code}</div>
        )}

        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/60">
          <PriorityPill priority={c.priority} />
          {c.target_submission_date && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] whitespace-nowrap ${
                overdue ? "text-destructive font-medium" : "text-muted-foreground"
              }`}
              title={overdue ? "Past target submission date" : "Target submission date"}
            >
              <CalendarClock className="h-3 w-3" />
              {fmtDateIST(c.target_submission_date)}
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}

function TableView() {
  const { data: cases, isLoading } = useCases();
  if (isLoading) return <TableSkeleton rows={6} cols={6} />;
  if (!cases || cases.length === 0) {
    return (
      <div className="card-surface overflow-hidden">
        <EmptyState
          icon={<Briefcase className="h-5 w-5" />}
          title="No live applications"
          description="Convert a lead, or create an application manually."
        />
      </div>
    );
  }
  return (
    <div className="card-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Code</th>
              <th className="text-left px-4 py-3 font-medium">Client</th>
              <th className="text-left px-4 py-3 font-medium">Visa</th>
              <th className="text-left px-4 py-3 font-medium">Stage</th>
              <th className="text-left px-4 py-3 font-medium">Priority</th>
              <th className="text-left px-4 py-3 font-medium">Manager</th>
              <th className="text-left px-4 py-3 font-medium">Target</th>
            </tr>
          </thead>
          <tbody>
            {cases.map(c => {
              const overdue = isOverdue(c.target_submission_date);
              return (
                <tr key={c.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/cases/${c.id}`} className="font-medium hover:text-accent font-mono text-xs">
                      {c.case_code ?? c.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar name={c.client_name ?? "—"} size="sm" />
                      <span className="truncate">{c.client_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">{c.visa_label}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone="info">
                      {(c.current_stage_code ?? "—").replace(/_/g, " ")}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-3"><PriorityPill priority={c.priority} /></td>
                  <td className="px-4 py-3 text-xs">
                    {c.manager_name ? (
                      <div className="flex items-center gap-2">
                        <Avatar name={c.manager_name} size="sm" />
                        <span className="truncate">{c.manager_name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/60">unassigned</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-xs whitespace-nowrap ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {fmtDateIST(c.target_submission_date)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
