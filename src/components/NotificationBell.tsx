"use client";

/**
 * NotificationBell.tsx
 * Real-time notification bell in the app header.
 *
 * Sources:
 *  1. Tasks assigned to me that are overdue or due today (polled + real-time)
 *  2. Recent activity_timeline events for cases/leads the user manages (polled)
 *
 * Uses Supabase real-time channel on the `tasks` table.
 * All DB reads use (supabase as any) because tasks / activity_timeline may not
 * be in the generated types.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { Bell, CheckCheck, AlertTriangle, Clock, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { fmtRelative } from "@/lib/format";
import { Link } from "@/lib/router-compat";
import { cn } from "@/lib/utils";

const db = supabase as any;

interface Notif {
  id: string;
  type: "overdue" | "due_today" | "new_task" | "timeline";
  title: string;
  body?: string | null;
  href?: string;
  at: string;
}

const POLL_MS = 2 * 60 * 1000; // re-fetch every 2 min

export function NotificationBell() {
  const { profile } = useAuth();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<string>(() =>
    localStorage.getItem("notif_last_seen") ?? new Date(0).toISOString()
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    if (!profile?.id) return;

    const now = new Date().toISOString();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todayEndISO = todayEnd.toISOString();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // 1. Overdue tasks
    const { data: overdue } = await db
      .from("tasks")
      .select("id, title, due_at, lead_id, case_id")
      .eq("assigned_to", profile.id)
      .eq("status_code", "open")
      .lt("due_at", now)
      .order("due_at", { ascending: false })
      .limit(10);

    // 2. Tasks due today (not overdue)
    const { data: dueToday } = await db
      .from("tasks")
      .select("id, title, due_at, lead_id, case_id")
      .eq("assigned_to", profile.id)
      .eq("status_code", "open")
      .gte("due_at", startOfDay.toISOString())
      .lte("due_at", todayEndISO)
      .order("due_at", { ascending: true })
      .limit(10);

    // 3. Recent timeline events since lastSeen (for cases/leads managed by this user)
    const { data: timeline } = await db
      .from("activity_timeline")
      .select("id, event_type, title, body, occurred_at, lead_id, case_id")
      .eq("is_system", false)
      .gt("occurred_at", lastSeen)
      .order("occurred_at", { ascending: false })
      .limit(10);

    const built: Notif[] = [
      ...((overdue ?? []) as any[]).map((t: any) => ({
        id: `ov-${t.id}`,
        type: "overdue" as const,
        title: t.title,
        body: "Overdue",
        href: t.lead_id ? `/leads/${t.lead_id}` : t.case_id ? `/cases/${t.case_id}` : undefined,
        at: t.due_at ?? now,
      })),
      ...((dueToday ?? []) as any[]).map((t: any) => ({
        id: `dt-${t.id}`,
        type: "due_today" as const,
        title: t.title,
        body: `Due ${fmtRelative(t.due_at)}`,
        href: t.lead_id ? `/leads/${t.lead_id}` : t.case_id ? `/cases/${t.case_id}` : undefined,
        at: t.due_at ?? now,
      })),
      ...((timeline ?? []) as any[]).map((e: any) => ({
        id: `tl-${e.id}`,
        type: "timeline" as const,
        title: e.title,
        body: e.body ?? undefined,
        href: e.lead_id ? `/leads/${e.lead_id}` : e.case_id ? `/cases/${e.case_id}` : undefined,
        at: e.occurred_at ?? now,
      })),
    ];

    // Deduplicate by id, sort by time desc
    const deduped = [...new Map(built.map((n) => [n.id, n])).values()].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    );

    setNotifs(deduped.slice(0, 20));
  }, [profile?.id, lastSeen]);

  // Initial fetch + polling
  useEffect(() => {
    void fetch();
    timerRef.current = setInterval(() => void fetch(), POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetch]);

  // Supabase real-time on tasks
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel("notif-tasks")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "tasks",
        filter: `assigned_to=eq.${profile.id}`,
      }, () => { void fetch(); })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "tasks",
        filter: `assigned_to=eq.${profile.id}`,
      }, () => { void fetch(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [profile?.id, fetch]);

  const markAllSeen = () => {
    const now = new Date().toISOString();
    setLastSeen(now);
    localStorage.setItem("notif_last_seen", now);
    // Remove timeline-type notifs (they're now "seen")
    setNotifs((prev) => prev.filter((n) => n.type !== "timeline"));
  };

  const newCount = notifs.filter((n) =>
    n.type === "timeline" || n.type === "overdue"
  ).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted/60 transition-colors"
          aria-label={`Notifications${newCount > 0 ? ` — ${newCount} new` : ""}`}
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
          {newCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center bg-destructive text-[10px] text-white font-bold rounded-full leading-none">
              {newCount > 9 ? "9+" : newCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0 max-h-[520px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-semibold text-sm">Notifications</span>
          {notifs.length > 0 && (
            <button
              onClick={markAllSeen}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all seen
            </button>
          )}
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {notifs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-3 opacity-20" />
              <p>You're all caught up!</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifs.map((n) => (
                <NotifRow key={n.id} notif={n} onClose={() => setOpen(false)} />
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2.5">
          <Link
            to="/tasks"
            onClick={() => setOpen(false)}
            className="text-xs text-accent hover:underline flex items-center gap-1"
          >
            View all tasks <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotifRow({ notif, onClose }: { notif: Notif; onClose: () => void }) {
  const icon = {
    overdue:   <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />,
    due_today: <Clock className="h-4 w-4 text-warning shrink-0" />,
    new_task:  <Clock className="h-4 w-4 text-primary shrink-0" />,
    timeline:  <Bell className="h-4 w-4 text-muted-foreground shrink-0" />,
  }[notif.type];

  const content = (
    <li
      className={cn(
        "flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors",
        notif.type === "overdue" && "bg-destructive/5"
      )}
    >
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{notif.title}</div>
        {notif.body && (
          <div className="text-xs text-muted-foreground mt-0.5">{notif.body}</div>
        )}
        <div className="text-[11px] text-muted-foreground mt-1">{fmtRelative(notif.at)}</div>
      </div>
      {notif.href && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />}
    </li>
  );

  if (notif.href) {
    return (
      <Link to={notif.href} onClick={onClose} className="block">
        {content}
      </Link>
    );
  }
  return <>{content}</>;
}
