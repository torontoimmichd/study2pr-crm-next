"use client";

import { useState } from "react";
import { Link, useParams } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { fmtDateIST, fmtRelative, fmtMoney } from "@/lib/format";
import { NewCaseDialog } from "@/components/NewCaseDialog";
import { NewLeadDialog } from "@/components/NewLeadDialog";
import { FamilyMemberDialog, type FamilyMemberFormValue } from "@/components/FamilyMemberDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { writeAudit } from "@/lib/audit";
import { EntityTimeline } from "@/components/EntityTimeline";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [newEnquiryOpen, setNewEnquiryOpen] = useState(false);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState<FamilyMemberFormValue | null>(null);
  const [deletingFamilyId, setDeletingFamilyId] = useState<string | null>(null);

  const { data: client, isLoading, refetch } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: cases } = useQuery({
    queryKey: ["client-cases", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("cases")
        .select("id, case_code, current_stage_code, priority, visa_type_id, created_at, target_submission_date")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      const ids = Array.from(new Set((data ?? []).map((c) => c.visa_type_id)));
      const { data: visas } = ids.length ? await supabase.from("visa_types").select("id, label").in("id", ids) : { data: [] };
      const m = new Map((visas ?? []).map((v) => [v.id, v.label]));
      return (data ?? []).map((c) => ({ ...c, visa_label: m.get(c.visa_type_id) ?? "—" }));
    },
    enabled: !!id,
  });

  const { data: family, refetch: refetchFamily } = useQuery({
    queryKey: ["client-family", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("family_members")
        .select("id, full_name, relationship, date_of_birth, passport_number, is_dependent, is_included_on_current_case, notes")
        .eq("principal_client_id", id!)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!id,
  });

  const handleDeleteFamily = async () => {
    if (!deletingFamilyId) return;
    const target = family?.find((f) => f.id === deletingFamilyId);
    const { error } = await supabase.from("family_members").delete().eq("id", deletingFamilyId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await writeAudit({
      action: "DELETE",
      entity_type: "family_member",
      entity_id: deletingFamilyId,
      changes: target ?? null,
    });
    toast.success("Family member removed");
    setDeletingFamilyId(null);
    void refetchFamily();
  };

  const { data: payments } = useQuery({
    queryKey: ["client-payments", id],
    queryFn: async () => {
      // payments are linked via invoice → client
      const { data: invs } = await supabase.from("invoices").select("id").eq("client_id", id!);
      const invIds = (invs ?? []).map((i) => i.id);
      if (invIds.length === 0) return [];
      const { data } = await supabase
        .from("payments")
        .select("id, amount, currency, paid_at, status, provider, invoice_id")
        .in("invoice_id", invIds)
        .order("paid_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  if (isLoading) return <div><PageHeader title="Loading…" /></div>;
  if (!client) return <div><PageHeader title="Client not found" /><div className="p-6"><Link to="/clients" className="text-accent hover:underline text-sm">← Back to clients</Link></div></div>;

  return (
    <div>
      <PageHeader
        title={client.full_name}
        subtitle={`${client.client_code ?? ""} · ${client.country_of_citizenship ?? "—"} · onboarded ${fmtDateIST(client.onboarded_at)}`}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/clients"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Button></Link>
            <Button variant="outline" size="sm" onClick={() => setNewEnquiryOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />New Enquiry
            </Button>
            <Button size="sm" onClick={() => setNewCaseOpen(true)} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-1.5" />New Case
            </Button>
          </div>
        }
      />

      <NewLeadDialog
        open={newEnquiryOpen}
        onOpenChange={setNewEnquiryOpen}
        linkedClient={{
          id: client.id,
          full_name: client.full_name,
          email: client.email,
          phone: client.phone,
          country_of_residence: client.country_of_citizenship,
        }}
      />

      <div className="p-6 max-w-[1400px]">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="cases">Cases ({cases?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="family">Family ({family?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="payments">Payments ({payments?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="card-surface p-5 space-y-2">
            <Field label="Email" value={client.email} />
            <Field label="Phone" value={client.phone} />
            <Field label="WhatsApp" value={client.whatsapp} />
            <Field label="Country of citizenship" value={client.country_of_citizenship} />
            <Field label="Current residence" value={client.current_residence} />
            <Field label="Date of birth" value={client.date_of_birth ? fmtDateIST(client.date_of_birth) : null} />
            <Field label="Preferred language" value={client.preferred_language} />
            <Field label="Notes" value={client.notes} />
          </TabsContent>

          <TabsContent value="cases" className="card-surface overflow-hidden">
            {!cases || cases.length === 0 ? (
              <div className="p-10 text-center">
                <Briefcase className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-4">No cases yet for this client.</p>
                <Button onClick={() => setNewCaseOpen(true)} className="bg-primary hover:bg-primary/90"><Plus className="h-4 w-4 mr-1.5" />Create case</Button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Code</th>
                    <th className="text-left px-4 py-3 font-medium">Visa</th>
                    <th className="text-left px-4 py-3 font-medium">Stage</th>
                    <th className="text-left px-4 py-3 font-medium">Priority</th>
                    <th className="text-left px-4 py-3 font-medium">Target submit</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-3"><Link to={`/cases/${c.id}`} className="font-medium hover:text-accent">{c.case_code ?? c.id.slice(0, 8)}</Link></td>
                      <td className="px-4 py-3">{c.visa_label}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{c.current_stage_code?.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 capitalize">{c.priority}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDateIST(c.target_submission_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabsContent>

          <TabsContent value="family" className="card-surface overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-display text-lg text-navy">Family members</h3>
              <Button
                size="sm"
                onClick={() => { setEditingFamily(null); setFamilyOpen(true); }}
              >
                <Plus className="h-4 w-4 mr-1.5" />Add family member
              </Button>
            </div>
            {!family || family.length === 0 ? (
              <div className="p-10 text-center">
                <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No family members on record.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Relationship</th>
                    <th className="text-left px-4 py-3 font-medium">Full name</th>
                    <th className="text-left px-4 py-3 font-medium">DOB</th>
                    <th className="text-left px-4 py-3 font-medium">Passport #</th>
                    <th className="text-left px-4 py-3 font-medium">Dependent</th>
                    <th className="text-right px-4 py-3 font-medium w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {family.map((f) => (
                    <tr
                      key={f.id}
                      className="border-t border-border hover:bg-muted/30 cursor-pointer"
                      onClick={() => {
                        setEditingFamily({
                          id: f.id,
                          full_name: f.full_name,
                          relationship: f.relationship,
                          date_of_birth: f.date_of_birth,
                          passport_number: f.passport_number,
                          is_dependent: !!f.is_dependent,
                          is_included_on_current_case: !!f.is_included_on_current_case,
                          notes: f.notes,
                        });
                        setFamilyOpen(true);
                      }}
                    >
                      <td className="px-4 py-3 capitalize">{f.relationship}</td>
                      <td className="px-4 py-3 font-medium">{f.full_name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {f.date_of_birth ? fmtDateIST(f.date_of_birth) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs">{f.passport_number || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3">
                        {f.is_dependent ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gold/20 text-navy">Yes</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingFamily({
                                id: f.id,
                                full_name: f.full_name,
                                relationship: f.relationship,
                                date_of_birth: f.date_of_birth,
                                passport_number: f.passport_number,
                                is_dependent: !!f.is_dependent,
                                is_included_on_current_case: !!f.is_included_on_current_case,
                                notes: f.notes,
                              });
                              setFamilyOpen(true);
                            }}
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeletingFamilyId(f.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabsContent>

          <TabsContent value="payments" className="card-surface overflow-hidden">
            {!payments || payments.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No payments recorded.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Amount</th>
                    <th className="text-left px-4 py-3 font-medium">Provider</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmtRelative(p.paid_at)}</td>
                      <td className="px-4 py-3 font-medium">{fmtMoney(Number(p.amount), p.currency)}</td>
                      <td className="px-4 py-3 text-xs">{p.provider ?? "—"}</td>
                      <td className="px-4 py-3 text-xs capitalize">{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="card-surface p-5">
            <EntityTimeline clientId={id} allowNotes />
          </TabsContent>
        </Tabs>
      </div>

      <NewCaseDialog open={newCaseOpen} onOpenChange={setNewCaseOpen} clientId={id!} onCreated={() => { void refetch(); }} />

      <FamilyMemberDialog
        open={familyOpen}
        onOpenChange={setFamilyOpen}
        clientId={id!}
        initial={editingFamily}
        onSaved={() => void refetchFamily()}
      />

      <ConfirmDialog
        open={!!deletingFamilyId}
        onOpenChange={(o) => !o && setDeletingFamilyId(null)}
        title="Remove family member?"
        description="This will permanently delete the record. The action will be logged in the audit trail."
        confirmLabel="Remove"
        onConfirm={handleDeleteFamily}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2 border-b border-border last:border-0">
      <dt className="text-xs uppercase text-muted-foreground tracking-wider">{label}</dt>
      <dd className="col-span-2 text-sm">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}
