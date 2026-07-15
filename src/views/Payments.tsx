"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, Search, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { TableSkeleton } from "@/components/TableSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fmtDateIST, fmtMoney } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, string> = {
  succeeded: "bg-success/15 text-success",
  pending:   "bg-warning/15 text-warning",
  failed:    "bg-destructive/15 text-destructive",
  refunded:  "bg-muted text-muted-foreground",
};

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string | null;
  provider: string | null;
  provider_reference: string | null;
  paid_at: string | null;
  notes: string | null;
  invoice_number?: string;
  client_name?: string;
}

export default function Payments() {
  const [search, setSearch] = useState("");

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, currency, status, provider, provider_reference, paid_at, notes, invoice_id")
        .order("paid_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const invoiceIds = [...new Set((data ?? []).map((r) => r.invoice_id).filter(Boolean))];
      if (!invoiceIds.length) return (data ?? []) as Payment[];

      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, client_id")
        .in("id", invoiceIds);

      const clientIds = [...new Set((invoices ?? []).map((i) => i.client_id).filter(Boolean))];
      const { data: clients } = clientIds.length
        ? await supabase.from("clients").select("id, full_name").in("id", clientIds)
        : { data: [] };

      const clientMap = new Map(
        ((clients ?? []) as { id: string; full_name: string }[]).map((c) => [c.id, c.full_name])
      );
      const invMap = new Map(
        ((invoices ?? []) as { id: string; invoice_number: string; client_id: string }[]).map((i) => [
          i.id,
          { invoice_number: i.invoice_number, client_name: clientMap.get(i.client_id) ?? "Unknown" },
        ])
      );

      return (data ?? []).map((r) => ({
        ...r,
        invoice_number: invMap.get(r.invoice_id)?.invoice_number ?? r.invoice_id,
        client_name: invMap.get(r.invoice_id)?.client_name ?? "Unknown",
      })) as Payment[];
    },
  });

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (p.provider_reference ?? "").toLowerCase().includes(q) ||
      (p.invoice_number ?? "").toLowerCase().includes(q) ||
      (p.client_name ?? "").toLowerCase().includes(q) ||
      (p.provider ?? "").toLowerCase().includes(q)
    );
  });

  const totalReceived = filtered
    .filter((p) => p.status === "succeeded")
    .reduce((s, p) => s + p.amount, 0);

  const handleExport = () => {
    downloadCsv(
      filtered.map((p) => ({
        date: fmtDateIST(p.paid_at),
        client: p.client_name,
        invoice: p.invoice_number,
        amount: p.amount,
        currency: p.currency,
        status: p.status ?? "",
        provider: p.provider ?? "",
        reference: p.provider_reference ?? "",
      })),
      "payments.csv"
    );
  };

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="All payment transactions across invoices"
        actions={
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        {/* Summary strip */}
        <div className="flex gap-4">
          <div className="card-surface px-5 py-3 flex items-center gap-3">
            <Wallet className="h-5 w-5 text-success" />
            <div>
              <div className="text-xs text-muted-foreground">Total received (filtered)</div>
              <div className="font-semibold text-success">{fmtMoney(totalReceived)}</div>
            </div>
          </div>
          <div className="card-surface px-5 py-3">
            <div className="text-xs text-muted-foreground">Transactions</div>
            <div className="font-semibold">{filtered.length}</div>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search reference, invoice, client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Wallet} title="No payments found" description="Payments are recorded against invoices." />
        ) : (
          <div className="card-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Date", "Client", "Invoice #", "Amount", "Provider", "Reference", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{fmtDateIST(p.paid_at)}</td>
                    <td className="px-4 py-3">{p.client_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.invoice_number}</td>
                    <td className="px-4 py-3 font-semibold">{fmtMoney(p.amount, p.currency)}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{p.provider ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.provider_reference ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_TONE[p.status ?? "pending"])}>
                        {p.status ?? "pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground">
              {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
