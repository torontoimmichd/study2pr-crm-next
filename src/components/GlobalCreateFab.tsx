"use client";

// src/components/GlobalCreateFab.tsx
// Floating Action Button — global create shortcut for Lead, Application/Case, Task
// Auto-detects current lead/case page and pre-fills the task dialog.

import { useState } from "react";
import { Plus, UserPlus, Briefcase, CheckSquare } from "lucide-react";
import { NewLeadDialog } from "./NewLeadDialog";
import { NewCaseDialog } from "./NewCaseDialog";
import { NewTaskDialog } from "./NewTaskDialog";
import { useNavigate, useLocation } from "@/lib/router-compat";

/** Parse the current URL to detect which entity is open */
function usePageContext() {
  const location = useLocation();
  const leadMatch  = location.pathname.match(/^\/leads\/([a-z0-9-]+)/i);
  const caseMatch  = location.pathname.match(/^\/cases\/([a-z0-9-]+)/i);
  const clientMatch = location.pathname.match(/^\/clients\/([a-z0-9-]+)/i);
  return {
    leadId:   leadMatch?.[1]   ?? null,
    caseId:   caseMatch?.[1]   ?? null,
    clientId: clientMatch?.[1] ?? null,
  };
}

export function GlobalCreateFab() {
  const [open, setOpen]       = useState(false);
  const [leadOpen, setLeadOpen]  = useState(false);
  const [caseOpen, setCaseOpen]  = useState(false);
  const [taskOpen, setTaskOpen]  = useState(false);
  const navigate = useNavigate();
  const { leadId, caseId, clientId } = usePageContext();

  const openLead = () => { setOpen(false); setLeadOpen(true); };
  const openCase = () => { setOpen(false); setCaseOpen(true); };
  const openTask = () => { setOpen(false); setTaskOpen(true); };

  // Context hint shown on "New Task" button when on a lead/case page
  const taskContext = leadId ? "for this lead" : caseId ? "for this case" : null;

  return (
    <>
      {/* Backdrop when menu open */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* FAB stack */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {/* Sub-actions — visible when open */}
        {open && (
          <div className="flex flex-col items-end gap-2 mb-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <button
              onClick={openTask}
              className="flex items-center gap-2 bg-card border border-border shadow-lg rounded-full px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <CheckSquare className="w-4 h-4 text-primary" />
              New Task
              {taskContext && (
                <span className="text-[10px] text-muted-foreground font-normal ml-0.5">({taskContext})</span>
              )}
            </button>
            <button
              onClick={openCase}
              className="flex items-center gap-2 bg-card border border-border shadow-lg rounded-full px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Briefcase className="w-4 h-4 text-accent" />
              New Application
            </button>
            <button
              onClick={openLead}
              className="flex items-center gap-2 bg-card border border-border shadow-lg rounded-full px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <UserPlus className="w-4 h-4 text-success" />
              New Lead
            </button>
          </div>
        )}

        {/* Main FAB button */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close create menu" : "Create new item"}
          className={`
            w-14 h-14 rounded-full shadow-xl flex items-center justify-center
            transition-all duration-200
            ${open
              ? "bg-navy hover:bg-navy/90 text-white rotate-45"
              : "bg-primary hover:bg-primary/90 text-white"}
          `}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Dialogs */}
      <NewLeadDialog
        open={leadOpen}
        onOpenChange={setLeadOpen}
        onCreated={(id) => navigate(`/leads/${id}`)}
      />

      <NewCaseDialog
        open={caseOpen}
        onOpenChange={setCaseOpen}
        defaultLeadId={leadId}
        defaultClientId={clientId}
      />

      {/* Task dialog — pre-filled with current lead/case context */}
      <NewTaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        defaultLeadId={leadId}
        defaultCaseId={caseId}
      />
    </>
  );
}
