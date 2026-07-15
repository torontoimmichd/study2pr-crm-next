"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { writeAudit } from "@/lib/audit";

interface VisaSubType {
  id: string;
  code: string;
  label: string;
}

interface ChecklistItem {
  id: string;
  visa_sub_type_id: string;
  document_type: string;
  label: string;
  is_required: boolean | null;
  applies_to: string | null;
  sort_order: number | null;
  guidance_notes: string | null;
}

const APPLIES_TO_OPTIONS = ["principal", "spouse", "dependent", "all"];

export default function AdminDocumentChecklists() {
  const qc = useQueryClient();
  const [selectedSubType, setSelectedSubType] = useState<string>("");
  const [editing, setEditing] = useState<ChecklistItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<ChecklistItem | null>(null);

  const { data: subTypes } = useQuery({
    queryKey: ["admin-doc-checklists-subtypes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visa_sub_types")
        .select("id, code, label")
        .eq("is_active", true)
        .order("label");
      if (error) throw error;
      return (data ?? []) as VisaSubType[];
    },
  });

  const { data: items } = useQuery({
    queryKey: ["admin-doc-checklists", selectedSubType],
    enabled: !!selectedSubType,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_checklists")
        .select("id, visa_sub_type_id, document_type, label, is_required, applies_to, sort_order, guidance_notes")
        .eq("visa_sub_type_id", selectedSubType)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChecklistItem[];
    },
  });

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("document_checklists").delete().eq("id", deleting.id);
    if (error) {
      toast.error("Delete failed: " + error.message);
      return;
    }
    await writeAudit({ action: "DELETE", entity_type: "document_checklists", entity_id: deleting.id, changes: { label: deleting.label } });
    toast.success("Document removed");
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["admin-doc-checklists", selectedSubType] });
  };

  return (
    <>
      <AdminPageHeader
        title="Document Checklists"
        subtitle="Required documents per visa sub-type. Drives the document tab on every case."
        actions={
          <Button size="sm" onClick={() => setAdding(true)} disabled={!selectedSubType}>
            <Plus className="h-4 w-4" /> Add Document
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        <div className="card-surface p-4">
          <Label className="text-xs text-muted-foreground">Visa sub-type</Label>
          <Select value={selectedSubType} onValueChange={setSelectedSubType}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Choose a sub-type to view its checklist…" />
            </SelectTrigger>
            <SelectContent>
              {subTypes?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="font-mono text-xs mr-2 opacity-60">{s.code}</span>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!selectedSubType ? (
          <div className="card-surface p-12 text-center text-sm text-muted-foreground">
            <FileCheck2 className="h-6 w-6 mx-auto mb-3 opacity-40" />
            Select a visa sub-type above to view or edit its document checklist.
          </div>
        ) : (
          <div className="card-surface overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Applies To</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!items || items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                      No documents configured for this sub-type yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-mono text-xs">{it.document_type}</TableCell>
                      <TableCell className="font-medium">
                        <div>{it.label}</div>
                        {it.guidance_notes && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{it.guidance_notes}</div>
                        )}
                      </TableCell>
                      <TableCell className="capitalize text-sm">{it.applies_to ?? "principal"}</TableCell>
                      <TableCell>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${it.is_required ? "bg-warning/15 text-warning-foreground border border-warning/30" : "bg-muted text-muted-foreground"}`}>
                          {it.is_required ? "Required" : "Optional"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(it)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleting(it)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {(editing || adding) && selectedSubType && (
        <ChecklistDialog
          item={editing}
          subTypeId={selectedSubType}
          open
          onClose={() => {
            setEditing(null);
            setAdding(false);
          }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-doc-checklists", selectedSubType] })}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Remove ${deleting?.label}?`}
        description="New cases for this sub-type will no longer require this document. Existing case requirements stay."
        confirmLabel="Remove"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}

function ChecklistDialog({
  item,
  subTypeId,
  open,
  onClose,
  onSaved,
}: {
  item: ChecklistItem | null;
  subTypeId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;
  const [docType, setDocType] = useState(item?.document_type ?? "");
  const [label, setLabel] = useState(item?.label ?? "");
  const [appliesTo, setAppliesTo] = useState(item?.applies_to ?? "principal");
  const [isRequired, setIsRequired] = useState(item?.is_required ?? true);
  const [notes, setNotes] = useState(item?.guidance_notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!docType.trim() || !label.trim()) {
      toast.error("Type and label required");
      return;
    }
    setSaving(true);
    const payload = {
      document_type: docType.trim(),
      label: label.trim(),
      applies_to: appliesTo,
      is_required: isRequired,
      guidance_notes: notes.trim() || null,
      visa_sub_type_id: subTypeId,
    };
    if (isEdit) {
      const { error } = await supabase.from("document_checklists").update(payload).eq("id", item!.id);
      if (error) {
        toast.error("Save failed: " + error.message);
        setSaving(false);
        return;
      }
      await writeAudit({ action: "UPDATE", entity_type: "document_checklists", entity_id: item!.id, changes: payload });
      toast.success("Document updated");
    } else {
      const { data, error } = await supabase.from("document_checklists").insert(payload).select("id").single();
      if (error) {
        toast.error("Create failed: " + error.message);
        setSaving(false);
        return;
      }
      await writeAudit({ action: "CREATE", entity_type: "document_checklists", entity_id: data.id, changes: payload });
      toast.success("Document added");
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit: ${item!.label}` : "Add Required Document"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Document Type (code)</Label>
              <Input value={docType} onChange={(e) => setDocType(e.target.value)} placeholder="passport" />
            </div>
            <div>
              <Label>Applies To</Label>
              <Select value={appliesTo} onValueChange={setAppliesTo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APPLIES_TO_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Valid passport (all pages)" />
          </div>
          <div>
            <Label>Guidance Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional staff/client guidance shown on the case page." rows={3} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isRequired} onCheckedChange={setIsRequired} id="req" />
            <Label htmlFor="req" className="cursor-pointer">Required</Label>
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
