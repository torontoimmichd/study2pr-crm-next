"use client";

// src/components/manager/AllCounselorsTable.tsx
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { DateRange } from "./DateRangeBranchFilter";

interface Row {
  counselor_id: string;
  full_name: string;
  branch_code: string | null;
  performance_rating: number;
  chain_tasks_30d: number;
  chain_tasks_on_time_30d: number;
  sla_breaches_30d: number;
  pending_prospectives: number;
  active_cases: number;
  revenue_90d: number;
}

interface Props {
  dateRange: DateRange;
  branchFilter: string[];
  onOpenCounselor: (id: string) => void;
}

export function AllCounselorsTable({ dateRange, branchFilter, onOpenCounselor }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<keyof Row>("performance_rating");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    void dateRange;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = (supabase as any).from("v_counselor_performance").select("*");
        if (branchFilter.length > 0) q = q.in("branch_code", branchFilter);
        const { data } = await q;
        setRows((data as Row[]) || []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [dateRange, branchFilter]);

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] as number; const bv = b[sortKey] as number;
    return (sortDir === "asc" ? 1 : -1) * (av > bv ? 1 : -1);
  });

  function exportCsv() {
    const headers = ["counselor_id", "full_name", "branch_code", "rating", "chain_tasks_30d", "on_time_30d", "breaches_30d", "pending", "active_cases", "revenue_90d"];
    const lines = [headers.join(",")];
    for (const r of sorted) {
      lines.push([
        r.counselor_id, JSON.stringify(r.full_name), r.branch_code || "",
        r.performance_rating, r.chain_tasks_30d, r.chain_tasks_on_time_30d,
        r.sla_breaches_30d, r.pending_prospectives, r.active_cases, r.revenue_90d
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `counselor_performance_${dateRange}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const columns: Array<keyof Row> = ["full_name", "branch_code", "performance_rating", "chain_tasks_30d", "sla_breaches_30d", "pending_prospectives", "active_cases", "revenue_90d"];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">All counselors performance</h3>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="w-3 h-3 mr-1" /> Export CSV
        </Button>
      </div>
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto my-6" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                {columns.map(k => (
                  <th key={k} className="py-1.5 cursor-pointer hover:text-foreground pr-3" onClick={() => {
                    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
                    else { setSortKey(k); setSortDir("desc"); }
                  }}>
                    {k.replace(/_/g, " ")}{sortKey === k && (sortDir === "asc" ? " ↑" : " ↓")}
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.counselor_id} className="border-b last:border-0">
                  <td className="py-1.5 font-medium pr-3">{r.full_name}</td>
                  <td className="pr-3">{r.branch_code || "—"}</td>
                  <td className="pr-3">{Number(r.performance_rating).toFixed(2)}</td>
                  <td className="pr-3">{r.chain_tasks_30d}</td>
                  <td className={`pr-3 ${r.sla_breaches_30d > 0 ? "text-red-700 font-medium" : ""}`}>{r.sla_breaches_30d}</td>
                  <td className="pr-3">{r.pending_prospectives}</td>
                  <td className="pr-3">{r.active_cases}</td>
                  <td className="pr-3">CAD {Math.round(r.revenue_90d || 0).toLocaleString()}</td>
                  <td>
                    <Button size="sm" variant="ghost" onClick={() => onOpenCounselor(r.counselor_id)}>Open</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
