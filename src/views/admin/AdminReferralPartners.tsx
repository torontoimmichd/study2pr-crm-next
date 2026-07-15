"use client";

/**
 * AdminReferralPartners.tsx
 * Manage referral partners — agents / brokers who send leads.
 * Route: /admin/referral-partners  (owner + admin only)
 *
 * referral_partners table:
 *   id uuid PK, name text, email text, phone text,
 *   company text, commission_rate numeric, commission_type text (percentage|fixed),
 *   notes text, is_active bool, created_at timestamptz
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, UserCheck, ToggleLeft, ToggleRight, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { writeAudit } from "@/lib/audit";
import { cn } from "@/lib/utils";

const db = supabase as any;

interface ReferralPartner {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  commission_rate: number;
  commission_type: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  lead_count?: number;
}

export default function AdminReferralPartners() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ReferralPartner | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<ReferralPartner | null>(null);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["admin-referral-partners"],
    queryFn: async () => {
      const { data, error } = await db
        .from("referral_partners")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;

      // Count leads per partner
      const ids = (data ?? []).map((p: ReferralPartner) => p.id);
      if (ids.length === 0) return [] as ReferralPartner[];

      const { data: leads } = await db
        .from("leads")
        .select("referral_partner_id")
        .in("referral_partner_id", ids);

      const counts: Record<string, number> = {};
      (leads ?? []).forEach((l: any) => {
        if (l.referral_partner_id) counts[l.referral_partner_id] = (counts[l.referral_partner_id] ?? 0) + 1;
      });

      return (data ?? []).map((p: ReferralPartner) => ({
        ...p,
        lead_count: counts[p.id] ?? 0,
      })) as ReferralPartner[];
    },
  });

  const toggleActive = async (p: ReferralPartner) => {
    const next = !p.is_active;
    const { error } = await db.from("referral_partners").update({ is_active: next }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(next ? "Partner activated" : "Partner paused");
    await writeAudit({ action: "UPDATE", entity_type: "referral_partners", entity_id: p.id, changes: { is_active: next } });
    qc.invalidateQueries({ queryKey: ["admin-referral-partners"] });
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await db.from("referral_partners").delete().eq("id", deleting.id);
    if (error) { toast.error(error.message); return; }
    await writeAudit({ action: "DELETE", entity_type: "referral_partners", entity_id: deleting.id, changes: { name: deleting.name } });
    toast.success("Partner removed");
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["admin-referral-partners"] });
  };

  const activeCount = partners.filter((p) => p.is_active).length;
  const totalLeads = partners.reduce((s, p) => s + (p.lead_count ?? 0), 0);

  return (
    <>
      <AdminPageHeader
        title="Referral Partners"
        subtitle="Agents and brokers who refer leads. Track their leads and commission rates."
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add Partner
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        {/* Stats */}
        {partners.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="card-surface p-4">
              <div className="text-2xl font-bold">{partners.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Total partners</div>
            </div>
            <div className="card-surface p-4">
              <div className="text-2xl font-bold text-success">{activeCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Active partners</div>
            </div>
            <div className="card-surface p-4">
              <div className="text-2xl font-bold text-primary">{totalLeads}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Leads referred</div>
            </div>
          </div>
        )}

        <div className="card-surface overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground animate-pulse">Loading partners…</div>
          ) : partners.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <UserCheck className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No referral partners yet</p>
              <p className="mt-1 opacity-70">Add partners to track referral leads and auto-calculate commissions.</p>
              <Button size="sm" className="mt-4" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4 mr-1" />Add first partner
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Partner", "Contact", "Commission", "Leads", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {partners.map((p) => (
                  <tr key={p.id} className={cn("hover:bg-muted/30 transition-colors", !p.is_active && "opacity-50")}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.name}</div>
                      {p.company && <div className="text-xs text-muted-foreground">{p.company}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.email && <div>{p.email}</div>}
                      {p.phone && <div>{p.phone}</div>}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {p.commission_type === "percentage"
                        ? `${p.commission_rate}%`
                        : `₹${Number(p.commission_rate).toLocaleString("en-IN")}`}
                      <div className="text-[10px] text-muted-foreground font-normal capitalize">{p.commission_type}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{p.lead_count ?? 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => void toggleActive(p)}
                        className={cn("flex items-center gap-1.5 text-xs font-medium transition-colors",
                          p.is_active ? "text-success" : "text-muted-foreground")}
                      >
                        {p.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        {p.is_active ? "Active" : "Paused"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleting(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {(editing || adding) && (
        <ReferralPartnerDialog
          partner={editing}
          open
          onClose={() => { setEditing(null); setAdding(false); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-referral-partners"] })}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Remove "${deleting?.name}"?`}
        description="Existing leads linked to this partner will keep the reference. The partner will no longer appear in the dropdown for new leads."
        confirmLabel="Remove"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}

function ReferralPartnerDialog({
  partner, open, onClose, onSaved,
}: {
  partner: ReferralPartner | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!partner;
  const [name, setName] = useState(partner?.name ?? "");
  const [email, setEmail] = useState(partner?.email ?? "");
  const [phone, setPhone] = useState(partner?.phone ?? "");
  const [company, setCompany] = useState(partner?.company ?? "");
  const [commType, setCommType] = useState<"percentage" | "fixed">(
    (partner?.commission_type as "percentage" | "fixed") ?? "percentage"
  );
  const [commRate, setCommRate] = useState(String(partner?.commission_rate ?? ""));
  const [notes, setNotes] = useState(partner?.notes ?? "");
  const [isActive, setIsActive] = useState(partner?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    const rate = parseFloat(commRate);
    if (isNaN(rate) || rate < 0) { toast.error("Commission rate must be a valid number"); return; }

    setSaving(true);
    const payload = {
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      company: company.trim() || null,
      commission_type: commType,
      commission_rate: rate,
      notes: notes.trim() || null,
      is_active: isActive,
    };

    if (isEdit) {
      const { error } = await db.from("referral_partners").update(payload).eq("id", partner!.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      await writeAudit({ action: "UPDATE", entity_type: "referral_partners", entity_id: partner!.id, changes: payload });
      toast.success("Partner updated");
    } else {
      const { error } = await db.from("referral_partners").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      await writeAudit({ action: "CREATE", entity_type: "referral_partners", entity_id: "new", changes: payload });
      toast.success("Partner created");
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit: ${partner!.name}` : "Add Referral Partner"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Full name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ravi Sharma" />
          </div>
          <div>
            <Label>Company / Agency</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Sharma Immigration Consultants" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ravi@example.com" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Commission type</Label>
              <Select value={commType} onValueChange={(v) => setCommType(v as "percentage" | "fixed")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed (₹)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{commType === "percentage" ? "Rate (%)" : "Amount (₹)"}</Label>
              <Input
                type="number" min="0" step="0.01"
                value={commRate}
                onChange={(e) => setCommRate(e.target.value)}
                placeholder={commType === "percentage" ? "10" : "5000"}
              />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="resize-none" placeholder="Optional notes about this partner" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="partner-active" />
            <Label htmlFor="partner-active" className="cursor-pointer">Active</Label>
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
