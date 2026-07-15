"use client";

import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, LayoutGrid, Table as TableIcon } from "lucide-react";
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
import { PriorityPill } from "@/components/StatusPill";
import { fmtDateIST } from "@/lib/format";
import { TableSkeleton } from "@/components/TableSkeleton";
import { NewCaseDialog } from "@/components/NewCaseDialog";
import { writeAudit } from "@/lib/audit";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export default function Cases() {
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [open, setOpen] = useState(false);

  const { data: stages } = useQuery({
    queryKey: ["case-stages"],
    queryFn: async () => (await supabase.from("case_stages_ref").select("*").order("sort_order")).data ?? [],
  });

  return (
    <div>
      <PageHeader
        title="Cases"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border overflow-hidden">
              <button onClick={() => setView("kanban")} className={`px-3 py-1.5 text-xs flex items-center gap-1.5 ${view === "kanban" ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                <LayoutGrid className="h-3.5 w-3.5" /> Kanban
              </button>
              <button onClick={() => setView("table")} className={`px-3 py-1.5 text-xs flex items-center gap-1.5 ${view === "table" ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                <TableIcon className="h-3.5 w-3.5" /> Table
              </button>
            </div>
            <Button onClick={() => setOpen(true)} className="bg-primary hover:bg-primary/90"><Plus className="h-4 w-4 mr-1.5" />New Case</Button>
          </div>
        }
      />
      <div className="p-6">
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
    await supabase.from("case_stage_history").insert({ case_id: caseId, from_stage_code: oldStage, to_stage_code: newStage, changed_by: user?.id ?? null, note: "drag-drop" });
    void writeAudit({ action: "STAGE_CHANGE", entity_type: "cases", entity_id: caseId, changes: { from: oldStage, to: newStage } });
    toast.success(`Moved to ${newStage}`);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map(stage => {
          const inStage = cases?.filter(c => c.current_stage_code === stage.code) ?? [];
          return <KanbanColumn key={stage.code} stage={stage} cases={inStage} />;
        })}
      </div>
    </DndContext>
  );
}

function KanbanColumn({ stage, cases }: { stage: { code: string; label: string }; cases: CaseRow[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.code });
  return (
    <div ref={setNodeRef} className={`flex-shrink-0 w-72 rounded-xl border border-border bg-muted/30 p-3 ${isOver ? "ring-2 ring-accent" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm capitalize">{stage.label}</h3>
        <span className="text-xs text-muted-foreground">{cases.length}</span>
      </div>
      <div className="space-y-2 min-h-[100px]">
        {cases.map(c => <KanbanCard key={c.id} c={c} />)}
      </div>
    </div>
  );
}

function KanbanCard({ c }: { c: CaseRow }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-card rounded-md border border-border p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${isDragging ? "opacity-50" : ""}`}
    >
      <Link to={`/cases/${c.id}`} onClick={(e) => isDragging && e.preventDefault()} className="block">
        <div className="font-medium text-sm">{c.client_name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{c.visa_label}</div>
        <div className="flex items-center justify-between mt-2">
          <PriorityPill priority={c.priority} />
          {c.manager_name && <Avatar name={c.manager_name} size="sm" />}
        </div>
      </Link>
    </div>
  );
}

function TableView() {
  const { data: cases, isLoading } = useCases();
  if (isLoading) return <TableSkeleton rows={6} cols={6} />;
  return (
    <div className="card-surface overflow-hidden">
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
          {cases?.map(c => (
            <tr key={c.id} className="border-t border-border hover:bg-muted/30">
              <td className="px-4 py-3"><Link to={`/cases/${c.id}`} className="font-medium hover:text-accent">{c.case_code ?? c.id.slice(0, 8)}</Link></td>
              <td className="px-4 py-3">{c.client_name}</td>
              <td className="px-4 py-3">{c.visa_label}</td>
              <td className="px-4 py-3 capitalize text-muted-foreground">{c.current_stage_code?.replace(/_/g, " ")}</td>
              <td className="px-4 py-3"><PriorityPill priority={c.priority} /></td>
              <td className="px-4 py-3 text-xs">{c.manager_name ?? "—"}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDateIST(c.target_submission_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
