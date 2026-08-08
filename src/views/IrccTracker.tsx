"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, FileSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "@/lib/router-compat";
import { fmtDateTimeIST } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type TrackerRow = Database["public"]["Views"]["v_ircc_tracker"]["Row"];

function formatUci(uci: string | null) {
  const digits = (uci ?? "").replace(/\D/g, "");
  return digits.length === 8 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : uci ?? "—";
}

export default function IrccTracker() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ircc-tracker"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_ircc_tracker").select("*").order("ircc_status_updated_at", { ascending: false });
      if (error) throw error;
      return data as TrackerRow[];
    },
  });

  const statuses = useMemo(() => Array.from(new Set(rows.map((row) => row.ircc_status).filter(Boolean) as string[])).sort(), [rows]);
  const filtered = rows.filter((row) => {
    const q = search.trim().toLowerCase();
    const matchesStatus = status === "all" || row.ircc_status === status;
    const matchesSearch = !q || [row.full_name, row.case_code, row.ircc_file_number, row.uci].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-screen p-4 lg:p-6">
      <PageHeader title="IRCC Tracker" subtitle="Applications with an IRCC file number and client UCI" />
      <div className="mt-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search client, case, file number or UCI" className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[190px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statuses.map((item) => <SelectItem key={item} value={item}>{item.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-4 card-surface overflow-hidden">
        {isLoading ? <div className="p-8 text-sm text-muted-foreground">Loading IRCC applications...</div> : filtered.length === 0 ? (
          <EmptyState icon={<FileSearch className="h-5 w-5" />} title="No IRCC files found" description="Applications appear here once an IRCC file number is recorded." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Client</th><th className="px-4 py-3">UCI</th><th className="px-4 py-3">Case</th><th className="px-4 py-3">File number</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Updated</th>
              </tr></thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.case_id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{row.full_name ?? "Unknown client"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatUci(row.uci)}</td>
                    <td className="px-4 py-3">{row.case_id ? <Link to={`/cases/${row.case_id}`} className="text-primary hover:underline">{row.case_code ?? row.case_id.slice(0, 8)}</Link> : "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.ircc_file_number}</td>
                    <td className="px-4 py-3 capitalize">{(row.ircc_status ?? "Not updated").replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{row.ircc_status_updated_at ? fmtDateTimeIST(row.ircc_status_updated_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
