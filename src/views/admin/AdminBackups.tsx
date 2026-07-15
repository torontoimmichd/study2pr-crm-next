"use client";

/**
 * AdminBackups.tsx
 * Backups & Archive — export data and manage archived cases.
 *
 * Sections:
 *  1. Data Exports — download leads, cases, clients as CSV
 *  2. Archived Cases — list + un-archive
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Archive,
  ArchiveRestore,
  FileText,
  Users,
  Briefcase,
  Loader2,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { writeAudit } from "@/lib/audit";

const db = supabase as any;

/* ─── CSV helpers ───────────────────────────────────────── */

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return [
    keys.join(","),
    ...rows.map((r) => keys.map((k) => escape(r[k])).join(",")),
  ].join("\n");
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Export card ───────────────────────────────────────── */

interface ExportConfig {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  fetchFn: () => Promise<Record<string, unknown>[]>;
}

function ExportCard({ config }: { config: ExportConfig }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const rows = await config.fetchFn();
      if (!rows.length) {
        toast.info("No data to export");
        setLoading(false);
        return;
      }
      const csv = rowsToCsv(rows);
      const ts = format(new Date(), "yyyy-MM-dd");
      downloadCsv(csv, `study2pr-${config.id}-${ts}.csv`);
      setDone(true);
      toast.success(`${rows.length} rows exported`);
      setTimeout(() => setDone(false), 3000);
    } catch (err) {
      console.error(err);
      toast.error("Export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", config.color)}>
            {config.icon}
          </div>
          <div>
            <CardTitle className="text-base">{config.label}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{config.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 mt-auto">
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => void handleExport()}
          disabled={loading}
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Exporting…</>
          ) : done ? (
            <><CheckCircle2 className="h-4 w-4 mr-2 text-success" /> Downloaded</>
          ) : (
            <><Download className="h-4 w-4 mr-2" /> Export CSV</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ─── Main page ─────────────────────────────────────────── */

export default function AdminBackups() {
  const qc = useQueryClient();
  const [archiving, setArchiving] = useState<string | null>(null);
  const [unarchiving, setUnarchiving] = useState<string | null>(null);

  /* Archived cases list */
  const { data: archivedCases, isLoading: loadingArchived } = useQuery({
    queryKey: ["archived-cases"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cases")
        .select(`
          id, case_ref, current_stage_code, created_at, updated_at,
          client:clients(full_name),
          visa_sub_type:visa_sub_types(label)
        `)
        .eq("is_archived", true)
        .order("updated_at", { ascending: false });
      return (data ?? []) as {
        id: string;
        case_ref: string;
        current_stage_code: string;
        created_at: string;
        updated_at: string;
        client: { full_name: string } | null;
        visa_sub_type: { label: string } | null;
      }[];
    },
  });

  /* Active closed cases that could be archived */
  const { data: closedCases } = useQuery({
    queryKey: ["closed-not-archived"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cases")
        .select(`id, case_ref, current_stage_code, updated_at, client:clients(full_name)`)
        .eq("is_archived", false)
        .in("current_stage_code", ["closed", "approved", "refused", "withdrawn"])
        .order("updated_at", { ascending: false });
      return (data ?? []) as {
        id: string;
        case_ref: string;
        current_stage_code: string;
        updated_at: string;
        client: { full_name: string } | null;
      }[];
    },
  });

  /* Export configs */
  const exports: ExportConfig[] = [
    {
      id: "leads",
      label: "Leads",
      description: "All leads including lifecycle state, source, and assigned advisor.",
      icon: <Users className="h-5 w-5 text-violet-600" />,
      color: "bg-violet-50 dark:bg-violet-950",
      fetchFn: async () => {
        const { data } = await supabase
          .from("leads")
          .select(`
            id, full_name, email, phone, country_of_residence,
            lifecycle_state, lead_source, created_at, converted_at,
            assigned_to, notes
          `)
          .order("created_at", { ascending: false });
        return (data ?? []) as Record<string, unknown>[];
      },
    },
    {
      id: "clients",
      label: "Clients",
      description: "All client profiles with contact details and citizenship info.",
      icon: <Users className="h-5 w-5 text-blue-600" />,
      color: "bg-blue-50 dark:bg-blue-950",
      fetchFn: async () => {
        const { data } = await supabase
          .from("clients")
          .select(`
            id, full_name, email, phone,
            country_of_citizenship, is_active, created_at, notes
          `)
          .order("created_at", { ascending: false });
        return (data ?? []) as Record<string, unknown>[];
      },
    },
    {
      id: "cases",
      label: "Cases",
      description: "All cases with status, quoted fee, stage, and assigned manager.",
      icon: <Briefcase className="h-5 w-5 text-amber-600" />,
      color: "bg-amber-50 dark:bg-amber-950",
      fetchFn: async () => {
        const { data } = await supabase
          .from("cases")
          .select(`
            id, case_ref, current_stage_code, is_archived,
            quoted_fee_inr, created_at, updated_at,
            case_manager_id, notes
          `)
          .order("created_at", { ascending: false });
        return (data ?? []) as Record<string, unknown>[];
      },
    },
    {
      id: "invoices",
      label: "Invoices",
      description: "All invoices with amounts, status, and payment dates.",
      icon: <FileText className="h-5 w-5 text-green-600" />,
      color: "bg-green-50 dark:bg-green-950",
      fetchFn: async () => {
        const { data } = await supabase
          .from("invoices")
          .select(`
            id, invoice_number, amount_inr, status,
            due_date, paid_at, created_at, case_id, client_id
          `)
          .order("created_at", { ascending: false });
        return (data ?? []) as Record<string, unknown>[];
      },
    },
  ];

  /* Archive a case */
  const archiveCase = async (caseId: string, caseRef: string) => {
    setArchiving(caseId);
    const { error } = await supabase
      .from("cases")
      .update({ is_archived: true })
      .eq("id", caseId);
    if (error) {
      toast.error("Failed to archive case");
    } else {
      void writeAudit({ action: "UPDATE", entity_type: "cases", entity_id: caseId, changes: { is_archived: true } });
      toast.success(`Case ${caseRef} archived`);
      void qc.invalidateQueries({ queryKey: ["archived-cases"] });
      void qc.invalidateQueries({ queryKey: ["closed-not-archived"] });
    }
    setArchiving(null);
  };

  /* Un-archive a case */
  const unarchiveCase = async (caseId: string, caseRef: string) => {
    setUnarchiving(caseId);
    const { error } = await supabase
      .from("cases")
      .update({ is_archived: false })
      .eq("id", caseId);
    if (error) {
      toast.error("Failed to restore case");
    } else {
      void writeAudit({ action: "UPDATE", entity_type: "cases", entity_id: caseId, changes: { is_archived: false } });
      toast.success(`Case ${caseRef} restored`);
      void qc.invalidateQueries({ queryKey: ["archived-cases"] });
      void qc.invalidateQueries({ queryKey: ["closed-not-archived"] });
    }
    setUnarchiving(null);
  };

  const stageColor = (s: string) => {
    if (["closed","refused","withdrawn"].includes(s)) return "bg-muted text-muted-foreground";
    if (s === "approved") return "bg-success/15 text-success";
    return "bg-primary/10 text-primary";
  };

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-navy">Backups &amp; Archive</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Export your data as CSV files or manage archived cases.
        </p>
      </div>

      {/* ── Data Exports ───────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Download className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Data Exports</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Export any table as a CSV file. The download includes all records and is timestamped for your records.
          For a full database backup, use the Supabase Dashboard → Database → Backups.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {exports.map((cfg) => (
            <ExportCard key={cfg.id} config={cfg} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          CSV exports contain personal data. Handle them securely and delete after use.
        </p>
      </section>

      <Separator />

      {/* ── Archive closed cases ───────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Archive className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Archive Closed Cases</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Archive completed, refused, or withdrawn cases to keep the active pipeline clean.
          Archived cases remain in the database and can be restored at any time.
        </p>

        {/* Cases eligible for archiving */}
        {closedCases && closedCases.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Archive className="h-4 w-4 text-amber-500" />
                Ready to archive ({closedCases.length})
              </CardTitle>
              <CardDescription className="text-xs">
                These cases are closed/approved/refused but not yet archived.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {closedCases.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2.5 gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">{c.case_ref}</span>
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize", stageColor(c.current_stage_code))}>
                          {c.current_stage_code.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{c.client?.full_name}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={archiving === c.id}
                      onClick={() => void archiveCase(c.id, c.case_ref)}
                    >
                      {archiving === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <><Archive className="h-3.5 w-3.5 mr-1" /> Archive</>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {closedCases?.length === 0 && (
          <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-3 mb-6">
            No closed cases pending archival. Cases will appear here when they reach a closed, approved, refused, or withdrawn stage.
          </p>
        )}
      </section>

      <Separator />

      {/* ── Archived cases ─────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ArchiveRestore className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">
              Archived Cases
              {(archivedCases?.length ?? 0) > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">({archivedCases!.length})</span>
              )}
            </h2>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void qc.invalidateQueries({ queryKey: ["archived-cases"] });
              void qc.invalidateQueries({ queryKey: ["closed-not-archived"] });
            }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
        </div>

        {loadingArchived ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading archived cases…
          </div>
        ) : !archivedCases?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <Archive className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No archived cases yet.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Case ref</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Client</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Visa type</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Stage</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Archived</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {archivedCases.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium">{c.case_ref}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.client?.full_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.visa_sub_type?.label ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize", stageColor(c.current_stage_code))}>
                        {c.current_stage_code.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {format(new Date(c.updated_at), "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        disabled={unarchiving === c.id}
                        onClick={() => void unarchiveCase(c.id, c.case_ref)}
                      >
                        {unarchiving === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <><ArchiveRestore className="h-3.5 w-3.5 mr-1" /> Restore</>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Full DB backup note */}
      <div className="bg-muted/50 rounded-lg px-4 py-3 text-xs text-muted-foreground flex items-start gap-2.5 mt-4">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          For full database backups (Point-in-Time Recovery), go to your{" "}
          <a
            href="https://supabase.com/dashboard/project/ocnsavosheduqzmeyvcd/database/backups/scheduled"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Supabase Dashboard → Database → Backups
          </a>
          . Supabase Pro plans include daily automated backups with up to 7 days of retention.
        </span>
      </div>
    </div>
  );
}
