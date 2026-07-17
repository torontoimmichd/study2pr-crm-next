/**
 * NotesPanel.tsx  — NEW FILE (2026-07-13)
 * Save in GitHub as: src/components/NotesPanel.tsx
 *
 * Real notes system, replacing the old single-text-blob lead notes.
 * - One row per note (table: entity_notes — created by sql/12)
 * - 9 categories: General, Follow-up, Internal, Client Communication, Call,
 *   Meeting, Email, WhatsApp, GC Account & Password
 * - Lockable: a locked note is visible ONLY to owner/admin and its author
 *   (enforced by database RLS, not just the UI). Only owner/admin can unlock;
 *   unlocking writes the note to the shared timeline.
 * - Unified: on an application it also shows notes made on the original lead
 *   and client (via v_case_notes); on a lead it also shows notes from the
 *   application(s) it became (via v_lead_notes). Falls back to direct table
 *   reads if sql/12's views aren't installed yet.
 *
 * Usage: <NotesPanel caseId={id} clientId={clientId} />  or  <NotesPanel leadId={id} />
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, LockOpen, Plus, StickyNote, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasRole } from "@/lib/auth-context";
import { fmtRelative, fmtDateTimeIST } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ── Note categories ──────────────────────────────────────────────────────────
const NOTE_TYPES: { value: string; label: string; badge: string }[] = [
  { value: "general",              label: "General",                badge: "bg-slate-100 text-slate-700" },
  { value: "follow_up",            label: "Follow-up",              badge: "bg-blue-100 text-blue-800" },
  { value: "internal",             label: "Internal",               badge: "bg-purple-100 text-purple-800" },
  { value: "client_communication", label: "Client Communication",   badge: "bg-emerald-100 text-emerald-800" },
  { value: "call",                 label: "Call",                   badge: "bg-teal-100 text-teal-800" },
  { value: "meeting",              label: "Meeting",                badge: "bg-indigo-100 text-indigo-800" },
  { value: "email",                label: "Email",                  badge: "bg-sky-100 text-sky-800" },
  { value: "whatsapp",             label: "WhatsApp",               badge: "bg-green-100 text-green-800" },
  { value: "gc_account",           label: "GC Account & Password",  badge: "bg-amber-100 text-amber-900" },
];
const typeMeta = (v: string) => NOTE_TYPES.find(t => t.value === v) ?? NOTE_TYPES[0];

interface NoteRow {
  id: string;
  lead_id: string | null;
  client_id: string | null;
  case_id: string | null;
  note_type: string;
  body: string;
  is_locked: boolean;
  created_by: string | null;
  created_at: string;
  migrated_from: string | null;
}

interface Props {
  leadId?: string;
  caseId?: string;
  clientId?: string;
  /** Heading shown above the list */
  title?: string;
}

export function NotesPanel({ leadId, caseId, clientId, title = "Notes" }: Props) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const isAdmin = hasRole(profile, "owner", "admin");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [noteType, setNoteType]     = useState("general");
  const [body, setBody]             = useState("");
  const [locked, setLocked]         = useState(false);
  const [saving, setSaving]         = useState(false);

  const notesKey = ["entity-notes", caseId ?? leadId ?? clientId];

  const { data: notes = [], isLoading } = useQuery({
    queryKey: notesKey,
    enabled: !!(caseId || leadId || clientId),
    queryFn: async (): Promise<NoteRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const cols = "id, lead_id, client_id, case_id, note_type, body, is_locked, created_by, created_at, migrated_from";

      // Prefer the unified views (lead + client + application in one list)…
      if (caseId) {
        const v = await sb.from("v_case_notes").select(cols).eq("for_case_id", caseId).order("created_at", { ascending: false }).limit(200);
        if (!v.error) return v.data ?? [];
      } else if (leadId) {
        const v = await sb.from("v_lead_notes").select(cols).eq("for_lead_id", leadId).order("created_at", { ascending: false }).limit(200);
        if (!v.error) return v.data ?? [];
      }
      // …fall back to a direct read if sql/12 views aren't installed yet.
      let q = sb.from("entity_notes").select(cols).order("created_at", { ascending: false }).limit(200);
      if (caseId) q = q.eq("case_id", caseId);
      else if (leadId) q = q.eq("lead_id", leadId);
      else q = q.eq("client_id", clientId);
      const d = await q;
      if (d.error) throw new Error(d.error.message);
      return d.data ?? [];
    },
  });

  // Resolve author names in one batch
  const authorIds = Array.from(new Set(notes.map(n => n.created_by).filter(Boolean))) as string[];
  const { data: authors } = useQuery({
    queryKey: ["note-authors", authorIds.join(",")],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("staff_profiles").select("id, full_name").in("id", authorIds);
      return new Map((data ?? []).map(a => [a.id, a.full_name]));
    },
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: notesKey });
    void qc.invalidateQueries({ queryKey: ["timeline"] });
  };

  const saveNote = async () => {
    if (!body.trim()) { toast.error("Note text is required"); return; }
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("entity_notes").insert({
      lead_id: leadId ?? null,
      client_id: clientId ?? null,
      case_id: caseId ?? null,
      note_type: noteType,
      body: body.trim(),
      is_locked: locked,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("entity_notes")
        ? "Notes table not found — run sql/12 in Supabase first."
        : error.message);
      return;
    }
    toast.success(locked ? "Locked note added" : "Note added");
    setBody(""); setNoteType("general"); setLocked(false); setDialogOpen(false);
    invalidate();
  };

  const setLock = async (note: NoteRow, lock: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("entity_notes")
      .update({ is_locked: lock }).eq("id", note.id);
    if (error) { toast.error(error.message); return; }
    toast.success(lock ? "Note locked" : "Note unlocked — now visible in the timeline");
    invalidate();
  };

  const deleteNote = async (note: NoteRow) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("entity_notes").delete().eq("id", note.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Note deleted");
    invalidate();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <StickyNote className="h-4 w-4 text-muted-foreground" /> {title} ({notes.length})
        </h3>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Note
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading notes…
        </div>
      ) : notes.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No notes yet. Add the first one.
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map(n => {
            const meta = typeMeta(n.note_type);
            const mine = n.created_by === user?.id;
            const authorName = n.created_by
              ? (authors?.get(n.created_by) ?? "Staff")
              : (n.migrated_from ? "Migrated" : "System");
            return (
              <div key={n.id} className={cn(
                "card-surface p-3 border rounded-lg",
                n.is_locked && "border-amber-300 bg-amber-50/40",
              )}>
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", meta.badge)}>
                    {meta.label}
                  </span>
                  {n.is_locked && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 flex items-center gap-0.5">
                      <Lock className="h-2.5 w-2.5" /> Locked
                    </span>
                  )}
                  {n.case_id && !caseId && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">application</span>}
                  {n.lead_id && !leadId && !n.case_id && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">lead</span>}
                  <span className="text-[11px] text-muted-foreground ml-auto" title={fmtDateTimeIST(n.created_at)}>
                    {authorName} · {fmtRelative(n.created_at)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                <div className="flex gap-1 justify-end mt-1.5">
                  {n.is_locked && isAdmin && (
                    <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => void setLock(n, false)}>
                      <LockOpen className="h-3 w-3 mr-1" /> Unlock
                    </Button>
                  )}
                  {!n.is_locked && (mine || isAdmin) && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-muted-foreground" onClick={() => void setLock(n, true)}>
                      <Lock className="h-3 w-3 mr-1" /> Lock
                    </Button>
                  )}
                  {(isAdmin || (mine && !n.is_locked)) && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-destructive" onClick={() => void deleteNote(n)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Note dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!saving) setDialogOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              Add Note {caseId ? "to Application" : leadId ? "to Lead" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Note Type</Label>
              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NOTE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Note</Label>
              <Textarea rows={4} value={body} onChange={e => setBody(e.target.value)}
                placeholder={noteType === "gc_account"
                  ? "GC account details… (tip: lock this note below)"
                  : "Write the note…"} className="text-sm" />
            </div>
            <button type="button" onClick={() => setLocked(!locked)}
              className={cn("w-full flex items-center gap-2 rounded-md border p-2 text-left text-xs transition-colors",
                locked ? "border-amber-400 bg-amber-50 text-amber-900" : "border-border text-muted-foreground hover:border-amber-300")}>
              {locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
              <span>
                <span className="font-medium">{locked ? "Locked" : "Lock this note"}</span>
                {" — "}only admin/owner and you can see a locked note. Unlocking posts it to the timeline.
              </span>
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={() => void saveNote()} disabled={saving || !body.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
