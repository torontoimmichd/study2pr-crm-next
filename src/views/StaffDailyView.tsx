"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  UserPlus,
  Briefcase,
  CheckSquare,
  IndianRupee,
  Search,
  Phone,
  Video,
  Users,
  CalendarPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/AppLayout";
import { fmtDateIST, fmtMoney } from "@/lib/format";
import { writeAudit } from "@/lib/audit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AttentionItem {
  id: string;
  kind: "sla_breach" | "ircc_action" | "task_due_today" | "task_overdue";
  title: string;
  subtitle: string;
  href: string;
  priorityScore: number;
  taskId?: string;
  leadId?: string;
  isBreach?: boolean;
}

function startOfTodayIST(): Date {
  const d = new Date();
  // Approximate: server returns ISO; we filter with toDateString comparisons client-side
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfTodayIST(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export default function StaffDailyView() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const meId = user?.id;

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Greeting (IST hour)
  const greeting = useMemo(() => {
    const istHour = Number(
      new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(now),
    );
    if (istHour < 12) return "Good morning";
    if (istHour < 17) return "Good afternoon";
    return "Good evening";
  }, [now]);
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  // === Stat queries (scoped to me) ===
  const { data: stats } = useQuery({
    queryKey: ["staff-stats", meId],
    enabled: !!meId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const todayStart = startOfTodayIST().toISOString();
      const todayEnd = endOfTodayIST().toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const todayDate = new Date().toISOString().slice(0, 10);

      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

      const [slaRes, openLeadsRes, newTodayRes, casesRes, soonCasesRes, dueTodayRes, overdueRes, commRes, hotLeadsRes] =
        await Promise.all([
          // SLA breaches: my new leads with first_response_due_at past now (fallback: created_at > 1h ago)
          supabase
            .from("leads")
            .select("id, first_response_due_at, created_at", { count: "exact" })
            .eq("assigned_to", meId!)
            .eq("lifecycle_state", "new_enquiry")
            .or(`first_response_due_at.lt.${new Date().toISOString()},and(first_response_due_at.is.null,created_at.lt.${oneHourAgo})`),
          // My open leads
          supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .eq("assigned_to", meId!)
            .not("lifecycle_state", "in", "(converted,cold,not_eligible,lost)"),
          // New today
          supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .eq("assigned_to", meId!)
            .gte("created_at", todayStart)
            .lte("created_at", todayEnd),
          // My active cases
          supabase
            .from("cases")
            .select("id", { count: "exact", head: true })
            .eq("case_manager_id", meId!)
            .eq("is_archived", false),
          // Cases close to submission (target within 7d)
          supabase
            .from("cases")
            .select("id", { count: "exact", head: true })
            .eq("case_manager_id", meId!)
            .eq("is_archived", false)
            .not("target_submission_date", "is", null)
            .lte("target_submission_date", sevenDaysOut)
            .gte("target_submission_date", todayDate),
          // Tasks due today
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("assigned_to", meId!)
            .is("completed_at", null)
            .eq("due_date", todayDate),
          // Overdue tasks
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("assigned_to", meId!)
            .is("completed_at", null)
            .lt("due_date", todayDate),
          // MTD commissions
          supabase
            .from("commissions")
            .select("amount_inr, rule_code, status, earned_at")
            .eq("staff_id", meId!)
            .gte("earned_at", monthStart),
          // Unresponded hot leads: assigned to me, new/contacted, no first response, created in last 4h
          supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .eq("assigned_to", meId!)
            .in("lifecycle_state", ["new_enquiry", "contacted"])
            .is("first_responded_at", null)
            .gte("created_at", fourHoursAgo),
        ]);

      const slaCount = slaRes.count ?? slaRes.data?.length ?? 0;
      const commTotal = (commRes.data ?? []).reduce((s, r) => s + Number(r.amount_inr ?? 0), 0);
      const byRule = (commRes.data ?? []).reduce<Record<string, { amount: number; count: number }>>((acc, r) => {
        const k = r.rule_code ?? "other";
        if (!acc[k]) acc[k] = { amount: 0, count: 0 };
        acc[k].amount += Number(r.amount_inr ?? 0);
        acc[k].count += 1;
        return acc;
      }, {});

      return {
        slaBreaches: slaCount,
        openLeads: openLeadsRes.count ?? 0,
        newLeadsToday: newTodayRes.count ?? 0,
        activeCases: casesRes.count ?? 0,
        casesNearSubmission: soonCasesRes.count ?? 0,
        tasksDueToday: dueTodayRes.count ?? 0,
        tasksOverdue: overdueRes.count ?? 0,
        mtdCommissions: commTotal,
        commByRule: byRule,
        unrespondedHotLeads: hotLeadsRes.count ?? 0,
      };
    },
  });

  // === Needs Attention queue ===
  const { data: attention = [] } = useQuery({
    queryKey: ["staff-attention", meId],
    enabled: !!meId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<AttentionItem[]> => {
      const items: AttentionItem[] = [];
      const todayDate = new Date().toISOString().slice(0, 10);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      // 1. SLA-breached new leads
      const { data: breachLeads } = await supabase
        .from("leads")
        .select("id, full_name, created_at, first_response_due_at, status")
        .eq("assigned_to", meId!)
        .eq("lifecycle_state", "new_enquiry")
        .or(`first_response_due_at.lt.${new Date().toISOString()},and(first_response_due_at.is.null,created_at.lt.${oneHourAgo})`)
        .order("created_at", { ascending: true })
        .limit(5);
      breachLeads?.forEach((l) => {
        const minsLate = Math.round((Date.now() - new Date(l.first_response_due_at ?? l.created_at!).getTime()) / 60000);
        items.push({
          id: `lead-${l.id}`,
          kind: "sla_breach",
          title: `Reply to ${l.full_name}`,
          subtitle: `SLA breached ${minsLate}m ago — new lead waiting`,
          href: `/leads/${l.id}`,
          priorityScore: 1000 + minsLate,
          leadId: l.id,
          isBreach: true,
        });
      });

      // 2. IRCC emails action-required for my cases (<24h)
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data: myCases } = await supabase
        .from("cases")
        .select("id")
        .eq("case_manager_id", meId!)
        .eq("is_archived", false);
      const myCaseIds = (myCases ?? []).map((c) => c.id);
      if (myCaseIds.length > 0) {
        const { data: emails } = await supabase
          .from("ircc_emails")
          .select("id, subject, action_due_at, matched_case_id")
          .eq("requires_action", true)
          .is("processed_at", null)
          .in("matched_case_id", myCaseIds)
          .lt("action_due_at", tomorrow)
          .order("action_due_at", { ascending: true })
          .limit(5);
        emails?.forEach((e) => {
          const hoursLeft = Math.max(
            0,
            Math.round((new Date(e.action_due_at!).getTime() - Date.now()) / 3600000),
          );
          items.push({
            id: `ircc-${e.id}`,
            kind: "ircc_action",
            title: e.subject ?? "IRCC email",
            subtitle: `Action due in ${hoursLeft}h`,
            href: `/cases/${e.matched_case_id}`,
            priorityScore: 900 - hoursLeft,
          });
        });
      }

      // 3. Tasks due today
      const { data: dueTasks } = await supabase
        .from("tasks")
        .select("id, title, case_id, lead_id")
        .eq("assigned_to", meId!)
        .is("completed_at", null)
        .eq("due_date", todayDate)
        .limit(5);
      dueTasks?.forEach((t) => {
        items.push({
          id: `task-${t.id}`,
          kind: "task_due_today",
          title: t.title,
          subtitle: "Due today",
          href: t.case_id ? `/cases/${t.case_id}` : t.lead_id ? `/leads/${t.lead_id}` : "/tasks",
          priorityScore: 500,
          taskId: t.id,
        });
      });

      // 4. Overdue tasks
      const { data: overdueTasks } = await supabase
        .from("tasks")
        .select("id, title, due_date, case_id, lead_id")
        .eq("assigned_to", meId!)
        .is("completed_at", null)
        .lt("due_date", todayDate)
        .order("due_date", { ascending: true })
        .limit(5);
      overdueTasks?.forEach((t) => {
        const daysLate = Math.floor(
          (Date.now() - new Date(t.due_date!).getTime()) / (1000 * 60 * 60 * 24),
        );
        items.push({
          id: `task-od-${t.id}`,
          kind: "task_overdue",
          title: t.title,
          subtitle: `Overdue by ${daysLate}d`,
          href: t.case_id ? `/cases/${t.case_id}` : t.lead_id ? `/leads/${t.lead_id}` : "/tasks",
          priorityScore: 600 + Math.min(daysLate, 99),
          taskId: t.id,
          isBreach: true,
        });
      });

      return items.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 5);
    },
  });

  // Recent completed (struck-through tail)
  const { data: completedTasks = [] } = useQuery({
    queryKey: ["staff-completed-tasks", meId],
    enabled: !!meId,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, completed_at")
        .eq("assigned_to", meId!)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(2);
      return data ?? [];
    },
  });

  // === Today's appointments ===
  const { data: appointments = [] } = useQuery({
    queryKey: ["staff-appointments-today", meId],
    enabled: !!meId,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const start = startOfTodayIST().toISOString();
      const end = endOfTodayIST().toISOString();
      const { data } = await supabase
        .from("appointments")
        .select("id, scheduled_at, duration_min, type, title, notes, meeting_link, related_lead_id, related_case_id")
        .eq("staff_id", meId!)
        .gte("scheduled_at", start)
        .lte("scheduled_at", end)
        .order("scheduled_at", { ascending: true });
      const rows = data ?? [];

      // Resolve lead names
      const leadIds = [...new Set(rows.map((r: { related_lead_id: string | null }) => r.related_lead_id).filter(Boolean) as string[])];
      let leadMap = new Map<string, string>();
      if (leadIds.length > 0) {
        const { data: leads } = await supabase.from("leads").select("id, full_name").in("id", leadIds);
        leadMap = new Map((leads ?? []).map((l) => [l.id, l.full_name]));
      }

      // Resolve case codes + client names
      const caseIds = [...new Set(rows.map((r: { related_case_id: string | null }) => r.related_case_id).filter(Boolean) as string[])];
      let caseMap = new Map<string, { code: string; client: string }>();
      if (caseIds.length > 0) {
        const { data: cases } = await supabase.from("cases").select("id, case_code, client_id").in("id", caseIds);
        const clientIds = [...new Set((cases ?? []).map((c) => c.client_id))];
        const { data: clients } = clientIds.length
          ? await supabase.from("clients").select("id, full_name").in("id", clientIds)
          : { data: [] };
        const clientMap = new Map((clients ?? []).map((c) => [c.id, c.full_name]));
        caseMap = new Map((cases ?? []).map((c) => [c.id, {
          code: c.case_code ?? c.id.slice(0, 8),
          client: clientMap.get(c.client_id) ?? "—",
        }]));
      }

      return rows.map((r: {
        id: string; scheduled_at: string; duration_min: number; type: string;
        title: string; notes: string | null; meeting_link: string | null;
        related_lead_id: string | null; related_case_id: string | null;
      }) => ({
        ...r,
        lead_name: r.related_lead_id ? (leadMap.get(r.related_lead_id) ?? null) : null,
        case_info: r.related_case_id ? (caseMap.get(r.related_case_id) ?? null) : null,
      }));
    },
  });

  // === Mutations ===
  const completeTaskMut = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ completed_at: new Date().toISOString(), status_code: "done" })
        .eq("id", taskId);
      if (error) throw error;
      await writeAudit({
        action: "UPDATE",
        entity_type: "tasks",
        entity_id: taskId,
        changes: { completed_at: new Date().toISOString() },
      });
    },
    onSuccess: () => {
      toast.success("Marked complete");
      queryClient.invalidateQueries({ queryKey: ["staff-attention"] });
      queryClient.invalidateQueries({ queryKey: ["staff-stats"] });
      queryClient.invalidateQueries({ queryKey: ["staff-completed-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-badge-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ackLeadMut = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from("leads")
        .update({ first_responded_at: new Date().toISOString() })
        .eq("id", leadId);
      if (error) throw error;
      await writeAudit({
        action: "UPDATE",
        entity_type: "leads",
        entity_id: leadId,
        changes: { first_responded_at: new Date().toISOString() },
      });
    },
    onSuccess: () => {
      toast.success("Lead acknowledged");
      queryClient.invalidateQueries({ queryKey: ["staff-attention"] });
      queryClient.invalidateQueries({ queryKey: ["staff-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleAttentionCheck = (item: AttentionItem) => {
    if (item.taskId) completeTaskMut.mutate(item.taskId);
    else if (item.leadId) ackLeadMut.mutate(item.leadId);
  };

  const attentionCount =
    (stats?.slaBreaches ?? 0) +
    (stats?.tasksOverdue ?? 0) +
    (stats?.unrespondedHotLeads ?? 0) +
    attention.filter((a) => a.kind === "ircc_action").length;

  // Next payout = 5th of next month
  const nextPayout = new Date(now.getFullYear(), now.getMonth() + 1, 5);

  // Search
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: searchResults = [] } = useQuery({
    queryKey: ["staff-search", search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const term = `%${search.trim()}%`;
      const [leads, cases, clients, docs] = await Promise.all([
        supabase.from("leads").select("id, full_name, email, phone").or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`).limit(5),
        supabase.from("cases").select("id, case_code, client_id").ilike("case_code", term).limit(5),
        supabase.from("clients").select("id, full_name, email, phone").or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`).limit(5),
        supabase.from("case_documents").select("id, title, case_id, created_at, is_deleted").ilike("title", term).eq("is_deleted", false).limit(5),
      ]);
      // Resolve case codes for document hits
      const docCaseIds = Array.from(new Set((docs.data ?? []).map((d) => d.case_id).filter(Boolean) as string[]));
      const caseCodeMap = new Map<string, string>();
      if (docCaseIds.length > 0) {
        const { data: docCases } = await supabase.from("cases").select("id, case_code").in("id", docCaseIds);
        (docCases ?? []).forEach((c) => caseCodeMap.set(c.id, c.case_code ?? c.id.slice(0, 8)));
      }
      return [
        ...(leads.data ?? []).map((l) => ({ kind: "Lead", id: l.id, label: l.full_name, sub: l.email ?? l.phone ?? "", href: `/leads/${l.id}` })),
        ...(cases.data ?? []).map((c) => ({ kind: "Case", id: c.id, label: c.case_code ?? c.id.slice(0, 8), sub: "", href: `/cases/${c.id}` })),
        ...(clients.data ?? []).map((c) => ({ kind: "Client", id: c.id, label: c.full_name, sub: c.email ?? c.phone ?? "", href: `/clients/${c.id}` })),
        ...(docs.data ?? []).map((d) => {
          const caseCode = caseCodeMap.get(d.case_id) ?? d.case_id.slice(0, 8);
          const uploaded = d.created_at ? new Date(d.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
          return {
            kind: "Document",
            id: d.id,
            label: d.title,
            sub: `${caseCode}${uploaded ? ` · ${uploaded}` : ""}`,
            href: `/cases/${d.case_id}?tab=documents`,
          };
        }),
      ];
    },
  });

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${firstName} 👋`}
        subtitle={`${fmtDateIST(now, "EEEE, dd MMMM yyyy")} · ${attentionCount} ${attentionCount === 1 ? "thing needs" : "things need"} your attention today`}
      />

      <div className="p-6 space-y-6 max-w-[1600px]">
        {/* Search */}
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads, cases, clients, documents…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
            className="pl-10 h-11 bg-card"
          />
          {searchOpen && search.trim().length >= 2 && (
            <div className="absolute top-full mt-1 w-full bg-popover border border-border rounded-md shadow-lg z-30 max-h-80 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground text-center">No results</div>
              ) : (
                searchResults.map((r) => (
                  <Link
                    key={`${r.kind}-${r.id}`}
                    to={r.href}
                    className="flex items-center justify-between px-3 py-2 hover:bg-muted text-sm"
                  >
                    <div>
                      <div className="font-medium">{r.label}</div>
                      {r.sub && <div className="text-xs text-muted-foreground">{r.sub}</div>}
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.kind}</span>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        {/* 5 stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="SLA Breaches"
            value={stats?.slaBreaches ?? 0}
            subtitle="Needs immediate reply"
            danger={(stats?.slaBreaches ?? 0) > 0}
            icon={<AlertCircle className="h-4 w-4" />}
            href="/leads?status=new"
          />
          <StatCard
            label="My Open Leads"
            value={stats?.openLeads ?? 0}
            subtitle={`${stats?.newLeadsToday ?? 0} new today`}
            icon={<UserPlus className="h-4 w-4" />}
            href="/leads"
          />
          <StatCard
            label="My Active Cases"
            value={stats?.activeCases ?? 0}
            subtitle={`${stats?.casesNearSubmission ?? 0} close to submission`}
            icon={<Briefcase className="h-4 w-4" />}
            href="/cases"
          />
          <StatCard
            label="Tasks Due Today"
            value={stats?.tasksDueToday ?? 0}
            subtitle={`${stats?.tasksOverdue ?? 0} overdue`}
            danger={(stats?.tasksOverdue ?? 0) > 0}
            icon={<CheckSquare className="h-4 w-4" />}
            href="/tasks"
          />
          <StatCard
            label="MTD Commissions"
            value={fmtMoney(stats?.mtdCommissions ?? 0, "INR")}
            subtitle="Month to date"
            icon={<IndianRupee className="h-4 w-4" />}
            href="/my-commissions"
            isText
          />
        </div>

        {/* Main + side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Needs Attention */}
          <div className="lg:col-span-2 card-surface p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg text-navy">Needs attention right now</h2>
              <span className="text-xs text-muted-foreground">Top {attention.length}</span>
            </div>

            {attention.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                ✨ All clear. Great work — nothing urgent right now.
              </div>
            ) : (
              <ul className="space-y-2">
                {attention.map((a) => (
                  <li
                    key={a.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-md border border-border hover:bg-muted/50 transition-colors",
                    )}
                  >
                    <Checkbox
                      className="mt-0.5"
                      onCheckedChange={() => handleAttentionCheck(a)}
                      disabled={!a.taskId && !a.leadId}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">{a.title}</div>
                      <div
                        className={cn(
                          "text-xs mt-0.5",
                          a.isBreach ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {a.subtitle}
                      </div>
                    </div>
                    <Link
                      to={a.href}
                      className="text-xs text-accent hover:underline shrink-0 mt-0.5"
                    >
                      Open →
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {/* Recent completed */}
            {completedTasks.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border space-y-1.5">
                {completedTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 text-xs opacity-50 line-through"
                  >
                    <CheckSquare className="h-3.5 w-3.5 text-success" />
                    <span className="flex-1 truncate">{t.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column: calendar + commissions */}
          <div className="space-y-4">
            {/* Today's Calendar */}
            <div className="card-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg text-navy">Today's calendar</h2>
                <span className="text-xs text-muted-foreground">
                  {appointments.length} appointment{appointments.length !== 1 && "s"}
                </span>
              </div>

              {appointments.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-muted-foreground mb-3">No appointments today</p>
                  <Link to="/calendar?new=1">
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <CalendarPlus className="h-4 w-4" /> Add appointment
                    </Button>
                  </Link>
                </div>
              ) : (
                <ul className="space-y-3">
                  {appointments.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 text-sm">
                      <div className="text-xs font-mono text-muted-foreground shrink-0 w-12 mt-0.5">
                        {fmtDateIST(a.scheduled_at, "HH:mm")}
                      </div>
                      <div className="h-7 w-7 rounded-md bg-muted text-navy flex items-center justify-center shrink-0">
                        <ApptIcon type={a.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">{a.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {a.duration_min}m · {a.type.replace(/_/g, " ")}
                        </div>
                        {a.case_info && (
                          <Link
                            to={`/cases/${a.related_case_id}`}
                            className="text-[11px] text-accent hover:underline truncate block"
                          >
                            {a.case_info.client} · {a.case_info.code}
                          </Link>
                        )}
                        {!a.case_info && a.lead_name && (
                          <Link
                            to={`/leads/${a.related_lead_id}`}
                            className="text-[11px] text-accent hover:underline truncate block"
                          >
                            {a.lead_name}
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                  <li className="pt-2">
                    <Link to="/calendar?new=1">
                      <Button size="sm" variant="outline" className="gap-1.5 w-full">
                        <CalendarPlus className="h-4 w-4" /> Add appointment
                      </Button>
                    </Link>
                  </li>
                </ul>
              )}
            </div>

            {/* My Commissions */}
            <div className="card-surface p-5">
              <h2 className="font-display text-lg text-navy mb-1">My commissions</h2>
              <p className="text-xs text-muted-foreground mb-3">Month to date</p>
              <div className="text-3xl font-semibold text-foreground mb-3">
                {fmtMoney(stats?.mtdCommissions ?? 0, "INR")}
              </div>
              <div className="space-y-1.5 text-sm">
                <CommissionRow
                  label="Sales"
                  count={stats?.commByRule?.["SALES_5PC"]?.count ?? 0}
                  amount={stats?.commByRule?.["SALES_5PC"]?.amount ?? 0}
                />
                <CommissionRow
                  label="Approvals"
                  count={stats?.commByRule?.["CASE_APPROVAL_5PC"]?.count ?? 0}
                  amount={stats?.commByRule?.["CASE_APPROVAL_5PC"]?.amount ?? 0}
                />
                <CommissionRow
                  label="Upsells"
                  count={stats?.commByRule?.["UPSELL_1K"]?.count ?? 0}
                  amount={stats?.commByRule?.["UPSELL_1K"]?.amount ?? 0}
                />
              </div>
              <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
                Next payout: <span className="text-foreground font-medium">{fmtDateIST(nextPayout)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  icon,
  href,
  danger,
  isText,
}: {
  label: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  href?: string;
  danger?: boolean;
  isText?: boolean;
}) {
  const inner = (
    <div className="card-surface p-4 hover:shadow-md transition-shadow h-full">
      <div className="flex items-center justify-between">
        <div className="stat-label">{label}</div>
        <div
          className={cn(
            "h-7 w-7 rounded-md flex items-center justify-center",
            danger ? "bg-destructive/15 text-destructive" : "bg-muted text-navy",
          )}
        >
          {icon}
        </div>
      </div>
      <div
        className={cn(
          "mt-2 truncate font-display",
          isText ? "text-xl" : "text-3xl",
          danger && "text-destructive",
        )}
      >
        {value}
      </div>
      {subtitle && (
        <div className={cn("text-xs mt-1", danger ? "text-destructive" : "text-muted-foreground")}>
          {subtitle}
        </div>
      )}
    </div>
  );
  return href ? <Link to={href}>{inner}</Link> : inner;
}

function CommissionRow({ label, count, amount }: { label: string; count: number; amount: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">
        {label} <span className="text-xs">({count})</span>
      </span>
      <span className="font-medium">{fmtMoney(amount, "INR")}</span>
    </div>
  );
}

function ApptIcon({ type }: { type: string }) {
  if (type === "phone_call" || type === "discovery_call") return <Phone className="h-4 w-4" />;
  if (type === "team_meeting") return <Users className="h-4 w-4" />;
  if (type === "consultation" || type === "follow_up") return <Video className="h-4 w-4" />;
  return <CalendarPlus className="h-4 w-4" />;
}
