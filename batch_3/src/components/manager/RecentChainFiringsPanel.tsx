"use client";

// src/components/manager/RecentChainFiringsPanel.tsx
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { DateRange } from "./DateRangeBranchFilter";

interface Firing {
  prospective_id: string;
  created_at: string;
  rule_code: string;
  target_application_type: string;
  status: string;
  counselor_name: string | null;
  family_unit_name: string | null;
}

interface Props {
  dateRange: DateRange;
  branchFilter: string[];
  onOpenProspective: (id: string) => void;
}

function relTime(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "<1h ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RecentChainFiringsPanel({ dateRange, branchFilter, onOpenProspective }: Props) {
  const [rows, setRows] = useState<Firing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void dateRange; void branchFilter;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any).from("v_recent_chain_firings").select("*").limit(20);
        setRows((data as Firing[]) || []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [dateRange, branchFilter]);

  return (
    <Card className="p-4">
      <h3 className="font-semibold text-sm mb-3">Recent chain firings</h3>
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto my-6" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No recent activity.</p>
      ) : (
        <div className="divide-y">
          {rows.map(r => (
            <button
              key={r.prospective_id}
              onClick={() => onOpenProspective(r.prospective_id)}
              className="w-full text-left flex items-start gap-2 py-2 hover:bg-muted/50 -mx-2 px-2 rounded"
            >
              <p className="text-[10px] text-muted-foreground w-14 shrink-0 mt-0.5">{relTime(r.created_at)}</p>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{r.rule_code}</span>
                  <span className="text-muted-foreground"> → {r.target_application_type}</span>
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {r.family_unit_name || "—"} · {r.counselor_name || "—"}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">{r.status.replace(/_/g, " ")}</Badge>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
