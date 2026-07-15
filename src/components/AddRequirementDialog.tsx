"use client";

import { useState, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { writeAudit } from "@/lib/audit";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caseId: string;
  onCreated?: () => void;
}

export function AddRequirementDialog({ open, onOpenChange, caseId, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !docType.trim()) { toast.error("Title and type required"); return; }
    setBusy(true);
    const insert = {
      case_id: caseId,
      title,
      document_type: docType,
      // placeholder storage path until uploaded
      storage_bucket: "case-files",
      storage_path: `${caseId}/_pending_${Date.now()}`,
      status: "pending_upload",
      expires_at: dueDate || null,
    };
    const { data, error } = await supabase.from("case_documents").insert(insert).select("id").single();
    if (error) { setBusy(false); toast.error(error.message); return; }
    void writeAudit({ action: "CREATE", entity_type: "case_documents", entity_id: data.id, changes: insert });
    setBusy(false);
    toast.success("Requirement added");
    setTitle(""); setDocType(""); setDueDate("");
    onCreated?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader><DialogTitle>Add document requirement</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Requirement name *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Bank statement (last 6 months)" required />
          </div>
          <div className="space-y-2">
            <Label>Document type *</Label>
            <Input value={docType} onChange={(e) => setDocType(e.target.value)} placeholder="e.g. financials" required />
          </div>
          <div className="space-y-2">
            <Label>Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add requirement"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
