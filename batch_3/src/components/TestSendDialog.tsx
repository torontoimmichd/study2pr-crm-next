"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string | null;
  templateName: string | null;
  channel: string | null;
}

export function TestSendDialog({ open, onOpenChange, templateId, templateName, channel }: Props) {
  const [recipient, setRecipient] = useState("");
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; body: string; status: string } | null>(null);

  const isEmail = channel === "email";

  const handleSend = async () => {
    if (!templateId) return;
    if (!recipient.trim()) {
      toast.error("Recipient required");
      return;
    }
    setSending(true);
    setPreview(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-template-test", {
        body: { template_id: templateId, recipient_email: recipient.trim() },
      });
      if (error) throw error;
      const result = data as {
        status: string;
        provider_error: string | null;
        rendered_subject: string;
        rendered_body: string;
      };
      setPreview({
        subject: result.rendered_subject,
        body: result.rendered_body,
        status: result.status,
      });
      if (result.status === "sent") {
        toast.success(`Test email sent to ${recipient.trim()}`);
      } else if (result.status === "failed") {
        toast.error("Send failed", { description: result.provider_error ?? undefined });
      } else {
        toast.message("Preview generated", {
          description: "No email provider configured for this channel — see preview below.",
        });
      }
    } catch (err) {
      toast.error("Test send failed", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSending(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setRecipient("");
      setPreview(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-navy">Test send</DialogTitle>
          <DialogDescription>
            Sending "{templateName ?? "Untitled"}" with sample variable values to a recipient of your choice.
            {!isEmail && " Non-email channels generate a preview only."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="test-recipient">Recipient {isEmail ? "email" : "(preview only)"} *</Label>
            <Input
              id="test-recipient"
              type={isEmail ? "email" : "text"}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={isEmail ? "you@example.com" : "+91 …"}
              disabled={sending}
            />
          </div>

          {preview && (
            <div className="rounded-md border border-border bg-muted/20 overflow-hidden">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Preview</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${
                    preview.status === "sent"
                      ? "bg-success/10 text-success"
                      : preview.status === "failed"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-amber-500/10 text-amber-700"
                  }`}
                >
                  {preview.status}
                </span>
              </div>
              {preview.subject && (
                <div className="px-3 py-1.5 text-xs border-b border-border">
                  <span className="text-muted-foreground">Subject: </span>
                  <span className="font-medium">{preview.subject}</span>
                </div>
              )}
              <div
                className="prose prose-sm max-w-none px-3 py-2 text-sm"
                dangerouslySetInnerHTML={{ __html: preview.body }}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={sending}>
            Close
          </Button>
          <Button onClick={() => void handleSend()} disabled={sending}>
            <Send className="h-4 w-4" />
            {sending ? "Sending…" : isEmail ? "Send test" : "Generate preview"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
