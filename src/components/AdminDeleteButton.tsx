"use client";

/**
 * AdminDeleteButton — owner/admin-only delete for a lead, application or client.
 *
 * The database already does the hard part and has for a while; there was simply no
 * button. This component is a thin front end over two existing functions, verified
 * live 2026-08-13:
 *
 *   fn_delete_impact(p_type text, p_id uuid) -> jsonb
 *       STABLE. Returns what would be lost: label, related counts, and paid_inr.
 *   fn_admin_delete(p_type text, p_id uuid, p_reason text) -> jsonb
 *       SECURITY DEFINER. Refuses unless fn_is_owner_admin(); refuses a blank
 *       reason; refuses outright if paid_inr > 0; snapshots the row into
 *       deletion_archive before deleting.
 *
 * p_type is exactly 'lead' | 'case' | 'client' — those three strings are what the
 * function branches on. Anything else returns null and fn_admin_delete raises.
 *
 * DELIBERATE: the button is hidden for non-admins AND the database refuses them
 * anyway. The hiding is courtesy; fn_is_owner_admin() is the actual control. Do not
 * "simplify" by trusting the client-side role check alone.
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router-compat";
import { Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { writeAudit } from "@/lib/audit";

export type DeletableType = "lead" | "case" | "client";

interface Impact {
  label?: string | null;
  paid_inr?: number | string | null;
  [key: string]: unknown;
}

const NOUN: Record<DeletableType, string> = {
  lead: "lead",
  case: "application",
  client: "client",
};

const AFTER: Record<DeletableType, string> = {
  lead: "/leads",
  case: "/cases",
  client: "/clients",
};

/** Counts worth showing, in the order they matter. Keys come from fn_delete_impact. */
const COUNT_KEYS = [
  "cases", "invoices", "documents", "tasks", "assessments",
  "applicants", "messages", "conversations",
];

/**
 * fn_delete_impact also returns BOOLEAN keys, which the numeric filter above drops.
 * They matter more than any of the counts: deleting a lead that already became a
 * client, or a client whose portal login exists, is the consequential case.
 */
const FLAG_KEYS: Record<string, string> = {
  converted_client: "This lead has already been converted to a client.",
  portal_user: "This client has a portal login linked.",
};

/** Query keys to drop so a deleted row cannot flash back from cache. */
const INVALIDATE: Record<DeletableType, string[]> = {
  lead:   ["leads", "leads-all", "lead-list", "sidebar-badge-counts"],
  case:   ["cases", "cases-all", "applications", "sidebar-badge-counts"],
  client: ["clients", "clients-all", "sidebar-badge-counts"],
};

export function AdminDeleteButton({
  type, id, label, onDeleted,
}: {
  type: DeletableType;
  id: string;
  /** Fallback name if fn_delete_impact has none. */
  label?: string | null;
  /** If given, called instead of navigating away. */
  onDeleted?: () => void;
}) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const isAdmin = profile?.role === "owner" || profile?.role === "admin";
  if (!isAdmin) return null;

  const openDialog = async () => {
    setOpen(true);
    setReason("");
    setImpact(null);
    setLoading(true);
    const { data, error } = await supabase.rpc("fn_delete_impact", { p_type: type, p_id: id });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setImpact((data ?? null) as Impact | null);
  };

  const paid = Number(impact?.paid_inr ?? 0);
  const blockedByMoney = paid > 0;
  const name = (impact?.label as string | null) || label || id.slice(0, 8);

  const counts = impact
    ? COUNT_KEYS
        .map((k) => ({ k, n: Number(impact[k] ?? 0) }))
        .filter((c) => Number.isFinite(c.n) && c.n > 0)
    : [];

  const flags = impact
    ? Object.keys(FLAG_KEYS).filter((k) => impact[k] === true).map((k) => FLAG_KEYS[k])
    : [];

  const confirm = async () => {
    if (!reason.trim()) { toast.error("Write why this is being deleted"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("fn_admin_delete", {
      p_type: type, p_id: id, p_reason: reason.trim(),
    });
    setBusy(false);
    if (error) {
      // The database's messages are written for a human — show them verbatim
      // rather than replacing them with something vaguer.
      toast.error(error.message);
      return;
    }
    void writeAudit({
      action: "DELETE",
      entity_type: type === "case" ? "cases" : type === "lead" ? "leads" : "clients",
      entity_id: id,
      changes: { reason: reason.trim() },
    });
    // Drop the caches that still hold this row, or it flashes back on the list
    // page until the next refetch.
    for (const key of INVALIDATE[type]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
    void qc.removeQueries({ queryKey: [type === "case" ? "case" : type, id] });

    toast.success(`${NOUN[type][0].toUpperCase()}${NOUN[type].slice(1)} deleted and archived`);
    setOpen(false);
    if (onDeleted) onDeleted();
    else navigate(AFTER[type]);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={openDialog}
        className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4 mr-1.5" />
        Delete
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this {NOUN[type]}?</DialogTitle>
          </DialogHeader>

          {loading ? (
            <p className="text-sm text-muted-foreground py-4">Checking what this would remove…</p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Deleting </span>
                  <span className="font-semibold">{name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  A snapshot is written to <span className="font-mono">deletion_archive</span> first,
                  with your reason. This is not reversible from the app.
                </p>
              </div>

              {counts.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                    Attached to this {NOUN[type]}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {counts.map((c) => (
                      <span key={c.k}>
                        <b className="tabular-nums">{c.n}</b>{" "}
                        <span className="text-muted-foreground">{c.k.replace(/_/g, " ")}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {flags.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/10 p-3 flex gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <ul className="text-sm text-amber-900 dark:text-amber-200 space-y-0.5">
                    {flags.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                </div>
              )}

              {blockedByMoney && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-semibold text-destructive">
                      ₹{paid.toLocaleString("en-IN")} has been paid against this {NOUN[type]}.
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      The database will refuse this delete. Reverse or refund the payment first —
                      deleting it now would change your revenue totals with no trace.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Reason (required)</Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. duplicate of an existing record"
                  disabled={blockedByMoney}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button
              onClick={confirm}
              disabled={busy || loading || blockedByMoney || !reason.trim()}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {busy ? "Deleting…" : `Delete ${NOUN[type]}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
