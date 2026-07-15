"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import { GitBranch, ArrowRight, Pencil, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtRelative } from "@/lib/format";
import { TableSkeleton } from "@/components/TableSkeleton";

interface VisaType {
  id: string;
  code: string;
  label: string;
  category: string;
}
interface VisaSubType {
  id: string;
  code: string;
  label: string;
  visa_type_id: string | null;
  is_active: boolean | null;
}
interface StepRow {
  id: string;
  visa_sub_type_id: string | null;
  is_active: boolean | null;
  version: number | null;
}
interface EditRow {
  step_template_id: string | null;
  proposed_at: string | null;
  proposed_by: string | null;
  status: string | null;
}

export default function AdminWorkflows() {
  const visaTypesQ = useQuery({
    queryKey: ["admin-wf-visa-types"],
    queryFn: async (): Promise<VisaType[]> => {
      const { data, error } = await supabase
        .from("visa_types")
        .select("id, code, label, category")
        .order("category")
        .order("label");
      if (error) throw error;
      return (data ?? []) as VisaType[];
    },
  });

  const subTypesQ = useQuery({
    queryKey: ["admin-wf-sub-types"],
    queryFn: async (): Promise<VisaSubType[]> => {
      const { data, error } = await supabase
        .from("visa_sub_types")
        .select("id, code, label, visa_type_id, is_active")
        .order("label");
      if (error) throw error;
      return (data ?? []) as VisaSubType[];
    },
  });

  const stepsQ = useQuery({
    queryKey: ["admin-wf-steps"],
    queryFn: async (): Promise<StepRow[]> => {
      const { data, error } = await supabase
        .from("step_templates")
        .select("id, visa_sub_type_id, is_active, version");
      if (error) throw error;
      return (data ?? []) as StepRow[];
    },
  });

  const editsQ = useQuery({
    queryKey: ["admin-wf-recent-edits"],
    queryFn: async (): Promise<EditRow[]> => {
      const { data, error } = await supabase
        .from("step_template_edits")
        .select("step_template_id, proposed_at, proposed_by, status")
        .order("proposed_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as EditRow[];
    },
  });

  const stepsBySubType = useMemo(() => {
    const m = new Map<string, StepRow[]>();
    (stepsQ.data ?? []).forEach((s) => {
      if (!s.visa_sub_type_id) return;
      const arr = m.get(s.visa_sub_type_id) ?? [];
      arr.push(s);
      m.set(s.visa_sub_type_id, arr);
    });
    return m;
  }, [stepsQ.data]);

  const stepIdToSubType = useMemo(() => {
    const m = new Map<string, string>();
    (stepsQ.data ?? []).forEach((s) => {
      if (s.visa_sub_type_id) m.set(s.id, s.visa_sub_type_id);
    });
    return m;
  }, [stepsQ.data]);

  const lastEditBySubType = useMemo(() => {
    const m = new Map<string, EditRow>();
    (editsQ.data ?? []).forEach((e) => {
      if (!e.step_template_id) return;
      const subType = stepIdToSubType.get(e.step_template_id);
      if (!subType) return;
      if (!m.has(subType)) m.set(subType, e);
    });
    return m;
  }, [editsQ.data, stepIdToSubType]);

  const pendingBySubType = useMemo(() => {
    const m = new Map<string, number>();
    (editsQ.data ?? []).forEach((e) => {
      if (e.status !== "pending" || !e.step_template_id) return;
      const subType = stepIdToSubType.get(e.step_template_id);
      if (!subType) return;
      m.set(subType, (m.get(subType) ?? 0) + 1);
    });
    return m;
  }, [editsQ.data, stepIdToSubType]);

  const groupedByVisaType = useMemo(() => {
    const visaTypes = visaTypesQ.data ?? [];
    const subs = subTypesQ.data ?? [];
    return visaTypes
      .map((vt) => ({
        visaType: vt,
        subTypes: subs.filter((s) => s.visa_type_id === vt.id),
      }))
      .filter((g) => g.subTypes.length > 0);
  }, [visaTypesQ.data, subTypesQ.data]);

  const isLoading = visaTypesQ.isLoading || subTypesQ.isLoading || stepsQ.isLoading;
  const totalPending = Array.from(pendingBySubType.values()).reduce((a, b) => a + b, 0);

  return (
    <>
      <AdminPageHeader
        title="Workflows & Stages"
        subtitle="Step templates per visa sub-type. Click any workflow to edit its steps, conditions, and triggers."
      />

      <div className="p-6 space-y-6">
        {totalPending > 0 && (
          <div className="rounded-lg border border-gold/40 bg-gold/10 p-3 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-gold mt-0.5 shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-navy">{totalPending}</span>{" "}
              <span className="text-muted-foreground">
                workflow edit{totalPending === 1 ? "" : "s"} awaiting your approval. Open the workflow to review.
              </span>
            </div>
          </div>
        )}

        {isLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : groupedByVisaType.length === 0 ? (
          <div className="card-surface p-12 text-center">
            <GitBranch className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-display text-lg text-navy">No visa sub-types yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Add visa types and their sub-types in{" "}
              <Link to="/admin/visa-types" className="text-primary underline-offset-2 hover:underline">
                Visa Types & Fees
              </Link>{" "}
              to start building workflows.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedByVisaType.map((group) => (
              <section key={group.visaType.id} className="card-surface overflow-hidden">
                <header className="px-5 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-base text-navy">{group.visaType.label}</h2>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">
                      {group.visaType.category} · {group.subTypes.length} sub-type
                      {group.subTypes.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </header>
                <div className="divide-y divide-border">
                  {group.subTypes.map((st) => {
                    const steps = stepsBySubType.get(st.id) ?? [];
                    const activeSteps = steps.filter((s) => s.is_active !== false).length;
                    const lastEdit = lastEditBySubType.get(st.id);
                    const pending = pendingBySubType.get(st.id) ?? 0;
                    return (
                      <Link
                        key={st.id}
                        to={`/admin/workflows/${st.id}`}
                        className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 hover:bg-muted/30 transition-colors items-center group"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-navy truncate">{st.label}</span>
                            <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                              {st.code}
                            </code>
                            {!st.is_active && (
                              <Badge variant="secondary" className="text-[10px]">
                                inactive
                              </Badge>
                            )}
                            {pending > 0 && (
                              <Badge className="text-[10px] bg-gold/20 text-gold-foreground border-gold/30 hover:bg-gold/30">
                                {pending} pending
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {lastEdit?.proposed_at ? (
                              <>Last edited {fmtRelative(lastEdit.proposed_at)}</>
                            ) : (
                              <>Never edited</>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground tabular-nums">
                          <span className="text-navy font-medium">{activeSteps}</span>
                          <span className="opacity-60">
                            {steps.length !== activeSteps ? ` / ${steps.length}` : ""} steps
                          </span>
                        </div>
                        <Button size="sm" variant="ghost" className="text-muted-foreground group-hover:text-foreground" asChild>
                          <span>
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </span>
                        </Button>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
