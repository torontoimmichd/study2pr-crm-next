import { supabase } from "@/integrations/supabase/client";

export type TimelineEventType =
  | "lead_created"
  | "lead_converted"
  | "stage_change"
  | "note_added"
  | "call_logged"
  | "call_no_answer"
  | "document_uploaded"
  | "document_verified"
  | "task_created"
  | "task_completed"
  | "message_sent"
  | "whatsapp_sent"
  | "email_sent"
  | "payment_received"
  | "case_created"
  | "case_stage_change"
  | "ircc_update"
  | "assignment_changed"
  | "client_created"
  | "custom";

interface TimelineArgs {
  event_type: TimelineEventType | string;
  title: string;
  body?: string | null;
  metadata?: Record<string, unknown> | null;
  lead_id?: string | null;
  case_id?: string | null;
  client_id?: string | null;
  is_system?: boolean;
  occurred_at?: string; // ISO — defaults to now()
}

/**
 * Insert a row into activity_timeline.
 * Always non-blocking — errors are logged but never thrown.
 */
export async function writeTimeline(args: TimelineArgs): Promise<void> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const actor_id = userRes.user?.id ?? null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("activity_timeline").insert({
      event_type:  args.event_type,
      title:       args.title,
      body:        args.body ?? null,
      metadata:    args.metadata ?? null,
      lead_id:     args.lead_id ?? null,
      case_id:     args.case_id ?? null,
      client_id:   args.client_id ?? null,
      actor_id,
      is_system:   args.is_system ?? false,
      occurred_at: args.occurred_at ?? new Date().toISOString(),
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[timeline] insert failed", error.message);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[timeline] threw", err);
  }
}

/** Icons and colors for each event type — consumed by EntityTimeline UI */
export const TIMELINE_META: Record<string, { label: string; color: string; icon: string }> = {
  lead_created:       { label: "Lead created",        color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",       icon: "UserPlus" },
  lead_converted:     { label: "Converted to client", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",   icon: "CheckCircle" },
  stage_change:       { label: "Stage changed",        color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",   icon: "ArrowRight" },
  note_added:         { label: "Note added",           color: "bg-muted text-foreground",                                               icon: "FileText" },
  call_logged:        { label: "Call logged",          color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300", icon: "Phone" },
  call_no_answer:     { label: "No answer",            color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",     icon: "PhoneMissed" },
  document_uploaded:  { label: "Document uploaded",   color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300", icon: "Upload" },
  document_verified:  { label: "Document verified",   color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",   icon: "ShieldCheck" },
  task_created:       { label: "Task created",         color: "bg-muted text-foreground",                                               icon: "ClipboardList" },
  task_completed:     { label: "Task completed",       color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",   icon: "CheckSquare" },
  message_sent:       { label: "Message sent",         color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",            icon: "MessageCircle" },
  whatsapp_sent:      { label: "WhatsApp sent",        color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",      icon: "MessageCircle" },
  email_sent:         { label: "Email sent",           color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",          icon: "Mail" },
  client_created:     { label: "Client created",       color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",      icon: "UserPlus" },
  payment_received:   { label: "Payment received",     color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: "DollarSign" },
  case_created:       { label: "Case created",         color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",       icon: "Briefcase" },
  case_stage_change:  { label: "Case stage changed",   color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",  icon: "ArrowRight" },
  ircc_update:        { label: "IRCC update",          color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",          icon: "AlertCircle" },
  assignment_changed: { label: "Assigned",             color: "bg-muted text-foreground",                                               icon: "User" },
  custom:             { label: "Note",                 color: "bg-muted text-foreground",                                               icon: "Info" },
};
