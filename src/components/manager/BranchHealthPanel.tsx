"use client";

// src/components/manager/BranchHealthPanel.tsx
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Branch {
  branch_code: string;
  counselor_count: number;
  avg_rating: number;
  pending_prospectives: number;
  breaches_30d: number;
}

interface Props {
  branchFilter: string[];
}

export function BranchHealthPanel({ branchFilter }: Props) {
  const [rows, setRows] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = (supabase as any).from("v_branch_health").select("*");
        if (branchFilter.length > 0) q = q.in("branch_code", branchFilter);
        const { data } = await q;
        setRows((data as Branch[]) || []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [branchFilter]);

  return (
    <Card className="p-4">
      <h3 className="font-semibold text-sm mb-3">Branch health</h3>
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto my-6" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No branch data yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b">
              <th className="py-1.5">Branch</th>
              <th>Staff</th>
              <th>Rating</th>
              <th>Pending</th>
              <th>Breaches</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.branch_code} className="border-b last:border-0">
                <td className="py-1.5 font-medium">{r.branch_code}</td>
                <td>{r.counselor_count}</td>
                <td>{Number(r.avg_rating).toFixed(2)}</td>
                <td>{r.pending_prospectives ?? 0}</td>
                <td className={r.breaches_30d > 0 ? "text-red-700 font-medium" : ""}>{r.breaches_30d ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
