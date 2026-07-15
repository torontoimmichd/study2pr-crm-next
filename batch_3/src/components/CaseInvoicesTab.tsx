"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { fmtDateIST, fmtMoney, fmtRelative } from "@/lib/format";
import { GenerateInvoiceDialog } from "@/components/GenerateInvoiceDialog";
import { InvoiceViewDialog } from "@/components/InvoiceViewDialog";

interface Props {
  caseId: string;
  clientId: string;
}

export function CaseInvoicesTab({ caseId, clientId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["case-invoices", caseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, total, currency, status, due_date, created_at, paid_total")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const statusClass = (s: string | null) => {
    if (s === "paid") return "bg-emerald-100 text-emerald-800";
    if (s === "partial") return "bg-amber-100 text-amber-800";
    if (s === "overdue") return "bg-red-100 text-red-800";
    if (s === "draft") return "bg-muted text-muted-foreground";
    return "bg-accent/10 text-accent";
  };

  return (
    <div className="card-surface overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm font-semibold">Invoices</h3>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />Generate invoice
        </Button>
      </div>

      {isLoading ? (
        <p className="p-6 text-sm text-muted-foreground">Loading…</p>
      ) : !invoices || invoices.length === 0 ? (
        <p className="p-8 text-sm text-muted-foreground text-center">No invoices generated yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5">Number</th>
              <th className="text-left px-4 py-2.5">Issued</th>
              <th className="text-left px-4 py-2.5">Due</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5">Paid / Total</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} className="border-t border-border">
                <td className="px-4 py-2.5 font-medium">{inv.invoice_number}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmtRelative(inv.created_at)}</td>
                <td className="px-4 py-2.5 text-xs">{inv.due_date ? fmtDateIST(inv.due_date) : "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusClass(inv.status)}`}>{inv.status ?? "draft"}</span>
                </td>
                <td className="px-4 py-2.5 text-right text-xs">
                  <span className="font-medium">{fmtMoney(Number(inv.paid_total ?? 0), inv.currency)}</span>
                  <span className="text-muted-foreground"> / {fmtMoney(Number(inv.total), inv.currency)}</span>
                </td>
                <td className="px-4 py-2.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => setViewingInvoiceId(inv.id)}
                    title="View / Print invoice"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <GenerateInvoiceDialog
        open={open}
        onOpenChange={setOpen}
        caseId={caseId}
        clientId={clientId}
        onCreated={() => qc.invalidateQueries({ queryKey: ["case-invoices", caseId] })}
      />

      <InvoiceViewDialog
        invoiceId={viewingInvoiceId}
        open={!!viewingInvoiceId}
        onOpenChange={(v) => !v && setViewingInvoiceId(null)}
      />
    </div>
  );
}
