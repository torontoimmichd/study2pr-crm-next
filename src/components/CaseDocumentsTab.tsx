"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2, AlertCircle, Upload, Plus, Download, XCircle, ShieldCheck, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { fmtDateIST, fmtRelative } from "@/lib/format";
import { UploadDocumentDialog } from "@/components/UploadDocumentDialog";
import { AddRequirementDialog } from "@/components/AddRequirementDialog";
import { writeTimeline } from "@/lib/timeline";
import { writeAudit } from "@/lib/audit";
import { toast } from "sonner";

interface Props {
  caseId: string;
}

interface DocRow {
  id: string;
  title: string;
  document_type: string;
  status: string | null;
  storage_bucket: string;
  storage_path: string;
  expires_at: string | null;
  expires_on: string | null;
  uploaded_by: string | null;
  uploaded_by_name?: string;
  created_at: string | null;
  is_pending_upload: boolean;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  verified:       { icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />, color: "text-emerald-600", label: "Verified" },
  pending:        { icon: <Clock className="h-5 w-5 text-amber-500" />, color: "text-amber-600", label: "Pending review" },
  rejected:       { icon: <XCircle className="h-5 w-5 text-destructive" />, color: "text-destructive", label: "Rejected" },
  pending_upload: { icon: <AlertCircle className="h-5 w-5 text-amber-500" />, color: "text-amber-600", label: "Awaiting upload" },
};

export function CaseDocumentsTab({ caseId }: Props) {
  const qc = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [addReqOpen, setAddReqOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<DocRow | null>(null);

  const { data: docs, isLoading } = useQuery({
    queryKey: ["case-docs-full", caseId],
    queryFn: async (): Promise<DocRow[]> => {
      const { data } = await supabase
        .from("case_documents")
        .select("id, title, document_type, status, storage_bucket, storage_path, expires_at, expires_on, uploaded_by, created_at")
        .eq("case_id", caseId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });
      const rows = data ?? [];
      const ids = Array.from(new Set(rows.map((r) => r.uploaded_by).filter(Boolean) as string[]));
      const { data: actors } = ids.length
        ? await supabase.from("staff_profiles").select("id, full_name").in("id", ids)
        : { data: [] };
      const m = new Map((actors ?? []).map((a) => [a.id, a.full_name]));
      return rows.map((r) => ({
        ...r,
        uploaded_by_name: r.uploaded_by ? m.get(r.uploaded_by) ?? "Unknown" : undefined,
        is_pending_upload: !r.storage_path || r.status === "pending_upload" || r.storage_path.includes("_pending_"),
      }));
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["case-docs-full", caseId] });

  const downloadDoc = async (row: DocRow) => {
    const { data, error } = await supabase.storage.from(row.storage_bucket).createSignedUrl(row.storage_path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const openUpload = (row: DocRow | null) => { setActiveRow(row); setUploadOpen(true); };

  const setDocStatus = async (doc: DocRow, newStatus: "verified" | "rejected") => {
    const { error } = await supabase
      .from("case_documents")
      .update({ status: newStatus, ...(newStatus === "verified" ? { verified_at: new Date().toISOString() } : {}) })
      .eq("id", doc.id);
    if (error) { toast.error(error.message); return; }
    void writeAudit({ action: "UPDATE", entity_type: "case_documents", entity_id: doc.id, changes: { status: newStatus } });
    void writeTimeline({
      event_type: newStatus === "verified" ? "document_verified" : "document_uploaded",
      title: `Document ${newStatus}: ${doc.title}`,
      body: null,
      case_id: caseId,
      is_system: false,
    });
    void qc.invalidateQueries({ queryKey: ["timeline", "case", caseId] });
    toast.success(newStatus === "verified" ? "Document verified" : "Document marked as rejected");
    refresh();
  };

  const updateExpiry = async (id: string, v: string) => {
    const { error } = await supabase.from("case_documents").update({ expires_on: v || null }).eq("id", id);
    if (error) { toast.error("Could not save expiry: " + error.message); return; }
    toast.success(v ? "Validity date saved — expiry reminders active" : "Validity date cleared");
    qc.invalidateQueries({ queryKey: ["case-docs-full", caseId] });
  };

  if (isLoading) return <div className="card-surface p-6 text-sm text-muted-foreground">Loading documents…</div>;

  const uploaded  = docs?.filter((d) => !d.is_pending_upload) ?? [];
  const pending   = docs?.filter((d) => d.is_pending_upload) ?? [];
  const verified  = docs?.filter((d) => d.status === "verified") ?? [];
  const overdueDocs = pending.filter((d) => d.expires_at && new Date(d.expires_at) < new Date());
  const total     = docs?.length ?? 0;

  return (
    <div className="card-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm font-semibold">Document checklist</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setAddReqOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add requirement
          </Button>
          <Button size="sm" onClick={() => openUpload(null)}>
            <Upload className="h-3.5 w-3.5 mr-1" />Upload
          </Button>
        </div>
      </div>

      {/* Progress summary */}
      {total > 0 && (
        <div className="px-4 py-3 border-b border-border bg-muted/30 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{verified.length} of {total} verified · {uploaded.length} uploaded · {pending.length} pending</span>
            {overdueDocs.length > 0 && (
              <span className="text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />{overdueDocs.length} overdue
              </span>
            )}
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: total ? `${(verified.length / total) * 100}%` : "0%" }}
            />
            <div
              className="bg-amber-400 transition-all"
              style={{ width: total ? `${((uploaded.length - verified.length) / total) * 100}%` : "0%" }}
            />
          </div>

          {/* Overdue alert */}
          {overdueDocs.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/8 border border-destructive/20 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {overdueDocs.length === 1
                ? `"${overdueDocs[0].title}" is overdue — follow up with the client.`
                : `${overdueDocs.length} documents are overdue — follow up with the client.`}
            </div>
          )}
        </div>
      )}

      {!docs || docs.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm text-muted-foreground">No documents or requirements yet.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => setAddReqOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add first requirement
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {docs.map((d) => {
            const statusCfg = STATUS_CONFIG[d.status ?? (d.is_pending_upload ? "pending_upload" : "pending")] ?? STATUS_CONFIG.pending;
            const overdue = d.is_pending_upload && d.expires_at && new Date(d.expires_at) < new Date();

            return (
              <li key={d.id} className={`flex items-center gap-3 px-4 py-3 ${overdue ? "bg-destructive/3" : ""}`}>
                <div className="shrink-0">{statusCfg.icon}</div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{d.title}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-1.5 mt-0.5">
                    <span className="capitalize">{d.document_type?.replace(/_/g, " ")}</span>
                    {d.is_pending_upload ? (
                      <>
                        <span>·</span>
                        <span className={overdue ? "text-destructive font-medium" : "text-amber-600"}>
                          {d.expires_at
                            ? `Due ${fmtDateIST(d.expires_at)}${overdue ? " · OVERDUE" : ""}`
                            : "Pending upload"}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>·</span>
                        <span className={statusCfg.color}>{statusCfg.label}</span>
                        {d.uploaded_by_name && <><span>·</span><span>by {d.uploaded_by_name}</span></>}
                        <span>·</span>
                        <span>{fmtRelative(d.created_at)}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {d.is_pending_upload ? (
                    <Button size="sm" variant="outline" onClick={() => openUpload(d)}>
                      <Upload className="h-3.5 w-3.5 mr-1" />Upload
                    </Button>
                  ) : (
                    <>
                      <input
                        type="date"
                        className="h-7 rounded border border-border bg-background px-1.5 text-[11px] text-muted-foreground"
                        value={d.expires_on ?? ""}
                        title="Document valid until — feeds automatic expiry reminders"
                        onChange={(e) => updateExpiry(d.id, e.target.value)}
                      />
                      <Button size="sm" variant="ghost" onClick={() => downloadDoc(d)} title="Open file">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      {d.status !== "verified" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => setDocStatus(d, "verified")}
                          title="Mark as verified"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {d.status !== "rejected" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDocStatus(d, "rejected")}
                          title="Mark as rejected"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {d.status === "rejected" && (
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => openUpload(d)}>
                          <Upload className="h-3 w-3 mr-1" />Re-upload
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={(v) => { setUploadOpen(v); if (!v) setActiveRow(null); }}
        caseId={caseId}
        existingDocId={activeRow?.id ?? null}
        defaultTitle={activeRow?.title}
        defaultDocType={activeRow?.document_type}
        onUploaded={refresh}
      />
      <AddRequirementDialog
        open={addReqOpen}
        onOpenChange={setAddReqOpen}
        caseId={caseId}
        onCreated={refresh}
      />
    </div>
  );
}
