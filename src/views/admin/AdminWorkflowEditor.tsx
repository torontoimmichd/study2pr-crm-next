"use client";

import { useMemo, useState } from "react";
import { useParams, Link } from "@/lib/router-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Clock,
  UserCircle2,
  ShieldCheck,
  History,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StepTemplateDialog } from "@/components/StepTemplateDialog";
import { StepConditionsPopover } from "@/components/StepConditionsPopover";
import { writeAudit } from "@/lib/audit";
import { fmtDateTimeIST, fmtRelative } from "@/lib/format";
import { toast } from "sonner";
import type { StepTemplate } from "@/views/Workflows";

const STEP_TYPE_BADGE: Record<string, string> = {
  task: "bg-primary/10 text-primary",
  document: "bg-accent/10 text-accent",
  email: "bg-blue-500/10 text-blue-700",
  wait: "bg-muted text-muted-foreground",
  condition: "bg-amber-500/10 text-amber-700",
};

interface SubTypeRow {
  id: string;
  code: string;
  label: string;
  visa_type_id: string | null;
}
interface VisaTypeRow {
  id: string;
  code: string;
  label: string;
  category: string;
}
interface EditProposal {
  id: string;
  step_template_id: string | null;
  status: string | null;
  proposed_at: string | null;
  proposed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  applied_version: number | null;
  proposed_change: unknown;
}

function SortableStepRow({
  step,
  onEdit,
  onDelete,
  slaLabel,
  conditionCount,
}: {
  step: StepTemplate;
  onEdit: (s: StepTemplate) => void;
  onDelete: (s: StepTemplate) => void;
  slaLabel?: string;
  conditionCount?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const stepType = step.step_type ?? "task";
  const badgeCls = STEP_TYPE_BADGE[stepType] ?? STEP_TYPE_BADGE.task;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 p-3 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground mt-1"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-muted-foreground">
            {String(step.sort_order ?? 0).padStart(2, "0")}
          </span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide ${badgeCls}`}>
            {stepType}
          </span>
          <span className="font-medium text-navy">{step.title}</span>
          <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
            {step.step_code}
          </code>
          {!step.is_active && (
            <Badge variant="secondary" className="text-[10px]">
              inactive
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            v{step.version ?? 1}
          </Badge>
        </div>
        {step.description && (
          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{step.description}</div>
        )}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1.5 flex-wrap">
          {step.assigned_role && (
            <span className="inline-flex items-center gap-1">
              <UserCircle2 className="h-3 w-3" /> {step.assigned_role.replace(/_/g, " ")}
            </span>
          )}
          {step.due_offset_days != null && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> Due +{step.due_offset_days}d
            </span>
          )}
          {slaLabel && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> SLA: {slaLabel}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <StepConditionsPopover stepId={step.id} stepTitle={step.title} count={conditionCount ?? 0} />
        <Button size="sm" variant="ghost" onClick={() => onEdit(step)} title="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(step)}
          title="Delete"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function AdminWorkflowEditor() {
  const { subTypeId } = useParams<{ subTypeId: string }>();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<StepTemplate | null>(null);
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StepTemplate | null>(null);

  const subTypeQ = useQuery({
    queryKey: ["admin-wfedit-sub-type", subTypeId],
    enabled: !!subTypeId,
    queryFn: async (): Promise<SubTypeRow | null> => {
      const { data, error } = await supabase
        .from("visa_sub_types")
        .select("id, code, label, visa_type_id")
        .eq("id", subTypeId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as SubTypeRow | null;
    },
  });

  const visaTypeQ = useQuery({
    queryKey: ["admin-wfedit-visa-type", subTypeQ.data?.visa_type_id],
    enabled: !!subTypeQ.data?.visa_type_id,
    queryFn: async (): Promise<VisaTypeRow | null> => {
      const { data, error } = await supabase
        .from("visa_types")
        .select("id, code, label, category")
        .eq("id", subTypeQ.data!.visa_type_id!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as VisaTypeRow | null;
    },
  });

  const stepsQ = useQuery({
    queryKey: ["admin-wfedit-steps", subTypeId],
    enabled: !!subTypeId,
    queryFn: async (): Promise<StepTemplate[]> => {
      const { data, error } = await supabase
        .from("step_templates")
        .select(
          "id, step_code, title, description, assigned_role, sla_rule_code, sort_order, is_active, version, visa_sub_type_id, step_type, due_offset_days",
        )
        .eq("visa_sub_type_id", subTypeId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StepTemplate[];
    },
  });

  const slaQ = useQuery({
    queryKey: ["admin-wfedit-sla"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_rules")
        .select("code, label, target_minutes")
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const conditionsQ = useQuery({
    queryKey: ["wf_step_conditions", subTypeId],
    enabled: !!subTypeId && (stepsQ.data?.length ?? 0) > 0,
    queryFn: async () => {
      const stepIds = (stepsQ.data ?? []).map((s) => s.id);
      if (stepIds.length === 0) return [] as { step_template_id: string }[];
      const { data, error } = await supabase
        .from("step_conditions")
        .select("id, step_template_id, action, condition")
        .in("step_template_id", stepIds);
      if (error) throw error;
      return (data ?? []) as { id: string; step_template_id: string; action: string; condition: unknown }[];
    },
  });

  const proposalsQ = useQuery({
    queryKey: ["admin-wfedit-proposals", subTypeId],
    enabled: !!subTypeId && (stepsQ.data?.length ?? 0) > 0,
    queryFn: async (): Promise<EditProposal[]> => {
      const stepIds = (stepsQ.data ?? []).map((s) => s.id);
      if (stepIds.length === 0) return [];
      const { data, error } = await supabase
        .from("step_template_edits")
        .select(
          "id, step_template_id, status, proposed_at, proposed_by, reviewed_at, review_notes, applied_version, proposed_change",
        )
        .in("step_template_id", stepIds)
        .order("proposed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as EditProposal[];
    },
  });

  const slaMap = useMemo(() => {
    const m = new Map<string, string>();
    (slaQ.data ?? []).forEach((r) => {
      m.set(r.code, `${r.label} (${r.target_minutes}m)`);
    });
    return m;
  }, [slaQ.data]);

  const conditionCountByStep = useMemo(() => {
    const m = new Map<string, number>();
    (conditionsQ.data ?? []).forEach((c) => {
      m.set(c.step_template_id, (m.get(c.step_template_id) ?? 0) + 1);
    });
    return m;
  }, [conditionsQ.data]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const items = stepsQ.data ?? [];
    const oldIdx = items.findIndex((s) => s.id === active.id);
    const newIdx = items.findIndex((s) => s.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(items, oldIdx, newIdx);

    qc.setQueryData(["admin-wfedit-steps", subTypeId], reordered);

    const updates = reordered.map((s, i) => ({ id: s.id, sort_order: i + 1 }));
    for (const u of updates) {
      const { error } = await supabase
        .from("step_templates")
        .update({ sort_order: u.sort_order } as never)
        .eq("id", u.id);
      if (error) {
        toast.error("Reorder failed", { description: error.message });
        void qc.invalidateQueries({ queryKey: ["admin-wfedit-steps", subTypeId] });
        return;
      }
    }
    void writeAudit({
      action: "UPDATE",
      entity_type: "step_template_order",
      entity_id: subTypeId!,
      changes: { order: updates.map((u) => u.id) },
    });
    toast.success("Order saved");
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    const { error } = await supabase.from("step_templates").delete().eq("id", id);
    if (error) {
      toast.error("Delete failed", { description: error.message });
      return;
    }
    void writeAudit({ action: "DELETE", entity_type: "step_template", entity_id: id });
    toast.success("Step deleted");
    setConfirmDelete(null);
    void qc.invalidateQueries({ queryKey: ["admin-wfedit-steps", subTypeId] });
  };

  const subTypeLabel = subTypeQ.data?.label ?? "—";
  const visaLabel = visaTypeQ.data?.label ?? "";
  const stepCount = (stepsQ.data ?? []).length;
  const maxVersion = (stepsQ.data ?? []).reduce((acc, s) => Math.max(acc, s.version ?? 1), 1);
  const pendingCount = (proposalsQ.data ?? []).filter((p) => p.status === "pending").length;

  return (
    <>
      <AdminPageHeader
        title={`Workflow: ${visaLabel ? `${visaLabel} → ${subTypeLabel}` : subTypeLabel}`}
        subtitle={
          subTypeId
            ? `${stepCount} step${stepCount === 1 ? "" : "s"} · current version ${maxVersion}`
            : undefined
        }
        breadcrumb={[
          { label: "Admin", to: "/admin" },
          { label: "Workflows", to: "/admin/workflows" },
          ...(visaTypeQ.data?.category
            ? [{ label: visaTypeQ.data.category }]
            : []),
          { label: subTypeLabel },
        ]}
        actions={
          <Button onClick={() => setCreatingOpen(true)} disabled={!subTypeId}>
            <Plus className="h-4 w-4" /> New step
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Governance callout */}
        <div className="rounded-lg border border-gold/40 bg-gradient-to-br from-gold/10 to-secondary p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-gold mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-medium text-navy">Staff Advisor governance</div>
            <p className="text-muted-foreground mt-0.5 leading-relaxed">
              Case managers can propose step edits. All non-owner edits to high-risk fields require your approval —
              typo fixes don't. Every change bumps the step version and is logged in audit.
            </p>
            {pendingCount > 0 && (
              <div className="mt-2">
                <Badge className="bg-gold/20 text-gold-foreground border-gold/30 hover:bg-gold/30">
                  {pendingCount} pending edit{pendingCount === 1 ? "" : "s"} to review
                </Badge>
              </div>
            )}
          </div>
        </div>

        <Tabs defaultValue="steps">
          <TabsList>
            <TabsTrigger value="steps">Steps ({stepCount})</TabsTrigger>
            <TabsTrigger value="history">
              Edit history{(proposalsQ.data?.length ?? 0) > 0 ? ` (${proposalsQ.data?.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="governance">Who can edit what</TabsTrigger>
          </TabsList>

          <TabsContent value="steps" className="mt-4">
            <div className="card-surface">
              <div className="px-4 py-3 border-b border-border">
                <div className="font-medium text-navy">{subTypeLabel} — workflow</div>
                <div className="text-xs text-muted-foreground">Drag the handle to reorder steps</div>
              </div>

              {stepsQ.isLoading ? (
                <TableSkeleton rows={5} cols={3} />
              ) : (stepsQ.data ?? []).length === 0 ? (
                <EmptyState
                  icon={<GitBranch className="h-5 w-5" />}
                  title="No steps yet"
                  description="Add the first step to define this workflow."
                  action={
                    <Button onClick={() => setCreatingOpen(true)}>
                      <Plus className="h-4 w-4" /> Add step
                    </Button>
                  }
                />
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={(stepsQ.data ?? []).map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {(stepsQ.data ?? []).map((s) => (
                      <SortableStepRow
                        key={s.id}
                        step={s}
                        onEdit={setEditing}
                        onDelete={setConfirmDelete}
                        slaLabel={s.sla_rule_code ? slaMap.get(s.sla_rule_code) : undefined}
                        conditionCount={conditionCountByStep.get(s.id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <div className="card-surface">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <div className="font-medium text-navy">Edit history</div>
              </div>
              {proposalsQ.isLoading ? (
                <TableSkeleton rows={3} cols={3} />
              ) : (proposalsQ.data ?? []).length === 0 ? (
                <div className="px-5 py-8 text-sm text-muted-foreground text-center">
                  No edits yet for this workflow.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {(proposalsQ.data ?? []).map((p) => (
                    <div key={p.id} className="px-4 py-3 grid grid-cols-[auto_1fr_auto] gap-3 items-center">
                      <Badge
                        variant={
                          p.status === "approved"
                            ? "default"
                            : p.status === "pending"
                            ? "secondary"
                            : "outline"
                        }
                        className="text-[10px] capitalize"
                      >
                        {p.status ?? "—"}
                      </Badge>
                      <div className="min-w-0">
                        <div className="text-sm">
                          {p.applied_version != null
                            ? `Applied as v${p.applied_version}`
                            : "Edit proposal"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {fmtRelative(p.proposed_at)}
                          {p.reviewed_at && ` · reviewed ${fmtRelative(p.reviewed_at)}`}
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {fmtDateTimeIST(p.proposed_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="governance" className="mt-4">
            <div className="card-surface overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <div className="font-medium text-navy">Propose Edit vs Direct Edit</div>
                <div className="text-xs text-muted-foreground">
                  Reference table — read-only. Reflects current RLS and approval rules.
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Role</th>
                    <th className="px-4 py-2 text-left">What they can do</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Owner", "Edit anything, publish instantly"],
                    ["Admin", "Edit anything except fees & commissions"],
                    ["Senior Advisor", "Propose step edits, add conditions"],
                    ["Case Manager", "Suggest new document checks"],
                    ["Document Specialist", "Mark docs as verified; no workflow edits"],
                    ["Support / Accountant", "View-only on workflows"],
                  ].map(([role, perm]) => (
                    <tr key={role}>
                      <td className="px-4 py-2.5 font-medium text-navy">{role}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{perm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {subTypeId && (
        <StepTemplateDialog
          open={creatingOpen || !!editing}
          onOpenChange={(o) => {
            if (!o) {
              setCreatingOpen(false);
              setEditing(null);
            }
          }}
          step={editing}
          visaSubTypeId={subTypeId}
          nextSortOrder={(stepsQ.data?.length ?? 0) + 1}
          slaRules={slaQ.data ?? []}
          onSaved={() => {
            setCreatingOpen(false);
            setEditing(null);
            void qc.invalidateQueries({ queryKey: ["admin-wfedit-steps", subTypeId] });
            void qc.invalidateQueries({ queryKey: ["admin-wfedit-proposals", subTypeId] });
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete this step?"
        description={
          confirmDelete
            ? `"${confirmDelete.title}" will be removed permanently. Existing cases mid-workflow are not affected.`
            : ""
        }
        confirmLabel="Delete step"
        destructive
        onConfirm={handleDeleteConfirmed}
      />
    </>
  );
}
