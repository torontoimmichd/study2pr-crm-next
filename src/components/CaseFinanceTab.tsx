/**
 * CaseFinanceTab.tsx — NEW FILE (2026-07-13)
 * Save in GitHub as: src/components/CaseFinanceTab.tsx
 *
 * Per-application finance view: summary (quoted fee, received, balance due,
 * expenses, net position) + a manual ledger to record ANYTHING financial —
 * expenses, govt fees, vendor payments, commission payouts, refunds,
 * adjustments, other income. Reads v_case_financials + finance_entries
 * (created by sql/13). Visible to owner/admin/accountant only.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Wallet, TrendingDown, TrendingUp, Scale } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasRole } from "@/lib/auth-context";
import { fmtRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const ENTRY_TYPES: { value: string; label: string; direction: "in" | "out" }[] = [
  { value: "expense",           label: "Expense",                 direction: "out" },
  { value: "govt_fee",          label: "Government Fee",          direction: "out" },
  { value: "vendor_payment",    label: "Vendor Payment",          direction: "out" },
  { value: "commission_payout", label: "Commission Payout",       direction: "out" },
  { value: "refund_to_client",  label: "Refund to Client",        direction: "out" },
  { value: "adjustment",        label: "Adjustment",              direction: "out" },
  { value: "other_income",      label: "Other Income (received)", direction: "in" },
];

const inr = (n: number | null | undefined) => `₹${Number(n ?? 0).toLocaleString("en-IN")}`;

interface EntryRow {
  id: string; entry_type: string; direction: string; amount_inr: number;
  category: string | null; paid_to: string | null; description: string | null;
  incurred_on: string; created_at: string;
}

interface Summary {
  quoted_fee_inr: number; payments_received_inr: number; balance_due_inr: number;
  ledger_outflow_inr: number; ledger_inflow_inr: number;
  commissions_accrued_inr: number; net_position_inr: number;
}

export function CaseFinanceTab({ caseId, clientId }: { caseId: string; clientId?: string | null }) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const allowed = hasRole(profile, "owner", "admin", "accountant");

  const [open, setOpen]           = useState(false);
  const [entryType, setEntryType] = useState("expense");
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [amount, setAmount]       = useState("");
  const [category, setCategory]   = useState("");
  const [paidTo, setPaidTo]       = useState("");
  const [desc, setDesc]           = useState("");
  const [date, setDate]           = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving]       = useState(false);

  const { data: summary } = useQuery({
    queryKey: ["case-financials", caseId],
    enabled: allowed,
    queryFn: async (): Promise<Summary | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("v_case_financials").select("*").eq("case_id", caseId).maybeSingle();
      if (error) return null; // view not installed yet — hide summary quietly
      return data;
    },
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["finance-entries", caseId],
    enabled: allowed,
    queryFn: async (): Promise<EntryRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("finance_entries")
        .select("id, entry_type, direction, amount_inr, category, paid_to, description, incurred_on, created_at")
        .eq("case_id", caseId)
        .order("incurred_on", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const onTypeChange = (v: string) => {
    setEntryType(v);
    setDirection(ENTRY_TYPES.find(t => t.value === v)?.direction ?? "out");
  };

  const save = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("finance_entries").insert({
      case_id: caseId, client_id: clientId ?? null,
      entry_type: entryType, direction, amount_inr: amt,
      category: category.trim() || null, paid_to: paidTo.trim() || null,
      description: desc.trim() || null, incurred_on: date,
      recorded_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("finance_entries")
        ? "Finance ledger not found — run sql/13 in Supabase first."
        : error.message);
      return;
    }
    toast.success("Entry recorded");
    setAmount(""); setCategory(""); setPaidTo(""); setDesc(""); setOpen(false);
    void qc.invalidateQueries({ queryKey: ["finance-entries", caseId] });
    void qc.invalidateQueries({ queryKey: ["case-financials", caseId] });
    void qc.invalidateQueries({ queryKey: ["timeline"] });
  };

  if (!allowed) {
    return <div className="py-8 text-center text-sm text-muted-foreground">
      Finance details are visible to owner, admin and accountant only.
    </div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="card-surface p-3 rounded-lg border">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" /> Quoted / Received</div>
            <div className="text-sm font-bold mt-0.5">{inr(summary.quoted_fee_inr)} <span className="text-muted-foreground font-normal">/</span> {inr(summary.payments_received_inr)}</div>
          </div>
          <div className="card-surface p-3 rounded-lg border">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Scale className="h-3 w-3" /> Balance Due</div>
            <div className="text-sm font-bold mt-0.5">{inr(summary.balance_due_inr)}</div>
          </div>
          <div className="card-surface p-3 rounded-lg border">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Outflow (ledger + commissions)</div>
            <div className="text-sm font-bold mt-0.5 text-red-600">{inr(summary.ledger_outflow_inr + summary.commissions_accrued_inr)}</div>
          </div>
          <div className="card-surface p-3 rounded-lg border">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Net Position</div>
            <div className={`text-sm font-bold mt-0.5 ${summary.net_position_inr >= 0 ? "text-emerald-600" : "text-red-600"}`}>{inr(summary.net_position_inr)}</div>
          </div>
        </div>
      )}

      {/* Ledger */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Financial Records ({entries.length})</h3>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Record Entry</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…
        </div>
      ) : entries.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Nothing recorded yet. Expenses, govt fees, commissions, refunds — record them here.
        </div>
      ) : (
        <div className="card-surface rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] text-muted-foreground">
                <th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Category</th>
                <th className="p-2">Paid To</th><th className="p-2">Description</th><th className="p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="p-2 whitespace-nowrap" title={fmtRelative(e.created_at)}>{e.incurred_on}</td>
                  <td className="p-2 capitalize">{e.entry_type.replace(/_/g, " ")}</td>
                  <td className="p-2">{e.category ?? "—"}</td>
                  <td className="p-2">{e.paid_to ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">{e.description ?? "—"}</td>
                  <td className={`p-2 text-right font-semibold whitespace-nowrap ${e.direction === "in" ? "text-emerald-600" : "text-red-600"}`}>
                    {e.direction === "in" ? "+" : "−"}{inr(e.amount_inr)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Record entry dialog */}
      <Dialog open={open} onOpenChange={v => { if (!saving) setOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-base">Record Financial Entry</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Type</Label>
              <Select value={entryType} onValueChange={onTypeChange}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTRY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Amount (₹) *</Label>
              <Input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            {entryType === "adjustment" && (
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Direction</Label>
                <Select value={direction} onValueChange={v => setDirection(v as "in" | "out")}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="out">Money out</SelectItem>
                    <SelectItem value="in">Money in</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="courier, biometrics…" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Paid To / From</Label>
              <Input value={paidTo} onChange={e => setPaidTo(e.target.value)} placeholder="vendor, staff, client…" className="h-9 text-sm" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Description</Label>
              <Textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder="What was this for?" className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={() => void save()} disabled={saving || !amount}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
