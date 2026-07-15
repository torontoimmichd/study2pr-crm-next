"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "@/components/RichTextEditor";
import { supabase } from "@/integrations/supabase/client";
import { writeAudit } from "@/lib/audit";
import { toast } from "sonner";

interface TemplateRow {
  id: string;
  template_name: string | null;
  template_category: string | null;
  template_variables: string[] | null;
  channel: string;
  subject: string | null;
  body: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: TemplateRow | null;
  onSaved?: () => void;
}

const VARIABLE_HINTS: { token: string; description: string }[] = [
  { token: "client.full_name", description: "Client's full name" },
  { token: "client.email", description: "Client's email" },
  { token: "client.phone", description: "Client's phone" },
  { token: "case.case_number", description: "Case code (e.g. PR-2026-00042)" },
  { token: "case.visa_label", description: "Visa type label" },
  { token: "case.fee", description: "Quoted fee" },
  { token: "visa.label", description: "Visa label" },
  { token: "staff.full_name", description: "Sender's name" },
  { token: "date.today", description: "Today's date (IST)" },
];

const CATEGORIES = [
  "lead_followup",
  "case_update",
  "document_request",
  "reminder",
  "invoice",
  "approval",
  "rejection",
  "general",
];

/** Pull `{{...}}` tokens out of an HTML body and dedupe. */
function extractVariables(html: string): string[] {
  const re = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    found.add(m[1]);
  }
  return Array.from(found);
}

export function TemplateDialog({ open, onOpenChange, template, onSaved }: Props) {
  const isEdit = !!template;
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [channel, setChannel] = useState<string>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const editorApiRef = useRef<{ insertText: (text: string) => void } | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  // detected variables (live from body)
  const detectedVars = useMemo(() => {
    const fromBody = extractVariables(body);
    const fromSubject = extractVariables(subject);
    return Array.from(new Set([...fromBody, ...fromSubject]));
  }, [body, subject]);

  useEffect(() => {
    if (open) {
      setName(template?.template_name ?? "");
      setCategory(template?.template_category ?? "general");
      setChannel(template?.channel ?? "email");
      setSubject(template?.subject ?? "");
      setBody(template?.body ?? "");
    }
  }, [open, template]);

  const insertVar = (token: string) => {
    const tag = `{{${token}}}`;
    // If subject has focus, insert there; otherwise into body editor.
    if (subjectRef.current && document.activeElement === subjectRef.current) {
      const el = subjectRef.current;
      const start = el.selectionStart ?? subject.length;
      const end = el.selectionEnd ?? subject.length;
      const next = subject.slice(0, start) + tag + subject.slice(end);
      setSubject(next);
      setTimeout(() => {
        el.focus();
        const pos = start + tag.length;
        el.setSelectionRange(pos, pos);
      }, 0);
      return;
    }
    editorApiRef.current?.insertText(tag);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (channel === "email" && !subject.trim()) {
      toast.error("Email templates need a subject");
      return;
    }
    const bodyText = body.replace(/<[^>]+>/g, "").trim();
    if (!bodyText) {
      toast.error("Body cannot be empty");
      return;
    }

    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const payload = {
        is_template: true,
        template_name: name.trim(),
        template_category: category,
        template_variables: detectedVars,
        channel,
        direction: "outbound",
        subject: channel === "email" ? subject.trim() : null,
        body: body.trim(),
        from_staff_id: userRes.user?.id ?? null,
        last_edited_by: userRes.user?.id ?? null,
        last_edited_at: new Date().toISOString(),
      };

      if (isEdit && template) {
        const { error } = await supabase
          .from("messages")
          .update(payload as never)
          .eq("id", template.id);
        if (error) throw error;
        void writeAudit({
          action: "UPDATE",
          entity_type: "message_template",
          entity_id: template.id,
          changes: payload as unknown as Record<string, unknown>,
        });
        toast.success("Template updated");
      } else {
        const { data, error } = await supabase
          .from("messages")
          .insert(payload as never)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (data?.id) {
          void writeAudit({
            action: "CREATE",
            entity_type: "message_template",
            entity_id: data.id,
            changes: payload as unknown as Record<string, unknown>,
          });
        }
        toast.success("Template created");
      }
      onSaved?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-navy">
            {isEdit ? "Edit template" : "New template"}
          </DialogTitle>
          <DialogDescription>
            Use <code className="text-xs bg-muted px-1 py-0.5 rounded">{`{{client.full_name}}`}</code>-style merge
            tags. Variables are auto-detected from the subject and body.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr,200px] gap-4">
          {/* MAIN COLUMN */}
          <div className="space-y-4 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-name">Template name *</Label>
                <Input
                  id="tpl-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Document reminder"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="tpl-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-channel">Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger id="tpl-channel" className="w-full sm:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="portal_chat">Portal chat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {channel === "email" && (
              <div className="space-y-1.5">
                <Label htmlFor="tpl-subject">Subject *</Label>
                <Input
                  ref={subjectRef}
                  id="tpl-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Action required: passport scan for {{case.case_number}}"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Body *</Label>
              <RichTextEditor
                value={body}
                onChange={setBody}
                placeholder={
                  channel === "email"
                    ? "Hi {{client.full_name}},\n\nWe still need a clear scan of …"
                    : "Hi {{client.full_name}}, quick reminder about …"
                }
                onReady={(api) => {
                  editorApiRef.current = api;
                }}
              />
            </div>

            {detectedVars.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-1">
                <span className="text-[11px] text-muted-foreground mr-1">Detected variables:</span>
                {detectedVars.map((v) => (
                  <Badge key={v} variant="secondary" className="text-[10px] font-mono">
                    {v}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* HINTS SIDEBAR */}
          <aside className="space-y-2">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Variables — click to insert
            </Label>
            <div className="rounded-md border border-border divide-y divide-border bg-muted/20 max-h-[420px] overflow-y-auto">
              {VARIABLE_HINTS.map((v) => (
                <button
                  key={v.token}
                  type="button"
                  onClick={() => insertVar(v.token)}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-muted/60 transition-colors group"
                >
                  <div className="font-mono text-[11px] text-foreground group-hover:text-primary">
                    {`{{${v.token}}}`}
                  </div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{v.description}</div>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Click anywhere in the subject or body first, then click a variable to insert it at the caret.
            </p>
          </aside>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
