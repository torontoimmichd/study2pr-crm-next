"use client";

import { useState, FormEvent, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { writeAudit } from "@/lib/audit";
import { useAuth } from "@/lib/auth-context";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
  defaultCaseId?: string | null;
  defaultLeadId?: string | null;
}

const NONE = "__none__";

export function NewTaskDialog({ open, onOpenChange, onCreated, defaultCaseId, defaultLeadId }: Props) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    due_at: "",
    priority: "normal",
    linked_kind: defaultCaseId ? "case" : defaultLeadId ? "lead" : "none",
    linked_id: defaultCaseId ?? defaultLeadId ?? "",
    assigned_to: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        title: "",
        description: "",
        due_at: "",
        priority: "normal",
        linked_kind: defaultCaseId ? "case" : defaultLeadId ? "lead" : "none",
        linked_id: defaultCaseId ?? defaultLeadId ?? "",
        assigned_to: "",
      });
    }
  }, [open, defaultCaseId, defaultLeadId]);

  const { data: staff } = useQuery({
    queryKey: ["staff-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_profiles")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");
      return data ?? [];
    },
  });

  const { data: cases } = useQuery({
    queryKey: ["cases-pick"],
    enabled: form.linked_kind === "case",
    queryFn: async () => {
      const { data } = await supabase
        .from("cases")
        .select("id, case_code, client_id")
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(200);
      const ids = Array.from(new Set((data ?? []).map((c) => c.client_id)));
      const { data: cls } = ids.length
        ? await supabase.from("clients").select("id, full_name").in("id", ids)
        : { data: [] };
      const m = new Map((cls ?? []).map((c) => [c.id, c.full_name]));
      return (data ?? []).map((c) => ({
        id: c.id,
        label: `${c.case_code ?? c.id.slice(0, 8)} · ${m.get(c.client_id) ?? "Client"}`,
      }));
    },
  });

  const { data: leads } = useQuery({
    queryKey: ["leads-pick"],
    enabled: form.linked_kind === "lead",
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, full_name")
        .not("lifecycle_state", "in", "(converted,cold,not_eligible,lost)")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSubmitting(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      priority: form.priority,
      status_code: "open",
      source: "manual",
      assigned_to: form.assigned_to || null,
      created_by: user?.id ?? null,
      case_id: form.linked_kind === "case" ? form.linked_id || null : null,
      lead_id: form.linked_kind === "lead" ? form.linked_id || null : null,
    };
    const { data, error } = await supabase.from("tasks").insert(payload).select("id").single();
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void writeAudit({ action: "CREATE", entity_type: "tasks", entity_id: data.id, changes: payload });
    toast.success("Task created");
    onOpenChange(false);
    onCreated?.(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-navy">New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title *</Label>
            <Input id="task-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea id="task-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due date/time</Label>
              <Input id="task-due" type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Linked to</Label>
              <Select
                value={form.linked_kind}
                onValueChange={(v) => setForm({ ...form, linked_kind: v, linked_id: "" })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="case">Case</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Entity</Label>
              <Select
                value={form.linked_id || NONE}
                onValueChange={(v) => setForm({ ...form, linked_id: v === NONE ? "" : v })}
                disabled={form.linked_kind === "none"}
              >
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {form.linked_kind === "case" && cases?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                  {form.linked_kind === "lead" && leads?.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Assigned to</Label>
            <Select value={form.assigned_to || NONE} onValueChange={(v) => setForm({ ...form, assigned_to: v === NONE ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {staff?.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-primary hover:bg-primary/90">
              {submitting ? "Saving…" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
