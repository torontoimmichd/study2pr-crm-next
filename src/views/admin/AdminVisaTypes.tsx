"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { writeAudit } from "@/lib/audit";
import { Badge } from "@/components/ui/badge";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Country { code: string; label: string; is_active: boolean | null; }
interface VisaCategory { id: string; code: string; label: string; is_active: boolean | null; }

interface VisaType {
  id: string;
  code: string;
  label: string;
  category: string;                 // legacy free-text (kept in sync with category code)
  category_id: string | null;       // NEW → visa_categories
  destination_country: string | null; // NEW → country label
  base_fee_inr: number | null;
  base_fee_cad: number | null;
  govt_fee_cad: number | null;
  is_active: boolean | null;
}

interface VisaSubType {
  id: string;
  code: string;
  label: string;
  visa_type_id: string | null;
  processing_time_days: number | null;
  is_active: boolean | null;
}

const ALL = "__all__";

export default function AdminVisaTypes() {
  const qc = useQueryClient();
  const [countryFilter, setCountryFilter] = useState<string>(ALL);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [editing, setEditing] = useState<VisaType | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<VisaType | null>(null);

  const { data: countries } = useQuery({
    queryKey: ["ref-countries"],
    queryFn: async () => {
      const { data } = await db.from("countries").select("code, label, is_active").order("sort_order");
      return (data ?? []) as Country[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["ref-visa-categories"],
    queryFn: async () => {
      const { data } = await db.from("visa_categories").select("id, code, label, is_active").order("sort_order");
      return (data ?? []) as VisaCategory[];
    },
  });

  const { data: types, isLoading } = useQuery({
    queryKey: ["admin-visa-types"],
    queryFn: async () => {
      const { data, error } = await db
        .from("visa_types")
        .select("id, code, label, category, category_id, destination_country, base_fee_inr, base_fee_cad, govt_fee_cad, is_active")
        .order("destination_country")
        .order("label");
      if (error) throw error;
      return (data ?? []) as VisaType[];
    },
  });

  const catLabel = useMemo(() => {
    const m = new Map<string, string>();
    (categories ?? []).forEach((c) => m.set(c.id, c.label));
    return m;
  }, [categories]);

  const filtered = useMemo(() => {
    if (!types) return [];
    return types.filter((t) => {
      const okCountry = countryFilter === ALL || t.destination_country === countryFilter;
      const okCat = categoryFilter === ALL || t.category_id === categoryFilter;
      return okCountry && okCat;
    });
  }, [types, countryFilter, categoryFilter]);

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await db.from("visa_types").delete().eq("id", deleting.id);
    if (error) { toast.error("Could not delete: " + error.message); return; }
    await writeAudit({ action: "DELETE", entity_type: "visa_types", entity_id: deleting.id, changes: { code: deleting.code } });
    toast.success("Sub-type deleted");
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["admin-visa-types"] });
  };

  return (
    <>
      <AdminPageHeader
        title="Visa Sub-Types & Fees"
        subtitle="The specific visas/services under each Country → Category (e.g. Canada → Visit → Tourism). Drives the Country → Category → Sub-type pickers on leads and cases."
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add Sub-Type
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Label className="text-xs text-muted-foreground">Country</Label>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All countries</SelectItem>
                {(countries ?? []).map((c) => <SelectItem key={c.code} value={c.label}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {(categories ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="card-surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Country</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Sub-Type</TableHead>
                <TableHead className="text-right">Base Fee (INR)</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Loading…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    <Tag className="h-5 w-5 mx-auto mb-2 opacity-40" />
                    No sub-types match this filter.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">{t.destination_country ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{t.category_id ? (catLabel.get(t.category_id) ?? "—") : "Uncategorised"}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{t.code}</TableCell>
                  <TableCell className="font-medium">{t.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {t.base_fee_inr ? `₹${Number(t.base_fee_inr).toLocaleString("en-IN")}` : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${t.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                      {t.is_active ? "Active" : "Paused"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleting(t)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {(editing || adding) && (
        <VisaTypeDialog
          visaType={editing}
          countries={countries ?? []}
          categories={categories ?? []}
          open
          onClose={() => { setEditing(null); setAdding(false); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-visa-types"] })}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.label}?`}
        description="This removes the sub-type from all dropdowns. Existing cases keep their reference."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}

function VisaTypeDialog({
  visaType, countries, categories, open, onClose, onSaved,
}: {
  visaType: VisaType | null;
  countries: Country[];
  categories: VisaCategory[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!visaType;
  const qc = useQueryClient();
  const [country, setCountry] = useState(visaType?.destination_country ?? (countries[0]?.label ?? ""));
  const [categoryId, setCategoryId] = useState(visaType?.category_id ?? (categories[0]?.id ?? ""));
  const [code, setCode] = useState(visaType?.code ?? "");
  const [label, setLabel] = useState(visaType?.label ?? "");
  const [baseFeeInr, setBaseFeeInr] = useState(visaType?.base_fee_inr?.toString() ?? "");
  const [baseFeeCad, setBaseFeeCad] = useState(visaType?.base_fee_cad?.toString() ?? "");
  const [govtFeeCad, setGovtFeeCad] = useState(visaType?.govt_fee_cad?.toString() ?? "");
  const [isActive, setIsActive] = useState(visaType?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const { data: subTypes } = useQuery({
    queryKey: ["admin-visa-sub-types", visaType?.id],
    enabled: !!visaType?.id,
    queryFn: async () => {
      const { data } = await db
        .from("visa_sub_types")
        .select("id, code, label, visa_type_id, processing_time_days, is_active")
        .eq("visa_type_id", visaType!.id)
        .order("label");
      return (data ?? []) as VisaSubType[];
    },
  });

  const [newSubCode, setNewSubCode] = useState("");
  const [newSubLabel, setNewSubLabel] = useState("");
  const [newSubDays, setNewSubDays] = useState("");

  const handleSave = async () => {
    if (!country) { toast.error("Please choose a country"); return; }
    if (!categoryId) { toast.error("Please choose a category"); return; }
    if (!code.trim() || !label.trim()) { toast.error("Code and label are required"); return; }
    setSaving(true);
    const catCode = categories.find((c) => c.id === categoryId)?.code ?? "other";
    const payload = {
      code: code.trim(),
      label: label.trim(),
      category: catCode,               // keep legacy NOT NULL column in sync
      category_id: categoryId,
      destination_country: country,
      base_fee_inr: baseFeeInr ? Number(baseFeeInr) : 0,
      base_fee_cad: baseFeeCad ? Number(baseFeeCad) : 0,
      govt_fee_cad: govtFeeCad ? Number(govtFeeCad) : 0,
      is_active: isActive,
    };
    if (isEdit) {
      const { error } = await db.from("visa_types").update(payload).eq("id", visaType!.id);
      if (error) { toast.error("Save failed: " + error.message); setSaving(false); return; }
      await writeAudit({ action: "UPDATE", entity_type: "visa_types", entity_id: visaType!.id, changes: payload });
      toast.success("Sub-type updated");
    } else {
      const { data, error } = await db.from("visa_types").insert(payload).select("id").single();
      if (error) { toast.error("Create failed: " + error.message); setSaving(false); return; }
      await writeAudit({ action: "CREATE", entity_type: "visa_types", entity_id: data.id, changes: payload });
      toast.success("Sub-type created");
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const addSubType = async () => {
    if (!visaType?.id || !newSubCode.trim() || !newSubLabel.trim()) return;
    const payload = {
      code: newSubCode.trim(),
      label: newSubLabel.trim(),
      visa_type_id: visaType.id,
      processing_time_days: newSubDays ? Number(newSubDays) : null,
      is_active: true,
    };
    const { data, error } = await db.from("visa_sub_types").insert(payload).select("id").single();
    if (error) { toast.error("Could not add stream: " + error.message); return; }
    await writeAudit({ action: "CREATE", entity_type: "visa_sub_types", entity_id: data.id, changes: payload });
    setNewSubCode(""); setNewSubLabel(""); setNewSubDays("");
    qc.invalidateQueries({ queryKey: ["admin-visa-sub-types", visaType.id] });
    toast.success("Stream added");
  };

  const removeSubType = async (s: VisaSubType) => {
    const { error } = await db.from("visa_sub_types").delete().eq("id", s.id);
    if (error) { toast.error("Delete failed: " + error.message); return; }
    await writeAudit({ action: "DELETE", entity_type: "visa_sub_types", entity_id: s.id, changes: { code: s.code } });
    qc.invalidateQueries({ queryKey: ["admin-visa-sub-types", visaType?.id] });
    toast.success("Stream removed");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit: ${visaType!.label}` : "Add Visa Sub-Type"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <section>
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Placement</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Country</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger><SelectValue placeholder="Choose country" /></SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => <SelectItem key={c.code} value={c.label}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section>
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Basic Info</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Internal Code</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. TOURISM" />
              </div>
              <div>
                <Label>Display Label</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Tourism / Visitor Visa" />
              </div>
              <div className="flex items-end gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} id="active" />
                <Label htmlFor="active" className="cursor-pointer">Active</Label>
              </div>
            </div>
          </section>

          <section>
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Fees</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Pro Fee (INR)</Label>
                <Input type="number" value={baseFeeInr} onChange={(e) => setBaseFeeInr(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Pro Fee (CAD)</Label>
                <Input type="number" value={baseFeeCad} onChange={(e) => setBaseFeeCad(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Govt Fee (CAD)</Label>
                <Input type="number" value={govtFeeCad} onChange={(e) => setGovtFeeCad(e.target.value)} placeholder="0" />
              </div>
            </div>
          </section>

          {isEdit && (
            <section>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Optional streams ({subTypes?.length ?? 0}) — e.g. EE-CEC, EE-FSW under Express Entry
              </h4>
              {subTypes && subTypes.length > 0 && (
                <div className="border border-border rounded-md mb-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-8">Code</TableHead>
                        <TableHead className="h-8">Label</TableHead>
                        <TableHead className="h-8 text-right">Days</TableHead>
                        <TableHead className="h-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subTypes.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-xs py-2">{s.code}</TableCell>
                          <TableCell className="py-2">{s.label}</TableCell>
                          <TableCell className="text-right tabular-nums py-2">{s.processing_time_days ?? "—"}</TableCell>
                          <TableCell className="py-2 text-right">
                            <Button size="sm" variant="ghost" onClick={() => void removeSubType(s)} className="text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="grid grid-cols-[1fr_2fr_80px_auto] gap-2 items-end">
                <Input value={newSubCode} onChange={(e) => setNewSubCode(e.target.value)} placeholder="Code" />
                <Input value={newSubLabel} onChange={(e) => setNewSubLabel(e.target.value)} placeholder="Label" />
                <Input type="number" value={newSubDays} onChange={(e) => setNewSubDays(e.target.value)} placeholder="Days" />
                <Button size="sm" variant="outline" onClick={() => void addSubType()}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </section>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create sub-type"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
