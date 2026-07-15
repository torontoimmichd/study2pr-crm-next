"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, User, Bot, Loader2, Info } from "lucide-react";
import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  "What CRS score do I need for Express Entry right now?",
  "Explain the difference between LMIA and LMIA-exempt work permits",
  "What documents are needed for a spousal sponsorship application?",
  "How does the Post-Graduation Work Permit work?",
  "What is the residency obligation for permanent residents?",
  "Which provinces have the easiest PNP streams for tech workers?",
];

export default function KnowledgeAI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const userMsg = text.trim();
    if (!userMsg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      // Build conversation history for context
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: "user", content: userMsg });

      const { data, error } = await supabase.functions.invoke("ask-immigration-ai", {
        body: { messages: history },
      });

      if (error) throw error;
      const reply = data?.reply ?? "I couldn't generate a response. Please try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I'm not able to connect to the AI service right now. Please check your internet connection or try again shortly. In the meantime, use the **IRCC Canon** tab for reference information on programs and eligibility.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      <PageHeader
        title="Ask AI"
        subtitle="Ask anything about Canadian immigration law, programs, or case strategy"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {isEmpty ? (
          <div className="max-w-2xl mx-auto mt-8 space-y-6">
            {/* Welcome */}
            <div className="text-center space-y-3">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-gold/20 flex items-center justify-center mx-auto">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-2xl text-navy">Immigration AI Assistant</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Ask about programs, eligibility, processing times, or case strategy. Always verify with official IRCC sources.
                </p>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning" />
              AI responses are for informational purposes only and do not constitute legal advice. Always verify with official IRCC sources and consult a licensed RCIC or immigration lawyer for client-specific guidance.
            </div>

            {/* Starter questions */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Try asking</p>
              <div className="grid gap-2">
                {STARTERS.map((q) => (
                  <button
                    key={q}
                    onClick={() => void send(q)}
                    className="text-left px-4 py-3 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors text-sm text-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                  msg.role === "assistant" ? "bg-primary/10" : "bg-sidebar-accent"
                )}>
                  {msg.role === "assistant"
                    ? <Sparkles className="h-4 w-4 text-primary" />
                    : <User className="h-4 w-4 text-sidebar-foreground" />
                  }
                </div>
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === "assistant"
                    ? "bg-muted text-foreground rounded-tl-sm"
                    : "bg-primary text-primary-foreground rounded-tr-sm"
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-border bg-card/50 p-4">
        <div className="max-w-2xl mx-auto flex gap-3 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about Express Entry, PGWP, spousal sponsorship…"
            rows={2}
            className="resize-none flex-1"
          />
          <Button
            onClick={() => void send(input)}
            disabled={!input.trim() || loading}
            className="shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-2">
          Press Enter to send · Shift+Enter for new line · Not legal advice
        </p>
      </div>
    </div>
  );
}
