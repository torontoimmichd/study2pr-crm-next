"use client";

/**
 * Staff: /assessments — submitted questionnaires with per-program scores,
 * plus the eligibility Rules editor (weights + on/off; owner/admin writes
 * enforced by RLS). Works once sql/22 is run.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, SlidersHorizontal, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Assessment {
  id: string; status: string; submitted_at: string;
  payload: Record<string, unknown>; facts: Record<string, unknown> | null;
  score_results: { visa_code: string; score: number; qualified: boolean; hard_gate_failures: string[] }[] | null;
}
interface Rule {
  id: string; visa_code: string; rule_code: string; label: string;
  rule_type: string; weight: number; is_active: boolean;
}

export default function AssessmentsReview() {
  const qc = useQueryClient();
  const [viewing, setViewing] = useState<Assessment | null>(null);

  const { data: rows, error } = useQuery({
    queryKey: ["assessments-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assessments")
        .select("id, status, submitted_at, payload, facts, score_results")
        .order("submitted_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as Assessment[];
    },
  });

  const { data: rules } = useQuery({
    queryKey: ["elig-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("program_eligibility_rules")
        .select("id, visa_code, rule_code, label, rule_type, weight, is_active")
        .order("visa_code").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Rule[];
    },
  });

  const personName = (a: Assessment) =>
    ((a.payload?.personal as Record<string, string>)?.full_name) || "Unnamed";
  const personPhone = (a: Assessment) =>
    ((a.payload?.personal as Record<string, string>)?.phone) || "—";
  const best = (a: Assessment) => {
    const r = [...(a.score_results ?? [])].sort((x, y) => y.score - x.score)[0];
    return r ? `${r.visa_code} ${r.score}%` : "not scored";
  };

  const updateRule = async (r: Rule, patch: Partial<Rule>) => {
    const { error } = await supabase.from("program_eligibility_rules").update(patch).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["elig-rules"] });
  };

  const grouped = (rules ?? []).reduce((acc, r) => {
    (acc[r.visa_code] = acc[r.visa_code] ?? []).push(r);
    return acc;
  }, {} as Record<string, Rule[]>);

  return (
    <>
      <PageHeader title="Assessments" subtitle="Submitted eligibility questionnaires, auto-scored against your program rules." />
      <div className="p-6">
        {error ? (
          <div className="card-surface p-8 text-center text-sm text-muted-foreground">
            Assessment tables not installed yet — run sql/22 in Supabase, then refresh this page.
          </div>
        ) : (
          <Tabs defaultValue="list">
            <TabsList>
              <TabsTrigger value="list"><ClipboardList className="h-3.5 w-3.5 mr-1" />Submissions ({rows?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="rules"><SlidersHorizontal className="h-3.5 w-3.5 mr-1" />Eligibility rules</TabsTrigger>
            </TabsList>

            <TabsContent value="list">
              <div className="card-surface overflow-hidden mt-3">
                {!rows?.length ? (
                  <p className="p-10 text-center text-sm text-muted-foreground">
                    No assessments yet. Share the public link: <b>/assessment</b>
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {rows.map((a) => (
                      <li key={a.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 cursor-pointer"
                          onClick={() => setViewing(a)}>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">{personName(a)}</div>
                          <p className="text-xs text-muted-foreground">
                            {personPhone(a)} · {new Date(a.submitted_at).toLocaleString("en-IN")} · {a.status}
                          </p>
                        </div>
                        <span className="text-xs rounded bg-muted px-2 py-1">{best(a)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>

            <TabsContent value="rules">
              <div className="space-y-4 mt-3">
                {Object.entries(grouped).map(([visa, list]) => (
                  <div key={visa} className="card-surface overflow-hidden">
                    <div className="px-4 py-2 border-b border-border bg-muted/40 text-sm font-medium">{visa}</div>
                    <ul className="divide-y divide-border">
                      {list.map((r) => (
                        <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className={"text-[10px] uppercase rounded px-1.5 py-0.5 " +
                            (r.rule_type === "hard_gate" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700")}>
                            {r.rule_type === "hard_gate" ? "gate" : "score"}
                          </span>
                          <span className="text-sm flex-1">{r.label}</span>
                          {r.rule_type === "weighted" && (
                            <Input type="number" className="w-20 h-8" value={r.weight}
                                   onChange={(e) => updateRule(r, { weight: +e.target.value })} />
                          )}
                          <Switch checked={r.is_active} onCheckedChange={(v) => updateRule(r, { is_active: v })} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Gates exclude a program entirely when failed. Score rules add their weight when passed;
                  qualified = no failed gates and ≥ 60%. Changes apply to the NEXT submission (existing ones keep their scores).
                </p>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewing ? personName(viewing) : ""} — assessment</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Program scores</h4>
                <ul className="space-y-1.5">
                  {[...(viewing.score_results ?? [])].sort((a, b) => b.score - a.score).map((r) => (
                    <li key={r.visa_code} className="flex items-center gap-2 text-sm">
                      {r.qualified
                        ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                        : <XCircle className="h-4 w-4 text-muted-foreground" />}
                      <span className="w-36 font-mono text-xs">{r.visa_code}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className={"h-full " + (r.qualified ? "bg-green-500" : "bg-muted-foreground/40")}
                             style={{ width: `${r.score}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs">{r.score}%</span>
                      {!!r.hard_gate_failures?.length && (
                        <span className="text-[10px] text-red-600">gate: {r.hard_gate_failures.join(", ")}</span>
                      )}
                    </li>
                  ))}
                  {!viewing.score_results?.length && (
                    <p className="text-xs text-muted-foreground">Not scored — run sql/22 and re-submit, or score manually.</p>
                  )}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Key facts</h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {Object.entries(viewing.facts ?? {}).map(([k, v]) => (
                    <div key={k} className="rounded bg-muted/50 px-2 py-1">
                      <span className="text-muted-foreground">{k.replace(/_/g, " ")}: </span>
                      <span className="font-medium">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Full submitted answers (raw)</summary>
                <pre className="mt-2 whitespace-pre-wrap break-all bg-muted/50 rounded p-3">
                  {JSON.stringify(viewing.payload, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
