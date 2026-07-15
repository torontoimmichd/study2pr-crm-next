"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { fmtDateTimeIST, fmtMoney } from "@/lib/format";
import { RecordPaymentDialog } from "@/components/RecordPaymentDialog";

interface Props {
  caseId: string;
  clientId: string;
  quotedFeeInr: number;
}

export function CasePaymentsTab({ caseId, clientId, quotedFeeInr }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["case-payments-full", caseId],
    queryFn: async () => {
      const { data: invs } = await supabase.from("invoices").select("id, invoice_number, currency").eq("case_id", caseId);
      const invIds = (invs ?? []).map(i => i.id);
      const invMap = new Map((invs ?? []).map(i => [i.id, i]));
      const { data: pays } = invIds.length
        ? await supabase.from("payments").select("*").in("invoice_id", invIds).order("paid_at", { ascending: false })
        : { data: [] };
      return { payments: (pays ?? []).map(p => ({ ...p, invoice_number: invMap.get(p.invoice_id)?.invoice_number ?? "—" })) };
    },
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["case-payments-full", caseId] });
    void qc.invalidateQueries({ queryKey: ["case-invoices", caseId] });
    void qc.invalidateQueries({ queryKey: ["case", caseId] });
  };

  const totalPaidInr = (data?.payments ?? []).filter(p => p.currency === "INR").reduce((s, p) => s + Number(p.amount), 0);
  const totalPaidOther = (data?.payments ?? []).filter(p => p.currency !== "INR");

  return (
    <div className="card-surface overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm font-semibold">Payments</h3>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />Record payment
        </Button>
      </div>

      {isLoading ? (
        <p className="p-6 text-sm text-muted-foreground">Loading…</p>
      ) : !data?.payments.length ? (
        <p className="p-8 text-sm text-muted-foreground text-center">No payments recorded yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5">Date</th>
              <th className="text-left px-4 py-2.5">Invoice</th>
              <th className="text-left px-4 py-2.5">Method</th>
              <th className="text-left px-4 py-2.5">Reference</th>
              <th className="text-right px-4 py-2.5">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.payments.map(p => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmtDateTimeIST(p.paid_at)}</td>
                <td className="px-4 py-2.5 font-medium">{p.invoice_number}</td>
                <td className="px-4 py-2.5 text-xs capitalize">{p.provider ?? "—"}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.provider_reference ?? "—"}</td>
                <td className="px-4 py-2.5 text-right font-medium">{fmtMoney(Number(p.amount), p.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="border-t border-border bg-muted/20 px-4 py-3 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Paid <span className="font-semibold text-foreground">{fmtMoney(totalPaidInr, "INR")}</span> of{" "}
          <span className="font-semibold text-foreground">{fmtMoney(quotedFeeInr, "INR")}</span> agreed
          {totalPaidOther.length > 0 && (
            <span> · plus {totalPaidOther.map(p => fmtMoney(Number(p.amount), p.currency)).join(", ")}</span>
          )}
        </div>
        <div className="text-xs">
          {quotedFeeInr > 0 && (
            <span className="font-medium">{Math.min(100, Math.round((totalPaidInr / quotedFeeInr) * 100))}%</span>
          )}
        </div>
      </div>

      <RecordPaymentDialog open={open} onOpenChange={setOpen} caseId={caseId} clientId={clientId} onRecorded={refresh} />
    </div>
  );
}
