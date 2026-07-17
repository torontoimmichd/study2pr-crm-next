"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, PartyPopper, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { writeAudit } from "@/lib/audit";

interface Festival {
  code: string;
  label: string;
  next_date: string;
  template_name: string;
  is_active: boolean;
  notes: string | null;
  body?: string; // joined from messages template
}

const emptyDraft = { code: "", label: "", next_date: "", body: "", notes: "" };

export default function AdminFestivals() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Festival | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Festival | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState(false);

  const { data: festivals } = useQuery({
    queryKey: ["admin-festivals"],
    queryFn: async (): Promise<Festival[]> => {
      const { data: rows, error } = await supabase
        .from("communication_festivals")
        .select("code, label, next_date, template_name, is_active, notes")
        .order("next_date", { ascending: true });
      if (error) throw error;
      const names = (rows ?? []).map((r) => r.template_name);
      const { data: tpls } = names.length
        ? await supabase
            .from("messages")
            .select("template_name, body")
            .eq("is_template", true)
            .in("template_name", names)
        : { data: [] as { template_name: string; body: string | null }[] };
      const bodyByName = new Map((tpls ?? []).map((t) => [t.template_name, t.body ?? ""]));
      return (rows ?? []).map((r) => ({ ...r, body: bodyByName.get(r.template_name) ?? "" })) as Festival[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-festivals"] });

  const saveTemplateBody = async (templateName: string, body: string) => {
    // update if exists, else create the template row
    const { data: existing } = await supabase
      .from("messages")
      .select("id")
      .eq("is_template", true)
      .eq("template_name", templateName)
      .maybeSingle();
    if (existing?.id) {
      const { error } = await supabase.from("messages").update({ body }).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("messages").insert({
        channel: "whatsapp",
        direction: "outbound",
        is_template: true,
        template_name: templateName,
        template_category: "festival",
        template_variables: ["first_name"],
        body,
        status: "active",
      });
      if (error) throw error;
    }
  };

  const handleToggle = async (f: Festival, on: boolean) => {
    const { error } = await supabase
      .from("communication_festivals")
      .update({ is_active: on })
      .eq("code", f.code);
    if (error) { toast.error("Update failed: " + error.message); return; }
    refresh();
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!draft.label.trim() || !draft.next_date) { toast.error("Name and date are required"); return; }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("communication_festivals")
        .update({ label: draft.label.trim(), next_date: draft.next_date, notes: draft.notes || null })
        .eq("code", editing.code);
      if (error) throw error;
      await saveTemplateBody(editing.template_name, draft.body);
      await writeAudit({ action: "UPDATE", entity_type: "communication_festivals", entity_id: editing.code, changes: { label: draft.label, next_date: draft.next_date } });
      toast.success("Festival updated");
      setEditing(null);
      refresh();
    } catch (e) {
      toast.error("Save failed: " + (e as Error).message);
    } finally { setBusy(false); }
  };

  const handleAdd = async () => {
    if (!draft.label.trim() || !draft.next_date || !draft.body.trim()) {
      toast.error("Name, date and message are all required"); return;
    }
    setBusy(true);
    try {
      const code = draft.label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
      const templateName = "FESTIVAL_" + code;
      await saveTemplateBody(templateName, draft.body.trim());
      const { error } = await supabase.from("communication_festivals").insert({
        code, label: draft.label.trim(), next_date: draft.next_date,
        template_name: templateName, is_active: true, notes: draft.notes || null,
      });
      if (error) throw error;
      await writeAudit({ action: "CREATE", entity_type: "communication_festivals", entity_id: code, changes: { label: draft.label, next_date: draft.next_date } });
      toast.success("Festival greeting added");
      setAdding(false);
      setDraft(emptyDraft);
      refresh();
    } catch (e) {
      toast.error("Add failed: " + (e as Error).message);
    } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("communication_festivals").delete().eq("code", deleting.code);
    if (error) { toast.error("Delete failed: " + error.message); return; }
    await writeAudit({ action: "DELETE", entity_type: "communication_festivals", entity_id: deleting.code, changes: { label: deleting.label } });
    toast.success("Festival removed (its message stays in Templates)");
    setDeleting(null);
    refresh();
  };

  const openEdit = (f: Festival) => {
    setDraft({ code: f.code, label: f.label, next_date: f.next_date, body: f.body ?? "", notes: f.notes ?? "" });
    setEditing(f);
  };

  const dialogFields = (isAdd: boolean) => (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Festival name</Label>
        <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Baisakhi Mela" />
      </div>
      <div className="space-y-1.5">
        <Label>Next date it falls on</Label>
        <Input type="date" value={draft.next_date} onChange={(e) => setDraft({ ...draft, next_date: e.target.value })} />
        <p className="text-xs text-muted-foreground">
          Hindu lunar festivals move every year — update this date each year after checking a panchang.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label>Greeting message (WhatsApp)</Label>
        <Textarea rows={4} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          placeholder="Happy ... , {{first_name}}! ... — Team Study2PR" />
        <p className="text-xs text-muted-foreground">
          Use <code className="font-mono">{"{{first_name}}"}</code> where the client&apos;s name should appear.
          Sent automatically to all clients at ~9:30 AM IST on the date above (max 1 message per client per day).
        </p>
      </div>
      <div className="space-y-1.5">
        <Label>Notes (optional)</Label>
        <Input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="e.g. verify date yearly" />
      </div>
      {!isAdd && <p className="text-xs text-muted-foreground">Internal code: {draft.code}</p>}
    </div>
  );

  return (
    <>
      <AdminPageHeader
        title="Festival Greetings"
        subtitle="Which festivals get an automatic WhatsApp greeting, on which date, with what message. Toggle any festival off to skip it."
        actions={
          <Button size="sm" onClick={() => { setDraft(emptyDraft); setAdding(true); }}>
            <Plus className="h-4 w-4" /> Add Festival
          </Button>
        }
      />

      <div className="p-6">
        <div className="card-surface overflow-hidden">
          {!festivals || festivals.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <PartyPopper className="h-5 w-5 mx-auto mb-2 opacity-40" />
              No festivals configured yet. Run the comms pack SQL or add one above.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {festivals.map((f) => (
                <li key={f.code} className="flex items-center gap-4 px-4 py-3">
                  <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{f.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(f.next_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {f.notes?.toLowerCase().includes("verify") && (
                        <span className="text-[10px] uppercase tracking-wide rounded bg-amber-100 text-amber-800 px-1.5 py-0.5">verify date</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{f.body || "No message set — add one!"}</p>
                  </div>
                  <Switch checked={f.is_active} onCheckedChange={(v) => handleToggle(f, v)} />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(f)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleting(f)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Messages queue in the outbox and are sent once WhatsApp sending goes live (Meta approval).
          Wording can also be edited under Email &amp; WhatsApp Templates (category: festival).
        </p>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Edit festival greeting</DialogTitle></DialogHeader>
          {dialogFields(false)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adding} onOpenChange={(o) => !o && setAdding(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add festival greeting</DialogTitle></DialogHeader>
          {dialogFields(true)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={busy}>{busy ? "Adding…" : "Add Festival"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remove this festival?"
        description={`"${deleting?.label}" will no longer send greetings. Its message template stays saved under Templates.`}
        confirmLabel="Remove"
        onConfirm={handleDelete}
      />
    </>
  );
}
