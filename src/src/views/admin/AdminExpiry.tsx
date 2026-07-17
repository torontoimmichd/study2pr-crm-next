"use client";

/**
 * Admin → Expiry & Alerts
 * Tab 1: Expiring items register (what expires, for which client, when)
 * Tab 2: Alert rules (how many days before expiry each alert fires; toggle types)
 * Backed by expiry_items / expiry_alert_rules (sql/20-21). The engine sweeps daily.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Timer, AlarmClock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Rule {
  item_type: string; label: string; alert1_days: number; alert2_days: number;
  task_title: string; client_template: string | null; urgent: boolean; is_active: boolean;
}
interface Item {
  id: string; client_id: string | null; case_id: string | null; item_type: string;
  label: string | null; expires_on: string; notes: string | null; is_active: boolean;
  client_name?: string;
}

const emptyItem = { client_id: "", item_type: "", label: "", expires_on: "", notes: "" };

export default function AdminExpiry() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [draft, setDraft] = useState(emptyItem);
  const [ruleDraft, setRuleDraft] = useState({ alert1_days: 60, alert2_days: 30 });
  const [clientQuery, setClientQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: rules } = useQuery({
    queryKey: ["admin-expiry-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expiry_alert_rules")
        .select("*").order("item_type");
      if (error) throw error;
      return (data ?? []) as Rule[];
    },
  });

  const { data: items } = useQuery({
    queryKey: ["admin-expiry-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expiry_items")
        .select("*").order("expires_on", { ascending: true }).limit(200);
      if (error) throw error;
      const rows = (data ?? []) as Item[];
      const ids = [...new Set(rows.map((r) => r.client_id).filter(Boolean))] as string[];
      const { data: cls } = ids.length
        ? await supabase.from("clients").select("id, full_name").in("id", ids)
        : { data: [] as { id: string; full_name: string }[] };
      const nameById = new Map((cls ?? []).map((c) => [c.id, c.full_name]));
      return rows.map((r) => ({ ...r, client_name: r.client_id ? nameById.get(r.client_id) : undefined }));
    },
  });

  const { data: clientOptions } = useQuery({
    queryKey: ["admin-expiry-clients", clientQuery],
    enabled: clientQuery.length >= 2,
    queryFn: async () => {
      const { data } = await supabase.from("clients")
        .select("id, full_name").ilike("full_name", `%${clientQuery}%`).limit(8);
      return data ?? [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-expiry-items"] });
    qc.invalidateQueries({ queryKey: ["admin-expiry-rules"] });
  };

  const addItem = async () => {
    if (!draft.client_id || !draft.item_type || !draft.expires_on) {
      toast.error("Client, type and expiry date are required"); return;
    }
    setBusy(true);
    const { error } = await supabase.from("expiry_items").insert({
      client_id: draft.client_id, item_type: draft.item_type,
      label: draft.label || null, expires_on: draft.expires_on, notes: draft.notes || null,
    });
    setBusy(false);
    if (error) { toast.error("Add failed: " + error.message); return; }
    toast.success("Expiry reminder added — engine will alert automatically");
    setAdding(false); setDraft(emptyItem); setClientQuery("");
    refresh();
  };

  const toggleItem = async (it: Item, on: boolean) => {
    const { error } = await supabase.from("expiry_items").update({ is_active: on }).eq("id", it.id);
    if (error) toast.error(error.message); else refresh();
  };

  const deleteItem = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("expiry_items").delete().eq("id", deleting.id);
    if (error) { toast.error(error.message); return; }
    setDeleting(null); refresh();
  };

  const toggleRule = async (r: Rule, on: boolean) => {
    const { error } = await supabase.from("expiry_alert_rules")
      .update({ is_active: on }).eq("item_type", r.item_type);
    if (error) toast.error(error.message); else refresh();
  };

  const saveRule = async () => {
    if (!editingRule) return;
    const { error } = await supabase.from("expiry_alert_rules")
      .update({ alert1_days: ruleDraft.alert1_days, alert2_days: ruleDraft.alert2_days })
      .eq("item_type", editingRule.item_type);
    if (error) { toast.error(error.message); return; }
    toast.success("Rule updated");
    setEditingRule(null); refresh();
  };

  const daysLeft = (d: string) =>
    Math.ceil((new Date(d + "T00:00:00").getTime() - Date.now()) / 86400000);

  return (
    <>
      <AdminPageHeader
        title="Expiry & Alerts"
        subtitle="What expires, when, and how early the system warns you and the client. The engine checks every morning."
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add Expiry Reminder
          </Button>
        }
      />

      <div className="p-6">
        <Tabs defaultValue="items">
          <TabsList>
            <TabsTrigger value="items"><AlarmClock className="h-3.5 w-3.5 mr-1" />Expiring items ({items?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="rules"><Timer className="h-3.5 w-3.5 mr-1" />Alert rules</TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            <div className="card-surface overflow-hidden mt-3">
              {!items?.length ? (
                <p className="p-10 text-center text-sm text-muted-foreground">
                  Nothing tracked yet. Add a reminder — e.g. a client&apos;s work permit expiry — and the engine handles the rest.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((it) => (
                    <li key={it.id} className="flex items-center gap-4 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{it.client_name ?? "—"}</span>
                          <span className="text-muted-foreground">·</span>
                          <span>{it.label ?? it.item_type.replace(/_/g, " ")}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Expires {new Date(it.expires_on + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          {" · "}
                          <span className={daysLeft(it.expires_on) <= 30 ? "text-destructive font-medium" : ""}>
                            {daysLeft(it.expires_on)} days left
                          </span>
                        </p>
                      </div>
                      <Switch checked={it.is_active} onCheckedChange={(v) => toggleItem(it, v)} />
                      <Button variant="ghost" size="icon" onClick={() => setDeleting(it)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rules">
            <div className="card-surface overflow-hidden mt-3">
              <ul className="divide-y divide-border">
                {(rules ?? []).map((r) => (
                  <li key={r.item_type} className="flex items-center gap-4 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{r.label}</div>
                      <p className="text-xs text-muted-foreground">
                        Alert 1: {r.alert1_days} days before · Alert 2: {r.alert2_days} days before
                        {r.client_template ? " · client gets WhatsApp" : " · internal only"}
                        {r.urgent ? " · urgent (bypasses 1/day cap)" : ""}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => {
                      setRuleDraft({ alert1_days: r.alert1_days, alert2_days: r.alert2_days });
                      setEditingRule(r);
                    }}>Edit days</Button>
                    <Switch checked={r.is_active} onCheckedChange={(v) => toggleRule(r, v)} />
                  </li>
                ))}
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add item dialog */}
      <Dialog open={adding} onOpenChange={(o) => !o && setAdding(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add expiry reminder</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Input placeholder="Type client name to search…" value={clientQuery}
                     onChange={(e) => { setClientQuery(e.target.value); setDraft({ ...draft, client_id: "" }); }} />
              {!!clientOptions?.length && !draft.client_id && (
                <div className="border border-border rounded-md divide-y divide-border">
                  {clientOptions.map((c) => (
                    <button key={c.id} type="button"
                      className="block w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                      onClick={() => { setDraft({ ...draft, client_id: c.id }); setClientQuery(c.full_name); }}>
                      {c.full_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>What expires?</Label>
              <Select value={draft.item_type} onValueChange={(v) => setDraft({ ...draft, item_type: v })}>
                <SelectTrigger><SelectValue placeholder="Choose type" /></SelectTrigger>
                <SelectContent>
                  {(rules ?? []).filter((r) => r.is_active).map((r) => (
                    <SelectItem key={r.item_type} value={r.item_type}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Expiry date</Label>
              <Input type="date" value={draft.expires_on} onChange={(e) => setDraft({ ...draft, expires_on: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Label (optional)</Label>
              <Input placeholder="e.g. SOWP — spouse" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            <Button onClick={addItem} disabled={busy}>{busy ? "Adding…" : "Add reminder"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit rule dialog */}
      <Dialog open={!!editingRule} onOpenChange={(o) => !o && setEditingRule(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Alert timing — {editingRule?.label}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Alert 1 (days before)</Label>
              <Input type="number" min={1} value={ruleDraft.alert1_days}
                     onChange={(e) => setRuleDraft({ ...ruleDraft, alert1_days: +e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Alert 2 (days before)</Label>
              <Input type="number" min={1} value={ruleDraft.alert2_days}
                     onChange={(e) => setRuleDraft({ ...ruleDraft, alert2_days: +e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRule(null)}>Cancel</Button>
            <Button onClick={saveRule}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remove this reminder?"
        description="No further alerts will fire for it. Already-created tasks stay."
        confirmLabel="Remove"
        destructive
        onConfirm={deleteItem}
      />
    </>
  );
}
