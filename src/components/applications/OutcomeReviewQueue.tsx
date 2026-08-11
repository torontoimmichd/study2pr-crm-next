"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Link } from "@/lib/router-compat";
import { toast } from "sonner";

type OutcomePath = "close_file" | "reapplication" | "appeal_reconsideration" | "judicial_review";

type ReviewRow = {
  review_id: string | null;
  case_id: string | null;
  case_code: string | null;
  client_name: string | null;
  programme: string | null;
  refusal_reason_code: string | null;
  refusal_reason_notes: string | null;
  opened_at: string | null;
  days_open: number | null;
  decision_notified_on: string | null;
  matter_locale: string | null;
  jr_filing_deadline: string | null;
  days_to_jr_deadline: number | null;
};

const PATHS: Array<{ value: OutcomePath; label: string; description: string }> = [
  { value: "close_file", label: "Close file", description: "No further immigration work will be opened from this refusal." },
  { value: "reapplication", label: "Reapplication", description: "Create a successor application when the reapplication work begins." },
  { value: "appeal_reconsideration", label: "Appeal / reconsideration", description: "Continue with an appeal or reconsideration path." },
  { value: "judicial_review", label: "Judicial review", description: "Requires an explicit legal acceptance before this path can be recorded." },
];

export function OutcomeReviewQueue({ onResolved }: { onResolved: () => void }) {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("v_open_outcome_reviews").select("*").order("opened_at", { ascending: true });
    if (error) toast.error(error.message);
    setReviews((data ?? []) as ReviewRow[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (reviews.length === 0) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No open refusal reviews.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Refusal review queue</div>
        <p className="mt-1 text-xs text-amber-900/80">Record the client&apos;s next path before this refusal can leave review. A judicial-review date is a statutory reminder only; verify the current statute before relying on it.</p>
      </div>
      {reviews.map((review) => <OutcomeReviewCard key={review.review_id ?? review.case_id} review={review} onResolved={() => { void load(); onResolved(); }} />)}
    </div>
  );
}

function OutcomeReviewCard({ review, onResolved }: { review: ReviewRow; onResolved: () => void }) {
  const { user, profile } = useAuth();
  const [path, setPath] = useState<OutcomePath | "">("");
  const [rationale, setRationale] = useState("");
  const [decisionNotifiedOn, setDecisionNotifiedOn] = useState(review.decision_notified_on ?? "");
  const [matterLocale, setMatterLocale] = useState(review.matter_locale ?? "");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [legalNote, setLegalNote] = useState("");
  const [saving, setSaving] = useState(false);

  const isJudicialReview = path === "judicial_review";
  const canAcceptLegal = profile?.role === "owner" || profile?.role === "admin";
  const selectedPath = PATHS.find((item) => item.value === path);

  async function decide() {
    if (!review.review_id) return toast.error("This outcome review has no review record.");
    if (!path) return toast.error("Choose an outcome path first.");
    if (!rationale.trim()) return toast.error("Add a rationale before deciding this review.");
    if (isJudicialReview && (!decisionNotifiedOn || !matterLocale || !legalAccepted || !legalNote.trim())) {
      return toast.error("Judicial review requires notification date, location, legal acceptance and an acceptance note.");
    }
    if (isJudicialReview && !user?.id) return toast.error("Your staff identity could not be verified.");
    if (isJudicialReview && !canAcceptLegal) return toast.error("Only an owner or admin can record legal acceptance for judicial review.");

    setSaving(true);
    const { error } = await supabase
      .from("case_outcome_reviews")
      .update({
        chosen_path: path,
        path_rationale: rationale.trim(),
        review_status: "decided",
        decided_at: new Date().toISOString(),
        ...(isJudicialReview
          ? {
              decision_notified_on: decisionNotifiedOn,
              matter_locale: matterLocale,
              legal_accepted_by: user?.id ?? null,
              legal_accepted_at: new Date().toISOString(),
              legal_accepted_note: legalNote.trim(),
            }
          : {}),
      })
      .eq("id", review.review_id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Outcome review recorded");
    onResolved();
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-slate-50/70 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{review.client_name ?? "Unnamed client"}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{review.case_code ?? "Case"}{review.programme ? ` · ${review.programme}` : ""} · Open {review.days_open ?? 0} days</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-red-200 text-red-700">Refused</Badge>
            {review.case_id && <Link to={`/cases/${review.case_id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="h-3 w-3" /> Open case</Link>}
          </div>
        </div>
        {(review.refusal_reason_code || review.refusal_reason_notes) && <p className="mt-2 text-xs text-muted-foreground">Reason: {review.refusal_reason_code ?? review.refusal_reason_notes}</p>}
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1.3fr]">
          <div className="space-y-1.5">
            <Label>Chosen path</Label>
            <Select value={path} onValueChange={(value) => setPath(value as OutcomePath)}>
              <SelectTrigger><SelectValue placeholder="Choose what happens next" /></SelectTrigger>
              <SelectContent>{PATHS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
            {selectedPath && <p className="text-[11px] text-muted-foreground">{selectedPath.description}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Path rationale</Label>
            <Textarea value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Record the client instruction and why this path was chosen" rows={3} />
          </div>
        </div>

        {isJudicialReview && (
          <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-violet-950"><Scale className="h-4 w-4" /> Legal acceptance required</div>
            <p className="text-xs text-violet-900/80">The date below is a reminder calculated by the database. Verify the current statute and notification facts before relying on it.</p>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5"><Label>Decision notified on</Label><Input type="date" value={decisionNotifiedOn} onChange={(event) => setDecisionNotifiedOn(event.target.value)} /></div>
              <div className="space-y-1.5"><Label>Matter location</Label><Select value={matterLocale} onValueChange={setMatterLocale}><SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger><SelectContent><SelectItem value="in_canada">In Canada</SelectItem><SelectItem value="outside_canada">Outside Canada</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Database reminder</Label><div className="rounded-md border bg-white px-3 py-2 text-sm">{review.jr_filing_deadline ?? "Will calculate after date"}</div></div>
            </div>
            {review.days_to_jr_deadline != null && <p className="text-xs font-medium text-violet-900">{review.days_to_jr_deadline} days from the current database calculation. Verify the statute.</p>}
            {!canAcceptLegal && <p className="text-xs font-medium text-red-700">Only an owner or admin can record the legal acceptance required for this path.</p>}
            <div className="flex items-start gap-2">
              <Checkbox id={`legal-${review.review_id}`} disabled={!canAcceptLegal} checked={legalAccepted} onCheckedChange={(checked) => setLegalAccepted(checked === true)} />
              <Label htmlFor={`legal-${review.review_id}`} className="text-xs leading-5">I have accepted this matter for judicial review and will verify the filing deadline before advising the client.</Label>
            </div>
            <Textarea value={legalNote} onChange={(event) => setLegalNote(event.target.value)} placeholder="Legal acceptance note" rows={2} />
          </div>
        )}

        <div className="flex justify-end"><Button onClick={() => void decide()} disabled={saving || !path}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<CheckCircle2 className="mr-2 h-4 w-4" />Record decision</Button></div>
      </CardContent>
    </Card>
  );
}
