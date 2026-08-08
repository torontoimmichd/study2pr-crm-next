"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness, Plus, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

type Position = { id: string; staff_id: string; function_code: string; programme_family: string | null; country: string | null; is_primary: boolean; is_active: boolean };
type Draft = { function_code: string; programme_family: string; country: string; is_primary: boolean; is_active: boolean };

const emptyDraft = (): Draft => ({ function_code: "", programme_family: "__all__", country: "__all__", is_primary: false, is_active: true });

export default function AdminPositions() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const { data: staff = [] } = useQuery({ queryKey: ["admin-positions-staff"], queryFn: async () => (await supabase.from("staff_profiles").select("id, full_name, role, is_active").order("full_name")).data ?? [] });
  const { data: functions = [] } = useQuery({ queryKey: ["staff-functions"], queryFn: async () => (await supabase.from("staff_functions").select("code, label").eq("is_active", true).order("sort_order")).data ?? [] });
  const { data: families = [] } = useQuery({ queryKey: ["programme-families"], queryFn: async () => (await supabase.from("programme_families").select("code, label").eq("is_active", true).order("sort_order")).data ?? [] });
  const { data: visaTypes = [] } = useQuery({ queryKey: ["position-countries"], queryFn: async () => (await supabase.from("visa_types").select("destination_country").eq("is_active", true).order("destination_country")).data ?? [] });
  const { data: positions = [] } = useQuery({ queryKey: ["staff-positions"], queryFn: async () => (await supabase.from("staff_positions").select("id, staff_id, function_code, programme_family, country, is_primary, is_active").order("created_at")).data as Position[] });
  const countries = useMemo(() => Array.from(new Set(visaTypes.map((item) => item.destination_country).filter(Boolean))) as string[], [visaTypes]);

  const save = async (staffId: string) => {
    const draft = drafts[staffId];
    if (!draft.function_code) { toast.error("Choose a function first"); return; }
    setSaving(staffId);
    const { error } = await supabase.from("staff_positions").insert({ staff_id: staffId, function_code: draft.function_code, programme_family: draft.programme_family === "__all__" ? null : draft.programme_family, country: draft.country === "__all__" ? null : draft.country, is_primary: draft.is_primary, is_active: draft.is_active, created_by: user?.id ?? null });
    setSaving(null);
    if (error) { toast.error(error.code === "23505" ? "This staff position already exists." : error.message); return; }
    setDrafts((current) => ({ ...current, [staffId]: emptyDraft() }));
    void qc.invalidateQueries({ queryKey: ["staff-positions"] });
    toast.success("Position added");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("staff_positions").delete().eq("id", id);
    if (error) toast.error(error.message); else void qc.invalidateQueries({ queryKey: ["staff-positions"] });
  };

  const update = async (id: string, patch: Partial<Position>) => {
    const { error } = await supabase.from("staff_positions").update(patch).eq("id", id);
    if (error) toast.error(error.message); else void qc.invalidateQueries({ queryKey: ["staff-positions"] });
  };

  return <div>
    <AdminPageHeader title="Staff Positions" subtitle="Capability assignments are separate from permission roles." />
    <div className="p-6 space-y-4 max-w-6xl">
      {staff.map((person) => {
        const rows = positions.filter((position) => position.staff_id === person.id);
        const draft = drafts[person.id] ?? emptyDraft();
        return <section key={person.id} className="card-surface p-4 space-y-3">
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Users className="h-4 w-4" /></div><div><div className="font-semibold">{person.full_name}</div><div className="text-xs text-muted-foreground">{person.role}{person.is_active === false ? " · inactive" : ""}</div></div></div><span className="text-xs text-muted-foreground">{rows.length} position{rows.length === 1 ? "" : "s"}</span></div>
          {rows.map((row) => <div key={row.id} className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_auto_auto_auto] gap-2 items-center border-t border-border pt-2 text-sm"><span>{functions.find((item) => item.code === row.function_code)?.label ?? row.function_code}</span><span>{families.find((item) => item.code === row.programme_family)?.label ?? "All programmes"}</span><span>{row.country ?? "All countries"}</span><label className="flex items-center gap-1 text-xs"><Switch checked={row.is_primary} onCheckedChange={(value) => void update(row.id, { is_primary: value })} />Primary</label><label className="flex items-center gap-1 text-xs"><Switch checked={row.is_active} onCheckedChange={(value) => void update(row.id, { is_active: value })} />Active</label><Button variant="ghost" size="icon" onClick={() => void remove(row.id)} aria-label="Remove position"><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}
          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_auto_auto] gap-2 border-t border-dashed border-border pt-3"><Select value={draft.function_code} onValueChange={(value) => setDrafts((current) => ({ ...current, [person.id]: { ...draft, function_code: value } }))}><SelectTrigger><SelectValue placeholder="Function" /></SelectTrigger><SelectContent>{functions.map((item) => <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}</SelectContent></Select><Select value={draft.programme_family} onValueChange={(value) => setDrafts((current) => ({ ...current, [person.id]: { ...draft, programme_family: value } }))}><SelectTrigger><SelectValue placeholder="Programme family" /></SelectTrigger><SelectContent><SelectItem value="__all__">All programmes</SelectItem>{families.map((item) => <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}</SelectContent></Select><Select value={draft.country} onValueChange={(value) => setDrafts((current) => ({ ...current, [person.id]: { ...draft, country: value } }))}><SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger><SelectContent><SelectItem value="__all__">All countries</SelectItem>{countries.map((country) => <SelectItem key={country} value={country}>{country}</SelectItem>)}</SelectContent></Select><label className="flex items-center gap-2 text-xs px-2"><Switch checked={draft.is_primary} onCheckedChange={(value) => setDrafts((current) => ({ ...current, [person.id]: { ...draft, is_primary: value } }))} />Primary</label><Button onClick={() => void save(person.id)} disabled={saving === person.id}><Plus className="h-4 w-4 mr-1" />Add</Button></div>
        </section>;
      })}
      {staff.length === 0 && <div className="card-surface p-8 text-center text-sm text-muted-foreground">No staff profiles found.</div>}
    </div>
  </div>;
}
