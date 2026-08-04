"use client";

/**
 * OutreachDialog.tsx
 * Send WhatsApp or Email to a lead directly from Lead Detail.
 *
 * - Loads templates from `messages` where is_template = true (whatsapp / email)
 * - Replaces {{name}}, {{advisor_name}} placeholders
 * - WhatsApp: opens the connected in-app Comms Hub composer
 * - Email: opens mailto: link
 * - Logs outreach to activity_timeline after send
 */

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Mail, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { writeTimeline } from "@/lib/timeline";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { WaComposer } from "@/components/comms/WaComposer";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  leadName: string;
  leadPhone?: string | null;
  leadEmail?: string | null;
  /** Open directly on a specific channel tab */
  defaultChannel?: Channel;
}

type Channel = "whatsapp" | "email";

interface Template {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
}

function applyPlaceholders(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export function OutreachDialog({ open, onOpenChange, leadId, leadName, leadPhone, leadEmail, defaultChannel }: Props) {
  const { profile } = useAuth();
  const [channel, setChannel] = useState<Channel>(defaultChannel ?? "whatsapp");
  const [templateId, setTemplateId] = useState("");
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [lastInboundAt, setLastInboundAt] = useState<string | null>(null);
  const [openingConversation, setOpeningConversation] = useState(false);

  // Sync channel when defaultChannel or open changes
  useEffect(() => {
    if (open) {
      setChannel(defaultChannel ?? "whatsapp");
      setConversationId(null);
      setLastInboundAt(null);
    }
  }, [open, defaultChannel]);

  useEffect(() => {
    if (!open || channel !== "whatsapp" || !leadId || !leadPhone) return;
    let cancelled = false;
    setOpeningConversation(true);
    void (async () => {
      const { data: id, error } = await supabase.rpc("open_lead_whatsapp_conversation", { p_lead_id: leadId });
      if (cancelled) return;
      if (error || !id) {
        toast.error(error?.message ?? "Could not open the WhatsApp composer");
        setOpeningConversation(false);
        return;
      }
      const { data: conversation, error: conversationError } = await supabase
        .from("conversations")
        .select("id, last_inbound_at")
        .eq("id", id)
        .maybeSingle();
      if (conversationError) toast.error(conversationError.message);
      setConversationId(id);
      setLastInboundAt(conversation?.last_inbound_at ?? null);
      setOpeningConversation(false);
    })();
    return () => { cancelled = true; };
  }, [open, channel, leadId, leadPhone]);

  const vars: Record<string, string> = {
    name:         leadName,
    lead_name:    leadName,
    client_name:  leadName,
    advisor_name: profile?.full_name ?? "Your advisor",
  };

  const { data: templates = [] } = useQuery({
    queryKey: ["outreach-templates"],
    queryFn: async () => {
      // P1.7 — FIXED (2026-07-30): table "admin_templates" does not exist in
      // study2pr-prod, so this query returned null on every render and the
      // template dropdown was permanently empty in all 4 screens that mount
      // this dialog. Templates actually live in `messages` where
      // is_template = true (same source AdminTemplates.tsx manages). Verified:
      // 37 active whatsapp templates were present but unreachable.
      // The error is now surfaced instead of being silently discarded.
      const { data, error } = await supabase
        .from("messages")
        .select("id, template_name, channel, subject, body")
        .eq("is_template", true)
        .eq("status", "active")
        .in("channel", ["whatsapp", "email"])
        .order("template_name");
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[outreach] template load failed:", error.message);
        return [];
      }
      type TemplateRow = { id: string; template_name: string | null; channel: string; subject: string | null; body: string | null };
      return ((data ?? []) as TemplateRow[]).map((r) => ({
        id: r.id,
        name: r.template_name ?? "(untitled)",
        channel: r.channel,
        subject: r.subject,
        body: r.body ?? "",
      })) as Template[];
    },
  });

  const filtered = templates.filter((t) => t.channel === channel || t.channel === "both");

  const pickTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setMessage(applyPlaceholders(tpl.body, vars));
    setSubject(tpl.subject ? applyPlaceholders(tpl.subject, vars) : "");
  };

  const handleSend = async () => {
    if (!message.trim()) { toast.error("Message cannot be empty"); return; }

    if (channel === "whatsapp") return;
    if (!leadEmail) { toast.error("No email address on file for this lead"); return; }
    const mailUrl = `mailto:${leadEmail}?subject=${encodeURIComponent(subject || "Study2PR Immigration")}&body=${encodeURIComponent(message)}`;
    window.open(mailUrl, "_blank", "noopener,noreferrer");

    // Log to timeline
    void writeTimeline({
      event_type: "email_sent",
      title: `Email sent to ${leadName}${subject ? ` — "${subject}"` : ""}`,
      body: message.length > 200 ? message.slice(0, 200) + "…" : message,
      lead_id: leadId,
      is_system: false,
    });

    toast.success("Email client opened");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send message to {leadName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Channel toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["whatsapp", "email"] as Channel[]).map((ch) => (
              <button
                key={ch}
                onClick={() => { setChannel(ch); setTemplateId(""); setMessage(""); setSubject(""); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors",
                  channel === ch
                    ? ch === "whatsapp" ? "bg-green-600 text-white" : "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                {ch === "whatsapp"
                  ? <><MessageCircle className="h-4 w-4" /> WhatsApp</>
                  : <><Mail className="h-4 w-4" /> Email</>}
              </button>
            ))}
          </div>

          {/* Contact info check */}
          {channel === "whatsapp" && !leadPhone && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              No phone number on file for this lead. Please add one in the lead details first.
            </p>
          )}
          {channel === "email" && !leadEmail && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              No email address on file for this lead. Please add one in the lead details first.
            </p>
          )}

          {channel === "whatsapp" && leadPhone && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Messages are sent through the connected WhatsApp API and remain on this lead&apos;s communication history.
              </p>
              {openingConversation && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Opening secure conversation…
                </div>
              )}
              {conversationId && (
                <WaComposer
                  conversationId={conversationId}
                  lastInboundAt={lastInboundAt}
                  onSent={() => undefined}
                  onFailed={() => undefined}
                />
              )}
            </div>
          )}

          {/* Email template picker */}
          {channel === "email" && filtered.length > 0 && (
            <div>
              <Label>Load from template <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select value={templateId} onValueChange={pickTemplate}>
                <SelectTrigger><SelectValue placeholder="Choose a template…" /></SelectTrigger>
                <SelectContent>
                  {filtered.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Email subject */}
          {channel === "email" && (
            <div>
              <Label>Subject</Label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Study2PR Immigration — Your Application"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}

          {/* Email message body */}
          {channel === "email" && <div>
            <Label>Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="Dear {{name}},\n\nThank you for your interest in Study2PR…"
              className="resize-none"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Use <code className="bg-muted px-0.5 rounded">{"{{name}}"}</code> and <code className="bg-muted px-0.5 rounded">{"{{advisor_name}}"}</code> as placeholders
            </p>
          </div>}

          {/* Send button */}
          {channel === "email" && <div className="flex justify-between items-center pt-1">
            <div className="text-xs text-muted-foreground">
              {`To: ${leadEmail ?? "no email"}`}
            </div>
            <Button
              onClick={() => void handleSend()}
              disabled={!message.trim() || !leadEmail}
            >
              <><Send className="h-4 w-4 mr-1.5" />Open email client</>
            </Button>
          </div>
          }
        </div>
      </DialogContent>
    </Dialog>
  );
}
