"use client";

// src/components/lead-detail/NextBestActionBar.tsx
import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { ChainTask } from "@/lib/types";

interface Props {
  task: ChainTask;
  onAction: () => void;
}

function slaText(dueAt: string | null | undefined) {
  if (!dueAt) return "no SLA";
  const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86400000);
  if (days < 0) return `${Math.abs(days)} days OVERDUE`;
  if (days === 0) return "due today";
  return `${days} day${days === 1 ? "" : "s"} remaining`;
}

export function NextBestActionBar({ task, onAction }: Props) {
  const [busy, setBusy] = useState(false);
  const sla = slaText(task.sla_due_at);
  const overdue = task.sla_due_at && new Date(task.sla_due_at).getTime() < Date.now();

  const markContacted = async () => {
    setBusy(true);
    try {
      await (supabase as any).from("tasks").update({
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", task.id);
      if (task.prospective_application_id) {
        await (supabase as any).from("prospective_applications").update({
          status: "client_contacted",
          client_decision_at: new Date().toISOString(),
        }).eq("id", task.prospective_application_id);
      }
      onAction();
    } finally {
      setBusy(false);
    }
  };

  const snooze = async () => {
    setBusy(true);
    try {
      const newDue = new Date(Date.now() + 3 * 86400000).toISOString();
      await (supabase as any).from("tasks").update({ sla_due_at: newDue, due_at: newDue }).eq("id", task.id);
      onAction();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={`p-3 ${overdue ? "bg-red-50 border-red-200" : "bg-red-50/60 border-red-200"}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <AlertCircle className="w-5 h-5 text-red-700 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-red-900">
            Next best action · SLA {sla}
          </p>
          <p className="text-xs text-red-700">{task.description || task.title}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={markContacted} disabled={busy} className="bg-red-700 hover:bg-red-800">
            Mark contacted
          </Button>
          <Button size="sm" variant="outline" onClick={snooze} disabled={busy}>
            Snooze 3 days
          </Button>
        </div>
      </div>
    </Card>
  );
}
