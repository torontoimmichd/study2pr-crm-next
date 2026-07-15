"use client";

// src/components/manager/TopFamilyUnitsPanel.tsx
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Unit {
  id: string;
  unit_name: string;
  origin_country: string | null;
  expected_lifetime_revenue_cad: number;
  lifetime_revenue_cad: number;
  member_count: number;
  open_prospectives: number;
}

interface Props {
  onOpenFamily: (id: string) => void;
}

export function TopFamilyUnitsPanel({ onOpenFamily }: Props) {
  const [rows, setRows] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any).from("v_top_family_units").select("*").limit(10);
        setRows((data as Unit[]) || []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Card className="p-4">
      <h3 className="font-semibold text-sm mb-3">Top family units by LTV</h3>
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto my-6" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No family units yet.</p>
      ) : (
        <div className="divide-y">
          {rows.map(u => (
            <div key={u.id} className="flex items-center gap-2 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{u.unit_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {u.member_count} members · {u.origin_country || "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-emerald-700">
                  CAD {Math.round(u.expected_lifetime_revenue_cad || 0).toLocaleString()}
                </p>
                {u.open_prospectives > 0 && (
                  <Badge variant="secondary" className="text-[10px]">{u.open_prospectives} pending</Badge>
                )}
              </div>
              <Button size="sm" variant="ghost" onClick={() => onOpenFamily(u.id)}>
                <Eye className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
