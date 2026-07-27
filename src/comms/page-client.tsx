"use client";

/**
 * Unified Inbox — Comms Hub Sprint 1.
 * Tabs: My Conversations · Team Queue · Unassigned/Triage.
 * Live via Supabase Realtime (conversations + communication_events).
 * Optimistic UI on send. Mobile-first: list ⇄ thread panes.
 *
 * Extension points:
 *  - channel filter (email/SMS/calls)  → Sprint 2
 *  - SLA badges + escalation           → Sprint 3
 *  - AI summary/suggested replies      → Sprint 4
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, User, Users, AlertTriangle, Check, CheckCheck, ChevronLeft, Paperclip, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth-context";
import { fmtRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WaComposer } from "@/components/comms/WaComposer";

// ─── types (mirrors sql/34 schema) ───────────────────────────────────────────
interface ConversationRow {
  id: string;
  channel: string;
  client_id: string | null;
  lead_id: string | null;
  assigned_to: string | null;
  status: "open" | "triage" | "closed";
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  unread_count: number;
  updated_at: string;
}
interface EventRow {
  id: string;
  direction: "inbound" | "outbound" | "internal";
  event_type: string;
  body: string | null;
  delivery_status: "queued" | "sent" | "delivered" | "read" | "failed" | null;
  occurred_at: string;
  actor_id: string | null;
  optimistic?: boolean;
}
interface StaffRow { id: string; full_name: string; role: string }
type Tab = "mine" | "team" | "triage";

// ─── delivery ticks ──────────────────────────────────────────────────────────
function Ticks({ status }: { status: EventRow["delivery_status"] }) {
  if (status === "failed") return <AlertTriangle className="w-3 h-3 text-destructive inline" />;
  if (status === "read") return <CheckCheck className="w-3 h-3 text-sky-500 inline" />;
  if (status === "delivered") return <CheckCheck className="w-3 h-3 text-muted-foreground inline" />;
  if (status === "sent") return <Check className="w-3 h-3 text-muted-foreground inline" />;
  return <Check className="w-3 h-3 text-muted-foreground/40 inline" />; // queued
}

export default function PageClient() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("mine");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<EventRow[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // ── conversations (RLS trims to what the caller may see) ──────────────────
  const { data: convs, isLoading: convsLoading, error: convsError, refetch } = useQuery({
    queryKey: ["comms-conversations"],
    queryFn: async (): Promise<ConversationRow[]> => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, channel, client_id, lead_id, assigned_to, status, last_inbound_at, last_outbound_at, unread_count, updated_at")
        .neq("status", "closed")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ConversationRow[];
    },
  });

  // ── contact names for the list ────────────────────────────────────────────
  const { data: names } = useQuery({
    queryKey: ["comms-names", (convs ?? []).length],
    enabled: !!convs && convs.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const leadIds = Array.from(new Set((convs ?? []).map((c) => c.lead_id).filter(Boolean))) as string[];
      const clientIds = Array.from(new Set((convs ?? []).map((c) => c.client_id).filter(Boolean))) as string[];
      const map: Record<string, string> = {};
      if (leadIds.length) {
        const { data } = await supabase.from("leads").select("id, full_name").in("id", leadIds);
        for (const l of data ?? []) map[`L${l.id}`] = l.full_name;
      }
      if (clientIds.length) {
        const { data } = await supabase.from("clients").select("id, full_name").in("id", clientIds);
        for (const c of data ?? []) map[`C${c.id}`] = c.full_name;
      }
      return map;
    },
  });

  const { data: staff } = useQuery({
    queryKey: ["comms-staff"],
    queryFn: async (): Promise<StaffRow[]> => {
      const { data } = await supabase
        .from("staff_profiles").select("id, full_name, role")
        .in("role", ["owner", "admin", "case_manager", "intake_officer", "filing_officer"])
        .eq("is_active", true).order("full_name");
      return (data ?? []) as StaffRow[];
    },
  });

  // ── events for the open conversation ──────────────────────────────────────
  const { data: events, isLoading: eventsLoading, error: eventsError } = useQuery({
    queryKey: ["comms-events", activeId],
    enabled: !!activeId,
    queryFn: async (): Promise<EventRow[]> => {
      const { data, error } = await supabase
        .from("communication_events")
        .select("id, direction, event_type, body, delivery_status, occurred_at, actor_id")
        .eq("conversation_id", activeId as string)
        .order("occurred_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });

  // ── realtime: refresh on any change ───────────────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel("comms-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        void qc.invalidateQueries({ queryKey: ["comms-conversations"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "communication_events" }, (payload) => {
        const row = payload.new as { conversation_id?: string };
        if (row.conversation_id === activeId) {
          setOptimistic([]); // server truth replaces local echo
          void qc.invalidateQueries({ queryKey: ["comms-events", activeId] });
        }
        void qc.invalidateQueries({ queryKey: ["comms-conversations"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "communication_events" }, (payload) => {
        const row = payload.new as { conversation_id?: string };
        if (row.conversation_id === activeId) void qc.invalidateQueries({ queryKey: ["comms-events", activeId] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc, activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events, optimistic]);

  // mark read on open
  useEffect(() => {
    if (activeId) void supabase.rpc("mark_conversation_read", { p_conversation: activeId });
  }, [activeId]);

  const filtered = useMemo(() => {
    const all = convs ?? [];
    if (tab === "mine") return all.filter((c) => c.assigned_to === user?.id && c.status === "open");
    if (tab === "team") return all.filter((c) => c.status === "open" && c.assigned_to && c.assigned_to !== user?.id);
    return all.filter((c) => c.status === "triage" || !c.assigned_to);
  }, [convs, tab, user?.id]);

  const active = (convs ?? []).find((c) => c.id === activeId) ?? null;
  const nameOf = (c: ConversationRow) =>
    (c.client_id && names?.[`C${c.client_id}`]) || (c.lead_id && names?.[`L${c.lead_id}`]) || "Unknown contact";

  const assign = async (convId: string, staffId: string) => {
    const { error } = await supabase
      .from("conversations")
      .update({ assigned_to: staffId, status: "open", updated_at: new Date().toISOString() })
      .eq("id", convId);
    if (error) toast.error(`Assign failed: ${error.message}`);
    else {
      toast.success("Assigned");
      void qc.invalidateQueries({ queryKey: ["comms-conversations"] });
    }
  };

  const tabs: Array<{ key: Tab; label: string; icon: React.ReactNode; count: number }> = [
    { key: "mine", label: "My Conversations", icon: <User className="w-3.5 h-3.5" />, count: (convs ?? []).filter((c) => c.assigned_to === user?.id && c.status === "open").length },
    { key: "team", label: "Team Queue", icon: <Users className="w-3.5 h-3.5" />, count: (convs ?? []).filter((c) => c.status === "open" && c.assigned_to && c.assigned_to !== user?.id).length },
    { key: "triage", label: "Triage", icon: <AlertTriangle className="w-3.5 h-3.5" />, count: (convs ?? []).filter((c) => c.status === "triage" || !c.assigned_to).length },
  ];

  return (
    <>
      <PageHeader
        title="Communications"
        subtitle="Every WhatsApp on the client's file. Calls, email, SMS join in later sprints."
        actions={<Button size="sm" variant="outline" onClick={() => void refetch()}><RefreshCw className="w-4 h-4" /></Button>}
      />
      <div className="flex h-[calc(100vh-8.5rem)]">
        {/* ── list pane (hidden on mobile when a thread is open) ── */}
        <div className={`w-full md:w-80 border-r border-border flex flex-col ${activeId ? "hidden md:flex" : "flex"}`}>
          <div className="flex border-b border-border">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 px-2 py-2 text-[11px] font-medium flex items-center justify-center gap-1 border-b-2 ${
                  tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                }`}
              >
                {t.icon}{t.label}
                <span className="ml-0.5 rounded-full bg-muted px-1.5">{t.count}</span>
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {convsLoading && <p className="p-4 text-sm text-muted-foreground">Loading conversations…</p>}
            {convsError && (
              <p className="p-4 text-sm text-destructive">
                Could not load conversations. <button className="underline" onClick={() => void refetch()}>Retry</button>
              </p>
            )}
            {!convsLoading && !convsError && filtered.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground text-center">
                {tab === "triage" ? "Triage queue is empty. Nothing unmatched." : "No conversations here yet."}
              </p>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-border/60 hover:bg-muted/40 ${
                  activeId === c.id ? "bg-muted/60" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    {nameOf(c)}
                  </span>
                  {c.unread_count > 0 && (
                    <span className="rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5">{c.unread_count}</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[11px] text-muted-foreground capitalize">{c.status}</span>
                  <span className="text-[11px] text-muted-foreground">{fmtRelative(c.updated_at)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── thread pane ── */}
        <div className={`flex-1 flex-col ${activeId ? "flex" : "hidden md:flex"}`}>
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="px-4 py-2 border-b border-border flex items-center gap-2 bg-card">
                <button className="md:hidden" onClick={() => setActiveId(null)} aria-label="Back">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{nameOf(active)}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{active.channel} · {active.status}</p>
                </div>
                <Select value={active.assigned_to ?? ""} onValueChange={(v) => void assign(active.id, v)}>
                  <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Assign to…" /></SelectTrigger>
                  <SelectContent>
                    {(staff ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-muted/20">
                {eventsLoading && <p className="text-sm text-muted-foreground">Loading messages…</p>}
                {eventsError && <p className="text-sm text-destructive">Could not load messages.</p>}
                {!eventsLoading && (events ?? []).length === 0 && optimistic.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>
                )}
                {[...(events ?? []), ...optimistic].map((e) => (
                  <div key={e.id} className={`flex ${e.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                        e.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-card border border-border"
                      } ${e.optimistic ? "opacity-60" : ""}`}
                    >
                      {e.event_type === "media" && (
                        <p className="text-[11px] flex items-center gap-1 opacity-80"><Paperclip className="w-3 h-3" /> attachment</p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{e.body ?? "(no text)"}</p>
                      <p className={`text-[10px] mt-1 flex items-center gap-1 ${e.direction === "outbound" ? "text-primary-foreground/70 justify-end" : "text-muted-foreground"}`}>
                        {new Date(e.occurred_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        {e.direction === "outbound" && <Ticks status={e.optimistic ? null : e.delivery_status} />}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <WaComposer
                conversationId={active.id}
                lastInboundAt={active.last_inbound_at}
                onSent={({ body }) =>
                  setOptimistic((prev) => [...prev, {
                    id: `optimistic-${Date.now()}`,
                    direction: "outbound", event_type: "message", body,
                    delivery_status: null, occurred_at: new Date().toISOString(),
                    actor_id: user?.id ?? null, optimistic: true,
                  }])
                }
                onFailed={() => setOptimistic([])}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
