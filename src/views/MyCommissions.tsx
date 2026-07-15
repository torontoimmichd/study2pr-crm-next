"use client";

import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingUp, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { TableSkeleton } from "@/components/TableSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { fmtDateIST, fmtMoney } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, string> = {
  accrued: "bg-warning/15 text-warning",
  paid:    "bg-success/15 text-success",
  clawed_back: "bg-destructive/15 text-destructive",
};

interface Commission {
  id: string;
  amount_inr: number;
  status: string | null;
  earned_at: string | null;
  paid_at: string | null;
  rule_code: string | null;
  notes: string | null;
  case_ref?: string | null;
}

export default function MyCommissions() {
  const { user } = useAuth();

  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ["my-commissions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commissions")
        .select("id, amount_inr, status, earned_at, paid_at, rule_code, notes, case_id")
        .eq("staff_id", user!.id)
        .order("earned_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const caseIds = [...new Set((data ?? []).map((r) => r.case_id).filter(Boolean) as string[])];
      const { data: cases } = caseIds.length
        ? await supabase.from("cases").select("id, case_ref").in("id", caseIds)
        : { data: [] };

      const caseMap = new Map(
        ((cases ?? []) as { id: string; case_ref: string }[]).map((c) => [c.id, c.case_ref])
      );

      return (data ?? []).map((r) => ({
        ...r,
        case_ref: r.case_id ? caseMap.get(r.case_id) ?? null : null,
      })) as Commission[];
    },
  });

  const accrued = commissions.filter((c) => c.status === "accrued").reduce((s, c) => s + c.amount_inr, 0);
  const paid    = commissions.filter((c) => c.status === "paid").reduce((s, c) => s + c.amount_inr, 0);
  const total   = commissions.reduce((s, c) => s + c.amount_inr, 0);

  return (
    <div>
      <PageHeader title="My Commissions" subtitle="Your earned commissions across all cases" />

      <div className="p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card-surface p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Clock className="h-3.5 w-3.5" /> Accrued (unpaid)
            </div>
            <div className="text-2xl font-semibold text-warning">{fmtMoney(accrued)}</div>
          </div>
          <div className="card-surface p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <DollarSign className="h-3.5 w-3.5" /> Paid out
            </div>
            <div className="text-2xl font-semibold text-success">{fmtMoney(paid)}</div>
          </div>
          <div className="card-surface p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> Total earned
            </div>
            <div className="text-2xl font-semibold">{fmtMoney(total)}</div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : commissions.length === 0 ? (
          <EmptyState icon={DollarSign} title="No commissions yet" description="Commissions appear here once cases convert and invoices are paid." />
        ) : (
          <div className="card-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Earned", "Case", "Rule", "Amount", "Status", "Paid on", "Notes"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {commissions.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{fmtDateIST(c.earned_at)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.case_ref ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.rule_code ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold">{fmtMoney(c.amount_inr)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_TONE[c.status ?? "accrued"])}>
                        {(c.status ?? "accrued").replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDateIST(c.paid_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{c.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground">
              {commissions.length} commission record{commissions.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
