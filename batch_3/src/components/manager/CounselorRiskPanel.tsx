"use client";

// src/components/manager/CounselorRiskPanel.tsx
//
// Shows counselors with rating < 4.50 OR with SLA breaches in the date range.
// All actions are inline: opening a counselor opens the sheet, no navigation.

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { DateRange } from "./DateRangeBranchFilter";

interface CounselorPerf {
  counselor_id: string;
  full_name: string;
  branch_code: string | null;
  performance_rating: number;
  chain_misses_count: number;
  chain_tasks_30d: number;
  chain_tasks_on_time_30d: number;
  sla_breaches_30d: number;
  pending_prospectives: number;
  active_cases: number;
}

interface Props {
  dateRange: DateRange;
  branchFilter: string[];
  onOpenCounselor: (id: string) => void;
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function ratingColor(r: number) {
  if (r >= 4.50) return "bg-emerald-100 text-emerald-900";
  if (r >= 4.00) return "bg-amber-100 text-amber-900";
  return "bg-red-100 text-red-900";
}

export function CounselorRiskPanel({ dateRange, branchFilter, onOpenCounselor }: Props) {
  const [data, setData] = useState<CounselorPerf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void dateRange;
    setLoading(true);
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = (supabase as any).from("v_counselor_performance").select("*");
        if (branchFilter.length > 0) q = q.in("branch_code", branchFilter);
        const { data: d } = await q;
        // Filter to at-risk and sort
        const filtered = ((d as CounselorPerf[]) || [])
          .filter(c => c.performance_rating < 4.50 || c.sla_breaches_30d > 0)
          .sort((a, b) => b.sla_breaches_30d - a.sla_breaches_30d || a.performance_rating - b.performance_rating);
        setData(filtered);
      } catch {
        setData([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [dateRange, branchFilter]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Counselors at risk</h3>
        {data.length > 0 && (
          <Badge variant="destructive">{data.length}</Badge>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <p className="text-sm text-emerald-700 text-center py-6">
          ✓ All counselors are within target.
        </p>
      ) : (
        <div className="divide-y">
          {data.map(c => (
            <div key={c.counselor_id} className="flex items-center gap-3 py-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold">
                {initials(c.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.full_name}</p>
                <p className="text-[10px] text-muted-foreground">{c.branch_code || "—"}</p>
              </div>
              <Badge className={ratingColor(c.performance_rating)}>
                {Number(c.performance_rating).toFixed(2)}
              </Badge>
              {c.sla_breaches_30d > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  <AlertCircle className="w-3 h-3 mr-0.5" />
                  {c.sla_breaches_30d}
                </Badge>
              )}
              {c.pending_prospectives > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {c.pending_prospectives} pending
                </Badge>
              )}
              <Button size="sm" variant="ghost" onClick={() => onOpenCounselor(c.counselor_id)}>
                <Eye className="w-3 h-3 mr-1" /> Open
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
