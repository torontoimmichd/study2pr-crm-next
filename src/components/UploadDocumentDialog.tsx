"use client";

import { useState, FormEvent, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { writeAudit } from "@/lib/audit";
import { useAuth } from "@/lib/auth-context";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caseId: string;
  /** When set, we're uploading against an existing checklist row. */
  existingDocId?: string | null;
  /** Pre-fill the title (e.g. checklist requirement label). */
  defaultTitle?: string;
  defaultDocType?: string;
  onUploaded?: () => void;
}

export function UploadDocumentDialog({ open, onOpenChange, caseId, existingDocId, defaultTitle, defaultDocType, onUploaded }: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState(defaultTitle ?? "");
  const [documentType, setDocumentType] = useState(defaultDocType ?? "general");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // reset on open changes
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setTitle(defaultTitle ?? "");
      setDocumentType(defaultDocType ?? "general");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    }
    onOpenChange(v);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) { toast.error("Choose a file first"); return; }
    if (!title.trim()) { toast.error("Title is required"); return; }
    setBusy(true);

    const safeName = file.name.replace(/[^\w.-]+/g, "_");
    const path = `${caseId}/${Date.now()}_${safeName}`;

    const { error: upErr } = await supabase.storage.from("case-files").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
    if (upErr) { setBusy(false); toast.error(upErr.message); return; }

    if (existingDocId) {
      const patch = {
        title,
        document_type: documentType,
        storage_bucket: "case-files",
        storage_path: path,
        mime_type: file.type || null,
        file_size_bytes: file.size,
        uploaded_by: user?.id ?? null,
        status: "pending_review",
        is_deleted: false,
      };
      const { error } = await supabase.from("case_documents").update(patch).eq("id", existingDocId);
      if (error) { setBusy(false); toast.error(error.message); return; }
      void writeAudit({ action: "UPLOAD", entity_type: "case_documents", entity_id: existingDocId, changes: patch });
    } else {
      const insert = {
        case_id: caseId,
        title,
        document_type: documentType,
        storage_bucket: "case-files",
        storage_path: path,
        mime_type: file.type || null,
        file_size_bytes: file.size,
        uploaded_by: user?.id ?? null,
        status: "pending_review",
      };
      const { data, error } = await supabase.from("case_documents").insert(insert).select("id").single();
      if (error) { setBusy(false); toast.error(error.message); return; }
      void writeAudit({ action: "UPLOAD", entity_type: "case_documents", entity_id: data.id, changes: insert });
    }

    setBusy(false);
    toast.success("Document uploaded");
    onUploaded?.();
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader><DialogTitle>{existingDocId ? "Upload document" : "Add & upload document"}</DialogTitle></DialogHeader>

          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. IELTS results" required />
          </div>
          <div className="space-y-2">
            <Label>Document type</Label>
            <Input value={documentType} onChange={(e) => setDocumentType(e.target.value)} placeholder="e.g. passport, ielts, education" />
          </div>
          <div className="space-y-2">
            <Label>File *</Label>
            <Input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
            {file && <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · {file.type || "unknown"}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Uploading…" : "Upload"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
