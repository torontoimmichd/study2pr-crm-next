"use client";

import { useState, FormEvent, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { writeAudit } from "@/lib/audit";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
}

export function NewClientDialog({ open, onOpenChange, onCreated }: Props) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", country_of_citizenship: "", current_residence: "", notes: "" });

  useEffect(() => {
    if (!open) setForm({ full_name: "", email: "", phone: "", country_of_citizenship: "", current_residence: "", notes: "" });
  }, [open]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error("Full name is required");
      return;
    }
    setSubmitting(true);
    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      country_of_citizenship: form.country_of_citizenship.trim() || null,
      current_residence: form.current_residence.trim() || null,
      notes: form.notes.trim() || null,
      is_active: true,
    };
    const { data, error } = await supabase.from("clients").insert(payload).select("id").single();
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void writeAudit({ action: "CREATE", entity_type: "clients", entity_id: data.id, changes: payload });
    toast.success("Client created");
    onOpenChange(false);
    onCreated?.(data.id);
    navigate(`/clients/${data.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-navy">New Client</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full name *</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Citizenship</Label><Input value={form.country_of_citizenship} onChange={(e) => setForm({ ...form, country_of_citizenship: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Current residence</Label><Input value={form.current_residence} onChange={(e) => setForm({ ...form, current_residence: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-primary hover:bg-primary/90">{submitting ? "Saving…" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
