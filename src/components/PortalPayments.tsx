"use client";

import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const fmtMoney = (n: number | null, cur: string | null) =>
  n == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: cur || "INR", maximumFractionDigits: 0 }).format(n);

export function PortalPayments({ caseId }: { caseId: string }) {
  const { data: financials } = useQuery({
    queryKey: ["portal-financials", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_case_financials")
        .select("case_id, quoted_fee_inr, ledger_inflow_inr, payments_received_inr, balance_due_inr")
        .eq("case_id", caseId)
        .maybeSingle();
      if (error) return null;
      return data;
    },
  });

  if (!financials) return null;
  const quoted = financials.quoted_fee_inr ?? 0;
  const invoiced = financials.ledger_inflow_inr ?? 0;
  const paid = financials.payments_received_inr ?? 0;
  const balance = financials.balance_due_inr ?? Math.max(quoted - paid, 0);

  return (
    <div className="card-surface overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-display text-base text-navy flex items-center gap-2"><Receipt className="h-4 w-4" /> Payments</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {balance > 0 ? `Balance due: ${fmtMoney(balance, "INR")}` : "All settled — thank you!"}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
        {[["Quoted", quoted], ["Invoiced", invoiced], ["Paid", paid], ["Balance", balance]].map(([label, amount]) => (
          <div key={label} className="bg-card px-3 py-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="text-sm font-semibold mt-1">{fmtMoney(Number(amount), "INR")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
