"use client";

import { useState } from "react";
import { useNavigate, useParams, Link } from "@/lib/router-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle, Mail, Phone, ArrowRight, ChevronRight } from "lucide-react";
import { EntityTimeline } from "@/components/EntityTimeline";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { LeadStatusPill } from "@/components/StatusPill";
import { fmtRelative, fmtDateTimeIST } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { writeAudit } from "@/lib/audit";
import { writeTimeline } from "@/lib/timeline";
import { createStageTasks } from "@/lib/taskEngine";
import { useAuth } from "@/lib/auth-context";
import { LogCallDialog } from "@/components/LogCallDialog";
import { StageTransitionWizard, type LeadStageData } from "@/components/StageTransitionWizard";
import { ConvertLeadWizard } from "@/components/ConvertLeadWizard";
import { OutreachDialog } from "@/components/OutreachDialog";

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const [convertWizardOpen, setConvertWizardOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [visaRes, srcRes, staffRes] = await Promise.all([
        data.interested_visa_type_id ? supabase.from("visa_types").select("label").eq("id", data.interested_visa_type_id).maybeSingle() : Promise.resolve({ data: null }),
        data.source_code ? supabase.from("lead_sources").select("label").eq("code", data.source_code).maybeSingle() : Promise.resolve({ data: null }),
        data.assigned_to ? supabase.from("staff_profiles").select("full_name").eq("id", data.assigned_to).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      return {
        ...data,
        visa_label: (visaRes as { data: { label: string } | null }).data?.label ?? null,
        source_label: (srcRes as { data: { label: string } | null }).data?.label ?? null,
        assigned_name: (staffRes as { data: { full_name: string } | null }).data?.full_name ?? null,
      };
    },
    enabled: !!id,
  });

  const { data: staff } = useQuery({
    queryKey: ["staff-active"],
    queryFn: async () => {
      const { data } = await supabase.from("staff_profiles").select("id, full_name").eq("is_active", true).order("full_name");
      return data ?? [];
    },
  });

  const updateLead = async (patch: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("leads").update(patch as any).eq("id", id!);
    if (error) {
      toast.error(error.message);
      return false;
    }
    void writeAudit({ action: "UPDATE", entity_type: "leads", entity_id: id!, changes: patch });
    void qc.invalidateQueries({ queryKey: ["lead", id] });
    void qc.invalidateQueries({ queryKey: ["leads-list"] });
    void qc.invalidateQueries({ queryKey: ["leads-counts"] });
    void qc.invalidateQueries({ queryKey: ["sidebar-badge-counts"] });
    toast.success("Saved");
    return true;
  };

  // Conversion now handled by ConvertLeadWizard

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Loading lead…" />
        <div className="p-6">
          <div className="h-32 bg-muted rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }
  if (!lead) {
    return (
      <div>
        <PageHeader title="Lead not found" />
        <div className="p-6">
          <Link to="/leads" className="text-accent hover:underline text-sm"><ArrowLeft className="h-4 w-4 inline mr-1" /> Back to leads</Link>
        </div>
      </div>
    );
  }

  const assessment = (lead.assessment_data as Record<string, unknown> | null) ?? null;

  return (
    <div>
      <PageHeader
        title={lead.full_name}
        subtitle={`${lead.visa_label ?? "No visa selected"} · ${lead.source_label ?? lead.source_code ?? "Unknown source"} · ${fmtRelative(lead.created_at)}`}
        actions={
          <Link to="/leads">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1.5" /> Back</Button>
          </Link>
        }
      />

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-[1400px]">
        {/* Main */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card-surface p-5">
            <div className="flex items-center gap-2 flex-wrap">
              <LeadStatusPill status={lead.lifecycle_state} />
              {lead.country_of_residence && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-xs">{lead.country_of_residence}</span>
              )}
              {lead.crs_score && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gold/15 text-gold-foreground text-xs font-medium">CRS {lead.crs_score}</span>
              )}
            </div>
          </div>

          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="assessment">Assessment</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="card-surface p-5 space-y-3">
              <DetailField label="Email" value={lead.email} />
              <DetailField label="Phone" value={lead.phone} />
              <DetailField label="Country of residence" value={lead.country_of_residence} />
              <div>
                <div className="text-xs uppercase text-muted-foreground">CRS score</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-medium text-sm">{lead.crs_score ?? "—"}</span>
                  <a href="/crs-calculator" target="_blank" rel="noopener noreferrer"
                     className="text-[11px] text-accent hover:underline">
                    Open calculator ↗
                  </a>
                </div>
              </div>
              <DetailField label="Source" value={lead.source_label ?? lead.source_code} />
              <DetailField label="Source detail" value={lead.source_detail} />
              <DetailField label="First contact due" value={lead.first_response_due_at ? fmtDateTimeIST(lead.first_response_due_at) : null} />
              <DetailField label="First responded" value={lead.first_responded_at ? fmtDateTimeIST(lead.first_responded_at) : null} />
            </TabsContent>

            <TabsContent value="assessment" className="card-surface p-5">
              {!assessment ? (
                <p className="text-sm text-muted-foreground">No self-assessment submitted.</p>
              ) : (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {Object.entries(assessment).map(([k, v]) => (
                    <div key={k} className="border-b border-border pb-2">
                      <dt className="text-xs uppercase text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                      <dd className="font-medium mt-0.5 break-words">{typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="card-surface p-5">
              <EntityTimeline leadId={id} allowNotes />
            </TabsContent>

            <TabsContent value="notes" className="card-surface p-5 space-y-3">
              <NotesEditor value={lead.notes ?? ""} onSave={(v) => updateLead({ notes: v })} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card-surface p-5 space-y-3">
            <h3 className="font-display text-sm uppercase tracking-wider text-muted-foreground">Quick actions</h3>
            <div className="grid grid-cols-3 gap-2">
              {lead.phone && (
                <a
                  href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center gap-1 p-2.5 rounded-md bg-muted hover:bg-muted/70 text-xs"
                >
                  <MessageCircle className="h-4 w-4 text-success" /> WhatsApp
                </a>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="flex flex-col items-center gap-1 p-2.5 rounded-md bg-muted hover:bg-muted/70 text-xs">
                  <Mail className="h-4 w-4 text-accent" /> Email
                </a>
              )}
              {lead.phone && (
                <button
                  type="button"
                  onClick={() => setCallOpen(true)}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-md bg-muted hover:bg-muted/70 text-xs w-full"
                >
                  <Phone className="h-4 w-4 text-primary" /> Log call
                </button>
              )}
              <button
                type="button"
                onClick={() => setOutreachOpen(true)}
                className="flex flex-col items-center gap-1 p-2.5 rounded-md bg-muted hover:bg-muted/70 text-xs w-full"
              >
                <MessageCircle className="h-4 w-4 text-success" /> Message
              </button>
            </div>
            <Button
              onClick={() => setConvertWizardOpen(true)}
              disabled={lead.lifecycle_state === "converted"}
              className="w-full bg-gold hover:bg-gold/90 text-gold-foreground"
            >
              {lead.lifecycle_state === "converted" ? "Already converted" : (<>Convert → Client + Case <ArrowRight className="h-4 w-4 ml-1.5" /></>)}
            </Button>
            {lead.converted_client_id && (
              <Link to={`/clients/${lead.converted_client_id}`} className="block text-center text-xs text-accent hover:underline">
                View client →
              </Link>
            )}
          </div>

          <div className="card-surface p-5 space-y-3">
            <div className="space-y-1.5">
              <Label>Pipeline Stage</Label>
              <button
                onClick={() => setWizardOpen(true)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-border bg-background hover:bg-muted/60 transition-colors text-sm"
              >
                <div className="flex items-center gap-2">
                  <LeadStatusPill status={lead.lifecycle_state} />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <p className="text-[11px] text-muted-foreground">Click to open stage transition wizard</p>
            </div>
            <div className="space-y-1.5">
              <Label>Assigned to</Label>
              <Select value={lead.assigned_to ?? "__none"} onValueChange={(v) => updateLead({ assigned_to: v === "__none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Unassigned</SelectItem>
                  {staff?.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stage context — shows structured data for current stage */}
          <StageContextPanel lead={lead} />
        </div>
      </div>

      {/* Stage transition wizard */}
      <StageTransitionWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        currentStage={lead.lifecycle_state as string}
        leadData={lead as unknown as LeadStageData}
        onTransition={async (updates) => {
          const from = lead.lifecycle_state as string;
          const to = updates.lifecycle_state as string;
          const ok = await updateLead(updates);
          if (ok) {
            void writeAudit({
              action: "STAGE_CHANGE",
              entity_type: "leads",
              entity_id: id!,
              changes: { from, to, ...updates },
            });
            void writeTimeline({
              event_type: "stage_change",
              title: `Stage: ${from.replace(/_/g, " ")} → ${to.replace(/_/g, " ")}`,
              body: (updates.stage_metadata as Record<string, unknown> | null)?.review_notes as string ?? null,
              metadata: { from, to },
              lead_id: id!,
            });
            void qc.invalidateQueries({ queryKey: ["timeline", "lead", id] });
            // Auto-create stage-specific tasks (fire-and-forget)
            void createStageTasks(id!, to, lead.assigned_to ?? profile?.id ?? null, user?.id ?? null);
          }
        }}
      />

      <LogCallDialog
        open={callOpen}
        onOpenChange={setCallOpen}
        leadId={id}
        leadName={lead.full_name}
        onLogged={() => void qc.invalidateQueries({ queryKey: ["timeline", "lead", id] })}
      />

      {convertWizardOpen && (
        <ConvertLeadWizard
          lead={lead}
          open={convertWizardOpen}
          onOpenChange={setConvertWizardOpen}
          onConverted={() => void qc.invalidateQueries({ queryKey: ["lead", id] })}
        />
      )}

      <OutreachDialog
        open={outreachOpen}
        onOpenChange={setOutreachOpen}
        leadId={id!}
        leadName={lead.full_name}
        leadPhone={lead.phone}
        leadEmail={lead.email}
      />
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2 border-b border-border last:border-0">
      <dt className="text-xs uppercase text-muted-foreground tracking-wider">{label}</dt>
      <dd className="col-span-2 text-sm">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function NotesEditor({ value, onSave }: { value: string; onSave: (v: string) => Promise<boolean> }) {
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  return (
    <>
      <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note about this lead…" />
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={saving || text === value}
          onClick={async () => { setSaving(true); await onSave(text); setSaving(false); }}
          className="bg-primary hover:bg-primary/90"
        >
          {saving ? "Saving…" : "Save notes"}
        </Button>
      </div>
    </>
  );
}

// silence unused
Input;

// ── StageContextPanel ──────────────────────────────────────────────────────
// Shows structured stage-specific data for the current lifecycle stage.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StageContextPanel({ lead }: { lead: any }) {
  const stage = lead.lifecycle_state as string;
  const meta = (lead.stage_metadata ?? {}) as Record<string, unknown>;

  if (stage === "waiting") {
    const REASON_LABELS: Record<string, string> = {
      ielts_pending: "IELTS / Language test pending",
      work_experience_incomplete: "Work experience incomplete",
      funds_arrangement: "Funds arrangement",
      spouse_wp_pr_pending: "Spouse WP/PR pending",
      pnp_intake_not_open: "PNP intake not open",
      family_decision_pending: "Family decision pending",
      graduation_pending: "Graduation pending",
      permit_expiry_awaited: "Permit expiry awaited",
      crs_score_improvement: "CRS score improvement",
      medical_police_clearance: "Medical / Police clearance",
      other: "Other",
    };
    const FREQ_LABELS: Record<string, string> = {
      weekly: "Weekly", bi_weekly: "Bi-weekly", monthly: "Monthly", quarterly: "Quarterly",
    };
    if (!lead.waiting_reason) return null;
    return (
      <div className="card-surface p-4 space-y-2 border-l-4 border-yellow-400">
        <div className="text-[10px] uppercase tracking-widest text-yellow-700 dark:text-yellow-300 font-semibold">Waiting Period</div>
        <CtxRow label="Reason" value={REASON_LABELS[lead.waiting_reason] ?? lead.waiting_reason} />
        <CtxRow label="Start" value={lead.waiting_start_date} />
        {lead.waiting_end_date && <CtxRow label="End" value={lead.waiting_end_date} />}
        {lead.waiting_contact_frequency && <CtxRow label="Frequency" value={FREQ_LABELS[lead.waiting_contact_frequency] ?? lead.waiting_contact_frequency} />}
        {lead.waiting_linked_milestone && <CtxRow label="Milestone" value={lead.waiting_linked_milestone} />}
        {lead.waiting_review_notes && (
          <div className="pt-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Review Notes</div>
            <div className="text-xs mt-0.5 text-foreground leading-relaxed">{lead.waiting_review_notes}</div>
          </div>
        )}
      </div>
    );
  }

  if (stage === "proposal_sent" && meta.proposal_date) {
    return (
      <div className="card-surface p-4 space-y-2 border-l-4 border-amber-400">
        <div className="text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-300 font-semibold">Proposal</div>
        <CtxRow label="Date" value={meta.proposal_date as string} />
        {meta.fee_quoted_inr && <CtxRow label="Fee" value={`₹ ${Number(meta.fee_quoted_inr).toLocaleString("en-IN")}`} />}
        {meta.services_included && (
          <div className="pt-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Services</div>
            <div className="text-xs mt-0.5 text-foreground leading-relaxed">{meta.services_included as string}</div>
          </div>
        )}
      </div>
    );
  }

  if (stage === "negotiating" && meta.objection_type) {
    const OBJ: Record<string, string> = {
      fee_too_high: "Fee too high", timeline_too_long: "Timeline too long",
      service_scope: "Service scope", competitor_offer: "Competitor offer",
      success_guarantee: "Success guarantee", family_approval: "Family approval",
      financial_timing: "Financial timing", other: "Other",
    };
    return (
      <div className="card-surface p-4 space-y-2 border-l-4 border-orange-400">
        <div className="text-[10px] uppercase tracking-widest text-orange-700 dark:text-orange-300 font-semibold">Negotiation</div>
        <CtxRow label="Objection" value={OBJ[meta.objection_type as string] ?? meta.objection_type as string} />
        {meta.resolution_approach && (
          <div className="pt-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Resolution approach</div>
            <div className="text-xs mt-0.5 text-foreground leading-relaxed">{meta.resolution_approach as string}</div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function CtxRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}
