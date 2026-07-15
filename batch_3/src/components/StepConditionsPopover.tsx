"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GitBranch, Plus, Trash2, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { writeAudit } from "@/lib/audit";
import { toast } from "sonner";

interface Condition {
  id: string;
  step_template_id: string;
  action: string;
  condition: unknown;
  notes: string | null;
}

const ACTIONS = [
  { value: "skip", label: "Skip step" },
  { value: "require", label: "Require step" },
  { value: "branch", label: "Branch to alternate" },
  { value: "auto_complete", label: "Auto-complete" },
];

const FIELDS = [
  { value: "visa_sub_type", label: "Visa sub-type code" },
  { value: "client_country", label: "Client country" },
  { value: "case_priority", label: "Case priority" },
  { value: "has_dependents", label: "Has dependents" },
  { value: "stage", label: "Current stage" },
];

const OPERATORS = [
  { value: "eq", label: "=" },
  { value: "neq", label: "≠" },
  { value: "in", label: "in (comma-sep)" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
];

interface Props {
  stepId: string;
  stepTitle: string;
  count: number;
}

export function StepConditionsPopover({ stepId, stepTitle, count }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newField, setNewField] = useState("visa_sub_type");
  const [newOp, setNewOp] = useState("eq");
  const [newValue, setNewValue] = useState("");
  const [newAction, setNewAction] = useState("skip");
  const [adding, setAdding] = useState(false);

  const conditionsQ = useQuery({
    queryKey: ["step_conditions_for", stepId],
    enabled: open,
    queryFn: async (): Promise<Condition[]> => {
      const { data, error } = await supabase
        .from("step_conditions")
        .select("id, step_template_id, action, condition, notes")
        .eq("step_template_id", stepId);
      if (error) throw error;
      return (data ?? []) as Condition[];
    },
  });

  const handleAdd = async () => {
    if (!newValue.trim()) {
      toast.error("Value required");
      return;
    }
    setAdding(true);
    try {
      const cond = { field: newField, op: newOp, value: newValue.trim() };
      const { data, error } = await supabase
        .from("step_conditions")
        .insert({
          step_template_id: stepId,
          action: newAction,
          condition: cond as never,
        } as never)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (data?.id) {
        void writeAudit({
          action: "CREATE",
          entity_type: "step_condition",
          entity_id: data.id,
          changes: { step_template_id: stepId, action: newAction, condition: cond },
        });
      }
      setNewValue("");
      void qc.invalidateQueries({ queryKey: ["step_conditions_for", stepId] });
      void qc.invalidateQueries({ queryKey: ["wf_step_conditions"] });
      toast.success("Condition added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (c: Condition) => {
    const { error } = await supabase.from("step_conditions").delete().eq("id", c.id);
    if (error) {
      toast.error("Delete failed", { description: error.message });
      return;
    }
    void writeAudit({
      action: "DELETE",
      entity_type: "step_condition",
      entity_id: c.id,
      changes: { step_template_id: stepId },
    });
    void qc.invalidateQueries({ queryKey: ["step_conditions_for", stepId] });
    void qc.invalidateQueries({ queryKey: ["wf_step_conditions"] });
    toast.success("Condition removed");
  };

  const fmtCondition = (c: Condition) => {
    const cond = c.condition as { field?: string; op?: string; value?: string } | null;
    if (!cond?.field) return "—";
    const opLbl = OPERATORS.find((o) => o.value === cond.op)?.label ?? cond.op;
    return `${cond.field} ${opLbl} ${cond.value ?? ""}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          title="Conditions"
          className={count > 0 ? "text-amber-700 hover:text-amber-800" : "text-muted-foreground"}
        >
          <GitBranch className="h-4 w-4" />
          {count > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1">{count}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        <div className="px-3 py-2.5 border-b border-border">
          <div className="font-medium text-sm text-navy">Conditions</div>
          <div className="text-[11px] text-muted-foreground truncate">for "{stepTitle}"</div>
        </div>

        <div className="max-h-[200px] overflow-y-auto divide-y divide-border">
          {conditionsQ.isLoading ? (
            <div className="p-3 text-xs text-muted-foreground">Loading…</div>
          ) : (conditionsQ.data ?? []).length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">
              No conditions. Step always runs.
            </div>
          ) : (
            (conditionsQ.data ?? []).map((c) => (
              <div key={c.id} className="p-2.5 flex items-start justify-between gap-2 hover:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] capitalize">{c.action.replace(/_/g, " ")}</Badge>
                    <code className="text-[11px] text-foreground/80 font-mono truncate">{fmtCondition(c)}</code>
                  </div>
                </div>
                <button
                  onClick={() => void handleRemove(c)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  aria-label="Remove condition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-border space-y-2 bg-muted/20">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Add condition</Label>
          <div className="grid grid-cols-2 gap-1.5">
            <Select value={newAction} onValueChange={setNewAction}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIONS.map((a) => <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={newField} onValueChange={setNewField}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELDS.map((f) => <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-1.5">
            <Select value={newOp} onValueChange={setNewOp}>
              <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OPERATORS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="value"
              className="h-8 text-xs"
            />
          </div>
          <Button size="sm" onClick={() => void handleAdd()} disabled={adding} className="w-full h-8">
            <Plus className="h-3.5 w-3.5" /> Add condition
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
