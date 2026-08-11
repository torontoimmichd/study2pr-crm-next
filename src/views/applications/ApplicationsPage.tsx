"use client";

// src/pages/applications/ApplicationsPage.tsx
//
// New Applications page. Adds:
//   - "Pipeline" tab (default) showing active + prospective interleaved by family unit
//   - View toggle (Both / Active / Prospective)
//   - Family-unit and chain-priority filters
//   - "Bulk process" button → opens BulkProcessProspectivesSheet
//   - Shared <ApplicationRow> and <ProspectiveRow> components
//
// Route: /applications

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Layers, Loader2, ArrowRightLeft, CircleDollarSign, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ApplicationRow } from "@/components/applications/ApplicationRow";
import { ProspectiveRow } from "@/components/applications/ProspectiveRow";
import { ProspectiveDetailSheet } from "@/components/applications/ProspectiveDetailSheet";
import { BulkProcessProspectivesSheet } from "@/components/applications/BulkProcessProspectivesSheet";
import { StaffTransferDialog } from "@/components/StaffTransferDialog";
import { OutcomeReviewQueue } from "@/components/applications/OutcomeReviewQueue";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";
import type { ApplicationRow as AppRowType, ProspectiveAppRow } from "@/lib/types";
import { Link } from "@/lib/router-compat";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type StatusTab = "pipeline" | "in_process" | "decision" | "withdrawn" | "pending_payment" | "completed" | "outcome_reviews";
type ViewMode = "both" | "active" | "prospective";

type CompletedRow = {
  case_id: string | null;
  case_code: string | null;
  client_name: string | null;
  destination_country: string | null;
  programme: string | null;
  current_stage_code: string | null;
  outcome: string | null;
  quoted_fee_inr: number | null;
  paid: number | null;
  outstanding: number | null;
  decision_at: string | null;
  is_archived: boolean | null;
  review_status: string | null;
};

type OutstandingRow = {
  case_id: string | null;
  case_code: string | null;
  client_id: string | null;
  full_name: string | null;
  current_stage_code: string | null;
  quoted_fee_inr: number | null;
  invoiced: number | null;
  paid: number | null;
  outstanding: number | null;
};

export default function ApplicationsPage() {
  const [tab, setTab] = useState<StatusTab>("pipeline");
  const [viewMode, setViewMode] = useState<ViewMode>("both");
  const [familyFilter, setFamilyFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [counselorFilter, setCounselorFilter] = useState<string>("me");
  const [search, setSearch] = useState("");

  const [cases, setCases] = useState<AppRowType[]>([]);
  const [prospectives, setProspectives] = useState<(ProspectiveAppRow & { for_person_name: string | null; family_unit_name: string | null })[]>([]);
  const [completed, setCompleted] = useState<CompletedRow[]>([]);
  const [outstanding, setOutstanding] = useState<OutstandingRow[]>([]);
  const [completedOutcomeFilter, setCompletedOutcomeFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // Sheet state — page stays mounted
  const [openProspectiveId, setOpenProspectiveId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  // Fetch data on tab/filter change
  useEffect(() => {
    void counselorFilter;
    setLoading(true);
    (async () => {
      if (tab === "completed") {
        const { data, error } = await supabase.from("v_completed_applications").select("*").order("decision_at", { ascending: false, nullsFirst: false });
        if (error) toast.error(error.message);
        setCompleted((data ?? []) as CompletedRow[]);
        setCases([]);
        setProspectives([]);
        setLoading(false);
        return;
      }

      if (tab === "pending_payment") {
        const [{ data, error }, { data: activeCases, error: activeCasesError }] = await Promise.all([
          supabase.from("v_outstanding_money").select("*").order("outstanding", { ascending: false, nullsFirst: false }),
          supabase.from("cases").select("id").eq("is_archived", false),
        ]);
        if (error) toast.error(error.message);
        if (activeCasesError) toast.error(activeCasesError.message);
        const activeCaseIds = new Set((activeCases ?? []).map((row) => row.id));
        const terminalStages = new Set(["approved", "refused", "withdrawn", "closed"]);
        setOutstanding(((data ?? []) as OutstandingRow[]).filter((row) => activeCaseIds.has(row.case_id ?? "") && !terminalStages.has(row.current_stage_code ?? "")));
        setCases([]);
        setProspectives([]);
        setLoading(false);
        return;
      }

      if (tab === "outcome_reviews") {
        setCases([]);
        setProspectives([]);
        setLoading(false);
        return;
      }

      // Cases
      // @ts-expect-error Supabase's nested relationship parser exceeds TypeScript's instantiation depth here.
      let casesQ = supabase
        .from("cases")
        .select("*, client:client_id(full_name, family_role), family_unit:family_unit_id(unit_name), case_manager:case_manager_id(full_name), visa:visa_type_id(label)")
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(200);

      if (tab === "in_process") casesQ = casesQ.is("outcome", null);
      if (tab === "decision") casesQ = casesQ.in("outcome", ["approved", "refused"]);
      if (tab === "withdrawn") casesQ = casesQ.eq("current_stage_code", "withdrawn");
      // Prospectives
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let prospQ = (supabase as any)
        .from("prospective_applications")
        .select("*, chain_rule:triggered_by_rule(rule_code, sla_days, priority), family_unit:family_unit_id(unit_name)")
        .eq("status", "pending_counselor_action")
        .order("trigger_date");

      if (priorityFilter !== "all") prospQ = prospQ.eq("chain_rule.priority", priorityFilter);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [casesRes, prospRes] = await Promise.all([casesQ, prospQ]) as any;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedCases: AppRowType[] = ((casesRes.data || []) as any[]).map((c: any) => ({
        ...c,
        client_name: c.client?.full_name || c.lead?.full_name || "—",
        family_unit_name: c.family_unit?.unit_name || null,
        assigned_to_name: c.case_manager?.full_name || null,
        stage: c.stage || c.current_stage_code || null,
        case_number: c.case_number || c.case_ref || null,
        fee: c.fee || c.quoted_fee_inr || null,
        for_family_role: c.for_family_role || c.family_role || c.client?.family_role || null,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedProsp = ((prospRes.data || []) as any[]).map((p: any) => ({
        ...p,
        for_person_name: null,
        family_unit_name: p.family_unit?.unit_name || null,
      }));

      // Filter by family if set
      const filteredCases = familyFilter === "all" ? mappedCases : mappedCases.filter(c => c.family_unit_id === familyFilter);
      const filteredProsp = familyFilter === "all" ? mappedProsp : mappedProsp.filter((p: ProspectiveAppRow) => p.family_unit_id === familyFilter);

      // Attach the next open task per case (for the Next-task column + hover popover)
      const caseIds = filteredCases.map(c => c.id).filter(Boolean);
      if (caseIds.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: taskRows } = await (supabase as any)
          .from("tasks")
          .select("case_id, title, due_at")
          .in("case_id", caseIds)
          .is("completed_at", null)
          .order("due_at", { ascending: true, nullsFirst: false });
        const nextMap = new Map<string, { title: string; due_at: string | null }>();
        for (const t of (taskRows ?? []) as { case_id: string | null; title: string; due_at: string | null }[]) {
          if (t.case_id && !nextMap.has(t.case_id)) nextMap.set(t.case_id, { title: t.title, due_at: t.due_at });
        }
        filteredCases.forEach(c => { (c as AppRowType).next_task = nextMap.get(c.id) ?? null; });
      }

      setCases(filteredCases);
      setProspectives(filteredProsp);
      setCompleted([]);
      setOutstanding([]);
      setLoading(false);
    })();
  }, [tab, familyFilter, priorityFilter, counselorFilter]);

  const visibleCompleted = useMemo(() => {
    const q = search.trim().toLowerCase();
    return completed.filter((row) => {
      const matchesOutcome = completedOutcomeFilter === "all" || row.outcome === completedOutcomeFilter;
      const matchesSearch = !q || [row.case_code, row.client_name, row.programme, row.destination_country].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
      return matchesOutcome && matchesSearch;
    });
  }, [completed, completedOutcomeFilter, search]);

  const visibleOutstanding = useMemo(() => {
    const q = search.trim().toLowerCase();
    return outstanding.filter((row) => !q || [row.case_code, row.full_name].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)));
  }, [outstanding, search]);

  // Realtime — when anything changes, refresh in place (no navigation)
  useRealtimeChannel("applications-page", [
    {
      table: "cases",
      onChange: () => {
        setTab(t => t);
      },
    },
    {
      table: "prospective_applications",
      onChange: () => {
        setTab(t => t);
      },
    },
  ]);

  // Filter active/prospective views for pipeline tab
  const showActive = tab === "pipeline" ? viewMode !== "prospective" : true;
  const showProspective = tab === "pipeline" && viewMode !== "active";

  // Filter cases by search
  const visibleCases = useMemo(() => {
    if (!search) return cases;
    const q = search.toLowerCase();
    return cases.filter(c =>
      c.case_number?.toLowerCase().includes(q) ||
      c.client_name?.toLowerCase().includes(q) ||
      c.application_type?.toLowerCase().includes(q)
    );
  }, [cases, search]);

  // Group by family unit for pipeline view
  const pipelineGroups = useMemo(() => {
    if (tab !== "pipeline") return null;
    const map = new Map<string, { name: string; cases: AppRowType[]; prospectives: typeof prospectives }>();
    for (const c of visibleCases) {
      const key = c.family_unit_id || `solo-${c.id}`;
      if (!map.has(key)) map.set(key, { name: c.family_unit_name || c.client_name || "—", cases: [], prospectives: [] });
      map.get(key)!.cases.push(c);
    }
    for (const p of prospectives) {
      const key = p.family_unit_id || `solo-prosp-${p.id}`;
      if (!map.has(key)) map.set(key, { name: p.family_unit_name || "—", cases: [], prospectives: [] });
      map.get(key)!.prospectives.push(p);
    }
    return Array.from(map.entries());
  }, [tab, visibleCases, prospectives]);

  // Update a single case in place
  const updateCase = (caseId: string, patch: Partial<AppRowType>) => {
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, ...patch } : c));
  };

  // Prospective due in 7 days (controls bulk button enabled state)
  const prospectivesDueIn7Days = prospectives.filter(p => {
    const t = new Date(p.trigger_date).getTime();
    return t <= Date.now() + 7 * 86400000;
  }).length;

  return (
    <div className="min-h-screen p-4 lg:p-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2 rounded-xl border border-white/80 bg-gradient-to-r from-indigo-50 via-white to-amber-50 px-4 py-3 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold">Applications</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Active cases, family applications, and future opportunities</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setTransferOpen(true)}>
            <ArrowRightLeft className="w-4 h-4 mr-1" />
            Transfer
          </Button>
          <Button
            variant={prospectivesDueIn7Days > 0 ? "default" : "outline"}
            disabled={prospectivesDueIn7Days === 0}
            onClick={() => setBulkOpen(true)}
          >
            <Layers className="w-4 h-4 mr-1" />
            Bulk process {prospectivesDueIn7Days > 0 && `(${prospectivesDueIn7Days})`}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as StatusTab)}>
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="in_process">In Process</TabsTrigger>
          <TabsTrigger value="decision">Decision</TabsTrigger>
          <TabsTrigger value="withdrawn">Withdrawn</TabsTrigger>
          <TabsTrigger value="pending_payment">Pending Payment</TabsTrigger>
          <TabsTrigger value="outcome_reviews">Outcome Reviews</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters row */}
      {tab !== "outcome_reviews" && tab !== "completed" && (
      <Card className="p-3 mt-3 flex items-center gap-2 flex-wrap">
        {tab === "pipeline" && (
          <Select value={viewMode} onValueChange={v => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Active + Prospective</SelectItem>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="prospective">Prospective only</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select value={familyFilter} onValueChange={setFamilyFilter}>
          <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All family units</SelectItem>
          </SelectContent>
        </Select>

        {(tab === "pipeline" && viewMode !== "active") && (
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-40 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select value={counselorFilter} onValueChange={setCounselorFilter}>
          <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="me">My cases</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search by case #, name, type…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </Card>
      )}

      {tab === "completed" && (
        <Card className="p-3 mt-3 flex items-center gap-2 flex-wrap">
          <Select value={completedOutcomeFilter} onValueChange={setCompletedOutcomeFilter}>
            <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="All outcomes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outcomes</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="refused">Refused</SelectItem>
              <SelectItem value="withdrawn">Withdrawn</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8 h-8 text-sm" placeholder="Search completed applications" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </Card>
      )}

      {/* Body */}
      {tab === "outcome_reviews" ? (
        <div className="mt-3"><OutcomeReviewQueue onResolved={() => undefined} /></div>
      ) : tab === "completed" ? (
        <div className="mt-3"><CompletedView rows={visibleCompleted} /></div>
      ) : tab === "pending_payment" ? (
        <div className="mt-3"><OutstandingView rows={visibleOutstanding} /></div>
      ) : <Card className="mt-3 p-3">
        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : tab === "pipeline" && pipelineGroups ? (
          <PipelineView
            groups={pipelineGroups}
            showActive={showActive}
            showProspective={showProspective}
            onUpdateCase={updateCase}
            onOpenProspective={setOpenProspectiveId}
          />
        ) : (
          <FlatView cases={visibleCases} onUpdateCase={updateCase} />
        )}
      </Card>}

      {/* Sheets (overlay; page stays mounted) */}
      <ProspectiveDetailSheet
        prospectiveId={openProspectiveId}
        open={openProspectiveId !== null}
        onOpenChange={(o) => { if (!o) setOpenProspectiveId(null); }}
        onUpdated={(id, status) => {
          // Optimistic update — remove from prospectives if it converted/declined
          if (status !== "pending_counselor_action") {
            setProspectives(prev => prev.filter(p => p.id !== id));
          }
        }}
      />
      <BulkProcessProspectivesSheet
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onComplete={() => {
          // Force tab re-render to refresh data
          setTab(t => t);
        }}
      />
      <StaffTransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        defaultType="applications"
        onTransferred={() => setTab(t => t)}
      />
    </div>
  );
}

// ============================================================
// Pipeline view: grouped by family unit, active + prospective interleaved
// ============================================================
function PipelineView({
  groups, showActive, showProspective, onUpdateCase, onOpenProspective,
}: {
  groups: Array<[string, { name: string; cases: AppRowType[]; prospectives: (ProspectiveAppRow & { for_person_name: string | null; family_unit_name: string | null })[] }]>;
  showActive: boolean;
  showProspective: boolean;
  onUpdateCase: (id: string, patch: Partial<AppRowType>) => void;
  onOpenProspective: (id: string) => void;
}) {
  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No applications match your filters.</p>;
  }
  return (
    <div className="space-y-4">
      {groups.map(([key, group]) => (
        <div key={key}>
          <div className="flex items-baseline gap-2 mb-1.5 px-1">
            <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">{group.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {group.cases.length} active · {group.prospectives.length} prospective
            </p>
          </div>
          <div className="border-t border-slate-200">
            {showActive && [...group.cases].sort((a, b) => {
              const role = (row: AppRowType) => String(row.for_family_role || "").toLowerCase();
              const aPrimary = role(a) === "primary" || role(a) === "principal";
              const bPrimary = role(b) === "primary" || role(b) === "principal";
              if (aPrimary !== bPrimary) return aPrimary ? -1 : 1;
              return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
            }).map((c, index) => (
              <ApplicationRow
                key={c.id}
                app={c}
                context="applications_page"
                showFamilyContext={false}
                familyChild={group.cases.length > 1 && index > 0}
                familyRole={c.for_family_role}
                familyParentName={group.name}
                onUpdated={(patch) => onUpdateCase(c.id, patch)}
              />
            ))}
            {showProspective && group.prospectives.map(p => (
              <ProspectiveRow
                key={p.id}
                prospective={p}
                context="applications_page"
                showFamilyContext={false}
                onOpen={onOpenProspective}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Flat view: traditional list for non-pipeline tabs
// ============================================================
function FlatView({
  cases, onUpdateCase,
}: {
  cases: AppRowType[];
  onUpdateCase: (id: string, patch: Partial<AppRowType>) => void;
}) {
  if (cases.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No applications.</p>;
  }
  return (
    <div>
      {cases.map(c => (
        <ApplicationRow
          key={c.id}
          app={c}
          context="applications_page"
          showFamilyContext
          onUpdated={(patch) => onUpdateCase(c.id, patch)}
        />
      ))}
    </div>
  );
}

function formatINR(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value ?? 0);
}

function CompletedView({ rows }: { rows: CompletedRow[] }) {
  if (rows.length === 0) return <Card className="p-8 text-center text-sm text-muted-foreground">No completed applications match this view.</Card>;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-slate-50/70 px-4 py-3 text-sm font-semibold"><ClipboardCheck className="h-4 w-4 text-emerald-600" /> Completed applications <span className="text-xs font-normal text-muted-foreground">({rows.length})</span></div>
      <div className="divide-y">
        {rows.map((row) => (
          <div key={row.case_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-[130px] flex-1">
              {row.case_id ? <Link to={`/cases/${row.case_id}`} className="text-sm font-semibold text-primary hover:underline">{row.case_code ?? "Open case"}</Link> : <span className="text-sm font-semibold">{row.case_code ?? "—"}</span>}
              <p className="text-xs text-muted-foreground">{row.client_name ?? "Unnamed client"}{row.programme ? ` · ${row.programme}` : ""}</p>
            </div>
            <div className="min-w-[120px] text-xs text-muted-foreground">{row.destination_country ?? "—"}<br /><span className="capitalize">{row.current_stage_code?.replace(/_/g, " ") ?? row.outcome ?? "—"}</span></div>
            <Badge variant="outline" className="capitalize">{row.outcome ?? "completed"}</Badge>
            {row.is_archived && <Badge variant="secondary">Archived</Badge>}
            <div className="ml-auto text-right text-xs"><div>Paid {formatINR(row.paid)}</div><div className={row.outstanding && row.outstanding > 0 ? "font-semibold text-amber-700" : "text-muted-foreground"}>Outstanding {formatINR(row.outstanding)}</div></div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function OutstandingView({ rows }: { rows: OutstandingRow[] }) {
  if (rows.length === 0) return <Card className="p-8 text-center text-sm text-muted-foreground">No active applications with outstanding money.</Card>;
  const total = rows.reduce((sum, row) => sum + Number(row.outstanding ?? 0), 0);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b bg-amber-50/70 px-4 py-3"><div className="flex items-center gap-2 text-sm font-semibold"><CircleDollarSign className="h-4 w-4 text-amber-600" /> Pending payment <span className="text-xs font-normal text-muted-foreground">({rows.length})</span></div><span className="text-sm font-semibold text-amber-800">{formatINR(total)} outstanding</span></div>
      <div className="divide-y">
        {rows.map((row) => (
          <div key={row.case_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-[130px] flex-1">{row.case_id ? <Link to={`/cases/${row.case_id}`} className="text-sm font-semibold text-primary hover:underline">{row.case_code ?? "Open case"}</Link> : <span className="text-sm font-semibold">{row.case_code ?? "—"}</span>}<p className="text-xs text-muted-foreground">{row.full_name ?? "Unnamed client"}</p></div>
            <Badge variant="outline" className="capitalize">{row.current_stage_code?.replace(/_/g, " ") ?? "active"}</Badge>
            <div className="text-right text-xs"><div>Quoted {formatINR(row.quoted_fee_inr)}</div><div className="font-semibold text-amber-700">Due {formatINR(row.outstanding)}</div></div>
          </div>
        ))}
      </div>
    </Card>
  );
}
