"use client";

// src/components/applications/CaseQuickActionsMenu.tsx
import { useState } from "react";
import { MoreVertical, CheckCircle2, XCircle, UserPlus, StickyNote, Eye, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { MarkOutcomePopover } from "./MarkOutcomePopover";
import { CaseQuickViewSheet } from "./CaseQuickViewSheet";
import { useNavigate } from "@/lib/router-compat";
import type { ApplicationRow } from "@/lib/types";

interface Props {
  app: ApplicationRow;
  onUpdated: (updated: Partial<ApplicationRow>) => void;
}

export function CaseQuickActionsMenu({ app, onUpdated }: Props) {
  const navigate = useNavigate();
  const [outcomeOpen, setOutcomeOpen] = useState<"approved" | "refused" | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setQuickViewOpen(true)}>
            <Eye className="w-3.5 h-3.5 mr-2" /> Quick view
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOutcomeOpen("approved")}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-emerald-600" /> Mark approved
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOutcomeOpen("refused")}>
            <XCircle className="w-3.5 h-3.5 mr-2 text-red-600" /> Mark refused
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => {/* TODO: reassign */}}>
            <UserPlus className="w-3.5 h-3.5 mr-2" /> Reassign
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => {/* TODO: add note */}}>
            <StickyNote className="w-3.5 h-3.5 mr-2" /> Add note
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate(`/cases/${app.id}`)}>
            <ArrowUpRight className="w-3.5 h-3.5 mr-2" /> Open full page
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {outcomeOpen && (
        <MarkOutcomePopover
          caseId={app.id}
          applicationType={app.application_type || "study_permit"}
          outcome={outcomeOpen}
          open={outcomeOpen !== null}
          onOpenChange={(o) => !o && setOutcomeOpen(null)}
          onSuccess={(decisionDate) => {
            onUpdated({
              outcome: outcomeOpen,
              decision_date: decisionDate,
              stage: outcomeOpen,
              checklist_step: outcomeOpen === "approved" ? 7 : app.checklist_step,
            });
            setOutcomeOpen(null);
          }}
        />
      )}

      <CaseQuickViewSheet
        caseId={app.id}
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
        onUpdated={onUpdated}
      />
    </>
  );
}
