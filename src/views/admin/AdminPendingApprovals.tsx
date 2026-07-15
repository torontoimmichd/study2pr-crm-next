"use client";

/**
 * AdminPendingApprovals
 *
 * Centralised review queue for everything that requires owner/admin sign-off:
 *   • Workflow step-template edits proposed by senior advisors
 *   • (Extensible: expense approvals, role changes, etc.)
 *
 * Approve → sets status = 'approved' and applies the proposed_change
 * Reject  → sets status = 'rejected' with a rejection reason
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  Clock,
  GitBranch,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { fmtRelative, fmtDateTimeIST } from "@/lib/format";
import { toast } from "sonner";
import { writeAudit } from "@/lib/audit";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ── Types ────────────────────────────────────────────────────────────────────

interface StepEdit {
  id: string;
  proposed_at: string | null;
  proposed_by: string | null;
  proposed_change: unknown;
  step_template_id: string | null;
  status: string | null;
  actor_name?: string;
  step_label?: string | null;
}

type TabKey = "pending" | "resolved";

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminPendingApprovals() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<StepEdit | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  // Fetch edits with actor + step names
  const { data: edits, isLoading } = useQuery({
    queryKey: ["pending-approvals", tab],
    queryFn: async () => {
      const statusFilter = tab === "pending" ? ["pending"] : ["approved", "rejected"];
      const { data, error } = await supabase
        .from("step_template_edits")
        .select("id, proposed_at, proposed_by, proposed_change, step_template_id, status")
        .in("status", statusFilter)
        .order("proposed_at", { ascending: tab === "pending" });
      if (error) throw error;

      const rows = (data ?? []) as StepEdit[];
      if (!rows.length) return rows;

      // Resolve actor names
      const actorIds = [...new Set(rows.map((r) => r.proposed_by).filter(Boolean) as string[])];
      const stepIds  = [...new Set(rows.map((r) => r.step_template_id).filter(Boolean) as string[])];

      const [actorsRes, stepsRes] = await Promise.all([
        actorIds.length
          ? supabase.from("staff_profiles").select("id, full_name").in("id", actorIds)
          : Promise.resolve({ data: [] }),
        stepIds.length
          ? supabase.from("step_templates").select("id, label").in("id", stepIds)
          : Promise.resolve({ data: [] }),
      ]);

      const actorMap = new Map(
        ((actorsRes.data ?? []) as { id: string; full_name: string }[]).map((a) => [a.id, a.full_name]),
      );
      const stepMap = new Map(
        ((stepsRes.data ?? []) as { id: string; label: string }[]).map((s) => [s.id, s.label]),
      );

      return rows.map((r) => ({
        ...r,
        actor_name: r.proposed_by ? actorMap.get(r.proposed_by) ?? "Unknown" : "System",
        step_label: r.step_template_id ? stepMap.get(r.step_template_id) ?? null : null,
      }));
    },
  });

  const pending = (edits ?? []).filter((e) => e.status === "pending");

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["pending-approvals"] });
    void qc.invalidateQueries({ queryKey: ["admin-home-stats"] });
    void qc.invalidateQueries({ queryKey: ["admin-pending-approvals"] });
  };

  // ── Approve ────────────────────────────────────────────────────────────────

  const handleApprove = async (edit: StepEdit) => {
    setProcessing(true);
    try {
      // Update the step template with the proposed change
      if (edit.step_template_id && edit.proposed_change) {
        const { error: stepErr } = await supabase
          .from("step_templates")
          .update(edit.proposed_change as Record<string, unknown>)
          .eq("id", edit.step_template_id);
        if (stepErr) throw stepErr;
      }

      // Mark edit as approved
      const { error } = await supabase
        .from("step_template_edits")
        .update({ status: "approved", reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
        .eq("id", edit.id);
      if (error) throw error;

      void writeAudit({
        action: "UPDATE",
        entity_type: "step_template_edits",
        entity_id: edit.id,
        changes: { status: "approved", step_template_id: edit.step_template_id },
      });

      toast.success("Change approved and applied");
      refresh();
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to approve");
    } finally {
      setProcessing(false);
    }
  };

  // ── Reject ─────────────────────────────────────────────────────────────────

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("step_template_edits")
        .update({
          status: "rejected",
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          review_notes: rejectReason.trim(),
        })
        .eq("id", rejectTarget.id);
      if (error) throw error;

      void writeAudit({
        action: "UPDATE",
        entity_type: "step_template_edits",
        entity_id: rejectTarget.id,
        changes: { status: "rejected", review_notes: rejectReason.trim() },
      });

      toast.success("Change rejected");
      setRejectTarget(null);
      setRejectReason("");
      refresh();
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to reject");
    } finally {
      setProcessing(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <AdminPageHeader
        title="Pending Approvals"
        subtitle="Review and approve configuration changes proposed by your team."
        breadcrumb={[{ label: "Admin Home", to: "/admin" }, { label: "Pending Approvals" }]}
      />

      <div className="p-6 space-y-6">
        {/* Alert badge */}
        {pending.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gold/40 bg-gold/10">
            <AlertCircle className="h-4 w-4 text-gold shrink-0" />
            <span className="text-sm font-medium text-gold-foreground">
              {pending.length} item{pending.length !== 1 ? "s" : ""} awaiting your review
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {(["pending", "resolved"] as TabKey[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
              {t === "pending" && pending.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-destructive text-[10px] text-destructive-foreground font-bold">
                  {pending.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Items */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : !edits || edits.length === 0 ? (
          <div className="card-surface p-12 text-center">
            <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-3 opacity-60" />
            <p className="text-sm text-muted-foreground">
              {tab === "pending" ? "Nothing waiting for review — all clear!" : "No resolved items yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {edits.map((edit) => (
              <EditCard
                key={edit.id}
                edit={edit}
                expanded={expandedId === edit.id}
                onToggle={() => setExpandedId(expandedId === edit.id ? null : edit.id)}
                onApprove={() => void handleApprove(edit)}
                onReject={() => setRejectTarget(edit)}
                processing={processing}
                showActions={tab === "pending"}
              />
            ))}
          </div>
        )}
      </div>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(v) => { if (!v) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-navy">Reject Change</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Provide a reason so the proposer knows what to change.
            </div>
            <div className="space-y-1.5">
              <Label>Rejection reason *</Label>
              <Textarea
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. The proposed document name conflicts with our naming convention. Please update to use the format 'Type – Sub-type'…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleReject()}
              disabled={processing || !rejectReason.trim()}
            >
              {processing ? "Rejecting…" : "Reject change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── EditCard ─────────────────────────────────────────────────────────────────

function EditCard({
  edit,
  expanded,
  onToggle,
  onApprove,
  onReject,
  processing,
  showActions,
}: {
  edit: StepEdit;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  processing: boolean;
  showActions: boolean;
}) {
  const statusIcon = {
    pending:  <Clock      className="h-4 w-4 text-warning" />,
    approved: <CheckCircle2 className="h-4 w-4 text-success" />,
    rejected: <XCircle    className="h-4 w-4 text-destructive" />,
  }[edit.status ?? "pending"] ?? null;

  const statusLabel = {
    pending:  "Awaiting review",
    approved: "Approved",
    rejected: "Rejected",
  }[edit.status ?? "pending"] ?? edit.status;

  return (
    <div className="card-surface overflow-hidden">
      <div className="px-5 py-4 flex items-start gap-4">
        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-foreground">
                Workflow step edit
                {edit.step_label && (
                  <span className="ml-1.5 text-muted-foreground font-normal">— {edit.step_label}</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>Proposed by <strong>{edit.actor_name}</strong></span>
                <span>·</span>
                <span title={fmtDateTimeIST(edit.proposed_at)}>{fmtRelative(edit.proposed_at)}</span>
                <span>·</span>
                <span className="flex items-center gap-1">{statusIcon} {statusLabel}</span>
              </div>
            </div>
            <button
              onClick={onToggle}
              className="p-1.5 rounded hover:bg-muted transition-colors shrink-0"
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>

          {/* Proposed change diff */}
          {expanded && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
                Proposed changes
              </div>
              <pre className="text-xs bg-muted/60 rounded-md p-3 overflow-auto max-h-48 border border-border leading-relaxed whitespace-pre-wrap break-words">
                {JSON.stringify(edit.proposed_change, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {showActions && (
        <div className="px-5 py-3 border-t border-border bg-muted/30 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onReject} disabled={processing}>
            <XCircle className="h-3.5 w-3.5 mr-1.5 text-destructive" /> Reject
          </Button>
          <Button
            size="sm"
            onClick={onApprove}
            disabled={processing}
            className="bg-success hover:bg-success/90 text-success-foreground"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Approve & Apply
          </Button>
        </div>
      )}
    </div>
  );
}
