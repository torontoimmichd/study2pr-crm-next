"use client";

import { NavLink, useLocation } from "@/lib/router-compat";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  Briefcase,
  CheckSquare,
  Inbox,
  MessageSquare,
  GitBranch,
  DollarSign,
  Building2,
  ShieldCheck,
  Settings,
  LogOut,
  Crown,
  Calendar,
  Phone,
  Mail,
  FileText,
  Receipt,
  Wallet,
  BookOpen,
  Sparkles,
  Lock,
  ClipboardList,
  BarChart3, AlarmClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, hasRole, type StaffRole } from "@/lib/auth-context";
import { initials } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: StaffRole[]; // omit = all staff
  badgeKey?: "inbox" | "tasks" | "leads" | "cases" | "ircc";
  goldIcon?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  roles?: StaffRole[];
}

const STAFF_GROUPS: NavGroup[] = [
  {
    label: "My Work",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/inbox", label: "My Inbox", icon: Inbox, badgeKey: "inbox", roles: ["owner", "admin", "senior_advisor", "case_manager"] },
      { to: "/tasks", label: "My Tasks", icon: CheckSquare, badgeKey: "tasks" },
      { to: "/calendar", label: "Calendar", icon: Calendar },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { to: "/leads", label: "Leads", icon: UserPlus, badgeKey: "leads" },
      { to: "/assessments", label: "Assessments", icon: ClipboardList },
      { to: "/cases", label: "Cases", icon: Briefcase, badgeKey: "cases" },
      { to: "/clients", label: "Clients", icon: Users },
      { to: "/documents", label: "Documents", icon: FileText },
    ],
  },
  {
    label: "Comms",
    items: [
      { to: "/messages", label: "Unified Inbox", icon: MessageSquare, roles: ["owner", "admin", "senior_advisor", "case_manager", "support"] },
      { to: "/calls", label: "Call Log", icon: Phone },
      { to: "/ircc", label: "IRCC Emails", icon: Mail, badgeKey: "ircc" },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/invoices", label: "Invoices", icon: Receipt },
      { to: "/payments", label: "Payments", icon: Wallet },
      { to: "/my-commissions", label: "My Commissions", icon: DollarSign },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { to: "/knowledge/canon", label: "IRCC Canon", icon: BookOpen },
      { to: "/knowledge/ai", label: "Ask AI", icon: Sparkles },
    ],
  },
];

const ADMIN_GROUP: NavGroup = {
  label: "Management",
  roles: ["owner", "admin"],
  items: [
    { to: "/digest", label: "Manager Digest", icon: ClipboardList, roles: ["owner", "admin"] },
    { to: "/followups", label: "Follow-up Integrity", icon: AlarmClock, roles: ["owner", "admin", "senior_advisor"] },
    { to: "/reports", label: "Reports", icon: BarChart3, roles: ["owner", "admin", "senior_advisor"] },
    { to: "/finance", label: "Finance", icon: DollarSign, roles: ["owner", "admin", "accountant"] },
    { to: "/hr", label: "HR / Team", icon: Building2, roles: ["owner", "admin"] },
    // Audit Log and Workflows live in the Control Center (Admin → System / Configure)
    // — removed here to avoid showing the same module in two places.
    { to: "/admin", label: "Control Center", icon: Lock, roles: ["owner", "admin"], goldIcon: true },
  ],
};

export function AppSidebar() {
  const { profile, signOut, user } = useAuth();
  const location = useLocation();
  const { state, setOpen } = useSidebar();
  const collapsed = state === "collapsed";

  // Auto-hide: expand on hover, collapse on leave
  const hoverTimer = useRef<number | null>(null);
  const handleMouseEnter = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setOpen(true), 120);
  };
  const handleMouseLeave = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setOpen(false), 180);
  };
  useEffect(() => () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
  }, []);

  const showExpanded = !collapsed;

  // Live counts for badges
  const { data: counts } = useQuery({
    queryKey: ["sidebar-badge-counts", user?.id],
    enabled: !!user?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const meId = user!.id;
      const [tasksRes, leadsRes, casesRes, irccRes, inboxRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("assigned_to", meId)
          .is("completed_at", null),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("assigned_to", meId)
          .not("lifecycle_state", "in", "(converted,cold,not_eligible,lost)"),
        supabase
          .from("cases")
          .select("id", { count: "exact", head: true })
          .eq("case_manager_id", meId)
          .neq("is_archived", true),
        supabase
          .from("ircc_emails")
          .select("id", { count: "exact", head: true })
          .eq("requires_action", true)
          .is("processed_at", null),
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("direction", "inbound")
          .eq("is_read", false),
      ]);
      return {
        tasks: tasksRes.count ?? 0,
        leads: leadsRes.count ?? 0,
        cases: casesRes.count ?? 0,
        ircc: irccRes.count ?? 0,
        inbox: inboxRes.count ?? 0,
      };
    },
  });

  const visibleGroups: NavGroup[] = [...STAFF_GROUPS, ADMIN_GROUP].filter(
    (g) => !g.roles || (profile && hasRole(profile, ...g.roles)),
  );

  const isActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(to + "/");

  const getBadge = (key?: NavItem["badgeKey"]) => {
    if (!key || !counts) return undefined;
    const v = counts[key];
    return v && v > 0 ? v : undefined;
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Brand */}
      <SidebarHeader className="border-b border-sidebar-border">
        <div className={cn("flex items-center gap-2 px-2 py-2", !showExpanded && "justify-center px-0")}>
          <div className="h-8 w-8 rounded-md bg-gold flex items-center justify-center shadow-sm shrink-0">
            <Crown className="h-4 w-4 text-gold-foreground" />
          </div>
          {showExpanded && (
            <div className="min-w-0">
              <div className="font-display text-lg leading-none text-white truncate">Study2PR</div>
              <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60 mt-0.5">
                CRM
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {visibleGroups.map((group) => {
          const items = group.items.filter(
            (it) => !it.roles || (profile && hasRole(profile, ...it.roles)),
          );
          if (!items.length) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const active = isActive(item.to);
                    const badge = getBadge(item.badgeKey);
                    const Icon = item.icon;
                    const inner = (
                      <NavLink
                        to={item.to}
                        className={cn(
                          "relative flex items-center gap-3 w-full",
                          active && "font-medium",
                        )}
                      >
                        {active && (
                          <span
                            aria-hidden
                            className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-gold"
                          />
                        )}
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            item.goldIcon ? "text-gold" : active ? "text-gold" : "opacity-70",
                          )}
                        />
                        {showExpanded && (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {badge !== undefined && (
                              <span
                                className={cn(
                                  "ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                                  item.badgeKey === "ircc" || item.badgeKey === "inbox"
                                    ? "bg-destructive/15 text-destructive"
                                    : "bg-sidebar-accent text-sidebar-accent-foreground",
                                )}
                              >
                                {badge > 99 ? "99+" : badge}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    );

                    const button = (
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className={cn(
                          "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
                        )}
                      >
                        {inner}
                      </SidebarMenuButton>
                    );

                    return (
                      <SidebarMenuItem key={item.to}>
                        {!showExpanded ? (
                          <Tooltip>
                            <TooltipTrigger asChild>{button}</TooltipTrigger>
                            <TooltipContent side="right">
                              {item.label}
                              {badge !== undefined && ` (${badge})`}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          button
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      {/* User footer */}
      {profile && (
        <SidebarFooter className="border-t border-sidebar-border">
          <div className={cn("flex items-center gap-2.5 px-2 py-2", !showExpanded && "justify-center px-0")}>
            <div className="h-9 w-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-medium text-sidebar-accent-foreground shrink-0">
              {initials(profile.full_name)}
            </div>
            {showExpanded && (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{profile.full_name}</div>
                  <div className="text-[11px] text-sidebar-foreground/60 capitalize truncate">
                    {profile.role.replace(/_/g, " ")}
                  </div>
                </div>
                <button
                  onClick={() => void signOut()}
                  className="p-1.5 rounded hover:bg-sidebar-accent transition-colors"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}

/**
 * Hook: persists sidebar open/closed state to localStorage and auto-collapses
 * when the viewport falls below `lg` (1024px).
 */
/**
 * Auto-hide sidebar: always starts collapsed (icon-only).
 * Hover on the sidebar expands it; mouse-leave collapses it back.
 * Users can still pin it open by clicking the SidebarTrigger.
 */
export function useSidebarPersistence() {
  // Always default to collapsed — hover is the expand mechanism
  const [open, setOpen] = useState(false);
  return [open, setOpen] as const;
}
