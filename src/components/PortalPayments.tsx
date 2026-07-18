"use client";

/**
 * PortalPayments — client-facing payments summary inside the portal.
 * Shows the client's own invoices + amounts paid/due. Read-only.
 * Requires the portal invoice RLS policy from sql/24 — until that runs,
 * the section simply renders nothing (no errors, no leaks).
 */

import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Invoice {
  id: string; invoice_number: string | null; issued_at: string | null;
  due_date: string | null; currency: string | null; total: number | null;
  paid_total: number | null; status: string | null;
}

const fmtMoney = (n: number | null, cur: string | null) =>
  n == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: cur || "INR", maximumFractionDigits: 0 }).format(n);

export function PortalPayments({ clientId }: { clientId: string }) {
  const { data: invoices } = useQuery({
    queryKey: ["portal-invoices", clientId],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, issued_at, due_date, currency, total, paid_total, status")
        .eq("client_id", clientId)
        .order("issued_at", { ascending: false });
      if (error) return []; // RLS not opened yet → show nothing quietly
      return (data ?? []) as Invoice[];
    },
  });

  if (!invoices?.length) return null;

  const totalDue = invoices.reduce((s, i) => s + Math.max((i.total ?? 0) - (i.paid_total ?? 0), 0), 0);
  const cur = invoices[0]?.currency ?? "INR";

  return (
    <div className="card-surface overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-display text-base text-navy flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Payments
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalDue > 0 ? `Balance due: ${fmtMoney(totalDue, cur)}` : "All settled — thank you!"}
          </p>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {invoices.map((inv) => {
          const due = Math.max((inv.total ?? 0) - (inv.paid_total ?? 0), 0);
          return (
            <li key={inv.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="flex-1 min-w-0">
                <span className="font-medium">{inv.invoice_number ?? "Invoice"}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
                  {inv.due_date && due > 0 ? ` · due ${new Date(inv.due_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{fmtMoney(inv.paid_total, inv.currency)} / {fmtMoney(inv.total, inv.currency)}</span>
              <span className={"text-[10px] uppercase rounded px-1.5 py-0.5 " +
                (due <= 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800")}>
                {due <= 0 ? "paid" : (inv.status ?? "due")}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
