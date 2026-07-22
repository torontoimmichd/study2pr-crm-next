"use client";

// src/pages/leads/LeadDetailPage.tsx
// Redesigned lead detail — all buttons wired, notes/timeline/tasks working.
// Route: /leads/:id

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "@/lib/router-compat";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Phone, MessageCircle, Mail, Send, CheckSquare, Loader2, ClipboardList, Clock, AlertCircle } from "lucide-react";
import { NewTaskDialog } from "@/components/NewTaskDialog";
import { fmtRelative, fmtDateTimeIST } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { writeAudit } from "@/lib/audit";
import { writeTimeline } from "@/lib/timeline";
import { createStageTasks } from "@/lib/taskEngine";
import { EntityTimeline } from "@/components/EntityTimeline";
import { NotesPanel } from "@/components/NotesPanel";
import { LogCallDialog } from "@/components/LogCallDialog";
import { ConvertLeadWizard } from "@/components/ConvertLeadWizard";
import { OutreachDialog } from "@/components/OutreachDialog";
import { StageTransitionWizard, type LeadStageData } from "@/components/StageTransitionWizard";

import { LeadHeaderCard } from "@/components/lead-detail/LeadHeaderCard";
import { KpiStrip } from "@/components/lead-detail/KpiStrip";
import { BasicInfoCard } from "@/components/lead-detail/BasicInfoCard";
import { FamilyUnitCard } from "@/components/lead-detail/FamilyUnitCard";
import { FeeAssignmentCard } from "@/components/lead-detail/FeeAssignmentCard";
import { ApplicationsPanel } from "@/components/lead-detail/ApplicationsPanel";
import { PathwayPlanCard } from "@/components/lead-detail/PathwayPlanCard";
import { ActivityTimelineCard } from "@/components/lead-detail/ActivityTimelineCard";
import { NextBestActionBar } from "@/components/lead-detail/NextBestActionBar";

import type {
  Lead, FamilyMember, ApplicationRow, ProspectiveAppRow,
  TimelineEvent, ChainTask,
} from "@/lib/types";

export default function LeadDetailPage() {
  const { id: leadId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, profile } = useAuth();

  // ── Data state ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<Lead | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [prospective, setProspective] = useState<ProspectiveAppRow[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [nextAction, setNextAction] = useState<ChainTask | null>(null);

  // ── Dialog state ─────────────────────────────────────────────────
  const [callOpen, setCallOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [outreachChannel, setOutreachChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [stageWizardOpen, setStageWizardOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // ── Load all lead data ────────────────────────────────────────────
  const loadAll = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data: leadData, error: leadErr } = await supabase
        .from("leads")
        .select("*, assigned_team_member:assigned_to(id, full_name)")
        .eq("id", id)
        .single();
      if (leadErr) throw leadErr;

      const raw = leadData as unknown as Record<string, unknown>;
      const familyUnitId = (raw?.family_unit_id as string | null) ?? null;

      const [familyRes, casesRes, prospRes, timelineRes, tasksRes, visaLabelRes, srcLabelRes] = await Promise.all([
        familyUnitId
          ? supabase.rpc("get_family_members", { p_family_unit_id: familyUnitId })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          : Promise.resolve({ data: [], error: null } as any),
        familyUnitId
          ? supabase.from("cases").select("*").eq("family_unit_id", familyUnitId).order("created_at", { ascending: false })
          : supabase.from("cases").select("*").eq("lead_id", id),
        familyUnitId
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (supabase as any)
              .from("prospective_applications")
              .select("*, chain_rule:triggered_by_rule(rule_code, description, sla_days, priority)")
              .eq("family_unit_id", familyUnitId)
              .neq("status", "converted_to_case")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          : Promise.resolve({ data: [], error: null } as any),
        supabase
          .from("activity_log")
          .select("*")
          .eq("lead_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("tasks")
          .select("*")
          .eq("lead_id", id)
          .is("completed_at", null)
          .order("due_at", { ascending: true })
          .limit(1),
        // Resolve visa type label
        raw.interested_visa_type_id
          ? supabase.from("visa_types").select("label").eq("id", raw.interested_visa_type_id as string).maybeSingle()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          : Promise.resolve({ data: null } as any),
        // Resolve source label
        raw.source_code
          ? supabase.from("lead_sources").select("label").eq("code", raw.source_code as string).maybeSingle()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          : Promise.resolve({ data: null } as any),
      ]);

      // Build enriched lead object with resolved labels and field aliases
      const ld = {
        ...leadData,
        visa_interest: (visaLabelRes.data as { label: string } | null)?.label ?? null,
        source: (srcLabelRes.data as { label: string } | null)?.label ?? (raw.source_code as string | null) ?? null,
        country: (raw.country_of_residence as string | null) ?? null,
        destination_country: (raw.country_of_interest as string | null) ?? null,
      } as unknown as Lead;
      setLead(ld);
      setEditingNotes(ld.notes ?? "");

      setFamilyMembers((familyRes.data || []) as FamilyMember[]);
      setApplications((casesRes.data || []) as ApplicationRow[]);
      setProspective((prospRes.data || []) as ProspectiveAppRow[]);
      setTimeline((timelineRes.data || []) as TimelineEvent[]);
      setNextAction(((tasksRes.data as ChainTask[] | null)?.[0] || null));
    } catch (err) {
      console.error("Failed to load lead detail:", err);
      toast.error("Failed to load lead");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (leadId) void loadAll(leadId);
  }, [leadId, loadAll]);

  // ── WhatsApp handler ──────────────────────────────────────────────
  const handleWhatsApp = () => {
    setOutreachChannel("whatsapp");
    setOutreachOpen(true);
  };

  // ── Email handler ─────────────────────────────────────────────────
  const handleEmail = () => {
    setOutreachChannel("email");
    setOutreachOpen(true);
  };

  // ── Save notes ────────────────────────────────────────────────────
  const saveNotes = async () => {
    if (!lead || !leadId) return;
    setSavingNotes(true);
    const { error } = await supabase.from("leads").update({ notes: editingNotes } as never).eq("id", leadId);
    if (error) { toast.error(error.message); setSavingNotes(false); return; }
    void writeTimeline({
      event_type: "note_added",
      title: "Note saved",
      body: editingNotes.slice(0, 120) || null,
      lead_id: leadId,
      is_system: false,
    });
    setLead(prev => prev ? { ...prev, notes: editingNotes } : prev);
    void qc.invalidateQueries({ queryKey: ["timeline", "lead", leadId] });
    toast.success("Notes saved");
    setSavingNotes(false);
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!lead) return <div className="p-8 text-center">Lead not found.</div>;

  return (
    <div className="bg-slate-50 min-h-screen p-4 lg:p-6">
      <div className="mb-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </div>

      {/* Header with wired buttons */}
      <LeadHeaderCard
        lead={lead}
        onEdit={() => setStageWizardOpen(true)}
        onConvert={() => setConvertOpen(true)}
        onCall={() => setCallOpen(true)}
        onWhatsApp={handleWhatsApp}
        onEmail={handleEmail}
      />

      <KpiStrip lead={lead} prospective={prospective} nextAction={nextAction} />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-3 mt-3">
        {/* Sidebar */}
        <aside className="flex flex-col gap-3">
          <BasicInfoCard
            lead={lead}
            onUpdate={(patch) => {
              setLead(prev => prev ? { ...prev, ...patch } as Lead : prev);
              void loadAll(leadId!);
            }}
          />
          <FamilyUnitCard
            members={familyMembers}
            currentLead={lead}
            familyUnitId={lead.family_unit_id ?? null}
            onMembersChanged={setFamilyMembers}
          />
          <FeeAssignmentCard lead={lead} />
        </aside>

        {/* Main content */}
        <main className="flex flex-col gap-3">
          <Tabs defaultValue="overview">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="applications">
                Applications <Badge variant="secondary" className="ml-1">{applications.length}</Badge>
              </TabsTrigger>
              {/* Chain plan tab moved to the CLIENTS module (ClientDetail) —
                  chains fire on application approval, which belongs to clients,
                  not unconverted leads. The Overview pathway snapshot stays. */}
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="communication">Communication</TabsTrigger>
              <TabsTrigger value="assessment">Assessment</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="space-y-3 mt-3">
              <ApplicationsPanel
                applications={applications}
                prospective={prospective}
                currentLeadId={lead.id}
              />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <PathwayPlanCard applications={applications} prospective={prospective} />
                <ActivityTimelineCard events={timeline} />
              </div>
              {nextAction && (
                <NextBestActionBar task={nextAction} onAction={() => loadAll(lead.id)} />
              )}
            </TabsContent>

            {/* Applications */}
            <TabsContent value="applications" className="mt-3">
              <ApplicationsPanel
                applications={applications}
                prospective={prospective}
                currentLeadId={lead.id}
                expanded
              />
            </TabsContent>

            {/* Tasks */}
            <TabsContent value="tasks" className="mt-3">
              <LeadTasksTab leadId={leadId!} leadName={lead.full_name} onTasksChanged={() => loadAll(leadId!)} />
            </TabsContent>

            {/* Timeline — read-only event feed; notes are added in the Notes tab */}
            <TabsContent value="timeline" className="mt-3">
              <div className="card-surface p-5 rounded-xl">
                <EntityTimeline leadId={leadId} allowNotes={false} />
              </div>
            </TabsContent>

            {/* Notes — categorised, one row per note (entity_notes) */}
            <TabsContent value="notes" className="mt-3">
              <NotesPanel leadId={leadId} clientId={lead.converted_client_id ?? undefined} title="Lead notes" />
            </TabsContent>

            {/* Documents — placeholder linking to existing Documents page */}
            <TabsContent value="documents" className="mt-3">
              <div className="card-surface p-5 rounded-xl">
                <p className="text-sm text-muted-foreground">Documents are managed per case. Open an application above to view its documents.</p>
              </div>
            </TabsContent>

            {/* Communication */}
            <TabsContent value="communication" className="mt-3">
              <CommunicationTab
                leadId={leadId!}
                onLogCall={() => setCallOpen(true)}
                onWhatsApp={handleWhatsApp}
                onSendMessage={() => setOutreachOpen(true)}
              />
            </TabsContent>

            {/* Assessment */}
            <TabsContent value="assessment" className="mt-3">
              <div className="card-surface p-5 rounded-xl">
                {!(lead as unknown as Record<string, unknown>)?.assessment_data ? (
                  <p className="text-sm text-muted-foreground">No self-assessment submitted.</p>
                ) : (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {Object.entries((lead as unknown as Record<string, unknown>).assessment_data as Record<string, unknown>).map(([k, v]) => (
                      <div key={k} className="border-b pb-2">
                        <dt className="text-xs uppercase text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                        <dd className="font-medium mt-0.5">{typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────── */}

      {/* Log call */}
      <LogCallDialog
        open={callOpen}
        onOpenChange={setCallOpen}
        leadId={leadId}
        leadName={lead.full_name}
        onLogged={() => {
          void qc.invalidateQueries({ queryKey: ["timeline", "lead", leadId] });
          void loadAll(leadId!);
        }}
      />

      {/* Convert lead → client + case */}
      {convertOpen && (
        <ConvertLeadWizard
          lead={lead as never}
          open={convertOpen}
          onOpenChange={setConvertOpen}
          onConverted={() => {
            // NOTE: do NOT call loadAll() here — it flips the page's `loading`
            // flag, which unmounts this component's subtree (including the open
            // ConvertLeadWizard) and then remounts it fresh, wiping the success
            // screen. That was the "success flashes then reverts to the form"
            // bug. Just invalidate caches; the wizard's own buttons navigate on.
            void qc.invalidateQueries({ queryKey: ["lead", leadId] });
            void qc.invalidateQueries({ queryKey: ["leads-list"] });
            void qc.invalidateQueries({ queryKey: ["leads-counts"] });
          }}
        />
      )}

      {/* WhatsApp / email outreach */}
      <OutreachDialog
        open={outreachOpen}
        onOpenChange={setOutreachOpen}
        leadId={leadId!}
        leadName={lead.full_name}
        leadPhone={lead.phone}
        leadEmail={lead.email}
        defaultChannel={outreachChannel}
      />

      {/* Stage transition wizard (opened via Edit button) */}
      <StageTransitionWizard
        open={stageWizardOpen}
        onOpenChange={setStageWizardOpen}
        currentStage={(lead.lifecycle_state || lead.stage || "new_enquiry") as string}
        leadData={lead as unknown as LeadStageData}
        onTransition={async (updates) => {
          const from = (lead.lifecycle_state || lead.stage || "new_enquiry") as string;
          const to = updates.lifecycle_state as string;
          const { error } = await supabase.from("leads").update(updates as never).eq("id", leadId!);
          if (error) { toast.error(error.message); return; }
          void writeAudit({ action: "STAGE_CHANGE", entity_type: "leads", entity_id: leadId!, changes: { from, to } });
          void writeTimeline({
            event_type: "stage_change",
            title: `Stage: ${from.replace(/_/g, " ")} → ${to.replace(/_/g, " ")}`,
            body: (updates.stage_metadata as Record<string, unknown> | null)?.review_notes as string ?? null,
            metadata: { from, to },
            lead_id: leadId!,
          });
          void qc.invalidateQueries({ queryKey: ["timeline", "lead", leadId] });
          void createStageTasks(leadId!, to, lead.assigned_to ?? profile?.id ?? null, user?.id ?? null);
          void loadAll(leadId!);
          toast.success(`Stage updated to ${to.replace(/_/g, " ")}`);
        }}
      />
    </div>
  );
}

// ── Communication tab — shows all outreach events logged for this lead ─────────
const COMM_TYPES = ["whatsapp_sent", "email_sent", "message_sent", "call_logged", "call_no_answer"];

const COMM_META: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  whatsapp_sent:  { icon: MessageCircle, label: "WhatsApp",  color: "bg-green-100 text-green-700" },
  email_sent:     { icon: Mail,          label: "Email",     color: "bg-blue-100 text-blue-700" },
  message_sent:   { icon: Send,          label: "Message",   color: "bg-sky-100 text-sky-700" },
  call_logged:    { icon: Phone,         label: "Call",      color: "bg-indigo-100 text-indigo-700" },
  call_no_answer: { icon: Phone,         label: "No answer", color: "bg-slate-100 text-slate-600" },
};

interface CommunicationTabProps {
  leadId: string;
  onLogCall: () => void;
  onWhatsApp: () => void;
  onSendMessage: () => void;
}

// ── Tasks tab — full task list with inline complete/acknowledge ─────────────────
interface LeadTasksTabProps {
  leadId: string;
  leadName: string;
  onTasksChanged: () => void;
}

type TaskFilter = "all" | "open" | "overdue" | "completed";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  status_code: string;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  assigned_to: string | null;
  assigned_name?: string;
}

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  high:   { label: "High",   color: "bg-red-100 text-red-700" },
  medium: { label: "Medium", color: "bg-amber-100 text-amber-700" },
  low:    { label: "Low",    color: "bg-slate-100 text-slate-600" },
};

function isOverdue(task: TaskRow): boolean {
  if (task.status_code === "completed" || task.status_code === "cancelled") return false;
  if (!task.due_at) return false;
  return new Date(task.due_at) < new Date();
}

function LeadTasksTab({ leadId, leadName, onTasksChanged }: LeadTasksTabProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);

  const { data: tasks = [], isLoading } = useQuery<TaskRow[]>({
    queryKey: ["lead-tasks", leadId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("tasks")
        .select("id, title, description, priority, status_code, due_at, completed_at, created_at, assigned_to")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) { console.warn("[LeadTasksTab]", error.message); return []; }

      // Batch-resolve assigned_to names
      const rows = (data ?? []) as TaskRow[];
      const assigneeIds = Array.from(new Set(rows.map((r) => r.assigned_to).filter(Boolean))) as string[];
      let nameMap = new Map<string, string>();
      if (assigneeIds.length > 0) {
        const { data: staff } = await supabase.from("staff_profiles").select("id, full_name").in("id", assigneeIds);
        nameMap = new Map((staff ?? []).map((s) => [s.id, s.full_name]));
      }
      return rows.map((r) => ({ ...r, assigned_name: r.assigned_to ? (nameMap.get(r.assigned_to) ?? "Unknown") : undefined }));
    },
  });

  const markComplete = async (task: TaskRow) => {
    setCompleting(task.id);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("tasks")
        .update({ status_code: "completed", completed_at: new Date().toISOString() })
        .eq("id", task.id);
      if (error) throw error;
      void writeTimeline({
        event_type: "task_completed",
        title: `Task completed: ${task.title}`,
        lead_id: leadId,
        is_system: false,
      });
      void qc.invalidateQueries({ queryKey: ["lead-tasks", leadId] });
      void qc.invalidateQueries({ queryKey: ["timeline", "lead", leadId] });
      onTasksChanged();
      toast.success("Task marked complete");
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to update task");
    } finally {
      setCompleting(null);
    }
  };

  const filtered = tasks.filter((t) => {
    if (filter === "open")      return t.status_code !== "completed" && t.status_code !== "cancelled" && !isOverdue(t);
    if (filter === "overdue")   return isOverdue(t);
    if (filter === "completed") return t.status_code === "completed";
    return true;
  });

  const counts = {
    all:       tasks.length,
    open:      tasks.filter((t) => t.status_code !== "completed" && t.status_code !== "cancelled" && !isOverdue(t)).length,
    overdue:   tasks.filter(isOverdue).length,
    completed: tasks.filter((t) => t.status_code === "completed").length,
  };

  return (
    <div className="card-surface rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Tasks</h3>
          {counts.overdue > 0 && (
            <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {counts.overdue} overdue
            </span>
          )}
        </div>
        <Button size="sm" onClick={() => setNewTaskOpen(true)}>
          + New Task
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-0 border-b border-border overflow-x-auto">
        {(["all", "open", "overdue", "completed"] as TaskFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2.5 text-xs font-medium capitalize whitespace-nowrap transition-colors border-b-2 -mb-px ${
              filter === f
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading tasks…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {filter === "all" ? "No tasks yet. Click \"+ New Task\" to create one." : `No ${filter} tasks.`}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filtered.map((task) => {
            const overdue = isOverdue(task);
            const done    = task.status_code === "completed";
            const pMeta   = task.priority ? (PRIORITY_META[task.priority] ?? null) : null;

            return (
              <div key={task.id} className={`p-4 flex items-start gap-3 hover:bg-muted/20 transition-colors ${overdue ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}>
                {/* Status icon */}
                <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  done    ? "bg-green-100 text-green-600" :
                  overdue ? "bg-red-100 text-red-600" :
                            "bg-muted text-muted-foreground"
                }`}>
                  {done    ? <CheckSquare className="w-3.5 h-3.5" /> :
                   overdue ? <AlertCircle  className="w-3.5 h-3.5" /> :
                             <Clock       className="w-3.5 h-3.5" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>
                      {task.title}
                    </p>
                    {pMeta && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${pMeta.color}`}>
                        {pMeta.label}
                      </span>
                    )}
                    {overdue && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-100 text-red-700">Overdue</span>
                    )}
                    {done && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-700">Completed</span>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-muted-foreground">
                    <span title="Assigned on">
                      Assigned {fmtRelative(task.created_at)}
                    </span>
                    {task.assigned_name && (
                      <span>→ {task.assigned_name}</span>
                    )}
                    {task.due_at && (
                      <span className={overdue ? "text-red-600 font-medium" : ""}>
                        Due {fmtRelative(task.due_at)}
                      </span>
                    )}
                    {task.completed_at && (
                      <span className="text-green-600">
                        Completed {fmtRelative(task.completed_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action */}
                {!done && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-shrink-0 text-xs h-7 px-2.5"
                    disabled={completing === task.id}
                    onClick={() => markComplete(task)}
                  >
                    {completing === task.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <><CheckSquare className="w-3 h-3 mr-1" />Done</>
                    }
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New task dialog pre-filled with this lead */}
      <NewTaskDialog
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        defaultLeadId={leadId}
        onCreated={() => {
          void qc.invalidateQueries({ queryKey: ["lead-tasks", leadId] });
          void qc.invalidateQueries({ queryKey: ["timeline", "lead", leadId] });
          onTasksChanged();
        }}
      />
    </div>
  );
}

function CommunicationTab({ leadId, onLogCall, onWhatsApp, onSendMessage }: CommunicationTabProps) {
  const { data: comms = [], isLoading } = useQuery({
    queryKey: ["communication-log", leadId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("activity_timeline")
        .select("id, event_type, title, body, occurred_at, actor_id, is_system")
        .eq("lead_id", leadId)
        .in("event_type", COMM_TYPES)
        .order("occurred_at", { ascending: false })
        .limit(50);
      if (error) console.warn("[CommunicationTab]", error.message);
      return (data ?? []) as Array<{
        id: string; event_type: string; title: string;
        body: string | null; occurred_at: string; actor_id: string | null; is_system: boolean;
      }>;
    },
  });

  return (
    <div className="card-surface rounded-xl overflow-hidden">
      {/* Action bar */}
      <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold">Communication log</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onLogCall}>
            <Phone className="w-3.5 h-3.5 mr-1.5" />Log call
          </Button>
          <Button variant="outline" size="sm" onClick={onWhatsApp}>
            <MessageCircle className="w-3.5 h-3.5 mr-1.5" />WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={onSendMessage}>
            <Mail className="w-3.5 h-3.5 mr-1.5" />Send message
          </Button>
        </div>
      </div>

      {/* Log */}
      {isLoading ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : comms.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No communications logged yet. Use the buttons above to log a call or send a message.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {comms.map((c) => {
            const meta = COMM_META[c.event_type] ?? COMM_META.message_sent;
            const IconComp = meta.icon;
            return (
              <div key={c.id} className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                  <IconComp className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium">{c.title}</p>
                    <span
                      className="text-[11px] text-muted-foreground whitespace-nowrap"
                      title={fmtDateTimeIST(c.occurred_at)}
                    >
                      {fmtRelative(c.occurred_at)}
                    </span>
                  </div>
                  {c.body && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.body}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${meta.color}`}>
                      {meta.label}
                    </span>
                    {c.is_system && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">auto</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
