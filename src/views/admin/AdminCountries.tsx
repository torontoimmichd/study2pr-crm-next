"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Globe } from "lucide-react";
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

interface Country {
  code: string;
  label: string;
  sort_order: number | null;
  is_active: boolean | null;
}

export default function AdminCountries() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Country | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Country | null>(null);

  const { data: countries, isLoading } = useQuery({
    queryKey: ["admin-countries"],
    queryFn: async () => {
      const { data, error } = await db
        .from("countries")
        .select("code, label, sort_order, is_active")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Country[];
    },
  });

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await db.from("countries").delete().eq("code", deleting.code);
    if (error) {
      toast.error("Delete failed: " + error.message);
      return;
    }
    await writeAudit({ action: "DELETE", entity_type: "countries", entity_id: deleting.code, changes: { label: deleting.label } });
    toast.success("Country removed");
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["admin-countries"] });
  };

  return (
    <>
      <AdminPageHeader
        title="Countries"
        subtitle="Destination countries your firm handles. Each visa sub-type belongs to one country. Add or pause countries anytime."
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add Country
          </Button>
        }
      />

      <div className="p-6">
        <div className="card-surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Country</TableHead>
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
              {!isLoading && (!countries || countries.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    <Globe className="h-5 w-5 mx-auto mb-2 opacity-40" />
                    No countries yet.
                  </TableCell>
                </TableRow>
              )}
              {(countries ?? []).map((c) => (
                <TableRow key={c.code}>
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
        <CountryDialog
          country={editing}
          open
          onClose={() => { setEditing(null); setAdding(false); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-countries"] })}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Remove ${deleting?.label}?`}
        description="Visa sub-types under this country keep their reference, but the country will no longer appear in dropdowns."
        confirmLabel="Remove"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}

function CountryDialog({
  country, open, onClose, onSaved,
}: {
  country: Country | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!country;
  const [code, setCode] = useState(country?.code ?? "");
  const [label, setLabel] = useState(country?.label ?? "");
  const [sortOrder, setSortOrder] = useState(country?.sort_order?.toString() ?? "100");
  const [isActive, setIsActive] = useState(country?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!code.trim() || !label.trim()) { toast.error("Code and country name are required"); return; }
    setSaving(true);
    const payload = {
      code: code.trim().toUpperCase(),
      label: label.trim(),
      sort_order: sortOrder ? Number(sortOrder) : 100,
      is_active: isActive,
    };
    if (isEdit) {
      const { error } = await db.from("countries").update({ label: payload.label, sort_order: payload.sort_order, is_active: payload.is_active }).eq("code", country!.code);
      if (error) { toast.error("Save failed: " + error.message); setSaving(false); return; }
      await writeAudit({ action: "UPDATE", entity_type: "countries", entity_id: country!.code, changes: payload });
      toast.success("Country updated");
    } else {
      const { error } = await db.from("countries").insert(payload);
      if (error) { toast.error("Create failed: " + error.message); setSaving(false); return; }
      await writeAudit({ action: "CREATE", entity_type: "countries", entity_id: payload.code, changes: payload });
      toast.success("Country added");
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit: ${country!.label}` : "Add Country"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Code (2 letters)</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} disabled={isEdit} placeholder="CA" maxLength={4} />
          </div>
          <div>
            <Label>Country name</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Canada" />
          </div>
          <div>
            <Label>Sort order</Label>
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="100" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="country-active" />
            <Label htmlFor="country-active" className="cursor-pointer">Active</Label>
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
