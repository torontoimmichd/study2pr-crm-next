"use client";

// src/components/applications/BulkProcessProspectivesSheet.tsx
import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ProspectiveAppRow } from "@/lib/types";

type Decision = "consent" | "decline" | "snooze" | null;

interface BulkRow {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prospective: ProspectiveAppRow & { family_unit_name: string; family_unit?: any };
  decision: Decision;
  fee: string;
  reason: string;
  snoozeDays: number;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onComplete: () => void;
}

export function BulkProcessProspectivesSheet({ open, onOpenChange, onComplete }: Props) {
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<{ consented: number; declined: number; snoozed: number } | null>(null);

  useEffect(() => {
    if (!open) { setSummary(null); return; }
    setLoading(true);
    (async () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("prospective_applications")
        .select("*, chain_rule:triggered_by_rule(rule_code, description, sla_days, priority), family_unit:family_unit_id(unit_name)")
        .eq("status", "pending_counselor_action")
        .lte("trigger_date", endDate.toISOString().slice(0, 10))
        .order("trigger_date");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: BulkRow[] = (data || []).map((p: any) => ({
        prospective: { ...p, family_unit_name: p.family_unit?.unit_name || "—" },
        decision: null,
        fee: (p.estimated_fee_cad || "").toString(),
        reason: "",
        snoozeDays: 7,
      }));
      setRows(mapped);
      setLoading(false);
    })();
  }, [open]);

  const grouped = useMemo(() => {
    const m = new Map<string, BulkRow[]>();
    rows.forEach(r => {
      const key = r.prospective.family_unit_name;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    });
    return Array.from(m.entries());
  }, [rows]);

  function updateRow(i: number, patch: Partial<BulkRow>) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }

  const markedCount = rows.filter(r => r.decision !== null).length;

  async function applyAll() {
    setSubmitting(true);
    try {
      const decisions = rows
        .filter(r => r.decision !== null)
        .map(r => {
          const base: Record<string, unknown> = { prospective_id: r.prospective.id, action: r.decision };
          if (r.decision === "consent" && r.fee) base.fee = Number(r.fee);
          if (r.decision === "decline" && r.reason) base.reason = r.reason;
          if (r.decision === "snooze") base.days = r.snoozeDays;
          return base;
        });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("bulk_process_prospectives", { p_decisions: decisions });
      if (error) {
        // Fallback: process individually
        let consented = 0, declined = 0, snoozed = 0;
        for (const r of rows.filter(x => x.decision !== null)) {
          if (r.decision === "consent") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from("prospective_applications").update({ status: "converted_to_case" }).eq("id", r.prospective.id);
            consented++;
          } else if (r.decision === "decline") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from("prospective_applications").update({ status: "declined_by_client" }).eq("id", r.prospective.id);
            declined++;
          } else if (r.decision === "snooze") {
            const d = new Date();
            d.setDate(d.getDate() + r.snoozeDays);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from("prospective_applications").update({ trigger_date: d.toISOString().slice(0, 10) }).eq("id", r.prospective.id);
            snoozed++;
          }
        }
        setSummary({ consented, declined, snoozed });
      } else {
        setSummary(data as { consented: number; declined: number; snoozed: number });
      }
      onComplete();
    } catch (e) {
      console.error(e);
      toast.error("Bulk apply failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[720px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Bulk process upcoming prospectives</SheetTitle>
          <SheetDescription>
            {summary
              ? "Done. Summary below."
              : `${rows.length} prospective application${rows.length === 1 ? "" : "s"} due within 7 days.`}
          </SheetDescription>
        </SheetHeader>

        {summary ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600" />
            <p className="text-lg font-medium">All applied</p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>{summary.consented} consented → new cases created</p>
              <p>{summary.declined} declined</p>
              <p>{summary.snoozed} snoozed</p>
            </div>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            No prospectives due in the next 7 days. 🎉
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto mt-4 space-y-4">
              {grouped.map(([familyName, group]) => (
                <div key={familyName}>
                  <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-2">
                    {familyName} · {group.length} item{group.length > 1 ? "s" : ""}
                  </p>
                  <div className="space-y-2">
                    {group.map((r) => {
                      const i = rows.findIndex(x => x.prospective.id === r.prospective.id);
                      return (
                        <div key={r.prospective.id} className={`border rounded-md p-3 ${
                          r.decision === "consent" ? "border-emerald-300 bg-emerald-50/50" :
                          r.decision === "decline" ? "border-red-300 bg-red-50/50" :
                          r.decision === "snooze" ? "border-amber-300 bg-amber-50/50" : ""
                        }`}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <p className="text-sm font-medium">{r.prospective.target_application_type}</p>
                              <p className="text-[10px] text-muted-foreground">
                                Triggers {new Date(r.prospective.trigger_date).toLocaleDateString("en-IN")}
                                {r.prospective.estimated_fee_cad && ` · ~CAD ${r.prospective.estimated_fee_cad}`}
                              </p>
                            </div>
                            {r.prospective.chain_rule?.priority && (
                              <Badge variant="outline">{r.prospective.chain_rule.priority}</Badge>
                            )}
                          </div>

                          <RadioGroup
                            value={r.decision || ""}
                            onValueChange={v => updateRow(i, { decision: v as Decision })}
                            className="flex gap-3"
                          >
                            <div className="flex items-center gap-1.5">
                              <RadioGroupItem value="consent" id={`c-${r.prospective.id}`} />
                              <Label htmlFor={`c-${r.prospective.id}`} className="text-xs">Consent</Label>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <RadioGroupItem value="decline" id={`d-${r.prospective.id}`} />
                              <Label htmlFor={`d-${r.prospective.id}`} className="text-xs">Decline</Label>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <RadioGroupItem value="snooze" id={`s-${r.prospective.id}`} />
                              <Label htmlFor={`s-${r.prospective.id}`} className="text-xs">Snooze</Label>
                            </div>
                          </RadioGroup>

                          {r.decision === "consent" && (
                            <div className="mt-2">
                              <Label className="text-[10px]">Fee CAD</Label>
                              <Input type="number" value={r.fee} onChange={e => updateRow(i, { fee: e.target.value })} className="h-7 text-xs" />
                            </div>
                          )}
                          {r.decision === "decline" && (
                            <div className="mt-2">
                              <Label className="text-[10px]">Reason</Label>
                              <Textarea rows={1} value={r.reason} onChange={e => updateRow(i, { reason: e.target.value })} className="text-xs" />
                            </div>
                          )}
                          {r.decision === "snooze" && (
                            <div className="mt-2 flex items-center gap-2">
                              <Label className="text-[10px]">Days</Label>
                              <Input type="number" min={1} max={30} value={r.snoozeDays} onChange={e => updateRow(i, { snoozeDays: Number(e.target.value) })} className="h-7 w-16 text-xs" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {markedCount} of {rows.length} marked
              </p>
              <Button disabled={markedCount === 0 || submitting} onClick={applyAll}>
                {submitting && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                Apply {markedCount} decision{markedCount === 1 ? "" : "s"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
