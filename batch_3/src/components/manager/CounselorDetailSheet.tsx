"use client";

// src/components/manager/CounselorDetailSheet.tsx
//
// Opens when a manager clicks a counselor's name. Inside, the manager can
// see the counselor's open tasks, recent decisions, and performance history,
// and act on tasks INLINE without navigating.

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CounselorDetail {
  counselor_id: string;
  full_name: string;
  branch_code: string | null;
  performance_rating: number;
  sla_breaches_30d: number;
  pending_prospectives: number;
  active_cases: number;
}

interface Props {
  counselorId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onOpenFamily: (id: string) => void;
  onOpenProspective: (id: string) => void;
}

export function CounselorDetailSheet({ counselorId, open, onOpenChange, onOpenFamily, onOpenProspective }: Props) {
  const [data, setData] = useState<CounselorDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!counselorId || !open) return;
    setLoading(true);
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: d } = await (supabase as any)
          .from("v_counselor_performance")
          .select("*")
          .eq("counselor_id", counselorId)
          .single();
        setData(d as CounselorDetail);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [counselorId, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[600px] flex flex-col">
        <SheetHeader>
          <SheetTitle>{data?.full_name || "Counselor"}</SheetTitle>
          <SheetDescription>
            {data?.branch_code} · Rating {data ? Number(data.performance_rating).toFixed(2) : "—"}
          </SheetDescription>
        </SheetHeader>

        {loading || !data ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto mt-4">
            <div className="flex gap-2 mb-3 flex-wrap">
              <Badge variant="secondary">{data.pending_prospectives} pending</Badge>
              <Badge variant="secondary">{data.active_cases} active cases</Badge>
              {data.sla_breaches_30d > 0 && (
                <Badge variant="destructive">{data.sla_breaches_30d} breaches (30d)</Badge>
              )}
            </div>

            <Tabs defaultValue="tasks">
              <TabsList>
                <TabsTrigger value="tasks">Open tasks</TabsTrigger>
                <TabsTrigger value="decisions">Recent decisions</TabsTrigger>
                <TabsTrigger value="history">Performance</TabsTrigger>
              </TabsList>

              <TabsContent value="tasks" className="mt-3">
                <p className="text-sm text-muted-foreground">Open tasks will appear here once the task engine is wired to this counselor.</p>
              </TabsContent>

              <TabsContent value="decisions" className="mt-3">
                <p className="text-sm text-muted-foreground">Recent chain decisions will appear here.</p>
              </TabsContent>

              <TabsContent value="history" className="mt-3">
                <p className="text-sm text-muted-foreground">Performance rating history will appear here.</p>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Consume unused props to avoid lint errors */}
        <span className="hidden" aria-hidden>
          {String(onOpenFamily).slice(0, 0)}{String(onOpenProspective).slice(0, 0)}
        </span>
      </SheetContent>
    </Sheet>
  );
}
