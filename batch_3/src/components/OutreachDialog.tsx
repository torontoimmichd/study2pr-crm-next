"use client";

/**
 * OutreachDialog.tsx
 * Send WhatsApp or Email to a lead directly from Lead Detail.
 *
 * - Loads templates from admin_templates (type: whatsapp / email)
 * - Replaces {{name}}, {{advisor_name}} placeholders
 * - WhatsApp: opens wa.me link in new tab
 * - Email: opens mailto: link
 * - Logs outreach to activity_timeline after send
 */

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Mail, ExternalLink, Send } from "lucide-react";
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

// Strip non-digit characters from phone for WhatsApp
function toWaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // If starts with 0, replace with 91 (India default)
  if (digits.startsWith("0") && digits.length === 11) return "91" + digits.slice(1);
  // If no country code (10 digits for India)
  if (digits.length === 10) return "91" + digits;
  return digits;
}

export function OutreachDialog({ open, onOpenChange, leadId, leadName, leadPhone, leadEmail, defaultChannel }: Props) {
  const { profile } = useAuth();
  const [channel, setChannel] = useState<Channel>(defaultChannel ?? "whatsapp");
  const [templateId, setTemplateId] = useState("");
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");

  // Sync channel when defaultChannel or open changes
  useEffect(() => {
    if (open) setChannel(defaultChannel ?? "whatsapp");
  }, [open, defaultChannel]);

  const vars: Record<string, string> = {
    name:         leadName,
    lead_name:    leadName,
    client_name:  leadName,
    advisor_name: profile?.full_name ?? "Your advisor",
  };

  const { data: templates = [] } = useQuery({
    queryKey: ["outreach-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_templates")
        .select("id, name, channel, subject, body")
        .in("channel", ["whatsapp", "email"])
        .eq("is_active", true)
        .order("name");
      return (data ?? []) as Template[];
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

    if (channel === "whatsapp") {
      if (!leadPhone) { toast.error("No phone number on file for this lead"); return; }
      const waPhone = toWaPhone(leadPhone);
      const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, "_blank", "noopener,noreferrer");
    } else {
      if (!leadEmail) { toast.error("No email address on file for this lead"); return; }
      const mailUrl = `mailto:${leadEmail}?subject=${encodeURIComponent(subject || "Study2PR Immigration")}&body=${encodeURIComponent(message)}`;
      window.open(mailUrl, "_blank", "noopener,noreferrer");
    }

    // Log to timeline
    void writeTimeline({
      event_type: channel === "whatsapp" ? "whatsapp_sent" : "email_sent",
      title: channel === "whatsapp"
        ? `WhatsApp sent to ${leadName}`
        : `Email sent to ${leadName}${subject ? ` — "${subject}"` : ""}`,
      body: message.length > 200 ? message.slice(0, 200) + "…" : message,
      lead_id: leadId,
      is_system: false,
    });

    toast.success(channel === "whatsapp" ? "WhatsApp opened — send the message in WhatsApp" : "Email client opened");
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

          {/* Template picker */}
          {filtered.length > 0 && (
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

          {/* Message body */}
          <div>
            <Label>Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder={channel === "whatsapp"
                ? "Hi {{name}}, this is {{advisor_name}} from Study2PR…"
                : "Dear {{name}},\n\nThank you for your interest in Study2PR…"}
              className="resize-none"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Use <code className="bg-muted px-0.5 rounded">{"{{name}}"}</code> and <code className="bg-muted px-0.5 rounded">{"{{advisor_name}}"}</code> as placeholders
            </p>
          </div>

          {/* Send button */}
          <div className="flex justify-between items-center pt-1">
            <div className="text-xs text-muted-foreground">
              {channel === "whatsapp"
                ? `To: ${leadPhone ?? "no phone"}`
                : `To: ${leadEmail ?? "no email"}`}
            </div>
            <Button
              onClick={() => void handleSend()}
              disabled={!message.trim() || (channel === "whatsapp" && !leadPhone) || (channel === "email" && !leadEmail)}
              className={cn(channel === "whatsapp" ? "bg-green-600 hover:bg-green-700" : "")}
            >
              {channel === "whatsapp"
                ? <><ExternalLink className="h-4 w-4 mr-1.5" />Open WhatsApp</>
                : <><Send className="h-4 w-4 mr-1.5" />Open email client</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
