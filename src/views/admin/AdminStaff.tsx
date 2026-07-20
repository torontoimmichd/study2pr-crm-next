"use client";

// src/views/admin/AdminStaff.tsx — v2 2026-07-18
// (1) "Add Staff" now WORKS: calls fn_add_staff RPC (sql/26) to link an auth
//     login to a staff profile. Requires the login to exist in Supabase Auth
//     first (Add user) — the dialog walks Gaurav through both steps.
// (2) Role list updated to the 5-role team model (+ legacy roles preserved).

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users, Plus, Pencil, CheckCircle2, XCircle, Crown, Shield, User,
  Mail, Phone, Clock, PhoneCall, FolderKanban, FileText, Calculator, EyeOff,
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
  { value: "owner",           label: "Owner / RCIC",      icon: Crown,      description: "Submission Expert — final review & submission, full access" },
  { value: "admin",           label: "Admin",             icon: Shield,     description: "Admin control center, all operations" },
  { value: "intake_officer",  label: "Intake Officer",    icon: PhoneCall,  description: "Answers calls, logs leads, basic qualification. Contacts only — no case files or finances" },
  { value: "case_manager",    label: "Case Manager",      icon: FolderKanban, description: "Traffic controller — leads, assessments, applications, assignments. Full case access, no finance" },
  { value: "filing_officer",  label: "Filing Officer",    icon: FileText,   description: "Forms, documents, IMM forms, PNP portals (full-time)" },
  { value: "filing_parttime", label: "Filing Part-Timer", icon: EyeOff,     description: "Masked case view — case ID + documents only, no client contacts (privacy model)" },
  { value: "accounts",        label: "Accounts Officer",  icon: Calculator, description: "Invoices, retainers, fees. Client name + financials only" },
  // Legacy roles kept for existing rows
  { value: "senior_advisor",  label: "Senior Advisor (legacy)", icon: User, description: "Legacy role — reassign when convenient" },
  { value: "accountant",      label: "Accountant (legacy)",     icon: User, description: "Legacy role — use Accounts Officer instead" },
  { value: "support",         label: "Support (legacy)",        icon: User, description: "Legacy role — use Intake Officer instead" },
];

const ROLE_TONE: Record<string, string> = {
  owner:           "bg-gold/20 text-gold-foreground border-gold/30",
  admin:           "bg-primary/10 text-primary border-primary/20",
  intake_officer:  "bg-sky-100 text-sky-700 border-sky-200",
  case_manager:    "bg-blue-100 text-blue-700 border-blue-200",
  filing_officer:  "bg-violet-100 text-violet-700 border-violet-200",
  filing_parttime: "bg-muted text-muted-foreground border-border",
  accounts:        "bg-emerald-100 text-emerald-700 border-emerald-200",
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
  id: null, full_name: "", email: "", role: "intake_officer", phone: "", is_active: true, visa_specialties: "",
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
      if (form.id) {
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
        const { error } = await supabase.from("staff_profiles").update(payload).eq("id", form.id);
        if (error) throw error;
        void writeAudit({ action: "UPDATE", entity_type: "staff_profiles", entity_id: form.id, changes: payload });
        toast.success("Staff profile updated");
      } else {
        // NEW STAFF: link an existing auth login via fn_add_staff (sql/26)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).rpc("fn_add_staff", {
          p_email: form.email.trim(),
          p_full_name: form.full_name.trim(),
          p_role: form.role,
          p_phone: form.phone.trim() || null,
        });
        if (error) {
          if (/fn_add_staff/i.test(error.message) && /not (exist|found)/i.test(error.message)) {
            toast.error("Run sql/26_staff_management.sql in Supabase first, then try again.");
          } else {
            toast.error(error.message);
          }
          setSaving(false);
          return;
        }
        void writeAudit({ action: "CREATE", entity_type: "staff_profiles", entity_id: String(data ?? ""), changes: { email: form.email, role: form.role } });
        toast.success(`${form.full_name.trim()} added to the team`);
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
              <Plus className="h-4 w-4 mr-1.5" /> Add Staff
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
            {ROLES.filter((r) => !r.label.includes("legacy")).map((r) => {
              const Icon = r.icon;
              return (
                <div key={r.value} className="flex items-center gap-3 text-sm">
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium border w-36 text-center shrink-0", ROLE_TONE[r.value] ?? "bg-muted text-muted-foreground border-border")}>
                    <Icon className="h-2.5 w-2.5 inline mr-0.5" />{r.label}
                  </span>
                  <span className="text-muted-foreground">{r.description}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Note: role-based data hiding (masked files for part-timers, finance-only for accounts) activates with the upcoming permissions pack. Until then roles are labels + navigation gates.
          </p>
        </div>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-navy">
              {form.id ? "Edit Staff Profile" : "Add Staff Member"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!form.id && (
              <div className="rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-xs text-muted-foreground space-y-1.5">
                <p className="font-medium text-foreground">Two quick steps:</p>
                <p><b>1.</b> Create their login first:{" "}
                  <a
                    href="https://supabase.com/dashboard/project/ocnsavosheduqzmeyvcd/auth/users"
                    target="_blank" rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >Supabase → Auth → Add user ↗</a>{" "}
                  (email + temporary password)
                </p>
                <p><b>2.</b> Enter the <b>same email</b> below with their name and role, then Save.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Full name *</Label>
                <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} disabled={!!form.id} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role *</Label>
                <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.filter((r) => form.id || !r.label.includes("legacy")).map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91…" />
              </div>
            </div>
            {form.id && (
              <>
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
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving…" : form.id ? "Save changes" : "Add to team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
