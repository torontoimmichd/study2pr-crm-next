"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Layers, GripVertical } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { writeAudit } from "@/lib/audit";

interface LeadSource {
  code: string;
  label: string;
  sort_order: number | null;
  is_active: boolean | null;
}

export default function AdminLeadSources() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<LeadSource | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<LeadSource | null>(null);

  const { data: sources } = useQuery({
    queryKey: ["admin-lead-sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_sources")
        .select("code, label, sort_order, is_active")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LeadSource[];
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id || !sources) return;
    const oldIdx = sources.findIndex((s) => s.code === active.id);
    const newIdx = sources.findIndex((s) => s.code === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(sources, oldIdx, newIdx);
    qc.setQueryData(["admin-lead-sources"], reordered);
    // persist new sort_order
    const updates = reordered.map((s, i) => ({ code: s.code, label: s.label, sort_order: i }));
    const { error } = await supabase.from("lead_sources").upsert(updates, { onConflict: "code" });
    if (error) {
      toast.error("Reorder failed: " + error.message);
      qc.invalidateQueries({ queryKey: ["admin-lead-sources"] });
      return;
    }
    await writeAudit({ action: "UPDATE", entity_type: "lead_sources", entity_id: "reorder", changes: { count: updates.length } });
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("lead_sources").delete().eq("code", deleting.code);
    if (error) {
      toast.error("Delete failed: " + error.message);
      return;
    }
    await writeAudit({ action: "DELETE", entity_type: "lead_sources", entity_id: deleting.code, changes: { label: deleting.label } });
    toast.success("Lead source removed");
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["admin-lead-sources"] });
  };

  return (
    <>
      <AdminPageHeader
        title="Lead Sources"
        subtitle="Where leads come from. Order here controls dropdown order in the New Lead modal and reports."
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add Source
          </Button>
        }
      />

      <div className="p-6">
        <div className="card-surface overflow-hidden">
          {!sources || sources.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <Layers className="h-5 w-5 mx-auto mb-2 opacity-40" />
              No lead sources yet.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sources.map((s) => s.code)} strategy={verticalListSortingStrategy}>
                <ul>
                  {sources.map((s) => (
                    <SortableSourceRow
                      key={s.code}
                      source={s}
                      onEdit={() => setEditing(s)}
                      onDelete={() => setDeleting(s)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {(editing || adding) && (
        <LeadSourceDialog
          source={editing}
          open
          onClose={() => {
            setEditing(null);
            setAdding(false);
          }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-lead-sources"] })}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Remove ${deleting?.label}?`}
        description="Existing leads keep their source reference. New leads will no longer see this option."
        confirmLabel="Remove"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}

function SortableSourceRow({
  source,
  onEdit,
  onDelete,
}: {
  source: LeadSource;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: source.code,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/30"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        aria-label="Drag"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="font-mono text-xs text-muted-foreground w-24 truncate">{source.code}</div>
      <div className="font-medium flex-1">{source.label}</div>
      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${source.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
        {source.is_active ? "Active" : "Paused"}
      </span>
      <Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
      <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
    </li>
  );
}

function LeadSourceDialog({
  source,
  open,
  onClose,
  onSaved,
}: {
  source: LeadSource | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!source;
  const [code, setCode] = useState(source?.code ?? "");
  const [label, setLabel] = useState(source?.label ?? "");
  const [isActive, setIsActive] = useState(source?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!code.trim() || !label.trim()) {
      toast.error("Code and label required");
      return;
    }
    setSaving(true);
    const payload = { code: code.trim(), label: label.trim(), is_active: isActive };
    if (isEdit) {
      const { error } = await supabase.from("lead_sources").update(payload).eq("code", source!.code);
      if (error) {
        toast.error("Save failed: " + error.message);
        setSaving(false);
        return;
      }
      await writeAudit({ action: "UPDATE", entity_type: "lead_sources", entity_id: source!.code, changes: payload });
      toast.success("Source updated");
    } else {
      const { error } = await supabase.from("lead_sources").insert(payload);
      if (error) {
        toast.error("Create failed: " + error.message);
        setSaving(false);
        return;
      }
      await writeAudit({ action: "CREATE", entity_type: "lead_sources", entity_id: payload.code, changes: payload });
      toast.success("Source created");
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit: ${source!.label}` : "Add Lead Source"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} disabled={isEdit} placeholder="WEBSITE" />
          </div>
          <div>
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Website Form" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="src-active" />
            <Label htmlFor="src-active" className="cursor-pointer">Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
