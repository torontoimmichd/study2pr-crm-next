"use client";

/**
 * LogCallDialog.tsx
 * Records a call to call_logs + activity_timeline.
 * Used from the "Call" quick-action in LeadDetail.
 */

import { useState, FormEvent, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { writeAudit } from "@/lib/audit";
import { writeTimeline } from "@/lib/timeline";
import { createCallbackTask } from "@/lib/taskEngine";
import { useAuth } from "@/lib/auth-context";

// ─── types ───────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId?: string | null;
  caseId?: string | null;
  clientId?: string | null;
  leadName?: string;
  onLogged?: () => void;
}

const OUTCOMES = [
  { value: "connected",         label: "Connected — full conversation" },
  { value: "connected_brief",   label: "Connected — brief / voicemail left" },
  { value: "no_answer",         label: "No answer" },
  { value: "busy",              label: "Busy / engaged" },
  { value: "wrong_number",      label: "Wrong number" },
  { value: "callback_requested",label: "Callback requested" },
  { value: "disconnected",      label: "Disconnected / dropped" },
];

const EMOTIONS = [
  { value: "very_positive",   label: "Very positive — enthusiastic" },
  { value: "positive",        label: "Positive — interested" },
  { value: "neutral",         label: "Neutral — polite" },
  { value: "hesitant",        label: "Hesitant — unsure" },
  { value: "negative",        label: "Negative — resistant" },
  { value: "very_negative",   label: "Very negative — hostile" },
];

const OBJECTIONS = [
  { value: "none",             label: "None" },
  { value: "fee_too_high",     label: "Fee too high" },
  { value: "not_ready_yet",    label: "Not ready yet" },
  { value: "comparing_options",label: "Comparing other options" },
  { value: "family_approval",  label: "Needs family approval" },
  { value: "financial_timing", label: "Financial timing" },
  { value: "success_concern",  label: "Concerned about success" },
  { value: "no_trust_yet",     label: "No trust yet" },
  { value: "other",            label: "Other" },
];

const CONNECTED_OUTCOMES = new Set(["connected", "connected_brief", "callback_requested"]);

const EMPTY_FORM = {
  direction: "outbound" as "outbound" | "inbound",
  outcome: "no_answer",
  duration_seconds: "",
  emotional_state: "",
  objection: "",
  promise_made: "",
  next_step: "",
  next_contact_at: "",
  notes: "",
};

// ─── component ───────────────────────────────────────────────────────────────

export function LogCallDialog({
  open, onOpenChange,
  leadId, caseId, clientId,
  leadName,
  onLogged,
}: Props) {
  const { user, profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!open) setForm(EMPTY_FORM);
  }, [open]);

  const isConnected = CONNECTED_OUTCOMES.has(form.outcome);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Minimum notes for connected calls
    if (isConnected && form.notes.trim().length < 20) {
      toast.error("Please add at least 20 characters of notes for a connected call");
      return;
    }

    setSubmitting(true);

    const payload = {
      lead_id: leadId ?? null,
      case_id: caseId ?? null,
      client_id: clientId ?? null,
      staff_id: profile?.id ?? null,
      direction: form.direction,
      outcome: form.outcome,
      duration_seconds: form.duration_seconds ? Number(form.duration_seconds) : null,
      emotional_state: isConnected && form.emotional_state ? form.emotional_state : null,
      objection: isConnected && form.objection && form.objection !== "none" ? form.objection : null,
      promise_made: form.promise_made.trim() || null,
      next_step: form.next_step.trim() || null,
      next_contact_at: form.next_contact_at ? new Date(form.next_contact_at).toISOString() : null,
      notes: form.notes.trim() || null,
      called_at: new Date().toISOString(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from("call_logs").insert(payload).select("id").single();
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    // Audit
    void writeAudit({ action: "CREATE", entity_type: "call_logs", entity_id: data.id, changes: payload });

    // Timeline entry
    const outcomeLabel = OUTCOMES.find((o) => o.value === form.outcome)?.label ?? form.outcome;
    const emotionLabel = EMOTIONS.find((em) => em.value === form.emotional_state)?.label ?? "";
    const body = [
      emotionLabel && `Emotional state: ${emotionLabel}`,
      form.objection && `Objection: ${OBJECTIONS.find((o) => o.value === form.objection)?.label ?? form.objection}`,
      form.promise_made && `Promise: ${form.promise_made}`,
      form.next_step && `Next step: ${form.next_step}`,
      form.notes,
    ].filter(Boolean).join("\n");

    void writeTimeline({
      event_type: isConnected ? "call_logged" : "call_no_answer",
      title: `${form.direction === "inbound" ? "Inbound" : "Outbound"} call — ${outcomeLabel}`,
      body: body || null,
      metadata: {
        outcome: form.outcome,
        duration_seconds: payload.duration_seconds,
        next_contact_at: payload.next_contact_at,
      },
      lead_id: leadId ?? null,
      case_id: caseId ?? null,
      client_id: clientId ?? null,
      is_system: false,
    });

    // Auto-create a callback task so no missed call is forgotten
    if (form.outcome === "no_answer" || form.outcome === "busy") {
      void createCallbackTask({
        leadId: leadId ?? null,
        caseId: caseId ?? null,
        assignedTo: profile?.id ?? null,
        createdBy: profile?.id ?? null,
      });
    }

    toast.success("Call logged");
    onOpenChange(false);
    onLogged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-navy">
            Log call{leadName ? ` — ${leadName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          {/* Direction + Outcome */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Direction</Label>
              <Select
                value={form.direction}
                onValueChange={(v) => setForm({ ...form, direction: v as "outbound" | "inbound" })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">Outbound (we called)</SelectItem>
                  <SelectItem value="inbound">Inbound (they called)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Outcome *</Label>
              <Select
                value={form.outcome}
                onValueChange={(v) => setForm({ ...form, outcome: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <Label htmlFor="call-duration">Duration (seconds)</Label>
            <Input
              id="call-duration"
              type="number"
              min={0}
              placeholder="e.g. 180 for 3 min"
              value={form.duration_seconds}
              onChange={(e) => setForm({ ...form, duration_seconds: e.target.value })}
            />
          </div>

          {/* Connected-only fields */}
          {isConnected && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Client emotional state</Label>
                  <Select
                    value={form.emotional_state}
                    onValueChange={(v) => setForm({ ...form, emotional_state: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {EMOTIONS.map((em) => (
                        <SelectItem key={em.value} value={em.value}>{em.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Objection raised</Label>
                  <Select
                    value={form.objection}
                    onValueChange={(v) => setForm({ ...form, objection: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      {OBJECTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="call-promise">Promise made to client</Label>
                <Input
                  id="call-promise"
                  placeholder="e.g. Will send checklist by Friday"
                  value={form.promise_made}
                  onChange={(e) => setForm({ ...form, promise_made: e.target.value })}
                />
              </div>
            </>
          )}

          {/* Next step (always visible) */}
          <div className="space-y-1.5">
            <Label htmlFor="call-nextstep">Next step</Label>
            <Input
              id="call-nextstep"
              placeholder="e.g. Send proposal, call back tomorrow, book consultation"
              value={form.next_step}
              onChange={(e) => setForm({ ...form, next_step: e.target.value })}
            />
          </div>

          {/* Next contact date */}
          <div className="space-y-1.5">
            <Label htmlFor="call-nextcontact">Next contact date/time</Label>
            <Input
              id="call-nextcontact"
              type="datetime-local"
              value={form.next_contact_at}
              onChange={(e) => setForm({ ...form, next_contact_at: e.target.value })}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="call-notes">
              Call notes
              {isConnected && (
                <span className="text-muted-foreground font-normal text-[11px] ml-1">(min 20 characters for connected calls)</span>
              )}
            </Label>
            <Textarea
              id="call-notes"
              rows={4}
              placeholder="Summary of the conversation, what was discussed, any concerns raised…"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-primary hover:bg-primary/90"
            >
              {submitting ? "Saving…" : "Log call"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
