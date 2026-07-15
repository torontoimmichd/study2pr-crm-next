"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search, CheckCircle2, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { TableSkeleton } from "@/components/TableSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { fmtDateIST, fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:  { label: "Pending",  cls: "bg-warning/15 text-warning",      icon: <Clock className="h-3 w-3" /> },
  verified: { label: "Verified", cls: "bg-success/15 text-success",      icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { label: "Rejected", cls: "bg-destructive/15 text-destructive", icon: <XCircle className="h-3 w-3" /> },
  expired:  { label: "Expired",  cls: "bg-muted text-muted-foreground",  icon: <Clock className="h-3 w-3" /> },
};

const TYPE_LABELS: Record<string, string> = {
  passport: "Passport", photo: "Photo", proof_of_funds: "Proof of Funds",
  language_test: "Language Test", education: "Education", employment: "Employment",
  police_clearance: "Police Clearance", medical: "Medical", other: "Other",
};

interface Doc {
  id: string;
  title: string;
  document_type: string;
  status: string | null;
  created_at: string | null;
  expires_at: string | null;
  verified_at: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  case_ref?: string | null;
  client_name?: string | null;
}

export default function Documents() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_documents")
        .select("id, title, document_type, status, created_at, expires_at, verified_at, file_size_bytes, mime_type, case_id")
        .is("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const caseIds = [...new Set((data ?? []).map((r) => r.case_id).filter(Boolean))];
      if (!caseIds.length) return (data ?? []) as Doc[];

      const { data: cases } = await supabase
        .from("cases")
        .select("id, case_ref, client_id")
        .in("id", caseIds);

      const clientIds = [...new Set((cases ?? []).map((c) => c.client_id).filter(Boolean))];
      const { data: clients } = clientIds.length
        ? await supabase.from("clients").select("id, full_name").in("id", clientIds)
        : { data: [] };

      const clientMap = new Map(
        ((clients ?? []) as { id: string; full_name: string }[]).map((c) => [c.id, c.full_name])
      );
      const caseMap = new Map(
        ((cases ?? []) as { id: string; case_ref: string; client_id: string }[]).map((c) => [c.id, { ref: c.case_ref, name: clientMap.get(c.client_id) ?? null }])
      );

      return (data ?? []).map((r) => ({
        ...r,
        case_ref: r.case_id ? caseMap.get(r.case_id)?.ref ?? null : null,
        client_name: r.case_id ? caseMap.get(r.case_id)?.name ?? null : null,
      })) as Doc[];
    },
  });

  const types = ["all", ...Object.keys(TYPE_LABELS)];

  const filtered = docs.filter((d) => {
    const matchType = typeFilter === "all" || d.document_type === typeFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      d.title.toLowerCase().includes(q) ||
      (d.client_name ?? "").toLowerCase().includes(q) ||
      (d.case_ref ?? "").toLowerCase().includes(q) ||
      d.document_type.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  const fmtSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div>
      <PageHeader title="Documents" subtitle="All uploaded documents across cases" />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search title, client, case, type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs capitalize transition-colors border",
                  typeFilter === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "all" ? "All" : (TYPE_LABELS[t] ?? t)}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No documents found" description="Documents are uploaded from case detail pages." />
        ) : (
          <div className="card-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Title", "Client", "Case", "Type", "Status", "Uploaded", "Expires", "Size"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((doc) => {
                  const tone = STATUS_TONE[doc.status ?? "pending"] ?? STATUS_TONE.pending;
                  const isExpiring =
                    doc.expires_at &&
                    new Date(doc.expires_at) < new Date(Date.now() + 30 * 86400_000) &&
                    doc.status !== "expired";
                  return (
                    <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium max-w-[200px] truncate">{doc.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{doc.client_name ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{doc.case_ref ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{TYPE_LABELS[doc.document_type] ?? doc.document_type}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", tone.cls)}>
                          {tone.icon} {tone.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{fmtRelative(doc.created_at)}</td>
                      <td className={cn("px-4 py-3 text-xs", isExpiring ? "text-warning font-medium" : "text-muted-foreground")}>
                        {fmtDateIST(doc.expires_at)}
                        {isExpiring && " ⚠"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmtSize(doc.file_size_bytes)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground">
              {filtered.length} document{filtered.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
