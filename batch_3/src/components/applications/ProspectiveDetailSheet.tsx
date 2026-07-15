"use client";

// src/components/applications/ProspectiveDetailSheet.tsx
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ProspectiveAppRow } from "@/lib/types";

interface Props {
  prospectiveId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUpdated: (id: string, status: ProspectiveAppRow["status"], promotedCaseId?: string) => void;
}

export function ProspectiveDetailSheet({ prospectiveId, open, onOpenChange, onUpdated }: Props) {
  const [data, setData] = useState<ProspectiveAppRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [fee, setFee] = useState("");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [snoozeDays, setSnoozeDays] = useState(7);
  const [busy, setBusy] = useState<"consent" | "decline" | "snooze" | null>(null);

  useEffect(() => {
    if (!prospectiveId || !open) return;
    setLoading(true);
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: d } = await (supabase as any)
        .from("prospective_applications")
        .select("*, chain_rule:triggered_by_rule(rule_code, description, counselor_script, sla_days, priority)")
        .eq("id", prospectiveId)
        .single();
      setData(d as ProspectiveAppRow);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setFee(((d as any)?.estimated_fee_cad || "").toString());
      setLoading(false);
    })();
  }, [prospectiveId, open]);

  async function consent() {
    if (!data) return;
    setBusy("consent");
    try {
      // Try RPC first, fall back to direct update
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newCaseId, error } = await (supabase as any).rpc("consent_prospective_to_case", {
        p_prospective_id: data.id,
        p_fee_quoted: fee ? Number(fee) : null,
        p_notes: notes || null,
      });
      if (error) {
        // Fallback: mark as converted
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("prospective_applications").update({ status: "converted_to_case" }).eq("id", data.id);
      }
      toast.success("Case created");
      onUpdated(data.id, "converted_to_case", newCaseId as string);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to consent");
    } finally {
      setBusy(null);
    }
  }

  async function decline() {
    if (!data) return;
    setBusy("decline");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("decline_prospective", {
        p_prospective_id: data.id,
        p_reason: reason || null,
      });
      if (error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("prospective_applications").update({ status: "declined_by_client" }).eq("id", data.id);
      }
      toast.success("Marked declined");
      onUpdated(data.id, "declined_by_client");
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to decline");
    } finally {
      setBusy(null);
    }
  }

  async function snooze() {
    if (!data) return;
    setBusy("snooze");
    try {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + snoozeDays);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("snooze_prospective", {
        p_prospective_id: data.id,
        p_snooze_days: snoozeDays,
      });
      if (error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("prospective_applications").update({
          trigger_date: newDate.toISOString().slice(0, 10)
        }).eq("id", data.id);
      }
      toast.success(`Snoozed ${snoozeDays} days`);
      onUpdated(data.id, "pending_counselor_action");
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to snooze");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[520px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Prospective application</SheetTitle>
          <SheetDescription>Triggered by chain rule. Decide and update inline.</SheetDescription>
        </SheetHeader>

        {loading || !data ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto mt-4 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <p className="text-xs uppercase tracking-wide font-semibold text-amber-900">
                {data.target_application_type}
              </p>
              <p className="text-sm font-medium text-amber-900 mt-1">
                {data.chain_rule?.description || "Chain-triggered prospective application"}
              </p>
              <div className="flex gap-2 mt-2 flex-wrap">
                <Badge className="bg-amber-200 text-amber-900">
                  Triggers {new Date(data.trigger_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                </Badge>
                {data.chain_rule?.priority && (
                  <Badge variant="outline" className="border-amber-400 text-amber-900">
                    Priority: {data.chain_rule.priority}
                  </Badge>
                )}
                {data.chain_rule?.sla_days && (
                  <Badge variant="outline" className="border-amber-400 text-amber-900">
                    SLA: {data.chain_rule.sla_days} days
                  </Badge>
                )}
              </div>
            </div>

            {data.chain_rule?.counselor_script && (
              <div className="bg-slate-50 border rounded-md p-3">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">
                  Counselor script
                </p>
                <p className="text-sm italic">"{data.chain_rule.counselor_script}"</p>
              </div>
            )}

            <div className="border rounded-md p-3 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Client consented
              </p>
              <div>
                <Label htmlFor="fee" className="text-xs">Quoted fee (CAD)</Label>
                <Input id="fee" type="number" value={fee} onChange={e => setFee(e.target.value)} placeholder={data.estimated_fee_cad?.toString() || "0"} />
              </div>
              <div>
                <Label htmlFor="notes" className="text-xs">Notes</Label>
                <Textarea id="notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <Button onClick={consent} disabled={busy !== null} className="w-full" size="sm">
                {busy === "consent" && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                Consent &amp; create case
              </Button>
            </div>

            <div className="border rounded-md p-3 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" /> Client declined
              </p>
              <div>
                <Label htmlFor="reason" className="text-xs">Reason</Label>
                <Textarea id="reason" rows={2} value={reason} onChange={e => setReason(e.target.value)} />
              </div>
              <Button onClick={decline} disabled={busy !== null} variant="outline" className="w-full" size="sm">
                {busy === "decline" && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                Mark declined
              </Button>
            </div>

            <div className="border rounded-md p-3 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" /> Snooze
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={1} max={30}
                  value={snoozeDays}
                  onChange={e => setSnoozeDays(Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
              <Button onClick={snooze} disabled={busy !== null} variant="outline" className="w-full" size="sm">
                {busy === "snooze" && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                Snooze
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
