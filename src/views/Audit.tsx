"use client";

import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Download, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { TableSkeleton } from "@/components/TableSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDateTimeIST } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";

const ACTION_TYPES = ["CREATE", "UPDATE", "DELETE", "STAGE_CHANGE", "STATUS_CHANGE", "CONVERT", "LOGIN", "UPLOAD", "PAYMENT"];
const ENTITY_TYPES = ["lead", "client", "case", "task", "case_document", "invoice", "payment", "commission", "message", "staff_profile"];

const PAGE_SIZE = 50;

export default function Audit() {
  const [page, setPage] = useState(0);
  const [actorId, setActorId] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [entityType, setEntityType] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filters = { actorId, action, entityType, from, to };

  // Staff list for actor dropdown
  const { data: staff } = useQuery({
    queryKey: ["audit-staff-list"],
    queryFn: async () => {
      const { data } = await supabase.from("staff_profiles").select("id, full_name").order("full_name");
      return data ?? [];
    },
  });
  const staffMap = useMemo(() => new Map((staff ?? []).map((s) => [s.id, s.full_name])), [staff]);

  const buildQuery = () => {
    let q = supabase.from("audit_log").select("*", { count: "exact" });
    if (actorId !== "all") q = q.eq("actor_id", actorId);
    if (action !== "all") q = q.eq("action", action);
    if (entityType !== "all") q = q.eq("entity_type", entityType);
    if (from) q = q.gte("occurred_at", new Date(from).toISOString());
    if (to) {
      const d = new Date(to);
      d.setHours(23, 59, 59, 999);
      q = q.lte("occurred_at", d.toISOString());
    }
    return q;
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit-log", page, filters],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const q = buildQuery()
        .order("occurred_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  // Client-side search filter (post-fetch) on actor name + entity_id
  const visibleRows = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data.rows;
    const s = search.toLowerCase();
    return data.rows.filter((r) => {
      const name = (r.actor_id ? staffMap.get(r.actor_id) : "") ?? "";
      return name.toLowerCase().includes(s) || r.entity_id.toLowerCase().includes(s) || r.entity_type.toLowerCase().includes(s);
    });
  }, [data, search, staffMap]);

  const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;

  const exportCsv = async () => {
    // Fetch up to 5000 rows matching the current filters
    const q = buildQuery().order("occurred_at", { ascending: false }).limit(5000);
    const { data, error } = await q;
    if (error) return;
    downloadCsv(
      `audit-${new Date().toISOString().slice(0, 10)}.csv`,
      ["When (UTC)", "Actor", "Action", "Entity type", "Entity ID", "IP", "Changes"],
      (data ?? []).map((r) => [
        r.occurred_at,
        r.actor_id ? staffMap.get(r.actor_id) ?? r.actor_id : "System",
        r.action,
        r.entity_type,
        r.entity_id,
        (r.ip_address as unknown as string) ?? "",
        r.changes ? JSON.stringify(r.changes) : "",
      ]),
    );
  };

  const resetFilters = () => {
    setActorId("all");
    setAction("all");
    setEntityType("all");
    setFrom("");
    setTo("");
    setSearch("");
    setPage(0);
  };

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Every staff write across the system"
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        }
      />

      <div className="p-6 space-y-4 max-w-[1600px]">
        {/* Filters */}
        <div className="card-surface p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Actor</label>
              <Select value={actorId} onValueChange={(v) => { setActorId(v); setPage(0); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actors</SelectItem>
                  {(staff ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Action</label>
              <Select value={action} onValueChange={(v) => { setAction(v); setPage(0); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {ACTION_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Entity</label>
              <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(0); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
                  {ENTITY_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">From</label>
              <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Search</label>
              <Input placeholder="Actor name or entity ID" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="text-xs text-muted-foreground">
              {data ? `${data.count.toLocaleString()} total rows` : "Loading…"}
              {isFetching && !isLoading && <span className="ml-2 italic">refreshing…</span>}
            </div>
            <Button variant="ghost" size="sm" onClick={resetFilters}>Reset filters</Button>
          </div>
        </div>

        {/* Table */}
        <div className="card-surface p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-5"><TableSkeleton rows={10} cols={5} /></div>
          ) : !visibleRows || visibleRows.length === 0 ? (
            <div className="p-5"><EmptyState title="No audit entries" description="Try adjusting filters or date range." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border bg-muted/30">
                    <th className="py-2 px-3 w-8" />
                    <th className="py-2 px-3 whitespace-nowrap">When (IST)</th>
                    <th className="py-2 px-3">Actor</th>
                    <th className="py-2 px-3">Action</th>
                    <th className="py-2 px-3">Entity</th>
                    <th className="py-2 px-3">IP / device</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => {
                    const isOpen = expanded === r.id;
                    const actorName = r.actor_id ? staffMap.get(r.actor_id) ?? "Unknown user" : "System";
                    const entityHref = entityLinkFor(r.entity_type, r.entity_id);
                    return (
                      <>
                        <tr
                          key={r.id}
                          className="border-b border-border/60 hover:bg-muted/40 cursor-pointer"
                          onClick={() => setExpanded(isOpen ? null : r.id)}
                        >
                          <td className="py-2 px-3 text-muted-foreground">
                            {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">{fmtDateTimeIST(r.occurred_at)}</td>
                          <td className="py-2 px-3 font-medium">{actorName}</td>
                          <td className="py-2 px-3">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/10 text-accent">
                              {r.action}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="text-muted-foreground">{r.entity_type}</span>{" "}
                            {entityHref ? (
                              <a href={entityHref} className="text-accent hover:underline font-mono text-xs" onClick={(e) => e.stopPropagation()}>
                                {r.entity_id.slice(0, 8)}
                              </a>
                            ) : (
                              <span className="font-mono text-xs text-muted-foreground">{r.entity_id.slice(0, 8)}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-xs text-muted-foreground font-mono">
                            {(r.ip_address as unknown as string) ?? "—"}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={r.id + "-x"} className="bg-muted/20">
                            <td />
                            <td colSpan={5} className="py-3 px-3">
                              <ChangesPanel changes={r.changes as Record<string, unknown> | null} userAgent={r.user_agent} fullId={r.entity_id} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {data && data.count > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm">
            <div className="text-muted-foreground text-xs">
              Page {page + 1} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function entityLinkFor(type: string, id: string): string | null {
  switch (type) {
    case "lead": return `/leads/${id}`;
    case "client": return `/clients/${id}`;
    case "case": return `/cases/${id}`;
    case "case_document":
    case "payment":
    case "invoice":
      return null; // would need parent case lookup
    default:
      return null;
  }
}

function ChangesPanel({ changes, userAgent, fullId }: { changes: Record<string, unknown> | null; userAgent: string | null; fullId: string }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Entity ID</div>
          <code className="text-xs font-mono break-all">{fullId}</code>
        </div>
        {userAgent && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">User agent</div>
            <code className="text-xs text-muted-foreground break-all">{userAgent}</code>
          </div>
        )}
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Changes</div>
        {!changes || Object.keys(changes).length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No change payload recorded.</p>
        ) : (
          <div className="rounded-md border border-border bg-card divide-y divide-border">
            {Object.entries(changes).map(([k, v]) => (
              <div key={k} className="flex gap-3 px-3 py-1.5 text-xs">
                <div className="w-40 shrink-0 font-medium text-muted-foreground">{k}</div>
                <div className="flex-1 min-w-0 break-all font-mono">
                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
