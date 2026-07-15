"use client";

// src/components/manager/KpiHeader.tsx
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { DateRange } from "./DateRangeBranchFilter";

interface Kpis {
  chain_tasks_total: number;
  on_time: number;
  hit_rate: number;
  avg_rating: number;
  open_prospectives: number;
}

interface Props {
  dateRange: DateRange;
  branchFilter: string[];
}

export function KpiHeader({ dateRange, branchFilter }: Props) {
  const [kpis, setKpis] = useState<Kpis | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let perfQ = (supabase as any).from("v_counselor_performance").select("*");
        if (branchFilter.length > 0) perfQ = perfQ.in("branch_code", branchFilter);
        const { data: perf } = await perfQ;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const all = (perf as any[]) || [];
        const total = all.reduce((s, r) => s + (r.chain_tasks_30d || 0), 0);
        const onTime = all.reduce((s, r) => s + (r.chain_tasks_on_time_30d || 0), 0);
        const avgRating = all.length ? all.reduce((s, r) => s + Number(r.performance_rating), 0) / all.length : 0;
        const openProsp = all.reduce((s, r) => s + (r.pending_prospectives || 0), 0);
        setKpis({
          chain_tasks_total: total,
          on_time: onTime,
          hit_rate: total ? Math.round((onTime / total) * 100) : 0,
          avg_rating: avgRating,
          open_prospectives: openProsp,
        });
      } catch {
        // Views may not exist yet — graceful degradation
        setKpis({ chain_tasks_total: 0, on_time: 0, hit_rate: 0, avg_rating: 0, open_prospectives: 0 });
      }
    })();
    void dateRange;
  }, [dateRange, branchFilter]);

  const hitColor = kpis && kpis.hit_rate >= 90 ? "text-emerald-700"
    : kpis && kpis.hit_rate >= 70 ? "text-amber-700"
    : "text-red-700";
  const ratingColor = kpis && kpis.avg_rating >= 4.50 ? "text-emerald-700"
    : kpis && kpis.avg_rating >= 4.00 ? "text-amber-700"
    : "text-red-700";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <Card className="p-3 bg-slate-50">
        <p className="text-xs text-muted-foreground">Chain tasks ({dateRange})</p>
        <p className="text-2xl font-semibold mt-1">{kpis?.chain_tasks_total ?? "—"}</p>
      </Card>
      <Card className="p-3 bg-slate-50">
        <p className="text-xs text-muted-foreground">SLA hit rate</p>
        <p className={`text-2xl font-semibold mt-1 ${hitColor}`}>
          {kpis ? `${kpis.hit_rate}%` : "—"}
        </p>
      </Card>
      <Card className="p-3 bg-slate-50">
        <p className="text-xs text-muted-foreground">Avg counselor rating</p>
        <p className={`text-2xl font-semibold mt-1 ${ratingColor}`}>
          {kpis ? kpis.avg_rating.toFixed(2) : "—"}
        </p>
      </Card>
      <Card className="p-3 bg-slate-50">
        <p className="text-xs text-muted-foreground">Open prospectives</p>
        <p className="text-2xl font-semibold mt-1">{kpis?.open_prospectives ?? "—"}</p>
      </Card>
    </div>
  );
}
