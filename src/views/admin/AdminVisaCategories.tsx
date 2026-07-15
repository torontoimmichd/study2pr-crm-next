"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, FolderTree } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { writeAudit } from "@/lib/audit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface VisaCategory {
  id: string;
  code: string;
  label: string;
  sort_order: number | null;
  is_active: boolean | null;
}

export default function AdminVisaCategories() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<VisaCategory | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<VisaCategory | null>(null);

  const { data: cats, isLoading } = useQuery({
    queryKey: ["admin-visa-categories"],
    queryFn: async () => {
      const { data, error } = await db
        .from("visa_categories")
        .select("id, code, label, sort_order, is_active")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VisaCategory[];
    },
  });

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await db.from("visa_categories").delete().eq("id", deleting.id);
    if (error) {
      toast.error("Delete failed: " + error.message);
      return;
    }
    await writeAudit({ action: "DELETE", entity_type: "visa_categories", entity_id: deleting.id, changes: { code: deleting.code } });
    toast.success("Category removed");
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["admin-visa-categories"] });
  };

  return (
    <>
      <AdminPageHeader
        title="Visa Categories"
        subtitle="The top level of your visa menu — e.g. Study, Visit, Work, PR, VAS. Shared across all countries. Add new categories anytime."
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add Category
          </Button>
        }
      />

      <div className="p-6">
        <div className="card-surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Order</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Loading…</TableCell>
                </TableRow>
              )}
              {!isLoading && (!cats || cats.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    <FolderTree className="h-5 w-5 mx-auto mb-2 opacity-40" />
                    No categories yet.
                  </TableCell>
                </TableRow>
              )}
              {(cats ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.code}</TableCell>
                  <TableCell className="font-medium">{c.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.sort_order ?? "—"}</TableCell>
                  <TableCell>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${c.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                      {c.is_active ? "Active" : "Paused"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleting(c)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {(editing || adding) && (
        <CategoryDialog
          category={editing}
          open
          onClose={() => { setEditing(null); setAdding(false); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-visa-categories"] })}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Remove ${deleting?.label}?`}
        description="Sub-types under this category will simply become uncategorised. You can re-assign them later."
        confirmLabel="Remove"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}

function CategoryDialog({
  category, open, onClose, onSaved,
}: {
  category: VisaCategory | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!category;
  const [code, setCode] = useState(category?.code ?? "");
  const [label, setLabel] = useState(category?.label ?? "");
  const [sortOrder, setSortOrder] = useState(category?.sort_order?.toString() ?? "100");
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!code.trim() || !label.trim()) { toast.error("Code and label are required"); return; }
    setSaving(true);
    const payload = {
      code: code.trim().toLowerCase().replace(/\s+/g, "_"),
      label: label.trim(),
      sort_order: sortOrder ? Number(sortOrder) : 100,
      is_active: isActive,
    };
    if (isEdit) {
      const { error } = await db.from("visa_categories").update({ label: payload.label, sort_order: payload.sort_order, is_active: payload.is_active }).eq("id", category!.id);
      if (error) { toast.error("Save failed: " + error.message); setSaving(false); return; }
      await writeAudit({ action: "UPDATE", entity_type: "visa_categories", entity_id: category!.id, changes: payload });
      toast.success("Category updated");
    } else {
      const { data, error } = await db.from("visa_categories").insert(payload).select("id").single();
      if (error) { toast.error("Create failed: " + error.message); setSaving(false); return; }
      await writeAudit({ action: "CREATE", entity_type: "visa_categories", entity_id: data.id, changes: payload });
      toast.success("Category added");
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit: ${category!.label}` : "Add Visa Category"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} disabled={isEdit} placeholder="study" />
            <p className="text-[11px] text-muted-foreground mt-1">Lowercase key used internally, e.g. study, visit, work, pr, vas.</p>
          </div>
          <div>
            <Label>Display label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Study" />
          </div>
          <div>
            <Label>Sort order</Label>
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="100" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="cat-active" />
            <Label htmlFor="cat-active" className="cursor-pointer">Active</Label>
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
