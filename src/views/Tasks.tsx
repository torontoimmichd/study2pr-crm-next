"use client";

import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckSquare, Clock, AlertCircle, User, Tag, Check, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { fmtRelative, fmtDateTimeIST } from "@/lib/format";
import { writeAudit } from "@/lib/audit";
import { writeTimeline } from "@/lib/timeline";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { NewTaskDialog } from "@/components/NewTaskDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FilterKey = "all" | "overdue" | "today" | "week" | "mine" | "unassigned";

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "bg-destructive/15 text-destructive border-destructive/30",
  high:   "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400",
  normal: "bg-muted text-muted-foreground border-border",
  low:    "bg-muted/50 text-muted-foreground/70 border-border",
};

export default function Tasks() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [staffFilter, setStaffFilter] = useState<string>("__all");
  const [open, setOpen] = useState(false);

  // Staff list for filter dropdown
  const { data: staff } = useQuery({
    queryKey: ["staff-active"],
    queryFn: async () => {
      const { data } = await supabase.from("staff_profiles").select("id, full_name").eq("is_active", true).order("full_name");
      return data ?? [];
    },
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks-list", filter, showCompleted, staffFilter, user?.id],
    queryFn: async () => {
      const now = new Date();

      // Build base query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from("tasks")
        .select("id, title, description, due_at, priority, status_code, source, completed_at, lead_id, case_id, assigned_to, created_at")
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(300);

      if (showCompleted) {
        q = q.not("completed_at", "is", null);
      } else {
        q = q.is("completed_at", null);
        q = q.neq("status_code", "done");
      }

      // Date filters (only for open tasks)
      if (!showCompleted) {
        if (filter === "overdue") q = q.lt("due_at", now.toISOString());
        if (filter === "today") {
          const end = new Date(); end.setHours(23, 59, 59, 999);
          q = q.lte("due_at", end.toISOString()).gte("due_at", now.toISOString());
        }
        if (filter === "week") {
          const end = new Date(); end.setDate(end.getDate() + 7);
          q = q.lte("due_at", end.toISOString());
        }
        if (filter === "mine" && user) q = q.eq("assigned_to", user.id);
        if (filter === "unassigned") q = q.is("assigned_to", null);
      }

      // Staff dropdown override
      if (staffFilter !== "__all") q = q.eq("assigned_to", staffFilter);

      const { data: rows } = await q;
      if (!rows || rows.length === 0) return [];

      // Batch-resolve assigned staff names
      const assigneeIds = Array.from(new Set(rows.map((r: { assigned_to: string | null }) => r.assigned_to).filter(Boolean) as string[]));
      let staffMap = new Map<string, string>();
      if (assigneeIds.length > 0) {
        const { data: staffRows } = await supabase.from("staff_profiles").select("id, full_name").in("id", assigneeIds);
        staffMap = new Map((staffRows ?? []).map((s) => [s.id, s.full_name]));
      }

      // Batch-resolve lead names
      const leadIds = Array.from(new Set(rows.map((r: { lead_id: string | null }) => r.lead_id).filter(Boolean) as string[]));
      let leadMap = new Map<string, string>();
      if (leadIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: leadRows } = await (supabase as any).from("leads").select("id, full_name").in("id", leadIds);
        leadMap = new Map((leadRows ?? []).map((l: { id: string; full_name: string }) => [l.id, l.full_name]));
      }

      // Batch-resolve case codes + client names
      const caseIds = Array.from(new Set(rows.map((r: { case_id: string | null }) => r.case_id).filter(Boolean) as string[]));
      let caseMap = new Map<string, { code: string; client: string }>();
      if (caseIds.length > 0) {
        const { data: caseRows } = await supabase.from("cases").select("id, case_code, client_id").in("id", caseIds);
        const clientIds = Array.from(new Set((caseRows ?? []).map((c) => c.client_id)));
        const { data: clientRows } = clientIds.length
          ? await supabase.from("clients").select("id, full_name").in("id", clientIds)
          : { data: [] };
        const clientMap = new Map((clientRows ?? []).map((c) => [c.id, c.full_name]));
        caseMap = new Map(
          (caseRows ?? []).map((c) => [c.id, { code: c.case_code ?? c.id.slice(0, 8), client: clientMap.get(c.client_id) ?? "—" }]),
        );
      }

      return rows.map((t: {
        id: string; title: string; description: string | null; due_at: string | null;
        priority: string; status_code: string; source: string | null; completed_at: string | null;
        lead_id: string | null; case_id: string | null; assigned_to: string | null; created_at: string;
      }) => ({
        ...t,
        assignee_name: t.assigned_to ? staffMap.get(t.assigned_to) ?? "Unknown" : null,
        lead_name: t.lead_id ? leadMap.get(t.lead_id) ?? null : null,
        case_info: t.case_id ? caseMap.get(t.case_id) ?? null : null,
      }));
    },
  });

  const completeTask = async (id: string) => {
    const task = tasks?.find((t) => t.id === id);
    const patch = { status_code: "done", completed_at: new Date().toISOString() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("tasks").update(patch as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    void writeAudit({ action: "STATUS_CHANGE", entity_type: "tasks", entity_id: id, changes: patch });
    void writeTimeline({
      event_type: "task_completed",
      title: `Task completed: ${task?.title ?? id}`,
      lead_id: task?.lead_id ?? null,
      case_id: task?.case_id ?? null,
      is_system: true,
    });
    void qc.invalidateQueries({ queryKey: ["tasks-list"] });
    void qc.invalidateQueries({ queryKey: ["sidebar-badge-counts"] });
    toast.success("Task marked complete");
  };

  const reopenTask = async (id: string) => {
    const patch = { status_code: "open", completed_at: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("tasks").update(patch as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    void writeAudit({ action: "STATUS_CHANGE", entity_type: "tasks", entity_id: id, changes: patch });
    void qc.invalidateQueries({ queryKey: ["tasks-list"] });
    void qc.invalidateQueries({ queryKey: ["sidebar-badge-counts"] });
    toast.success("Task reopened");
  };

  const overdueCt = tasks?.filter((t) => !t.completed_at && t.due_at && new Date(t.due_at) < new Date()).length ?? 0;

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="Open work across the team"
        actions={
          <Button onClick={() => setOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-1.5" /> New Task
          </Button>
        }
      />

      <div className="p-6 space-y-4 max-w-[1400px]">
        {/* Summary bar */}
        {!showCompleted && overdueCt > 0 && (
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-sm cursor-pointer hover:bg-destructive/15 transition-colors"
            onClick={() => setFilter("overdue")}
          >
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-destructive font-medium">{overdueCt} overdue {overdueCt === 1 ? "task" : "tasks"}</span>
            <span className="text-muted-foreground">— click to filter</span>
          </div>
        )}

        {/* Filter bar */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Mode toggle */}
          <div className="flex rounded-full border border-border overflow-hidden text-xs">
            <button
              onClick={() => { setShowCompleted(false); setFilter("all"); }}
              className={`px-3 py-1.5 font-medium transition-colors ${!showCompleted ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Open
            </button>
            <button
              onClick={() => { setShowCompleted(true); setFilter("all"); }}
              className={`px-3 py-1.5 font-medium transition-colors ${showCompleted ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Completed
            </button>
          </div>

          {/* Date filters (only for open) */}
          {!showCompleted && (
            <div className="flex flex-wrap gap-1.5">
              {([
                ["all", "All open"],
                ["overdue", "Overdue"],
                ["today", "Today"],
                ["week", "This week"],
                ["mine", "Mine"],
                ["unassigned", "Unassigned"],
              ] as [FilterKey, string][]).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    filter === k
                      ? "bg-navy text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          )}

          {/* Staff dropdown */}
          {(profile?.role === "owner" || profile?.role === "admin" || profile?.role === "senior_advisor") && (
            <div className="ml-auto">
              <Select value={staffFilter} onValueChange={setStaffFilter}>
                <SelectTrigger className="h-8 text-xs w-44">
                  <User className="h-3 w-3 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="All staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All staff</SelectItem>
                  {staff?.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="card-surface overflow-hidden">
          {isLoading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : !tasks?.length ? (
            <div className="p-14 text-center">
              <CheckSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {showCompleted ? "No completed tasks in this view." : "All clear — no tasks match."}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-8 px-4 py-3" />
                  <th className="text-left px-4 py-3 font-medium">Task</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Linked to</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Assigned</th>
                  <th className="text-left px-4 py-3 font-medium">Due</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Priority</th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const now = new Date();
                  const overdue = !t.completed_at && t.due_at && new Date(t.due_at) < now;
                  const isEngine = t.source === "engine";
                  return (
                    <tr key={t.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                      {/* Checkbox */}
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={!!t.completed_at}
                          onChange={() => t.completed_at ? reopenTask(t.id) : completeTask(t.id)}
                          className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                        />
                      </td>

                      {/* Title + description */}
                      <td className="px-4 py-3 max-w-xs">
                        <div className={`font-medium leading-snug ${t.completed_at ? "line-through text-muted-foreground" : ""}`}>
                          {t.title}
                        </div>
                        {t.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.description}</div>
                        )}
                        {isEngine && (
                          <span className="inline-flex items-center gap-0.5 mt-0.5 text-[10px] text-muted-foreground/60">
                            <Tag className="h-2.5 w-2.5" /> auto
                          </span>
                        )}
                      </td>

                      {/* Linked entity */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        {t.case_info ? (
                          <Link to={`/cases/${t.case_id}`} className="text-xs text-accent hover:underline">
                            {t.case_info.client} · {t.case_info.code}
                          </Link>
                        ) : t.lead_name ? (
                          <Link to={`/leads/${t.lead_id}`} className="text-xs text-accent hover:underline">
                            {t.lead_name}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Assignee */}
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                        {t.assignee_name ?? <span className="italic">Unassigned</span>}
                      </td>

                      {/* Due */}
                      <td className="px-4 py-3 text-xs">
                        {t.completed_at ? (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {fmtRelative(t.completed_at)}
                          </span>
                        ) : t.due_at ? (
                          <span className={overdue ? "text-destructive font-medium flex items-center gap-1" : "text-muted-foreground"}>
                            {overdue && <AlertCircle className="h-3 w-3 shrink-0" />}
                            {overdue ? `Overdue ${fmtRelative(t.due_at)}` : fmtDateTimeIST(t.due_at)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize ${PRIORITY_COLOR[t.priority] ?? PRIORITY_COLOR.normal}`}>
                          {t.priority}
                        </span>
                      </td>

                      {/* Mark done / Reopen */}
                      <td className="px-4 py-3 text-right">
                        {t.completed_at ? (
                          <button
                            onClick={() => reopenTask(t.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground bg-muted hover:bg-muted/80 transition-colors"
                          >
                            <RotateCcw className="h-3 w-3" /> Reopen
                          </button>
                        ) : (
                          <button
                            onClick={() => completeTask(t.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                          >
                            <Check className="h-3 w-3" /> Done
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {tasks && tasks.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">{tasks.length} task{tasks.length !== 1 ? "s" : ""} shown</p>
        )}
      </div>

      <NewTaskDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => {
          void qc.invalidateQueries({ queryKey: ["tasks-list"] });
          void qc.invalidateQueries({ queryKey: ["sidebar-badge-counts"] });
        }}
      />
    </div>
  );
}
