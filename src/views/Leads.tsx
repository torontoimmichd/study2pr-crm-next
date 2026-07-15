"use client";

import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "@/lib/router-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Inbox, Download, MoreHorizontal, Phone, MessageCircle, ArrowRight, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { LeadStatusPill } from "@/components/StatusPill";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { fmtRelative, fmtDateTimeIST } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { NewLeadDialog } from "@/components/NewLeadDialog";
import { ConvertLeadWizard } from "@/components/ConvertLeadWizard";
import { LogCallDialog } from "@/components/LogCallDialog";
import { OutreachDialog } from "@/components/OutreachDialog";
import { downloadCsv } from "@/lib/csv";
import { toast } from "sonner";

// Compact "how old is this lead" from created_at (e.g. 3h, 5d, 2w, 4mo)
function leadAge(createdAt: string | null | undefined): string {
  if (!createdAt) return "—";
  const ms = Date.now() - new Date(createdAt).getTime();
  if (isNaN(ms)) return "—";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

// Blueprint v1.0 lifecycle stage filters
const STAGE_FILTERS = [
  { key: "all",           label: "All",           values: null as string[] | null },
  { key: "active",        label: "Active",        values: ["new_enquiry","contacted","assessed","proposal_sent","negotiating"] },
  { key: "new_enquiry",   label: "New Enquiry",   values: ["new_enquiry"] },
  { key: "contacted",     label: "Contacted",     values: ["contacted"] },
  { key: "assessed",      label: "Assessed",      values: ["assessed"] },
  { key: "proposal_sent", label: "Proposal Sent", values: ["proposal_sent"] },
  { key: "negotiating",   label: "Negotiating",   values: ["negotiating"] },
  { key: "waiting",       label: "Waiting",       values: ["waiting"] },
  { key: "nurturing",     label: "Nurturing",     values: ["nurturing"] },
  { key: "cold",          label: "Cold",          values: ["cold"] },
  { key: "not_eligible",  label: "Not Eligible",  values: ["not_eligible"] },
  { key: "lost",          label: "Lost",          values: ["lost"] },
];

const ANY = "__any__";
const UNASSIGNED = "__unassigned__";

export default function Leads() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // Row action dialogs (convert / call / whatsapp)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [actionLead, setActionLead] = useState<any | null>(null);
  const [actionKind, setActionKind] = useState<"convert" | "call" | "wa" | null>(null);
  const openAction = (lead: unknown, kind: "convert" | "call" | "wa") => { setActionLead(lead); setActionKind(kind); };
  const closeAction = () => { setActionKind(null); setActionLead(null); };
  const lc = params.get("lc") ?? params.get("status") ?? "all"; // support legacy ?status= param
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);

  const [visaFilter, setVisaFilter] = useState<string>(ANY);
  const [sourceFilter, setSourceFilter] = useState<string>(ANY);
  const [assignedFilter, setAssignedFilter] = useState<string>(ANY);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: visaTypes } = useQuery({
    queryKey: ["visa-types-active"],
    queryFn: async () => (await supabase.from("visa_types").select("id, label").eq("is_active", true).order("label")).data ?? [],
  });
  const { data: sources } = useQuery({
    queryKey: ["lead-sources-active"],
    queryFn: async () => (await supabase.from("lead_sources").select("code, label").eq("is_active", true).order("sort_order")).data ?? [],
  });
  const { data: staff } = useQuery({
    queryKey: ["staff-active"],
    queryFn: async () => (await supabase.from("staff_profiles").select("id, full_name").eq("is_active", true).order("full_name")).data ?? [],
  });

  const { data: counts } = useQuery({
    queryKey: ["leads-counts"],
    queryFn: async () => {
      // Single query — count by lifecycle_state in JS to avoid N+1
      const { data } = await supabase.from("leads").select("lifecycle_state");
      const stageCounts = (data ?? []).reduce((acc, l) => {
        acc[l.lifecycle_state as string] = (acc[l.lifecycle_state as string] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      // Converted leads live only in Clients/Applications — never counted on the Leads page.
      const convertedCount = stageCounts["converted"] ?? 0;
      const map: Record<string, number> = { ...stageCounts, all: (data?.length ?? 0) - convertedCount };
      // Group counts
      map["active"] = ["new_enquiry","contacted","assessed","proposal_sent","negotiating"]
        .reduce((s, k) => s + (stageCounts[k] ?? 0), 0);
      return map;
    },
  });

  const buildQuery = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any)
      .from("leads")
      .select(
        "id, full_name, email, phone, notes, lifecycle_state, source_code, country_of_residence, country_of_interest, interested_country, interested_category_id, created_at, updated_at, assigned_to, interested_visa_type_id, enquiry_client_id",
      )
      .neq("lifecycle_state", "converted") // converted leads live in Clients/Applications, not here
      .order("updated_at", { ascending: false });
    if (lc !== "all") {
      const filter = STAGE_FILTERS.find((f) => f.key === lc);
      const vals = filter?.values;
      if (vals && vals.length === 1) q = q.eq("lifecycle_state", vals[0]);
      else if (vals && vals.length > 1) q = q.in("lifecycle_state", vals);
    }
    if (visaFilter !== ANY) q = q.eq("interested_visa_type_id", visaFilter);
    if (sourceFilter !== ANY) q = q.eq("source_code", sourceFilter);
    if (assignedFilter !== ANY) {
      if (assignedFilter === UNASSIGNED) q = q.is("assigned_to", null);
      else q = q.eq("assigned_to", assignedFilter);
    }
    if (dateFrom) q = q.gte("created_at", new Date(dateFrom).toISOString());
    if (dateTo) {
      const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
      q = q.lte("created_at", end.toISOString());
    }
    if (debounced.length > 0) {
      const t = `%${debounced}%`;
      q = q.or(`full_name.ilike.${t},email.ilike.${t},phone.ilike.${t}`);
    }
    return q;
  };

  const { data: leads, isLoading, refetch } = useQuery({
    queryKey: ["leads-list", lc, debounced, visaFilter, sourceFilter, assignedFilter, dateFrom, dateTo],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (buildQuery() as any).limit(100);
      if (error) throw error;

      const leadIds = (data ?? []).map((l) => l.id);
      const visaIds = Array.from(new Set((data ?? []).map((l) => l.interested_visa_type_id).filter(Boolean) as string[]));
      const staffIds = Array.from(new Set((data ?? []).map((l) => l.assigned_to).filter(Boolean) as string[]));
      const [visasRes, catsRes, staffRes, tasksRes] = await Promise.all([
        // visa_types row = the SUB-TYPE; also carries its category + country
        visaIds.length
          ? (supabase as any).from("visa_types").select("id, label, category_id, destination_country").in("id", visaIds)
          : Promise.resolve({ data: [] as { id: string; label: string; category_id: string | null; destination_country: string | null }[] }),
        (supabase as any).from("visa_categories").select("id, label"),
        staffIds.length ? supabase.from("staff_profiles").select("id, full_name").in("id", staffIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
        leadIds.length
          ? supabase.from("tasks").select("id, lead_id, title, due_at").in("lead_id", leadIds).is("completed_at", null).order("due_at", { ascending: true, nullsFirst: false })
          : Promise.resolve({ data: [] as { id: string; lead_id: string | null; title: string; due_at: string | null }[] }),
      ]);
      const visaRows = ((visasRes as { data: { id: string; label: string; category_id: string | null; destination_country: string | null }[] }).data ?? []);
      const visaMap = new Map(visaRows.map((v) => [v.id, v]));
      const catMap = new Map(((catsRes as { data: { id: string; label: string }[] }).data ?? []).map((c) => [c.id, c.label]));
      const staffMap = new Map(((staffRes as { data: { id: string; full_name: string }[] }).data ?? []).map((s) => [s.id, s.full_name]));
      // Next open task per lead (tasks are ordered by due_at asc, so first match = earliest)
      const nextTaskMap = new Map<string, { title: string; due_at: string | null }>();
      for (const t of (tasksRes as { data: { id: string; lead_id: string | null; title: string; due_at: string | null }[] }).data ?? []) {
        if (t.lead_id && !nextTaskMap.has(t.lead_id)) {
          nextTaskMap.set(t.lead_id, { title: t.title, due_at: t.due_at });
        }
      }
      return (data ?? []).map((l) => {
        const vt = l.interested_visa_type_id ? visaMap.get(l.interested_visa_type_id) : undefined;
        const categoryLabel = l.interested_category_id
          ? (catMap.get(l.interested_category_id) ?? null)
          : (vt?.category_id ? (catMap.get(vt.category_id) ?? null) : null);
        const countryLabel = l.interested_country || l.country_of_interest || vt?.destination_country || l.country_of_residence || null;
        return {
          ...l,
          country_label: countryLabel,
          category_label: categoryLabel,
          sub_type_label: vt?.label ?? null,
          assigned_name: l.assigned_to ? staffMap.get(l.assigned_to) ?? "—" : null,
          next_task: nextTaskMap.get(l.id) ?? null,
        };
      });
    },
  });

  const exportCsv = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (buildQuery() as any).limit(5000);
    if (error) { toast.error(error.message); return; }
    const visaMap = new Map((visaTypes ?? []).map((v) => [v.id, v.label]));
    const staffMap = new Map((staff ?? []).map((s) => [s.id, s.full_name]));
    const sourceMap = new Map((sources ?? []).map((s) => [s.code, s.label]));
    const rows = (data ?? []).map((l) => [
      l.full_name,
      l.email ?? "",
      l.phone ?? "",
      l.country_of_residence ?? "",
      l.interested_visa_type_id ? visaMap.get(l.interested_visa_type_id) ?? "" : "",
      l.source_code ? sourceMap.get(l.source_code) ?? l.source_code : "",
      (l.lifecycle_state as string ?? "").replace(/_/g, " "),
      l.assigned_to ? staffMap.get(l.assigned_to) ?? "" : "",
      l.created_at ? fmtDateTimeIST(l.created_at) : "",
    ]);
    downloadCsv(`leads-${new Date().toISOString().slice(0, 10)}.csv`, [
      "Name", "Email", "Phone", "Country", "Visa interest", "Source", "Status", "Assigned", "Received",
    ], rows);
    toast.success(`Exported ${rows.length} leads`);
  };

  const setStatus = (k: string) => {
    params.delete("status"); // drop legacy param
    if (k === "all") params.delete("lc");
    else params.set("lc", k);
    setParams(params, { replace: true });
  };

  const resetFilters = () => {
    setVisaFilter(ANY); setSourceFilter(ANY); setAssignedFilter(ANY);
    setDateFrom(""); setDateTo("");
  };

  const hasSecondary = visaFilter !== ANY || sourceFilter !== ANY || assignedFilter !== ANY || dateFrom || dateTo;

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle="Inbound prospects from website, referrals, and ads"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1.5" /> Export CSV
            </Button>
            <Button onClick={() => setOpen(true)} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-1.5" /> New Lead
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Stage filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          {STAGE_FILTERS.map((f) => {
            const active = (lc === "all" && f.key === "all") || lc === f.key;
            const count = counts?.[f.key] ?? 0;
            return (
              <button
                key={f.key}
                onClick={() => setStatus(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
                <span className={`ml-1.5 ${active ? "opacity-80" : "opacity-60"}`}>{count}</span>
              </button>
            );
          })}
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, phone…"
              className="pl-8 h-9"
            />
          </div>
        </div>

        {/* Secondary filters */}
        <div className="flex flex-wrap items-end gap-2 card-surface p-3">
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Visa type</label>
            <Select value={visaFilter} onValueChange={setVisaFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any visa</SelectItem>
                {visaTypes?.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Source</label>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any source</SelectItem>
                {sources?.map((s) => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Assigned</label>
            <Select value={assignedFilter} onValueChange={setAssignedFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Anyone</SelectItem>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {staff?.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">From</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-36" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-36" />
          </div>
          {hasSecondary && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs">Clear</Button>
          )}
        </div>

        {/* Table */}
        <div className="card-surface overflow-hidden">
          {isLoading ? (
            <TableSkeleton rows={8} cols={6} />
          ) : !leads || leads.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="No leads match"
              description="Try a different filter or add a new lead manually."
              action={<Button onClick={() => setOpen(true)} variant="outline"><Plus className="h-4 w-4 mr-1.5" /> New Lead</Button>}
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-3 font-medium">Name</th>
                  <th className="text-left px-3 py-3 font-medium">Age</th>
                  <th className="text-left px-3 py-3 font-medium">Phone</th>
                  <th className="text-left px-3 py-3 font-medium">Source</th>
                  <th className="text-left px-3 py-3 font-medium">Destination</th>
                  <th className="text-left px-3 py-3 font-medium">Visa Interest</th>
                  <th className="text-left px-3 py-3 font-medium">Stage</th>
                  <th className="text-left px-3 py-3 font-medium">Next Task</th>
                  <th className="text-left px-3 py-3 font-medium">Assigned</th>
                  <th className="text-left px-3 py-3 font-medium">Last Update</th>
                  <th className="text-right px-3 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => {
                  const nt = l.next_task as { title: string; due_at: string | null } | null;
                  const ntOverdue = nt?.due_at && new Date(nt.due_at) < new Date();
                  const sourceLabel = (sources ?? []).find((s) => s.code === l.source_code)?.label ?? l.source_code ?? "—";
                  return (
                  <tr key={l.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    {/* Name */}
                    <td className="px-3 py-3">
                      <Link to={`/leads/${l.id}`} className="font-medium text-foreground hover:text-accent">
                        {l.full_name}
                      </Link>
                      {l.email && <div className="text-[11px] text-muted-foreground truncate max-w-[160px]">{l.email}</div>}
                    </td>
                    {/* Age (how old the lead is) */}
                    <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap" title={l.created_at ? fmtDateTimeIST(l.created_at) : ""}>
                      {leadAge(l.created_at)}
                    </td>
                    {/* Phone */}
                    <td className="px-3 py-3 text-xs whitespace-nowrap">{l.phone ?? "—"}</td>
                    {/* Source */}
                    <td className="px-3 py-3 text-xs capitalize">{sourceLabel}</td>
                    {/* Destination */}
                    <td className="px-3 py-3 text-xs">{l.country_label ?? "—"}</td>
                    {/* Visa Interest */}
                    <td className="px-3 py-3">
                      {l.category_label && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium mr-1">{l.category_label}</span>
                      )}
                      <span className="text-xs text-muted-foreground">{l.sub_type_label ?? "—"}</span>
                    </td>
                    {/* Stage */}
                    <td className="px-3 py-3"><LeadStatusPill status={l.lifecycle_state as string} /></td>
                    {/* Next Task */}
                    <td className="px-3 py-3">
                      {nt ? (
                        <div>
                          <div className={`text-xs font-medium truncate max-w-[150px] ${ntOverdue ? "text-destructive" : "text-foreground"}`}>{nt.title}</div>
                          {nt.due_at && (
                            <div className={`text-[11px] ${ntOverdue ? "text-destructive" : "text-muted-foreground"}`}>{fmtRelative(nt.due_at)}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/60 italic">No task</span>
                      )}
                    </td>
                    {/* Assigned */}
                    <td className="px-3 py-3">
                      {l.assigned_name ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={l.assigned_name} size="sm" />
                          <span className="text-xs truncate max-w-[90px]">{l.assigned_name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unassigned</span>
                      )}
                    </td>
                    {/* Last Update */}
                    <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtRelative(l.updated_at ?? l.created_at)}</td>
                    {/* Actions */}
                    <td className="px-3 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => navigate(`/leads/${l.id}`)}>
                            <ExternalLink className="h-4 w-4 mr-2" /> Open profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAction(l, "convert")}>
                            <ArrowRight className="h-4 w-4 mr-2" /> Convert → Client + App
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAction(l, "call")}>
                            <Phone className="h-4 w-4 mr-2" /> Log call
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAction(l, "wa")} disabled={!l.phone}>
                            <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <NewLeadDialog open={open} onOpenChange={setOpen} onCreated={() => {
        void refetch();
        void qc.invalidateQueries({ queryKey: ["leads-counts"] });
      }} />

      {/* Row actions */}
      {actionKind === "convert" && actionLead && (
        <ConvertLeadWizard
          lead={actionLead}
          open
          onOpenChange={(v) => { if (!v) closeAction(); }}
          onConverted={() => {
            void refetch();
            void qc.invalidateQueries({ queryKey: ["leads-counts"] });
          }}
        />
      )}
      <LogCallDialog
        open={actionKind === "call"}
        onOpenChange={(v) => { if (!v) closeAction(); }}
        leadId={actionLead?.id}
        leadName={actionLead?.full_name}
        onLogged={() => void refetch()}
      />
      <OutreachDialog
        open={actionKind === "wa"}
        onOpenChange={(v) => { if (!v) closeAction(); }}
        leadId={actionLead?.id}
        leadName={actionLead?.full_name}
        leadPhone={actionLead?.phone}
        leadEmail={actionLead?.email}
      />
    </div>
  );
}

function SlaBadge({ createdAt, stage }: { createdAt: string | null; stage: string }) {
  if (stage !== "new_enquiry" || !createdAt) return <span className="text-xs text-muted-foreground">—</span>;
  const ageMin = (Date.now() - new Date(createdAt).getTime()) / 60_000;
  const targetMin = 60;
  if (ageMin > targetMin) {
    const h = Math.floor((ageMin - targetMin) / 60);
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
        Overdue {h > 0 ? `${h}h` : `${Math.round(ageMin - targetMin)}m`}
      </span>
    );
  }
  const remaining = Math.round(targetMin - ageMin);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-warning/15 text-warning-foreground text-xs font-medium">
      {remaining}m left
    </span>
  );
}
