"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, History, Save, Send, PhoneCall } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth, hasRole } from "@/lib/auth-context";
import { toast } from "sonner";

const STATES = ["draft", "ack_sent", "client_replied", "confirmed", "expert_review", "client_called"];
const CHANNELS = ["whatsapp", "email", "sms", "portal", "letter", "phone"];
type AssessmentPatch = Database["public"]["Tables"]["assessments"]["Update"];

export function AssessmentReviewPanel({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const [replyText, setReplyText] = useState("");
  const [replyChannel, setReplyChannel] = useState("whatsapp");
  const [payloadText, setPayloadText] = useState("");
  const [expertNotes, setExpertNotes] = useState("");
  const [discussionNotes, setDiscussionNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: assessment, isLoading } = useQuery({
    queryKey: ["lead-assessment", leadId],
    queryFn: async () => (await supabase.from("assessments").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle()).data,
  });
  const { data: changes = [] } = useQuery({
    queryKey: ["assessment-changes", assessment?.id], enabled: !!assessment?.id,
    queryFn: async () => (await supabase.from("assessment_changes").select("id, field_path, old_value, new_value, changed_at, change_source, changed_by").eq("assessment_id", assessment!.id).order("changed_at", { ascending: false })).data ?? [],
  });

  if (isLoading) return <div className="card-surface p-5 text-sm text-muted-foreground">Loading assessment...</div>;
  if (!assessment) return <div className="card-surface p-5 text-sm text-muted-foreground">No self-assessment submitted.</div>;

  const currentState = assessment.confirmation_state || "draft";
  const currentIndex = Math.max(0, STATES.indexOf(currentState));
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["lead-assessment", leadId] }); void qc.invalidateQueries({ queryKey: ["assessment-changes", assessment.id] }); };
  const save = async (patch: AssessmentPatch, success: string) => {
    setSaving(true);
    const { error } = await supabase.from("assessments").update(patch).eq("id", assessment.id);
    setSaving(false);
    if (error) { toast.error(error.message); return false; }
    toast.success(success); refresh(); return true;
  };
  const recordReply = async () => {
    if (!replyText.trim()) { toast.error("Paste the client's reply before saving it."); return; }
    await save({ client_reply_at: new Date().toISOString(), client_reply_channel: replyChannel, client_reply_text: replyText.trim(), confirmation_state: "client_replied" }, "Client reply recorded");
  };
  const confirm = async () => {
    const ok = await save({ confirmation_state: "confirmed", confirmed_at: new Date().toISOString(), confirmed_by: user?.id ?? null }, "Assessment confirmed");
    if (!ok) toast.error("The database requires a written client reply before confirmation.");
  };
  const savePayload = async () => {
    let parsed: unknown;
    try { parsed = JSON.parse(payloadText); } catch { toast.error("Assessment answers must be valid JSON."); return; }
    const confirmed = currentState === "confirmed";
    if (confirmed && !window.confirm("This will cancel the client's confirmation and the assessment result. They will need to confirm again.")) return;
    await save({ payload: parsed as Json, ...(confirmed ? { confirmation_state: "correction_requested", score_results: null, scored_at: null } : {}) }, "Assessment answers saved");
  };
  const review = async (verdict: "signed_off" | "not_eligible") => {
    if (!expertNotes.trim()) { toast.error("Add expert notes before signing off."); return; }
    await save({ expert_verdict: verdict, expert_notes: expertNotes.trim(), expert_state: verdict, expert_reviewed_at: new Date().toISOString(), expert_reviewed_by: user?.id ?? null, confirmation_state: "expert_review" }, verdict === "signed_off" ? "Expert review signed off" : "Assessment marked not eligible");
  };
  const saveDiscussion = async () => {
    if (!discussionNotes.trim()) { toast.error("Add discussion notes first."); return; }
    await save({ discussed_at: new Date().toISOString(), discussed_by: user?.id ?? null, discussion_notes: discussionNotes.trim(), confirmation_state: "client_called" }, "Discussion recorded");
  };

  return <div className="space-y-3">
    <div className="card-surface p-4"><Label>Client assessment link</Label><a className="mt-1 block text-sm text-primary underline break-all" href={`/assessment?lead=${leadId}`}>{typeof window === "undefined" ? "" : `${window.location.origin}/assessment?lead=${leadId}`}</a></div>
    <div className="card-surface p-4 space-y-3">
      <div className="flex items-center justify-between"><div><h3 className="font-semibold text-navy">Assessment confirmation</h3><p className="text-xs text-muted-foreground">Scoring runs when the client confirmation is recorded.</p></div><span className="text-xs font-medium capitalize">{currentState.replace(/_/g, " ")}</span></div>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-1">{STATES.map((state, index) => <div key={state} className={`rounded px-2 py-2 text-[10px] text-center ${index <= currentIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{state.replace(/_/g, " ")}</div>)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="space-y-2"><Label>Client reply</Label><Select value={replyChannel} onValueChange={setReplyChannel}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CHANNELS.map((channel) => <SelectItem key={channel} value={channel}>{channel}</SelectItem>)}</SelectContent></Select><Textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="Paste the reply verbatim" /><Button size="sm" onClick={() => void recordReply()} disabled={saving}><Save className="h-4 w-4 mr-1" />Record reply</Button></div>
        <div className="space-y-2"><Label>Actions</Label><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void confirm()} disabled={saving || !assessment.client_reply_at}><CheckCircle2 className="h-4 w-4 mr-1" />Confirm</Button><Button size="sm" variant="outline" onClick={() => void save({ confirmation_state: "ack_sent", ack_sent_at: new Date().toISOString() }, "Acknowledgement queued again")} disabled={saving}><Send className="h-4 w-4 mr-1" />Re-send acknowledgement</Button></div>{!assessment.client_reply_at && <p className="text-xs text-amber-700 flex gap-1"><AlertTriangle className="h-4 w-4 shrink-0" />A written reply is required before confirmation.</p>}</div>
      </div>
    </div>
    <div className="card-surface p-4 space-y-2"><div className="flex items-center justify-between"><h3 className="font-semibold text-navy">Assessment answers</h3><Button size="sm" variant="outline" onClick={() => { setPayloadText(JSON.stringify(assessment.payload ?? {}, null, 2)); }}><Save className="h-4 w-4 mr-1" />Load for editing</Button></div><Textarea value={payloadText} onChange={(event) => setPayloadText(event.target.value)} placeholder="Load the answers to make a correction" className="font-mono text-xs min-h-40" /><Button size="sm" onClick={() => void savePayload()} disabled={saving || !payloadText.trim()}>Save corrections</Button></div>
    {(["owner", "admin", "visa_expert"] as string[]).includes(profile?.role ?? "") && <div className="card-surface p-4 space-y-2"><h3 className="font-semibold text-navy">Expert review</h3><Textarea value={expertNotes} onChange={(event) => setExpertNotes(event.target.value)} placeholder="Expert notes" /><div className="flex gap-2"><Button size="sm" onClick={() => void review("signed_off")} disabled={saving}>Sign off</Button><Button size="sm" variant="destructive" onClick={() => void review("not_eligible")} disabled={saving}>Not eligible</Button></div></div>}
    <div className="card-surface p-4 space-y-2"><h3 className="font-semibold text-navy flex items-center gap-2"><PhoneCall className="h-4 w-4" />Client discussion</h3><Textarea value={discussionNotes} onChange={(event) => setDiscussionNotes(event.target.value)} placeholder="Record what was discussed with the client" /><Button size="sm" onClick={() => void saveDiscussion()} disabled={saving}>Save discussion</Button></div>
    <div className="card-surface p-4"><h3 className="font-semibold text-navy flex items-center gap-2"><History className="h-4 w-4" />Change history</h3>{changes.length === 0 ? <p className="text-sm text-muted-foreground mt-2">No changes recorded.</p> : <div className="mt-2 space-y-2">{changes.map((change) => <div key={change.id} className="border-t border-border pt-2 text-xs"><span className="font-medium">{change.field_path}</span>: {change.old_value ?? "empty"} → {change.new_value ?? "empty"}<span className="text-muted-foreground"> · {new Date(change.changed_at).toLocaleString()}</span></div>)}</div>}</div>
  </div>;
}
