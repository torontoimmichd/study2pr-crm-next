"use client";

import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import { Tag, GitBranch, Timer, Sparkles, Sparkle, History, AlertCircle, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/AdminLayout";
import { fmtDateTimeIST, fmtRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AuditRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  occurred_at: string;
  actor_id: string | null;
  changes: unknown;
}

interface PendingEdit {
  id: string;
  proposed_at: string | null;
  proposed_by: string | null;
  proposed_change: unknown;
  step_template_id: string | null;
  status: string | null;
}

const ADMIN_ENTITY_TYPES = [
  "visa_types",
  "visa_sub_types",
  "sla_rules",
  "upsell_triggers",
  "commission_rules",
  "office_hours_config",
  "office_holidays",
  "step_templates",
  "step_template_edits",
  "lead_sources",
  "document_checklists",
  "staff_profiles",
];

function describeChange(action: string, entity: string, changes: unknown): string {
  const ent = entity.replace(/_/g, " ");
  const verb = action === "CREATE" ? "Created" : action === "UPDATE" ? "Updated" : action === "DELETE" ? "Deleted" : action;
  if (changes && typeof changes === "object" && !Array.isArray(changes)) {
    const obj = changes as Record<string, unknown>;
    const keys = Object.keys(obj).slice(0, 3);
    if (keys.length) return `${verb} ${ent} (${keys.join(", ")})`;
  }
  return `${verb} ${ent}`;
}

export default function AdminHome() {
  const { data: stats } = useQuery({
    queryKey: ["admin-home-stats"],
    queryFn: async () => {
      const [visa, steps, sla, upsell, pending] = await Promise.all([
        supabase.from("visa_types").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("step_templates").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("sla_rules").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("upsell_triggers").select("code, is_active"),
        supabase.from("step_template_edits").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      const upsellRows = upsell.data ?? [];
      return {
        visa: visa.count ?? 0,
        steps: steps.count ?? 0,
        sla: sla.count ?? 0,
        pendingEdits: pending.count ?? 0,
        upsellActive: upsellRows.filter((r) => r.is_active).length,
        upsellPaused: upsellRows.filter((r) => !r.is_active).length,
      };
    },
  });

  const { data: recentChanges } = useQuery({
    queryKey: ["admin-recent-changes"],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("audit_log")
        .select("id, action, entity_type, entity_id, occurred_at, actor_id, changes")
        .in("entity_type", ADMIN_ENTITY_TYPES)
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(20);
      return (data ?? []) as AuditRow[];
    },
  });

  const { data: pendingApprovals } = useQuery({
    queryKey: ["admin-pending-approvals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("step_template_edits")
        .select("id, proposed_at, proposed_by, proposed_change, step_template_id, status")
        .eq("status", "pending")
        .order("proposed_at", { ascending: false })
        .limit(10);
      return (data ?? []) as PendingEdit[];
    },
  });

  const actorIds = Array.from(
    new Set([
      ...(recentChanges?.map((r) => r.actor_id).filter(Boolean) as string[] ?? []),
      ...(pendingApprovals?.map((r) => r.proposed_by).filter(Boolean) as string[] ?? []),
    ]),
  );

  const { data: actors } = useQuery({
    queryKey: ["admin-actors", actorIds.sort().join(",")],
    enabled: actorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_profiles")
        .select("id, full_name, role")
        .in("id", actorIds);
      return Object.fromEntries((data ?? []).map((s) => [s.id, s]));
    },
  });

  const actorName = (id: string | null | undefined) =>
    id ? actors?.[id]?.full_name ?? "Unknown" : "System";

  return (
    <>
      <AdminPageHeader
        title="Admin Home"
        subtitle="Configure every part of the CRM, website, and client portal — no code deploys required."
      />

      <div className="p-6 space-y-6">
        {/* Hero callout */}
        <div className="relative rounded-xl border border-gold/40 bg-gradient-to-br from-gold/15 via-secondary to-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-gold/20 flex items-center justify-center shrink-0">
              <Sparkle className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h2 className="font-display text-lg text-navy">Developer mode is you.</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
                Anything you change here takes effect instantly across the website, CRM, and client portal — no
                code deployment, no developer involvement. Every change is logged with your name and timestamp.
              </p>
            </div>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            icon={Tag}
            label="Visa Types"
            value={stats?.visa ?? 0}
            subtitle="All active"
            to="/admin/visa-types"
          />
          <StatTile
            icon={GitBranch}
            label="Workflow Steps"
            value={stats?.steps ?? 0}
            subtitle={`${stats?.pendingEdits ?? 0} edits pending approval`}
            highlight={(stats?.pendingEdits ?? 0) > 0}
            to="/admin/workflows"
          />
          <StatTile
            icon={Timer}
            label="Active SLAs"
            value={stats?.sla ?? 0}
            subtitle="Office-hour aware"
            to="/admin/sla-rules"
          />
          <StatTile
            icon={Sparkles}
            label="Upsell Triggers"
            value={(stats?.upsellActive ?? 0) + (stats?.upsellPaused ?? 0)}
            subtitle={`${stats?.upsellActive ?? 0} active, ${stats?.upsellPaused ?? 0} paused`}
            to="/admin/upsell-triggers"
          />
        </div>

        {/* Needs your approval */}
        <section className="card-surface">
          <header className="px-5 py-3 border-b border-border flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-gold" />
            <h3 className="font-display text-base text-navy">Needs Your Approval</h3>
            {pendingApprovals && pendingApprovals.length > 0 && (
              <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-gold/15 text-gold-foreground border border-gold/30 font-medium">
                {pendingApprovals.length}
              </span>
            )}
          </header>
          {!pendingApprovals || pendingApprovals.length === 0 ? (
            <div className="px-5 py-8 text-sm text-muted-foreground text-center">
              No pending workflow edits awaiting approval.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proposed By</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApprovals.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{actorName(p.proposed_by)}</TableCell>
                    <TableCell className="text-sm">Step template change</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtRelative(p.proposed_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/workflows">Review</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        {/* Recent changes */}
        <section className="card-surface">
          <header className="px-5 py-3 border-b border-border flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-display text-base text-navy">Recent Configuration Changes</h3>
            <span className="ml-auto text-[11px] text-muted-foreground">Last 7 days</span>
          </header>
          {!recentChanges || recentChanges.length === 0 ? (
            <div className="px-5 py-8 text-sm text-muted-foreground text-center">
              No configuration changes in the past 7 days.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right w-[110px]">Rollback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentChanges.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDateTimeIST(r.occurred_at)}
                    </TableCell>
                    <TableCell className="text-sm">{actorName(r.actor_id)}</TableCell>
                    <TableCell className="text-sm">
                      {describeChange(r.action, r.entity_type, r.changes)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          toast("Rollback isn't wired yet — track this change manually for now.")
                        }
                      >
                        <Undo2 className="h-3.5 w-3.5 mr-1" />
                        Rollback
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  subtitle,
  to,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  subtitle: string;
  to: string;
  highlight?: boolean;
}) {
  return (
    <Link
      to={to}
      className="card-surface p-4 block hover:border-gold/50 transition-colors group"
    >
      <div className="flex items-start justify-between">
        <div className="stat-label">{label}</div>
        <Icon className="h-4 w-4 text-gold opacity-70 group-hover:opacity-100" />
      </div>
      <div className="stat-value mt-2">{value}</div>
      <div
        className={`text-xs mt-1 ${highlight ? "text-destructive font-medium" : "text-muted-foreground"}`}
      >
        {subtitle}
      </div>
    </Link>
  );
}
