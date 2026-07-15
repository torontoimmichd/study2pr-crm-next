"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Clock,
  UserCircle2,
  History,
  Layers,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StepTemplateDialog } from "@/components/StepTemplateDialog";
import { StepConditionsPopover } from "@/components/StepConditionsPopover";
import { writeAudit } from "@/lib/audit";
import { fmtDateTimeIST } from "@/lib/format";
import { toast } from "sonner";

type VisaType = { id: string; code: string; label: string };
type VisaSubType = { id: string; code: string; label: string; visa_type_id: string | null };

export type StepTemplate = {
  id: string;
  step_code: string;
  title: string;
  description: string | null;
  assigned_role: string | null;
  sla_rule_code: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  version: number | null;
  visa_sub_type_id: string | null;
  step_type: string | null;
  due_offset_days: number | null;
};

type EditProposal = {
  id: string;
  step_template_id: string | null;
  status: string | null;
  proposed_at: string | null;
  proposed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  applied_version: number | null;
  proposed_change: unknown;
};

const STEP_TYPE_BADGE: Record<string, string> = {
  task: "bg-primary/10 text-primary",
  document: "bg-accent/10 text-accent",
  email: "bg-blue-500/10 text-blue-700",
  wait: "bg-muted text-muted-foreground",
  condition: "bg-amber-500/10 text-amber-700",
};

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
          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {step.description}
          </div>
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

export default function Workflows() {
  const qc = useQueryClient();

  const [visaTypeId, setVisaTypeId] = useState<string>("");
  const [subTypeId, setSubTypeId] = useState<string>("");
  const [editing, setEditing] = useState<StepTemplate | null>(null);
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StepTemplate | null>(null);

  const visaTypesQ = useQuery({
    queryKey: ["wf_visa_types"],
    queryFn: async (): Promise<VisaType[]> => {
      const { data, error } = await supabase
        .from("visa_types")
        .select("id, code, label")
        .eq("is_active", true)
        .order("label");
      if (error) throw error;
      return (data ?? []) as VisaType[];
    },
  });

  const subTypesQ = useQuery({
    queryKey: ["wf_visa_sub_types", visaTypeId],
    enabled: !!visaTypeId,
    queryFn: async (): Promise<VisaSubType[]> => {
      const { data, error } = await supabase
        .from("visa_sub_types")
        .select("id, code, label, visa_type_id")
        .eq("visa_type_id", visaTypeId)
        .eq("is_active", true)
        .order("label");
      if (error) throw error;
      return (data ?? []) as VisaSubType[];
    },
  });

  const stepsQ = useQuery({
    queryKey: ["wf_steps", subTypeId],
    enabled: !!subTypeId,
    queryFn: async (): Promise<StepTemplate[]> => {
      const { data, error } = await supabase
        .from("step_templates")
        .select(
          "id, step_code, title, description, assigned_role, sla_rule_code, sort_order, is_active, version, visa_sub_type_id, step_type, due_offset_days",
        )
        .eq("visa_sub_type_id", subTypeId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StepTemplate[];
    },
  });

  const slaQ = useQuery({
    queryKey: ["wf_sla_rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_rules")
        .select("code, label, target_minutes")
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const proposalsQ = useQuery({
    queryKey: ["wf_proposals", subTypeId],
    enabled: !!subTypeId,
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

  const triggersQ = useQuery({
    queryKey: ["wf_triggers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("upsell_triggers")
        .select("code, label, description, trigger_condition, offer_visa_code, delay_days, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Auto-create a default sub-type for a visa type that has none
  const createDefaultSubType = useMutation({
    mutationFn: async () => {
      const vtLabel = visaTypesQ.data?.find((v) => v.id === visaTypeId)?.label ?? "Standard";
      const vtCode  = visaTypesQ.data?.find((v) => v.id === visaTypeId)?.code ?? "std";
      const subCode = `${vtCode}_default`.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      const { data, error } = await supabase
        .from("visa_sub_types")
        .insert({
          visa_type_id: visaTypeId,
          label: `${vtLabel} — Standard`,
          code: subCode,
          is_active: true,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: async (data) => {
      toast.success("Default sub-type created — you can now add workflow steps.");
      await qc.invalidateQueries({ queryKey: ["wf_visa_sub_types", visaTypeId] });
      setSubTypeId(data.id);
    },
    onError: (err: Error) => {
      toast.error("Could not create sub-type", { description: err.message });
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

    // optimistic
    qc.setQueryData(["wf_steps", subTypeId], reordered);

    // persist new sort_order
    const updates = reordered.map((s, i) => ({ id: s.id, sort_order: i + 1 }));
    for (const u of updates) {
      const { error } = await supabase
        .from("step_templates")
        .update({ sort_order: u.sort_order } as never)
        .eq("id", u.id);
      if (error) {
        toast.error("Reorder failed", { description: error.message });
        void qc.invalidateQueries({ queryKey: ["wf_steps", subTypeId] });
        return;
      }
    }
    void writeAudit({
      action: "UPDATE",
      entity_type: "step_template_order",
      entity_id: subTypeId,
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
    void qc.invalidateQueries({ queryKey: ["wf_steps", subTypeId] });
  };

  const subTypeLabel = subTypesQ.data?.find((s) => s.id === subTypeId)?.label;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <header>
        <h1 className="font-display text-3xl">Workflows</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Step templates per visa sub-type. Drag to reorder, edit titles, assign roles, and set SLA targets.
        </p>
      </header>

      {/* Visa selector */}
      <div className="card-surface p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">
            Visa type
          </label>
          <Select
            value={visaTypeId}
            onValueChange={(v) => {
              setVisaTypeId(v);
              setSubTypeId("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a visa type…" />
            </SelectTrigger>
            <SelectContent>
              {(visaTypesQ.data ?? []).map((vt) => (
                <SelectItem key={vt.id} value={vt.id}>
                  {vt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">
            Sub-type / stream
          </label>
          <Select
            value={subTypeId}
            onValueChange={setSubTypeId}
            disabled={!visaTypeId || (subTypesQ.data ?? []).length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  !visaTypeId
                    ? "Pick a visa type first"
                    : subTypesQ.isLoading
                    ? "Loading…"
                    : (subTypesQ.data ?? []).length === 0
                    ? "No sub-types — see below"
                    : "Select a sub-type…"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {(subTypesQ.data ?? []).map((st) => (
                <SelectItem key={st.id} value={st.id}>
                  {st.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreatingOpen(true)} disabled={!subTypeId}>
          <Plus className="h-4 w-4" /> New step
        </Button>
      </div>

      {/* No visa type selected yet */}
      {!visaTypeId ? (
        <div className="card-surface">
          <EmptyState
            icon={<GitBranch className="h-5 w-5" />}
            title="Select a visa type"
            description="Pick a visa type above to view or build its workflow steps."
          />
        </div>
      ) : subTypesQ.isLoading ? (
        <div className="card-surface p-8 flex items-center justify-center">
          <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (subTypesQ.data ?? []).length === 0 ? (
        /* Visa type selected but no sub-types exist — offer to create a default */
        <div className="card-surface">
          <div className="p-8 flex flex-col items-center gap-4 text-center max-w-md mx-auto">
            <div className="h-12 w-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
              <Layers className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-display text-lg text-navy">No sub-types configured</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This visa type doesn't have any sub-types or streams yet. Workflow steps are
                organised under sub-types. You can create a default "Standard" sub-type now and
                start adding steps immediately — or add named streams (e.g. "FSW", "CEC") from{" "}
                <strong>Admin → Visa Types</strong> for more granular workflows.
              </p>
            </div>
            <Button
              onClick={() => createDefaultSubType.mutate()}
              disabled={createDefaultSubType.isPending}
            >
              {createDefaultSubType.isPending ? (
                "Creating…"
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Create "Standard" sub-type &amp; start building
                </>
              )}
            </Button>
          </div>
        </div>
      ) : !subTypeId ? (
        <div className="card-surface">
          <EmptyState
            icon={<GitBranch className="h-5 w-5" />}
            title="Pick a sub-type"
            description="Choose a sub-type / stream above to view and edit its workflow steps."
          />
        </div>
      ) : (
        <Tabs defaultValue="steps">
          <TabsList>
            <TabsTrigger value="steps">Steps</TabsTrigger>
            <TabsTrigger value="triggers">Triggers ({(triggersQ.data ?? []).length})</TabsTrigger>
            <TabsTrigger value="history">Edit history</TabsTrigger>
          </TabsList>

          <TabsContent value="steps" className="mt-4">
            <div className="card-surface">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <div className="font-medium text-navy">{subTypeLabel} — workflow</div>
                  <div className="text-xs text-muted-foreground">
                    {(stepsQ.data ?? []).length} steps · drag the handle to reorder
                  </div>
                </div>
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

          <TabsContent value="triggers" className="mt-4">
            <div className="card-surface">
              <div className="px-4 py-3 border-b border-border">
                <div className="font-medium text-navy">What fires this workflow</div>
                <div className="text-xs text-muted-foreground">
                  Active upsell &amp; automation triggers that can spawn tasks against cases on this workflow.
                </div>
              </div>
              {triggersQ.isLoading ? (
                <TableSkeleton rows={3} cols={3} />
              ) : (triggersQ.data ?? []).length === 0 ? (
                <EmptyState
                  icon={<GitBranch className="h-5 w-5" />}
                  title="No active triggers"
                  description="Configure upsell triggers in Settings → Upsell triggers."
                />
              ) : (
                <div className="divide-y divide-border">
                  {(triggersQ.data ?? []).map((t) => (
                    <div key={t.code} className="p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-navy">{t.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          <code className="font-mono">{t.code}</code>
                          {t.offer_visa_code && <> · offers <code className="font-mono">{t.offer_visa_code}</code></>}
                          {(t.delay_days ?? 0) > 0 && <> · delay {t.delay_days}d</>}
                        </div>
                        {t.description && (
                          <div className="text-xs text-foreground/70 mt-1">{t.description}</div>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">active</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <div className="card-surface">
              <div className="px-4 py-3 border-b border-border">
                <div className="font-medium text-navy">Recent edit proposals</div>
                <div className="text-xs text-muted-foreground">
                  Versioned changes to step templates for this sub-type.
                </div>
              </div>
              {proposalsQ.isLoading ? (
                <TableSkeleton rows={4} cols={4} />
              ) : (proposalsQ.data ?? []).length === 0 ? (
                <EmptyState
                  icon={<History className="h-5 w-5" />}
                  title="No proposals yet"
                  description="Edits made to steps via the proposal flow will appear here."
                />
              ) : (
                <div className="divide-y divide-border">
                  {(proposalsQ.data ?? []).map((p) => {
                    const stepTitle =
                      (stepsQ.data ?? []).find((s) => s.id === p.step_template_id)?.title ?? "—";
                    return (
                      <div key={p.id} className="p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-navy">{stepTitle}</div>
                          <div className="text-xs text-muted-foreground">
                            {fmtDateTimeIST(p.proposed_at)} · v{p.applied_version ?? "—"}
                          </div>
                          {p.review_notes && (
                            <div className="text-xs text-foreground/70 mt-1 italic">"{p.review_notes}"</div>
                          )}
                        </div>
                        <Badge
                          variant={
                            p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "secondary"
                          }
                          className="capitalize shrink-0"
                        >
                          {p.status ?? "pending"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      <StepTemplateDialog
        open={creatingOpen || !!editing}
        onOpenChange={(v) => {
          if (!v) {
            setCreatingOpen(false);
            setEditing(null);
          }
        }}
        step={editing}
        visaSubTypeId={subTypeId}
        nextSortOrder={((stepsQ.data ?? []).at(-1)?.sort_order ?? 0) + 1}
        slaRules={slaQ.data ?? []}
        onSaved={() => {
          setCreatingOpen(false);
          setEditing(null);
          void qc.invalidateQueries({ queryKey: ["wf_steps", subTypeId] });
        }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Delete step?"
        description={`"${confirmDelete?.title ?? ""}" will be permanently removed from this workflow.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
