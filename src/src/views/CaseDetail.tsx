"use client";

import { useEffect, useState } from "react";
import { Link, useParams } from "@/lib/router-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, CheckSquare, DollarSign, Activity, Receipt, FilePlus2, Users, Mail, Save, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { NotesPanel } from "@/components/NotesPanel";
import { CaseFinanceTab } from "@/components/CaseFinanceTab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PriorityPill, RiskPill } from "@/components/StatusPill";
import { fmtDateIST, fmtDateTimeIST, fmtMoney, fmtRelative } from "@/lib/format";
import { writeAudit } from "@/lib/audit";
import { writeTimeline } from "@/lib/timeline";
import { createCaseStageTasks } from "@/lib/taskEngine";
import { EntityTimeline } from "@/components/EntityTimeline";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { CaseDocumentsTab } from "@/components/CaseDocumentsTab";
import { CasePaymentsTab } from "@/components/CasePaymentsTab";
import { CaseInvoicesTab } from "@/components/CaseInvoicesTab";
import { GenerateInvoiceDialog } from "@/components/GenerateInvoiceDialog";
import { OutreachDialog } from "@/components/OutreachDialog";

const UNASSIGNED = "__unassigned__";

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [invoiceDlgOpen, setInvoiceDlgOpen] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [outreachChannel, setOutreachChannel] = useState<"whatsapp" | "email">("whatsapp");

  const { data: caseRow, isLoading } = useQuery({
    queryKey: ["case", id],
    queryFn: async () => {
      const { data } = await supabase.from("cases").select("*").eq("id", id!).maybeSingle();
      if (!data) return null;
      const [client, visa, subVisa] = await Promise.all([
        supabase.from("clients").select("id, full_name, email, phone, country_of_citizenship").eq("id", data.client_id).maybeSingle(),
        supabase.from("visa_types").select("label").eq("id", data.visa_type_id).maybeSingle(),
        data.visa_sub_type_id
          ? supabase.from("visa_sub_types").select("label").eq("id", data.visa_sub_type_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return {
        ...data,
        client: client.data,
        visa_label: visa.data?.label ?? "—",
        visa_sub_label: (subVisa as { data: { label: string } | null }).data?.label ?? null,
      };
    },
    enabled: !!id,
  });

  const { data: stages } = useQuery({
    queryKey: ["case-stages-ref"],
    queryFn: async () => (await supabase.from("case_stages_ref").select("*").order("sort_order")).data ?? [],
  });

  const { data: visaTypes } = useQuery({
    queryKey: ["visa-types-active"],
    queryFn: async () => (await supabase.from("visa_types").select("id, label").eq("is_active", true).order("label")).data ?? [],
  });

  const { data: subVisaTypes } = useQuery({
    queryKey: ["visa-sub-types-for", caseRow?.visa_type_id],
    enabled: !!caseRow?.visa_type_id,
    queryFn: async () => (await supabase.from("visa_sub_types").select("id, label").eq("visa_type_id", caseRow!.visa_type_id).eq("is_active", true).order("label")).data ?? [],
  });

  const { data: staff } = useQuery({
    queryKey: ["staff-active"],
    queryFn: async () => (await supabase.from("staff_profiles").select("id, full_name, role").eq("is_active", true).order("full_name")).data ?? [],
  });

  const { data: docCount } = useQuery({
    queryKey: ["case-doc-count", id],
    queryFn: async () => {
      const { count } = await supabase.from("case_documents").select("id", { count: "exact", head: true }).eq("case_id", id!).eq("is_deleted", false);
      return count ?? 0;
    },
    enabled: !!id,
  });

  const { data: tasks } = useQuery({
    queryKey: ["case-tasks", id],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").eq("case_id", id!).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: family } = useQuery({
    queryKey: ["case-family", caseRow?.client_id],
    enabled: !!caseRow?.client_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("family_members")
        .select("*")
        .eq("principal_client_id", caseRow!.client_id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const { data: ircc } = useQuery({
    queryKey: ["case-ircc", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("ircc_emails")
        .select("*")
        .eq("matched_case_id", id!)
        .order("received_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: history } = useQuery({
    queryKey: ["case-history", id],
    queryFn: async () => {
      const { data: stageHist } = await supabase.from("case_stage_history").select("*").eq("case_id", id!).order("changed_at", { ascending: false });
      const ids = Array.from(new Set((stageHist ?? []).map(h => h.changed_by).filter(Boolean) as string[]));
      const { data: actors } = ids.length ? await supabase.from("staff_profiles").select("id, full_name").in("id", ids) : { data: [] };
      const m = new Map((actors ?? []).map(a => [a.id, a.full_name]));
      return (stageHist ?? []).map(h => ({ ...h, actor_name: h.changed_by ? m.get(h.changed_by) ?? "Unknown" : "System" }));
    },
    enabled: !!id,
  });

  const moveStage = async (newStage: string) => {
    if (!caseRow || newStage === caseRow.current_stage_code) return;
    const old = caseRow.current_stage_code;
    const { error } = await supabase.from("cases").update({ current_stage_code: newStage, stage_entered_at: new Date().toISOString() }).eq("id", id!);
    if (error) { toast.error(error.message); return; }
    await supabase.from("case_stage_history").insert({ case_id: id!, from_stage_code: old, to_stage_code: newStage, changed_by: user?.id ?? null });
    void writeAudit({ action: "STAGE_CHANGE", entity_type: "cases", entity_id: id!, changes: { from: old, to: newStage } });
    // Wire: timeline entry + auto-tasks for the new stage
    void writeTimeline({
      event_type: "case_stage_change",
      title: `Case stage: ${(old ?? "—").replace(/_/g, " ")} → ${newStage.replace(/_/g, " ")}`,
      case_id: id!,
      client_id: caseRow.client_id ?? null,
      metadata: { from: old, to: newStage },
      is_system: true,
    });
    void createCaseStageTasks(id!, newStage, caseRow.case_manager_id ?? null, user?.id ?? null);
    toast.success("Stage updated");
    void qc.invalidateQueries({ queryKey: ["case", id] });
    void qc.invalidateQueries({ queryKey: ["case-history", id] });
    void qc.invalidateQueries({ queryKey: ["case-tasks", id] });
    void qc.invalidateQueries({ queryKey: ["cases-all"] });
    void qc.invalidateQueries({ queryKey: ["sidebar-badge-counts"] });
  };

  const toggleTask = async (taskId: string, done: boolean) => {
    const task = tasks?.find((t) => t.id === taskId);
    const patch = done
      ? { status_code: "done", completed_at: new Date().toISOString() }
      : { status_code: "open", completed_at: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("tasks").update(patch as any).eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    void writeAudit({ action: "STATUS_CHANGE", entity_type: "tasks", entity_id: taskId, changes: patch });
    if (done) {
      void writeTimeline({
        event_type: "task_completed",
        title: `Task completed: ${task?.title ?? taskId}`,
        case_id: id!,
        client_id: caseRow?.client_id ?? null,
        is_system: true,
      });
    }
    void qc.invalidateQueries({ queryKey: ["case-tasks", id] });
  };

  if (isLoading) return <div><PageHeader title="Loading…" /></div>;
  if (!caseRow) return <div><PageHeader title="Case not found" /><div className="p-6"><Link to="/cases" className="text-accent hover:underline text-sm">← Back</Link></div></div>;

  return (
    <div>
      <PageHeader
        title={`${caseRow.case_code ?? caseRow.id.slice(0,8)} · ${caseRow.client?.full_name ?? "Client"}`}
        subtitle={`${caseRow.visa_label}${caseRow.visa_sub_label ? ` · ${caseRow.visa_sub_label}` : ""} · opened ${fmtDateIST(caseRow.created_at)}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => { setOutreachChannel("whatsapp"); setOutreachOpen(true); }} disabled={!caseRow.client?.phone}>
              <MessageCircle className="h-4 w-4 mr-1.5" />WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setOutreachChannel("email"); setOutreachOpen(true); }} disabled={!caseRow.client?.email}>
              <Mail className="h-4 w-4 mr-1.5" />Email
            </Button>
            <Button size="sm" onClick={() => setInvoiceDlgOpen(true)}>
              <FilePlus2 className="h-4 w-4 mr-1.5" />Generate invoice
            </Button>
            <Link to="/cases"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Button></Link>
          </div>
        }
      />

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-[1400px]">
        <div className="lg:col-span-2 space-y-4">
          <div className="card-surface p-5">
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <PriorityPill priority={caseRow.priority} />
              <RiskPill risk={caseRow.risk_level} />
              <span className="text-xs text-muted-foreground capitalize">{caseRow.current_stage_code?.replace(/_/g, " ")}</span>
            </div>
            {/* Stage progress */}
            {stages && (
              <div className="flex gap-1">
                {stages.map(s => {
                  const idx = stages.findIndex(x => x.code === caseRow.current_stage_code);
                  const myIdx = stages.findIndex(x => x.code === s.code);
                  const done = myIdx <= idx;
                  return (
                    <div key={s.code} className="flex-1" title={s.label}>
                      <div className={`h-1.5 rounded-full ${done ? "bg-primary" : "bg-muted"}`} />
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 truncate">{s.label}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="documents"><FileText className="h-3.5 w-3.5 mr-1" />Docs ({docCount ?? 0})</TabsTrigger>
              <TabsTrigger value="tasks"><CheckSquare className="h-3.5 w-3.5 mr-1" />Tasks ({tasks?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="family"><Users className="h-3.5 w-3.5 mr-1" />Family ({family?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="payments"><DollarSign className="h-3.5 w-3.5 mr-1" />Payments</TabsTrigger>
              <TabsTrigger value="invoices"><Receipt className="h-3.5 w-3.5 mr-1" />Invoices</TabsTrigger>
              <TabsTrigger value="ircc"><Mail className="h-3.5 w-3.5 mr-1" />IRCC ({ircc?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="finance">Finance</TabsTrigger>
              <TabsTrigger value="activity"><Activity className="h-3.5 w-3.5 mr-1" />Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <OverviewEditor
                caseRow={caseRow}
                visaTypes={visaTypes ?? []}
                subVisaTypes={subVisaTypes ?? []}
                staff={staff ?? []}
                onSaved={() => {
                  void qc.invalidateQueries({ queryKey: ["case", id] });
                }}
              />
            </TabsContent>

            <TabsContent value="documents">
              <CaseDocumentsTab caseId={id!} />
            </TabsContent>

            <TabsContent value="tasks" className="card-surface p-3">
              {!tasks || tasks.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No tasks for this case.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {tasks.map(t => (
                    <li key={t.id} className="flex items-center gap-3 py-2.5 px-2">
                      <input
                        type="checkbox"
                        checked={t.status_code === "done"}
                        onChange={(e) => toggleTask(t.id, e.target.checked)}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm ${t.status_code === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                        {t.due_at && <div className="text-xs text-muted-foreground">Due {fmtDateTimeIST(t.due_at)}</div>}
                      </div>
                      <span className="text-xs capitalize text-muted-foreground">{t.priority}</span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="family" className="card-surface p-0">
              {!family || family.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  No family members on file.{" "}
                  {caseRow.client && (
                    <Link to={`/clients/${caseRow.client.id}`} className="text-accent hover:underline">Manage on client profile →</Link>
                  )}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">Relationship</th>
                      <th className="text-left px-4 py-2.5 font-medium">Name</th>
                      <th className="text-left px-4 py-2.5 font-medium">DOB</th>
                      <th className="text-left px-4 py-2.5 font-medium">Passport</th>
                      <th className="text-left px-4 py-2.5 font-medium">Dependent</th>
                      <th className="text-left px-4 py-2.5 font-medium">Included</th>
                    </tr>
                  </thead>
                  <tbody>
                    {family.map((m) => (
                      <tr key={m.id} className="border-t border-border">
                        <td className="px-4 py-2.5 capitalize">{m.relationship}</td>
                        <td className="px-4 py-2.5 font-medium">{m.full_name}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{fmtDateIST(m.date_of_birth)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{m.passport_number ?? "—"}</td>
                        <td className="px-4 py-2.5 text-xs">{m.is_dependent ? "Yes" : "No"}</td>
                        <td className="px-4 py-2.5 text-xs">{m.is_included_on_current_case ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </TabsContent>

            <TabsContent value="payments">
              <CasePaymentsTab caseId={id!} clientId={caseRow.client_id} quotedFeeInr={Number(caseRow.quoted_fee_inr ?? 0)} />
            </TabsContent>

            <TabsContent value="invoices">
              <CaseInvoicesTab caseId={id!} clientId={caseRow.client_id} />
            </TabsContent>

            <TabsContent value="ircc" className="card-surface p-0">
              {!ircc || ircc.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No IRCC emails matched to this case yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {ircc.map((e) => (
                    <li key={e.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{e.subject ?? "(no subject)"}</div>
                          <div className="text-xs text-muted-foreground truncate">From {e.from_address ?? "unknown"}</div>
                          {e.keyword_flags && e.keyword_flags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {e.keyword_flags.map((f: string) => (
                                <span key={f} className="px-1.5 py-0.5 rounded bg-muted text-[10px] uppercase tracking-wider">{f}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          {e.requires_action && (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] uppercase tracking-wider mb-1">Action</span>
                          )}
                          <div className="text-xs text-muted-foreground">{fmtRelative(e.received_at)}</div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="notes"><NotesPanel caseId={id!} clientId={caseRow?.client_id} /></TabsContent>

            <TabsContent value="finance"><CaseFinanceTab caseId={id!} clientId={caseRow?.client_id} /></TabsContent>

            <TabsContent value="activity" className="card-surface p-5">
              <EntityTimeline caseId={id} allowNotes />
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          {caseRow.client && (
            <div className="card-surface p-5">
              <h3 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-2">Client</h3>
              <div className="font-medium">{caseRow.client.full_name}</div>
              <div className="text-xs text-muted-foreground">{caseRow.client.email}</div>
              <div className="text-xs text-muted-foreground">{caseRow.client.phone}</div>
              <Link to={`/clients/${caseRow.client.id}`} className="text-xs text-accent hover:underline mt-2 inline-block">Open profile →</Link>
            </div>
          )}

          <div className="card-surface p-5 space-y-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Move stage</label>
            <Select value={caseRow.current_stage_code ?? ""} onValueChange={moveStage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {stages?.map(s => <SelectItem key={s.code} value={s.code} className="capitalize">{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <GenerateInvoiceDialog
        open={invoiceDlgOpen}
        onOpenChange={setInvoiceDlgOpen}
        caseId={id!}
        clientId={caseRow.client_id}
        onCreated={() => {
          void qc.invalidateQueries({ queryKey: ["case-invoices", id] });
        }}
      />

      {/* WhatsApp / Email outreach from case — uses client's contact info */}
      {caseRow.client && (
        <OutreachDialog
          open={outreachOpen}
          onOpenChange={setOutreachOpen}
          leadId={caseRow.client.id}
          leadName={caseRow.client.full_name}
          leadPhone={caseRow.client.phone}
          leadEmail={caseRow.client.email}
          defaultChannel={outreachChannel}
        />
      )}
    </div>
  );
}

interface CaseRow {
  id: string;
  visa_type_id: string;
  visa_sub_type_id: string | null;
  quoted_fee_inr: number | null;
  quoted_govt_fee_cad: number | null;
  target_submission_date: string | null;
  priority: string | null;
  case_manager_id: string | null;
  senior_advisor_id: string | null;
  outcome: string | null;
  notes: string | null;
  uci_number: string | null;
  application_number: string | null;
}

function OverviewEditor({
  caseRow,
  visaTypes,
  subVisaTypes,
  staff,
  onSaved,
}: {
  caseRow: CaseRow;
  visaTypes: { id: string; label: string }[];
  subVisaTypes: { id: string; label: string }[];
  staff: { id: string; full_name: string; role: string }[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    visa_type_id: caseRow.visa_type_id,
    visa_sub_type_id: caseRow.visa_sub_type_id ?? "",
    quoted_fee_inr: String(caseRow.quoted_fee_inr ?? 0),
    quoted_govt_fee_cad: String(caseRow.quoted_govt_fee_cad ?? 0),
    target_submission_date: caseRow.target_submission_date ?? "",
    priority: caseRow.priority ?? "normal",
    case_manager_id: caseRow.case_manager_id ?? "",
    senior_advisor_id: caseRow.senior_advisor_id ?? "",
    outcome: caseRow.outcome ?? "",
    notes: caseRow.notes ?? "",
    uci_number: caseRow.uci_number ?? "",
    application_number: caseRow.application_number ?? "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      visa_type_id: caseRow.visa_type_id,
      visa_sub_type_id: caseRow.visa_sub_type_id ?? "",
      quoted_fee_inr: String(caseRow.quoted_fee_inr ?? 0),
      quoted_govt_fee_cad: String(caseRow.quoted_govt_fee_cad ?? 0),
      target_submission_date: caseRow.target_submission_date ?? "",
      priority: caseRow.priority ?? "normal",
      case_manager_id: caseRow.case_manager_id ?? "",
      senior_advisor_id: caseRow.senior_advisor_id ?? "",
      outcome: caseRow.outcome ?? "",
      notes: caseRow.notes ?? "",
      uci_number: caseRow.uci_number ?? "",
      application_number: caseRow.application_number ?? "",
    });
  }, [caseRow]);

  const save = async () => {
    setSaving(true);
    const patch = {
      visa_type_id: form.visa_type_id,
      visa_sub_type_id: form.visa_sub_type_id || null,
      quoted_fee_inr: Number(form.quoted_fee_inr) || 0,
      quoted_govt_fee_cad: Number(form.quoted_govt_fee_cad) || 0,
      target_submission_date: form.target_submission_date || null,
      priority: form.priority,
      case_manager_id: form.case_manager_id || null,
      senior_advisor_id: form.senior_advisor_id || null,
      outcome: form.outcome || null,
      notes: form.notes || null,
      uci_number: form.uci_number.trim() || null,
      application_number: form.application_number.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("cases").update(patch).eq("id", caseRow.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    void writeAudit({ action: "UPDATE", entity_type: "cases", entity_id: caseRow.id, changes: patch });
    toast.success("Case updated");
    onSaved();
  };

  return (
    <div className="card-surface p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Visa type</label>
          <Select value={form.visa_type_id} onValueChange={(v) => setForm({ ...form, visa_type_id: v, visa_sub_type_id: "" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {visaTypes.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Visa sub-type</label>
          <Select
            value={form.visa_sub_type_id || UNASSIGNED}
            onValueChange={(v) => setForm({ ...form, visa_sub_type_id: v === UNASSIGNED ? "" : v })}
            disabled={subVisaTypes.length === 0}
          >
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>—</SelectItem>
              {subVisaTypes.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Quoted fee (INR)</label>
          <Input type="number" min="0" step="100" value={form.quoted_fee_inr} onChange={(e) => setForm({ ...form, quoted_fee_inr: e.target.value })} />
          <div className="text-[10px] text-muted-foreground">{fmtMoney(Number(form.quoted_fee_inr) || 0, "INR")}</div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Govt fee (CAD)</label>
          <Input type="number" min="0" step="10" value={form.quoted_govt_fee_cad} onChange={(e) => setForm({ ...form, quoted_govt_fee_cad: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Target submission</label>
          <Input type="date" value={form.target_submission_date ?? ""} onChange={(e) => setForm({ ...form, target_submission_date: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Priority</label>
          <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Case manager</label>
          <Select
            value={form.case_manager_id || UNASSIGNED}
            onValueChange={(v) => setForm({ ...form, case_manager_id: v === UNASSIGNED ? "" : v })}
          >
            <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Senior advisor</label>
          <Select
            value={form.senior_advisor_id || UNASSIGNED}
            onValueChange={(v) => setForm({ ...form, senior_advisor_id: v === UNASSIGNED ? "" : v })}
          >
            <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {staff.filter((s) => s.role === "senior_advisor" || s.role === "owner" || s.role === "admin").map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* IRCC identifiers — used for email auto-matching */}
      <div className="rounded-lg border border-border bg-blue-50/40 dark:bg-blue-900/10 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">IRCC Identifiers</span>
          <span className="text-[10px] text-muted-foreground ml-1">Used to auto-match incoming IRCC emails</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">UCI Number</label>
            <Input
              value={form.uci_number}
              onChange={(e) => setForm({ ...form, uci_number: e.target.value })}
              placeholder="e.g. 1234-5678"
            />
            <p className="text-[10px] text-muted-foreground">Universal Client Identifier from IRCC</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Application / File Number</label>
            <Input
              value={form.application_number}
              onChange={(e) => setForm({ ...form, application_number: e.target.value })}
              placeholder="e.g. E0012345678"
            />
            <p className="text-[10px] text-muted-foreground">IRCC application or file reference</p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Outcome</label>
        <Input value={form.outcome ?? ""} onChange={(e) => setForm({ ...form, outcome: e.target.value })} placeholder="approved, refused, withdrawn…" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</label>
        <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90">
          <Save className="h-4 w-4 mr-1.5" />
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
