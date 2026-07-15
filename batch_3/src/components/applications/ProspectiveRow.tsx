"use client";

// src/components/applications/ProspectiveRow.tsx
import { Badge } from "@/components/ui/badge";
import { Link as LinkIcon, Clock } from "lucide-react";
import type { ProspectiveAppRow } from "@/lib/types";

interface Props {
  prospective: ProspectiveAppRow & {
    for_person_name?: string | null;
    family_unit_name?: string | null;
  };
  context: "lead_detail" | "applications_page" | "manager_drill";
  showFamilyContext?: boolean;
  onOpen: (id: string) => void;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function priorityColor(p: string | null | undefined) {
  switch (p) {
    case "critical": return "bg-red-100 text-red-900 border-red-300";
    case "high":     return "bg-amber-100 text-amber-900 border-amber-300";
    default:         return "bg-slate-100 text-slate-700 border-slate-300";
  }
}

export function ProspectiveRow({ prospective, context, showFamilyContext, onOpen }: Props) {
  const p = prospective;
  return (
    <button
      onClick={() => onOpen(p.id)}
      className="w-full text-left flex items-center gap-2 py-2 border-b last:border-0 border-dashed border-amber-300 bg-amber-50/40 hover:bg-amber-100/60 -mx-2 px-2 rounded"
    >
      <div className="w-28 shrink-0">
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-400 text-amber-700">
          <LinkIcon className="w-2 h-2 mr-0.5" /> Prospective
        </Badge>
      </div>

      {context !== "lead_detail" && (
        <div className="flex-1 min-w-[140px]">
          <p className="text-sm font-medium truncate">{p.for_person_name || "—"}</p>
          {showFamilyContext && p.family_unit_name && (
            <p className="text-[10px] text-muted-foreground truncate">↳ {p.family_unit_name}</p>
          )}
        </div>
      )}

      <div className="flex-1 min-w-[120px]">
        <p className="text-sm truncate text-amber-900 font-medium">{p.target_application_type}</p>
        <p className="text-[10px] text-amber-700 flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          triggers {fmtDate(p.trigger_date)}
        </p>
      </div>

      {p.chain_rule?.priority && (
        <Badge variant="outline" className={`text-[10px] ${priorityColor(p.chain_rule.priority)}`}>
          {p.chain_rule.priority}
        </Badge>
      )}

      {p.chain_rule?.sla_days && (
        <div className="w-16 shrink-0 text-right">
          <p className="text-[10px] text-muted-foreground">SLA</p>
          <p className="text-[11px] font-medium">{p.chain_rule.sla_days}d</p>
        </div>
      )}

      {p.estimated_fee_cad && (
        <div className="w-24 shrink-0 text-right">
          <p className="text-[10px] text-muted-foreground">est.</p>
          <p className="text-[11px] font-medium">CAD {p.estimated_fee_cad.toLocaleString()}</p>
        </div>
      )}

      <span className="text-xs text-amber-700 hover:text-amber-900 font-medium pr-1">Open →</span>
    </button>
  );
}
