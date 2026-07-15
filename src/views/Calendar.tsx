"use client";

import { useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, addMinutes, startOfDay, isToday, isTomorrow } from "date-fns";
import {
  Calendar as CalendarIcon,
  Plus,
  Phone,
  Video,
  Users,
  UserCheck,
  ArrowRight,
  Briefcase,
  UserPlus,
  ExternalLink,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasRole } from "@/lib/auth-context";
import { PageHeader } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { writeAudit } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const APPT_TYPES = [
  { value: "discovery_call", label: "Discovery Call", icon: Phone },
  { value: "phone_call", label: "Phone Call", icon: Phone },
  { value: "team_meeting", label: "Team Meeting", icon: Users },
  { value: "consultation", label: "Consultation", icon: UserCheck },
  { value: "follow_up", label: "Follow-up", icon: ArrowRight },
  { value: "other", label: "Other", icon: CalendarIcon },
] as const;

type ApptType = (typeof APPT_TYPES)[number]["value"];

interface AppointmentRow {
  id: string;
  scheduled_at: string;
  duration_min: number | null;
  type: string;
  title: string;
  notes: string | null;
  meeting_link: string | null;
  related_lead_id: string | null;
  related_case_id: string | null;
  staff_id: string;
}

function nextHalfHour(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  d.setMinutes(m < 30 ? 30 : 60);
  return d;
}

function typeIcon(type: string) {
  return APPT_TYPES.find((t) => t.value === type)?.icon ?? CalendarIcon;
}

function typeLabel(type: string) {
  return APPT_TYPES.find((t) => t.value === type)?.label ?? type;
}

function dayHeader(d: Date) {
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEEE, dd MMM");
}

export default function CalendarPage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const meId = user?.id;
  const isAdmin = profile ? hasRole(profile, "owner", "admin") : false;
  const [open, setOpen] = useState(false);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["calendar-appointments", meId, isAdmin],
    enabled: !!meId,
    queryFn: async (): Promise<AppointmentRow[]> => {
      const start = startOfDay(new Date()).toISOString();
      const end = addDays(startOfDay(new Date()), 14).toISOString();
      let q = supabase
        .from("appointments")
        .select("id, scheduled_at, duration_min, type, title, notes, meeting_link, related_lead_id, related_case_id, staff_id")
        .gte("scheduled_at", start)
        .lt("scheduled_at", end)
        .order("scheduled_at", { ascending: true });
      if (!isAdmin) q = q.eq("staff_id", meId!);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Resolve linked lead/case names
  const { data: links = { leads: new Map(), cases: new Map() } } = useQuery({
    queryKey: ["calendar-links", appointments.map((a) => a.id).join(",")],
    enabled: appointments.length > 0,
    queryFn: async () => {
      const leadIds = Array.from(new Set(appointments.map((a) => a.related_lead_id).filter(Boolean) as string[]));
      const caseIds = Array.from(new Set(appointments.map((a) => a.related_case_id).filter(Boolean) as string[]));
      const [leadsRes, casesRes] = await Promise.all([
        leadIds.length ? supabase.from("leads").select("id, full_name").in("id", leadIds) : Promise.resolve({ data: [] }),
        caseIds.length ? supabase.from("cases").select("id, case_code").in("id", caseIds) : Promise.resolve({ data: [] }),
      ]);
      return {
        leads: new Map((leadsRes.data ?? []).map((l) => [l.id, l.full_name])),
        cases: new Map((casesRes.data ?? []).map((c) => [c.id, c.case_code ?? c.id.slice(0, 8)])),
      };
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    appointments.forEach((a) => {
      const dayKey = format(new Date(a.scheduled_at), "yyyy-MM-dd");
      if (!map.has(dayKey)) map.set(dayKey, []);
      map.get(dayKey)!.push(a);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [appointments]);

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Your appointments for the next 14 days"
        actions={
          <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> New Appointment
          </Button>
        }
      />

      <div className="p-6 max-w-[1100px] space-y-6">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : grouped.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon className="h-5 w-5" />}
            title="No appointments scheduled"
            description="Click + New Appointment to schedule a discovery call, consultation, or follow-up."
          />
        ) : (
          grouped.map(([dayKey, items]) => {
            const date = new Date(dayKey + "T00:00:00");
            return (
              <section key={dayKey}>
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2">
                  {dayHeader(date)}
                </h3>
                <div className="card-surface divide-y divide-border">
                  {items.map((a) => {
                    const Icon = typeIcon(a.type);
                    const time = format(new Date(a.scheduled_at), "HH:mm");
                    const leadName = a.related_lead_id ? links.leads.get(a.related_lead_id) : null;
                    const caseCode = a.related_case_id ? links.cases.get(a.related_case_id) : null;
                    return (
                      <div key={a.id} className="flex items-center gap-4 p-4">
                        <div className="text-sm font-mono font-medium text-navy w-14 shrink-0">{time}</div>
                        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-foreground truncate">{a.title}</div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span>{typeLabel(a.type)}</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {a.duration_min ?? 30}m
                            </span>
                            {leadName && (
                              <Link to={`/leads/${a.related_lead_id}`} className="inline-flex items-center gap-1 hover:text-accent">
                                <UserPlus className="h-3 w-3" /> {leadName}
                              </Link>
                            )}
                            {caseCode && (
                              <Link to={`/cases/${a.related_case_id}`} className="inline-flex items-center gap-1 hover:text-accent">
                                <Briefcase className="h-3 w-3" /> {caseCode}
                              </Link>
                            )}
                          </div>
                        </div>
                        {a.meeting_link && (
                          <a
                            href={a.meeting_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline shrink-0"
                          >
                            <Video className="h-3 w-3" /> Join
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>

      <NewAppointmentDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] })}
      />
    </div>
  );
}

// ----- Dialog -----

interface NewAppointmentDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

function NewAppointmentDialog({ open, onOpenChange, onCreated }: NewAppointmentDialogProps) {
  const { user } = useAuth();
  const [date, setDate] = useState<Date>(nextHalfHour());
  const [time, setTime] = useState<string>(format(nextHalfHour(), "HH:mm"));
  const [type, setType] = useState<ApptType>("discovery_call");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [leadSearch, setLeadSearch] = useState("");
  const [caseSearch, setCaseSearch] = useState("");

  const reset = () => {
    const d = nextHalfHour();
    setDate(d);
    setTime(format(d, "HH:mm"));
    setType("discovery_call");
    setTitle("");
    setDuration(30);
    setNotes("");
    setMeetingLink("");
    setLeadId(null);
    setCaseId(null);
    setLeadSearch("");
    setCaseSearch("");
  };

  const { data: leadOptions = [] } = useQuery({
    queryKey: ["appt-lead-search", leadSearch],
    enabled: leadSearch.trim().length >= 2,
    queryFn: async () => {
      const term = `%${leadSearch.trim()}%`;
      const { data } = await supabase
        .from("leads")
        .select("id, full_name, email")
        .or(`full_name.ilike.${term},email.ilike.${term}`)
        .limit(8);
      return data ?? [];
    },
  });

  const { data: caseOptions = [] } = useQuery({
    queryKey: ["appt-case-search", caseSearch],
    enabled: caseSearch.trim().length >= 2,
    queryFn: async () => {
      const term = `%${caseSearch.trim()}%`;
      const { data } = await supabase
        .from("cases")
        .select("id, case_code")
        .ilike("case_code", term)
        .limit(8);
      return data ?? [];
    },
  });

  const linkMissing = !leadId && !caseId;

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      if (!title.trim()) throw new Error("Title is required");
      if (!leadId && !caseId) throw new Error("Please link this appointment to a lead or a case.");
      const [hh, mm] = time.split(":").map(Number);
      const scheduled = new Date(date);
      scheduled.setHours(hh, mm, 0, 0);

      const { data, error } = await supabase
        .from("appointments")
        .insert({
          staff_id: user.id,
          scheduled_at: scheduled.toISOString(),
          duration_min: duration,
          type,
          title: title.trim(),
          notes: notes.trim() || null,
          meeting_link: meetingLink.trim() || null,
          related_lead_id: leadId,
          related_case_id: caseId,
        })
        .select("id")
        .single();
      if (error) throw error;
      await writeAudit({
        action: "INSERT",
        entity_type: "appointments",
        entity_id: data.id,
        changes: { type, title, scheduled_at: scheduled.toISOString() },
      });
    },
    onSuccess: () => {
      toast.success("Appointment created");
      reset();
      onOpenChange(false);
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New appointment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal mt-1", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {date ? format(date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs">Time</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ApptType)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {APPT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Discovery call with Priya"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs">Duration (minutes)</Label>
            <Input
              type="number"
              min={5}
              max={480}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 30)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Agenda, prep, links…"
              className="mt-1"
              rows={3}
            />
          </div>

          {/* Lead / Case — at least one required */}
          <div className={cn("space-y-2 rounded-lg p-3 border", linkMissing ? "border-destructive/50 bg-destructive/5" : "border-border bg-muted/20")}>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">
                Link to lead or case <span className="text-destructive">*</span>
              </Label>
              {linkMissing && (
                <span className="text-[11px] text-destructive font-medium">Required — pick at least one</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Lead</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full mt-1 justify-start text-left font-normal",
                        leadId ? "border-success/50 bg-success/5 text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-2 shrink-0 opacity-60" />
                      {leadId ? (leadOptions.find((l) => l.id === leadId)?.full_name ?? "Selected") : "Search lead…"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-72" align="start">
                    <Command>
                      <CommandInput placeholder="Search leads…" value={leadSearch} onValueChange={setLeadSearch} />
                      <CommandList>
                        <CommandEmpty>{leadSearch.length < 2 ? "Type 2+ chars to search" : "No matches"}</CommandEmpty>
                        <CommandGroup>
                          {leadId && (
                            <CommandItem onSelect={() => setLeadId(null)}>✕ Clear</CommandItem>
                          )}
                          {leadOptions.map((l) => (
                            <CommandItem key={l.id} onSelect={() => setLeadId(l.id)}>
                              <div className="flex flex-col">
                                <span>{l.full_name}</span>
                                {l.email && <span className="text-xs text-muted-foreground">{l.email}</span>}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Case</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full mt-1 justify-start text-left font-normal",
                        caseId ? "border-success/50 bg-success/5 text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <Briefcase className="h-3.5 w-3.5 mr-2 shrink-0 opacity-60" />
                      {caseId ? (caseOptions.find((c) => c.id === caseId)?.case_code ?? "Selected") : "Search case…"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-72" align="start">
                    <Command>
                      <CommandInput placeholder="Search case code…" value={caseSearch} onValueChange={setCaseSearch} />
                      <CommandList>
                        <CommandEmpty>{caseSearch.length < 2 ? "Type 2+ chars to search" : "No matches"}</CommandEmpty>
                        <CommandGroup>
                          {caseId && (
                            <CommandItem onSelect={() => setCaseId(null)}>✕ Clear</CommandItem>
                          )}
                          {caseOptions.map((c) => (
                            <CommandItem key={c.id} onSelect={() => setCaseId(c.id)}>
                              {c.case_code ?? c.id.slice(0, 8)}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs">Meeting link</Label>
            <Input
              type="url"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://meet.google.com/…"
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !title.trim() || linkMissing}>
            {createMut.isPending ? "Saving…" : "Save appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
