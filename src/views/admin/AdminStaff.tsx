"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users, Plus, Pencil, CheckCircle2, XCircle, Crown, Shield, User,
  Mail, Phone, Clock, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtDateTimeIST, fmtRelative } from "@/lib/format";
import { toast } from "sonner";
import { writeAudit } from "@/lib/audit";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const ROLES = [
  { value: "owner",             label: "Owner",             icon: Crown,  description: "Full access including billing and staff" },
  { value: "admin",             label: "Admin",             icon: Shield, description: "Admin control center, all operations" },
  { value: "senior_advisor",    label: "Senior Advisor",    icon: User,   description: "Workflow edits, all cases and leads" },
  { value: "case_manager",      label: "Case Manager",      icon: User,   description: "Manage assigned cases and leads" },
  { value: "document_specialist", label: "Document Specialist", icon: User, description: "Document upload and verification" },
  { value: "support",           label: "Support",           icon: User,   description: "Messaging and basic task management" },
  { value: "accountant",        label: "Accountant",        icon: User,   description: "Finance module only" },
];

const ROLE_TONE: Record<string, string> = {
  owner:              "bg-gold/20 text-gold-foreground border-gold/30",
  admin:              "bg-primary/10 text-primary border-primary/20",
  senior_advisor:     "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  case_manager:       "bg-muted text-foreground border-border",
  document_specialist: "bg-muted text-foreground border-border",
  support:            "bg-muted text-foreground border-border",
  accountant:         "bg-muted text-foreground border-border",
};

interface StaffProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  phone: string | null;
  is_active: boolean | null;
  last_login_at: string | null;
  visa_specialties: string[] | null;
  created_at: string | null;
}

interface EditState {
  id: string | null; // null = new
  full_name: string;
  email: string;
  role: string;
  phone: string;
  is_active: boolean;
  visa_specialties: string;
}

const EMPTY: EditState = {
  id: null, full_name: "", email: "", role: "case_manager", phone: "", is_active: true, visa_specialties: "",
};

export default function AdminStaff() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<EditState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["admin-staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as StaffProfile[];
    },
  });

  const visible = staff.filter((s) => showInactive || s.is_active !== false);

  const openEdit = (s: StaffProfile) => {
    setForm({
      id: s.id,
      full_name: s.full_name,
      email: s.email,
      role: s.role,
      phone: s.phone ?? "",
      is_active: s.is_active ?? true,
      visa_specialties: (s.visa_specialties ?? []).join(", "),
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        phone: form.phone.trim() || null,
        is_active: form.is_active,
        visa_specialties: form.visa_specialties
          ? form.visa_specialties.split(",").map((s) => s.trim()).filter(Boolean)
          : null,
        updated_at: new Date().toISOString(),
      };

      if (form.id) {
        const { error } = await supabase.from("staff_profiles").update(payload).eq("id", form.id);
        if (error) throw error;
        void writeAudit({ action: "UPDATE", entity_type: "staff_profiles", entity_id: form.id, changes: payload });
        toast.success("Staff profile updated");
      } else {
        // Note: creating a new auth user requires Supabase Admin API — we update the profile only
        toast.info("To add new staff, invite them via Supabase Auth. Then their profile will appear here for role assignment.");
        setSaving(false);
        return;
      }

      setDialogOpen(false);
      void qc.invalidateQueries({ queryKey: ["admin-staff"] });
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: StaffProfile) => {
    if (s.id === user?.id) { toast.error("You cannot deactivate your own account"); return; }
    const { error } = await supabase
      .from("staff_profiles")
      .update({ is_active: !s.is_active, updated_at: new Date().toISOString() })
      .eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success(s.is_active ? "Staff deactivated" : "Staff activated");
    void qc.invalidateQueries({ queryKey: ["admin-staff"] });
  };

  const roleInfo = (role: string) => ROLES.find((r) => r.value === role);

  return (
    <>
      <AdminPageHeader
        title="Staff & Roles"
        subtitle="Manage your team members and their access levels"
        breadcrumb={[{ label: "Admin Home", to: "/admin" }, { label: "Staff & Roles" }]}
        actions={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} />
              Show inactive
            </label>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1.5" /> Invite Staff
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="card-surface p-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">No staff found.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {visible.map((s) => {
              const ri = roleInfo(s.role);
              const RoleIcon = ri?.icon ?? User;
              const isMe = s.id === user?.id;
              return (
                <div key={s.id} className={cn("card-surface px-5 py-4 flex items-center gap-4", !s.is_active && "opacity-60")}>
                  <div className="h-10 w-10 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-semibold text-sidebar-accent-foreground shrink-0">
                    {s.full_name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{s.full_name}</span>
                      {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">You</span>}
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium border", ROLE_TONE[s.role] ?? "bg-muted text-muted-foreground")}>
                        <RoleIcon className="h-2.5 w-2.5 inline mr-0.5" />
                        {ri?.label ?? s.role}
                      </span>
                      {!s.is_active && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium">Inactive</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{s.email}</span>
                      {s.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</span>}
                      {s.last_login_at && (
                        <span className="flex items-center gap-1" title={fmtDateTimeIST(s.last_login_at)}>
                          <Clock className="h-3 w-3" /> Last login {fmtRelative(s.last_login_at)}
                        </span>
                      )}
                    </div>
                    {s.visa_specialties && s.visa_specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {s.visa_specialties.map((v) => (
                          <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{v}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void toggleActive(s)}
                      disabled={isMe}
                      className={s.is_active ? "text-destructive hover:bg-destructive/10" : "text-success hover:bg-success/10"}
                    >
                      {s.is_active
                        ? <><XCircle className="h-3.5 w-3.5 mr-1" /> Deactivate</>
                        : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Activate</>
                      }
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Role legend */}
        <div className="card-surface p-5 mt-4">
          <h3 className="text-sm font-medium mb-3 text-foreground">Role Permissions</h3>
          <div className="grid gap-2">
            {ROLES.map((r) => {
              const Icon = r.icon;
              return (
                <div key={r.value} className="flex items-center gap-3 text-sm">
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium border w-32 text-center shrink-0", ROLE_TONE[r.value])}>
                    <Icon className="h-2.5 w-2.5 inline mr-0.5" />{r.label}
                  </span>
                  <span className="text-muted-foreground">{r.description}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-navy">
              {form.id ? "Edit Staff Profile" : "Invite Staff Member"}
            </DialogTitle>
          </DialogHeader>
          {!form.id ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                To add a new staff member, invite them via the Supabase authentication dashboard. Once they sign up, their profile will appear here and you can assign their role.
              </p>
              <a
                href="https://supabase.com/dashboard/project/ocnsavosheduqzmeyvcd/auth/users"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
              >
                Open Supabase Auth → Invite User ↗
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Full name *</Label>
                  <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Role *</Label>
                  <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+1 416…" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Visa specialties (comma-separated)</Label>
                <Input
                  value={form.visa_specialties}
                  onChange={(e) => setForm((f) => ({ ...f, visa_specialties: e.target.value }))}
                  placeholder="Express Entry, PNP, Spousal…"
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
                <Label>Account active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            {form.id && (
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
