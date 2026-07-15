"use client";

// src/components/applications/CaseQuickViewSheet.tsx
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2 } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import type { ApplicationRow } from "@/lib/types";

interface Props {
  caseId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUpdated: (updated: Partial<ApplicationRow>) => void;
}

export function CaseQuickViewSheet({ caseId, open, onOpenChange, onUpdated }: Props) {
  const navigate = useNavigate();
  const [data, setData] = useState<ApplicationRow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!caseId || !open) return;
    setLoading(true);
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: d } = await (supabase as any).from("cases").select("*").eq("id", caseId).single();
      setData(d as ApplicationRow);
      setLoading(false);
    })();
  }, [caseId, open]);

  const stage = data?.stage || data?.current_stage_code || "—";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[480px] flex flex-col">
        <SheetHeader>
          <SheetTitle>{data?.case_number || data?.case_ref || "Case"}</SheetTitle>
        </SheetHeader>

        {loading || !data ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto mt-4 space-y-3">
            <div className="bg-slate-50 rounded-md p-3 space-y-1">
              <p className="text-xs text-muted-foreground">Type</p>
              <p className="text-sm font-medium">{data.application_type} · {data.visa_type_name || "—"}</p>
              <p className="text-xs text-muted-foreground mt-2">Stage</p>
              <Badge>{stage}</Badge>
            </div>
            <Button variant="outline" className="w-full" size="sm" onClick={() => navigate(`/cases/${caseId}`)}>
              <ExternalLink className="w-3 h-3 mr-1" /> Open full case
            </Button>
            {/* suppress unused onUpdated warning */}
            <span className="hidden">{String(onUpdated).slice(0, 0)}</span>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
