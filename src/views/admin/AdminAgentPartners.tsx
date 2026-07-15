"use client";

// src/pages/admin/AdminAgentPartners.tsx
// CRUD management for agent/partner organisations that refer leads.
// Route: /admin/agent-partners

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Handshake } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Textarea } from "@/components/ui/textarea";
import { writeAudit } from "@/lib/audit";
import { Badge } from "@/components/ui/badge";

interface AgentPartner {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  commission_pct: number | null;
  is_active: boolean;
  notes: string | null;
}

const BLANK: Omit<AgentPartner, "id"> = {
  name: "",
  company: null,
  email: null,
  phone: null,
  city: null,
  country: null,
  commission_pct: 0,
  is_active: true,
  notes: null,
};

export default function AdminAgentPartners() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AgentPartner | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<AgentPartner | null>(null);

  // Form state (used for both add and edit)
  const [form, setForm] = useState<Omit<AgentPartner, "id">>(BLANK);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: partners, isLoading } = useQuery({
    queryKey: ["admin-agent-partners"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("agent_partners")
        .select("id, name, company, email, phone, city, country, commission_pct, is_active, notes")
        .order("name");
      if (error) throw error;
      return (data ?? []) as AgentPartner[];
    },
  });

  const openAdd = () => {
    setForm(BLANK);
    setAdding(true);
  };

  const openEdit = (p: AgentPartner) => {
    setForm({
      name: p.name,
      company: p.company,
      email: p.email,
      phone: p.phone,
      city: p.city,
      country: p.country,
      commission_pct: p.commission_pct ?? 0,
      is_active: p.is_active,
      notes: p.notes,
    });
    setEditing(p);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }

    const payload = {
      name: form.name.trim(),
      company: form.company?.trim() || null,
      email: form.email?.trim() || null,
      phone: form.phone?.trim() || null,
      city: form.city?.trim() || null,
      country: form.country?.trim() || null,
      commission_pct: form.commission_pct ?? 0,
      is_active: form.is_active,
      notes: form.notes?.trim() || null,
    };

    if (adding) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("agent_partners")
        .insert(payload)
        .select("id")
        .single();
      if (error) { toast.error(error.message); return; }
      void writeAudit({ action: "CREATE", entity_type: "agent_partners", entity_id: data.id, changes: payload });
      toast.success("Agent partner added");
      setAdding(false);
    } else if (editing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("agent_partners")
        .update(payload)
        .eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      void writeAudit({ action: "UPDATE", entity_type: "agent_partners", entity_id: editing.id, changes: payload });
      toast.success("Agent partner updated");
      setEditing(null);
    }

    void qc.invalidateQueries({ queryKey: ["admin-agent-partners"] });
    void qc.invalidateQueries({ queryKey: ["agent-partners-active"] });
  };

  const handleDelete = async () => {
    if (!deleting) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("agent_partners")
      .delete()
      .eq("id", deleting.id);
    if (error) { toast.error("Cannot delete: " + error.message); return; }
    void writeAudit({ action: "DELETE", entity_type: "agent_partners", entity_id: deleting.id, changes: { name: deleting.name } });
    toast.success("Agent partner deleted");
    setDeleting(null);
    void qc.invalidateQueries({ queryKey: ["admin-agent-partners"] });
    void qc.invalidateQueries({ queryKey: ["agent-partners-active"] });
  };

  const handleToggleActive = async (p: AgentPartner) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("agent_partners")
      .update({ is_active: !p.is_active })
      .eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["admin-agent-partners"] });
    void qc.invalidateQueries({ queryKey: ["agent-partners-active"] });
  };

  return (
    <div>
      <AdminPageHeader
        title="Agent Partners"
        description="Manage agent and partner organisations that refer leads. Select 'Agent / Partner' in the source field when creating a lead."
        action={
          <Button onClick={openAdd} size="sm">
            <Plus className="h-4 w-4 mr-1.5" /> Add Partner
          </Button>
        }
      />

      <div className="p-6 max-w-4xl">
        {isLoading ? (
          <div className="text-sm text-muted-foreground p-4">Loading…</div>
        ) : !partners?.length ? (
          <div className="text-center py-16 card-surface rounded-xl">
            <Handshake className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No agent partners yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Add the agencies and individuals who refer clients to your firm.
            </p>
            <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1.5" /> Add first partner</Button>
          </div>
        ) : (
          <div className="card-surface overflow-hidden rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Name / Company</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Contact</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Location</th>
                  <th className="text-left px-4 py-3 font-medium">Commission %</th>
                  <th className="px-4 py-3 font-medium">Active</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.name}</div>
                      {p.company && <div className="text-xs text-muted-foreground">{p.company}</div>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                      {p.email && <div>{p.email}</div>}
                      {p.phone && <div>{p.phone}</div>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                      {[p.city, p.country].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {p.commission_pct != null && p.commission_pct > 0 ? (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          {p.commission_pct}%
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={p.is_active}
                        onCheckedChange={() => handleToggleActive(p)}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleting(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={adding || !!editing} onOpenChange={(v) => { if (!v) { setAdding(false); setEditing(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{adding ? "Add Agent Partner" : "Edit Agent Partner"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Contact name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Priya Mehta"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Company / Agency</Label>
                <Input
                  value={form.company ?? ""}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="e.g. Global Visa Consultants"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={form.phone ?? ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input
                  value={form.city ?? ""}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input
                  value={form.country ?? ""}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Commission %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={form.commission_pct ?? 0}
                  onChange={(e) => setForm({ ...form, commission_pct: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1.5 flex items-end pb-0.5">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                  />
                  <Label>Active</Label>
                </div>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Textarea
                  rows={2}
                  value={form.notes ?? ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Any notes about this partner…"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAdding(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        title="Delete agent partner?"
        description={`Remove "${deleting?.name}"? This cannot be undone. Leads linked to this partner will keep the reference.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
