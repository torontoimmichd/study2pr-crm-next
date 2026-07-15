"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import { FileText, Search, Download } from "lucide-react";
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
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  partial: "bg-warning/15 text-warning",
  paid: "bg-success/15 text-success",
  overdue: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground line-through",
};

interface Invoice {
  id: string;
  invoice_number: string;
  status: string | null;
  total: number;
  paid_total: number | null;
  currency: string;
  issued_at: string | null;
  due_date: string | null;
  client_name?: string;
  case_ref?: string | null;
}

export default function Invoices() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, status, total, paid_total, currency, issued_at, due_date, client_id, case_id")
        .order("issued_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const clientIds = [...new Set((data ?? []).map((r) => r.client_id).filter(Boolean))];
      const caseIds   = [...new Set((data ?? []).map((r) => r.case_id).filter(Boolean) as string[])];

      const [clientsRes, casesRes] = await Promise.all([
        clientIds.length
          ? supabase.from("clients").select("id, full_name").in("id", clientIds)
          : Promise.resolve({ data: [] }),
        caseIds.length
          ? supabase.from("cases").select("id, case_ref").in("id", caseIds)
          : Promise.resolve({ data: [] }),
      ]);

      const clientMap = new Map(
        ((clientsRes.data ?? []) as { id: string; full_name: string }[]).map((c) => [c.id, c.full_name])
      );
      const caseMap = new Map(
        ((casesRes.data ?? []) as { id: string; case_ref: string }[]).map((c) => [c.id, c.case_ref])
      );

      return (data ?? []).map((r) => ({
        ...r,
        client_name: clientMap.get(r.client_id) ?? "Unknown",
        case_ref: r.case_id ? caseMap.get(r.case_id) ?? null : null,
      })) as Invoice[];
    },
  });

  const statuses = ["all", "draft", "sent", "partial", "paid", "overdue", "cancelled"];

  const filtered = invoices.filter((inv) => {
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      inv.invoice_number.toLowerCase().includes(q) ||
      (inv.client_name ?? "").toLowerCase().includes(q) ||
      (inv.case_ref ?? "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const handleExport = () => {
    downloadCsv(
      filtered.map((inv) => ({
        invoice_number: inv.invoice_number,
        client: inv.client_name,
        case_ref: inv.case_ref ?? "",
        status: inv.status ?? "",
        total: inv.total,
        paid: inv.paid_total ?? 0,
        currency: inv.currency,
        issued_at: fmtDateIST(inv.issued_at),
        due_date: fmtDateIST(inv.due_date),
      })),
      "invoices.csv"
    );
  };

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="All client invoices across cases"
        actions={
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search invoice #, client, case…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs capitalize transition-colors border",
                  statusFilter === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices found" description="Invoices are created from case detail pages." />
        ) : (
          <div className="card-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Invoice #", "Client", "Case", "Status", "Total", "Paid", "Due Date"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((inv) => {
                  const outstanding = inv.total - (inv.paid_total ?? 0);
                  const isOverdue =
                    inv.status === "overdue" ||
                    (inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== "paid");
                  return (
                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-medium">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-foreground">{inv.client_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{inv.case_ref ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_TONE[inv.status ?? "draft"])}>
                          {inv.status ?? "draft"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{fmtMoney(inv.total, inv.currency)}</td>
                      <td className="px-4 py-3">
                        <div className="text-success font-medium">{fmtMoney(inv.paid_total ?? 0, inv.currency)}</div>
                        {outstanding > 0 && (
                          <div className={cn("text-xs", isOverdue ? "text-destructive" : "text-muted-foreground")}>
                            {fmtMoney(outstanding, inv.currency)} due
                          </div>
                        )}
                      </td>
                      <td className={cn("px-4 py-3", isOverdue && inv.status !== "paid" ? "text-destructive font-medium" : "text-muted-foreground")}>
                        {fmtDateIST(inv.due_date)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground">
              {filtered.length} invoice{filtered.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
