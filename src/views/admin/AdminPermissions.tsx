"use client";

/**
 * AdminPermissions.tsx
 * Role-based permissions matrix — visual reference for what each role can do.
 * Route: /admin/permissions  (owner + admin only)
 * Read-only — permissions are enforced in RLS + ProtectedRoute, not here.
 */

import { Check, X, Info } from "lucide-react";
import { AdminPageHeader } from "@/components/AdminLayout";
import { cn } from "@/lib/utils";

const ROLES = ["owner", "admin", "senior_advisor", "case_manager", "document_specialist", "support", "accountant"] as const;
type Role = typeof ROLES[number];

const ROLE_LABELS: Record<Role, string> = {
  owner:               "Owner",
  admin:               "Admin",
  senior_advisor:      "Sr. Advisor",
  case_manager:        "Case Mgr",
  document_specialist: "Doc Specialist",
  support:             "Support",
  accountant:          "Accountant",
};

const ROLE_COLORS: Record<Role, string> = {
  owner:               "bg-primary text-primary-foreground",
  admin:               "bg-navy/80 text-white",
  senior_advisor:      "bg-gold/80 text-gold-foreground",
  case_manager:        "bg-blue-600 text-white",
  document_specialist: "bg-purple-600 text-white",
  support:             "bg-teal-600 text-white",
  accountant:          "bg-emerald-700 text-white",
};

type Perm = "full" | "read" | "none" | "own";
type PermRow = { section: string; feature: string; note?: string; perms: Record<Role, Perm> };

const MATRIX: Array<{ group: string; rows: PermRow[] }> = [
  {
    group: "Leads",
    rows: [
      { section: "Leads", feature: "View all leads",        perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"read", support:"full", accountant:"none" } },
      { section: "Leads", feature: "Create new lead",       perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"none", support:"full", accountant:"none" } },
      { section: "Leads", feature: "Edit / stage leads",    perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"none", support:"none", accountant:"none" } },
      { section: "Leads", feature: "Delete leads",          perms: { owner:"full", admin:"full", senior_advisor:"none", case_manager:"none", document_specialist:"none", support:"none", accountant:"none" } },
      { section: "Leads", feature: "Log calls",             perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"none", support:"full", accountant:"none" } },
    ],
  },
  {
    group: "Clients & Cases",
    rows: [
      { section: "Clients", feature: "View clients",        perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"full", support:"full", accountant:"none" } },
      { section: "Clients", feature: "Create clients",      perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"none", support:"none", accountant:"none" } },
      { section: "Cases",   feature: "View cases",          perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"full", support:"full", accountant:"none" } },
      { section: "Cases",   feature: "Create / edit cases", perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"none", support:"none", accountant:"none" } },
      { section: "Cases",   feature: "Move case stage",     perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"none", support:"none", accountant:"none" } },
    ],
  },
  {
    group: "Documents",
    rows: [
      { section: "Documents", feature: "View documents",    perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"full", support:"full", accountant:"none" } },
      { section: "Documents", feature: "Verify documents",  perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"full", support:"none", accountant:"none" } },
      { section: "Documents", feature: "Reject documents",  perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"full", support:"none", accountant:"none" } },
      { section: "Documents", feature: "Upload documents",  perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"full", support:"none", accountant:"none" } },
    ],
  },
  {
    group: "Tasks & Calendar",
    rows: [
      { section: "Tasks", feature: "View all tasks",        perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"full", support:"full", accountant:"none" } },
      { section: "Tasks", feature: "Complete / reopen",     perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"full", support:"full", accountant:"none" } },
      { section: "Tasks", feature: "Assign to others",      perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"none", document_specialist:"none", support:"none", accountant:"none" } },
      { section: "Calendar", feature: "View calendar",      perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"full", support:"full", accountant:"none" } },
    ],
  },
  {
    group: "Communications",
    rows: [
      { section: "Inbox", feature: "View inbox",            perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"none", support:"none", accountant:"none" } },
      { section: "Messages", feature: "View messages",      perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"none", support:"full", accountant:"none" } },
      { section: "IRCC", feature: "View IRCC emails",       perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"none", support:"none", accountant:"none" } },
    ],
  },
  {
    group: "Finance",
    rows: [
      { section: "Finance", feature: "View Finance page",   perms: { owner:"full", admin:"full", senior_advisor:"none", case_manager:"none", document_specialist:"none", support:"none", accountant:"full" } },
      { section: "Invoices", feature: "View invoices",      perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"none", support:"none", accountant:"full" } },
      { section: "Invoices", feature: "Create invoices",    perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"none", support:"none", accountant:"full" } },
      { section: "Invoices", feature: "Print invoice PDF",  perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"none", support:"none", accountant:"full" } },
      { section: "Payments", feature: "Record payments",    perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"none", support:"none", accountant:"full" } },
      { section: "Commissions", feature: "View own commissions", perms: { owner:"full", admin:"full", senior_advisor:"own", case_manager:"own", document_specialist:"own", support:"own", accountant:"own" } },
    ],
  },
  {
    group: "Knowledge Base",
    rows: [
      { section: "Knowledge", feature: "View knowledge canon", perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"full", support:"full", accountant:"none" } },
      { section: "Knowledge", feature: "Edit knowledge base",  perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"none", document_specialist:"none", support:"none", accountant:"none" } },
      { section: "Knowledge", feature: "AI knowledge search",  perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"full", document_specialist:"full", support:"full", accountant:"none" } },
    ],
  },
  {
    group: "Management",
    rows: [
      { section: "Digest",    feature: "Manager digest",    perms: { owner:"full", admin:"full", senior_advisor:"none", case_manager:"none", document_specialist:"none", support:"none", accountant:"none" } },
      { section: "HR",        feature: "HR page",           perms: { owner:"full", admin:"full", senior_advisor:"none", case_manager:"none", document_specialist:"none", support:"none", accountant:"none" } },
      { section: "Audit",     feature: "Audit log",         perms: { owner:"full", admin:"full", senior_advisor:"none", case_manager:"none", document_specialist:"none", support:"none", accountant:"none" } },
      { section: "Workflows", feature: "Manage workflows",  perms: { owner:"full", admin:"full", senior_advisor:"full", case_manager:"none", document_specialist:"none", support:"none", accountant:"none" } },
    ],
  },
  {
    group: "Admin / Control Center",
    rows: [
      { section: "Admin", feature: "Visa types",             perms: { owner:"full", admin:"full", senior_advisor:"none", case_manager:"none", document_specialist:"none", support:"none", accountant:"none" } },
      { section: "Admin", feature: "Lead sources",           perms: { owner:"full", admin:"full", senior_advisor:"none", case_manager:"none", document_specialist:"none", support:"none", accountant:"none" } },
      { section: "Admin", feature: "SLA rules",              perms: { owner:"full", admin:"full", senior_advisor:"none", case_manager:"none", document_specialist:"none", support:"none", accountant:"none" } },
      { section: "Admin", feature: "Commission rules",       perms: { owner:"full", admin:"full", senior_advisor:"none", case_manager:"none", document_specialist:"none", support:"none", accountant:"none" } },
      { section: "Admin", feature: "Upsell triggers",        perms: { owner:"full", admin:"full", senior_advisor:"none", case_manager:"none", document_specialist:"none", support:"none", accountant:"none" } },
      { section: "Admin", feature: "Document checklists",    perms: { owner:"full", admin:"full", senior_advisor:"none", case_manager:"none", document_specialist:"none", support:"none", accountant:"none" } },
      { section: "Admin", feature: "Templates",              perms: { owner:"full", admin:"full", senior_advisor:"none", case_manager:"none", document_specialist:"none", support:"none", accountant:"none" } },
      { section: "Admin", feature: "Staff management",       perms: { owner:"full", admin:"full", senior_advisor:"none", case_manager:"none", document_specialist:"none", support:"none", accountant:"none" } },
      { section: "Admin", feature: "Pending approvals",      perms: { owner:"full", admin:"full", senior_advisor:"none", case_manager:"none", document_specialist:"none", support:"none", accountant:"none" } },
    ],
  },
];

const PERM_ICONS: Record<Perm, React.ReactNode> = {
  full: <Check className="h-4 w-4 text-success" />,
  read: <Check className="h-4 w-4 text-warning" />,
  own:  <span className="text-[10px] font-bold text-blue-600">OWN</span>,
  none: <X className="h-4 w-4 text-muted-foreground opacity-30" />,
};

const PERM_BG: Record<Perm, string> = {
  full: "bg-success/5",
  read: "bg-warning/5",
  own:  "bg-blue-50",
  none: "",
};

export default function AdminPermissions() {
  return (
    <>
      <AdminPageHeader
        title="Permissions Matrix"
        subtitle="What each staff role can do in the system. Enforced via Supabase RLS and route guards — this is a reference view only."
      />

      <div className="p-6 space-y-4">
        {/* Legend */}
        <div className="card-surface p-4 flex flex-wrap gap-4 text-xs">
          <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-success" /> Full access</span>
          <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-warning" /> Read-only</span>
          <span className="flex items-center gap-1.5"><span className="text-[10px] font-bold text-blue-600">OWN</span> Own records only</span>
          <span className="flex items-center gap-1.5"><X className="h-4 w-4 text-muted-foreground opacity-40" /> No access</span>
          <span className="flex items-center gap-1.5 ml-auto text-muted-foreground">
            <Info className="h-3.5 w-3.5" /> Actual permissions enforced by Supabase RLS — this matrix is indicative only.
          </span>
        </div>

        {/* Matrix */}
        <div className="card-surface overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-48">Feature</th>
                {ROLES.map((r) => (
                  <th key={r} className="py-3 text-center text-[11px] font-semibold uppercase tracking-wider min-w-[90px]">
                    <span className={cn("px-2 py-1 rounded-full whitespace-nowrap", ROLE_COLORS[r])}>
                      {ROLE_LABELS[r]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((group) => (
                <>
                  <tr key={`grp-${group.group}`} className="bg-muted/50">
                    <td colSpan={ROLES.length + 1} className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {group.group}
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={`${row.section}-${row.feature}`} className="border-b border-border last:border-b-0 hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        <div className="text-sm">{row.feature}</div>
                        {row.note && <div className="text-[11px] text-muted-foreground">{row.note}</div>}
                      </td>
                      {ROLES.map((role) => {
                        const perm = row.perms[role];
                        return (
                          <td key={role} className={cn("py-2.5 text-center", PERM_BG[perm])}>
                            <div className="flex justify-center">
                              {PERM_ICONS[perm]}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          To change permissions, update Row Level Security policies in Supabase and route guards in ProtectedRoute.
        </p>
      </div>
    </>
  );
}
