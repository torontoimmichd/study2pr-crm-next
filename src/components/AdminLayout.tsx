"use client";

import { NavLink, useLocation, Navigate } from "@/lib/router-compat";
import {
  Settings as SettingsIcon,
  Tag,
  Globe,
  FolderTree,
  GitBranch,
  FileCheck2,
  Timer,
  Sparkles,
  PartyPopper,
  Percent,
  Mail,
  Users,
  Lock,
  Layers,
  Plug,
  Clock,
  ShieldCheck,
  Database,
  ArrowLeft,
  Crown,
  AlertCircle,
  Handshake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, hasRole } from "@/lib/auth-context";
import { toast } from "sonner";

interface AdminNavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean; // links outside /admin
}

interface AdminGroup {
  label: string;
  items: AdminNavItem[];
}

const ADMIN_GROUPS: AdminGroup[] = [
  {
    label: "Operations",
    items: [
      { to: "/admin", label: "Admin Home", icon: SettingsIcon },
      { to: "/admin/pending-approvals", label: "Pending Approvals", icon: AlertCircle },
    ],
  },
  {
    label: "Configure",
    items: [
      { to: "/admin/countries", label: "Countries", icon: Globe },
      { to: "/admin/visa-categories", label: "Visa Categories", icon: FolderTree },
      { to: "/admin/visa-types", label: "Visa Sub-Types & Fees", icon: Tag },
      { to: "/admin/workflows", label: "Workflows & Stages", icon: GitBranch },
      { to: "/admin/document-checklists", label: "Document Checklists", icon: FileCheck2 },
      { to: "/admin/sla-rules", label: "SLA Rules", icon: Timer },
      { to: "/admin/upsell-triggers", label: "Upsell Triggers", icon: Sparkles },
      { to: "/admin/commission-rules", label: "Commission Rules", icon: Percent },
      { to: "/admin/templates", label: "Email & WhatsApp Templates", icon: Mail },
      { to: "/admin/festivals", label: "Festival Greetings", icon: PartyPopper },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/admin/staff", label: "Staff & Roles", icon: Users },
      { to: "/admin/permissions", label: "Permissions Matrix", icon: Lock },
    ],
  },
  {
    label: "Sources",
    items: [
      { to: "/admin/lead-sources", label: "Lead Sources", icon: Layers },
      { to: "/admin/referral-partners", label: "Referral Partners", icon: Users },
      { to: "/admin/agent-partners", label: "Agent Partners", icon: Handshake },
      { to: "/admin/integrations", label: "Integrations", icon: Plug },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/office-hours", label: "Office Hours", icon: Clock },
      { to: "/audit", label: "Audit Log", icon: ShieldCheck, external: true },
      { to: "/admin/backups", label: "Backups & Archive", icon: Database },
    ],
  },
];

import type { ReactNode as AdminChildren } from "react";

export function AdminLayout({ children }: { children?: AdminChildren }) {
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile || !hasRole(profile, "owner", "admin")) {
    toast.error("Admin mode requires owner or admin role");
    return <Navigate to="/dashboard" replace />;
  }

  const isActive = (to: string) =>
    to === "/admin"
      ? location.pathname === "/admin"
      : location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <div className="flex min-h-[calc(100vh-3rem)]">
      {/* Admin sub-sidebar */}
      <aside className="w-60 shrink-0 border-r border-border bg-sidebar/40 sticky top-12 h-[calc(100vh-3rem)] overflow-y-auto">
        <div className="p-4 border-b border-border">
          <NavLink to="/dashboard" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3">
            <ArrowLeft className="h-3 w-3" />
            Back to CRM
          </NavLink>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-gold flex items-center justify-center shadow-sm">
              <Crown className="h-4 w-4 text-gold-foreground" />
            </div>
            <div>
              <div className="font-display text-base text-navy leading-tight">Control Center</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {hasRole(profile, "owner") ? "Owner Console" : "Admin Console"}
              </div>
            </div>
          </div>
        </div>
        <nav className="p-2 space-y-4">
          {ADMIN_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                {group.label}
              </div>
              <div className="mt-1 space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.to);
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                      )}
                    >
                      {active && (
                        <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-1 rounded-r-full bg-gold" />
                      )}
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-gold" : "opacity-70")} />
                      <span className="truncate">{item.label}</span>
                      {item.external && (
                        <span className="ml-auto text-[9px] uppercase tracking-wider text-muted-foreground">↗</span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Owner badge bar */}
        <div className="px-6 py-2 border-b border-border bg-card/50 flex items-center justify-end gap-2 sticky top-12 z-10">
          <div className="text-[11px] text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{profile.full_name}</span>{" "}
            <span className="inline-flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full bg-gold/15 text-gold-foreground border border-gold/30 text-[10px] font-medium uppercase tracking-wider">
              <Crown className="h-3 w-3 text-gold" />
              {hasRole(profile, "owner") ? "Owner" : "Admin"}
            </span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumb?: { label: string; to?: string }[];
}

export function AdminPageHeader({ title, subtitle, actions, breadcrumb }: AdminPageHeaderProps) {
  return (
    <div className="px-6 py-5 border-b border-border bg-card/30">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
          {breadcrumb.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {b.to ? (
                <NavLink to={b.to} className="hover:text-foreground transition-colors">
                  {b.label}
                </NavLink>
              ) : (
                <span>{b.label}</span>
              )}
              {i < breadcrumb.length - 1 && <span className="opacity-40">›</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-navy leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
