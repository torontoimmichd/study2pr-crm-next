"use client";

/**
 * WaComposer — WhatsApp composer with 24-hour service-window enforcement.
 *
 * Window state is computed from conversation.last_inbound_at (resets on every
 * inbound). OPEN → free text + live countdown. CLOSED → template picker only;
 * the free-text box is disabled so staff can never type into a closed window
 * and have sends silently fail. wa-send enforces the same rule server-side.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Send, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface WaTemplate { id: string; name: string; language: string; body: string; category: string }

interface Props {
  conversationId: string;
  lastInboundAt: string | null;
  onSent: (localEcho: { body: string; template: boolean }) => void;
  onFailed: () => void;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

function fmtCountdown(msLeft: number): string {
  const h = Math.floor(msLeft / 3_600_000);
  const m = Math.floor((msLeft % 3_600_000) / 60_000);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function WaComposer({ conversationId, lastInboundAt, onSent, onFailed }: Props) {
  const [text, setText] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // tick the countdown every 30s
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const expiresAt = lastInboundAt ? new Date(lastInboundAt).getTime() + WINDOW_MS : null;
  const msLeft = expiresAt ? expiresAt - now : 0;
  const windowOpen = msLeft > 0;

  const { data: templates } = useQuery({
    queryKey: ["wa-templates"],
    queryFn: async (): Promise<WaTemplate[]> => {
      const { data, error } = await supabase
        .from("wa_templates")
        .select("id, name, language, body, category")
        .eq("status", "approved")
        .order("name");
      if (error) throw error;
      return (data ?? []) as WaTemplate[];
    },
  });

  const selectedTemplate = useMemo(
    () => (templates ?? []).find((t) => t.name === templateName) ?? null,
    [templates, templateName],
  );

  const send = async () => {
    if (sending) return;
    const payload = windowOpen
      ? { conversation_id: conversationId, text: text.trim() }
      : selectedTemplate
        ? { conversation_id: conversationId, template: { name: selectedTemplate.name, language: selectedTemplate.language } }
        : null;
    if (!payload || (windowOpen && !text.trim())) return;

    setSending(true);
    onSent({ body: windowOpen ? text.trim() : `[template] ${selectedTemplate?.name}`, template: !windowOpen });
    const echoText = text;
    setText("");
    try {
      const { data, error } = await supabase.functions.invoke("wa-send", { body: payload });
      const err = error?.message ?? (data as { error?: string } | null)?.error;
      if (err) {
        toast.error(`Send failed: ${err}`);
        setText(echoText);
        onFailed();
      }
    } catch (e) {
      toast.error("Send failed — network error");
      setText(echoText);
      onFailed();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-border bg-card p-3 space-y-2">
      {/* window state banner */}
      {windowOpen ? (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="w-3 h-3 text-emerald-600" />
          Service window open — free text allowed. Closes in{" "}
          <span className="font-semibold text-emerald-700">{fmtCountdown(msLeft)}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-700">
          <LayoutTemplate className="w-3 h-3" />
          24h window closed — only approved templates can be sent. It reopens when the client replies.
        </div>
      )}

      {windowOpen ? (
        <div className="flex gap-2 items-end">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a WhatsApp message…"
            rows={2}
            className="resize-none text-sm flex-1 min-h-[40px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
            }}
          />
          <Button size="sm" onClick={() => void send()} disabled={sending || !text.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2 items-center">
          <Select value={templateName} onValueChange={setTemplateName}>
            <SelectTrigger className="flex-1 h-9 text-sm">
              <SelectValue placeholder="Choose an approved template…" />
            </SelectTrigger>
            <SelectContent>
              {(templates ?? []).map((t) => (
                <SelectItem key={t.id} value={t.name}>
                  {t.name} ({t.language}) — {t.body.slice(0, 40)}…
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => void send()} disabled={sending || !selectedTemplate}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}
      {!windowOpen && selectedTemplate && (
        <p className="text-[11px] text-muted-foreground border border-border rounded p-2 bg-muted/30">
          {selectedTemplate.body}
        </p>
      )}
    </div>
  );
}
