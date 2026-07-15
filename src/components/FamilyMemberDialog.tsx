"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { writeAudit } from "@/lib/audit";

const RELATIONSHIPS = [
  "spouse",
  "child",
  "parent",
  "sibling",
  "guardian",
  "other",
] as const;

export interface FamilyMemberFormValue {
  id?: string;
  full_name: string;
  relationship: string;
  date_of_birth: string | null;
  passport_number: string | null;
  is_dependent: boolean;
  is_included_on_current_case: boolean;
  notes: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  initial?: FamilyMemberFormValue | null;
  onSaved: () => void;
}

const EMPTY: FamilyMemberFormValue = {
  full_name: "",
  relationship: "spouse",
  date_of_birth: null,
  passport_number: null,
  is_dependent: true,
  is_included_on_current_case: true,
  notes: null,
};

export function FamilyMemberDialog({ open, onOpenChange, clientId, initial, onSaved }: Props) {
  const [val, setVal] = useState<FamilyMemberFormValue>(EMPTY);
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?.id;

  useEffect(() => {
    if (open) setVal(initial ?? EMPTY);
  }, [open, initial]);

  const save = async () => {
    if (!val.full_name.trim()) {
      toast.error("Full name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        principal_client_id: clientId,
        full_name: val.full_name.trim(),
        relationship: val.relationship,
        date_of_birth: val.date_of_birth || null,
        passport_number: val.passport_number?.trim() || null,
        is_dependent: val.is_dependent,
        is_included_on_current_case: val.is_included_on_current_case,
        notes: val.notes?.trim() || null,
      };

      if (isEdit && initial?.id) {
        const { error } = await supabase.from("family_members").update(payload).eq("id", initial.id);
        if (error) throw error;
        await writeAudit({
          action: "UPDATE",
          entity_type: "family_member",
          entity_id: initial.id,
          changes: { before: initial, after: payload },
        });
        toast.success("Family member updated");
      } else {
        const { data, error } = await supabase.from("family_members").insert(payload).select("id").single();
        if (error) throw error;
        await writeAudit({
          action: "CREATE",
          entity_type: "family_member",
          entity_id: data.id,
          changes: payload,
        });
        toast.success("Family member added");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-navy">
            {isEdit ? "Edit family member" : "Add family member"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fm-name">Full name *</Label>
              <Input
                id="fm-name"
                value={val.full_name}
                onChange={(e) => setVal({ ...val, full_name: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <Label>Relationship *</Label>
              <Select value={val.relationship} onValueChange={(v) => setVal({ ...val, relationship: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fm-dob">Date of birth</Label>
              <Input
                id="fm-dob"
                type="date"
                value={val.date_of_birth ?? ""}
                onChange={(e) => setVal({ ...val, date_of_birth: e.target.value || null })}
              />
            </div>
            <div>
              <Label htmlFor="fm-pp">Passport #</Label>
              <Input
                id="fm-pp"
                value={val.passport_number ?? ""}
                onChange={(e) => setVal({ ...val, passport_number: e.target.value })}
                placeholder="e.g. P1234567"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch
                checked={val.is_dependent}
                onCheckedChange={(c) => setVal({ ...val, is_dependent: c })}
              />
              Dependent
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch
                checked={val.is_included_on_current_case}
                onCheckedChange={(c) => setVal({ ...val, is_included_on_current_case: c })}
              />
              On current case
            </label>
          </div>

          <div>
            <Label htmlFor="fm-notes">Notes</Label>
            <Textarea
              id="fm-notes"
              rows={2}
              value={val.notes ?? ""}
              onChange={(e) => setVal({ ...val, notes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : isEdit ? "Save changes" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
