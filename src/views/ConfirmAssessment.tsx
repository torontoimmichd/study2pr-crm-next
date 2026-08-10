"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type ResolvedLink = { ok?: boolean; valid?: boolean; purpose?: string; client_name?: string; full_name?: string; assessment?: Record<string, unknown>; payload?: Record<string, unknown>; message?: string; error?: string };

export default function ConfirmAssessment({ token }: { token: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["secure-assessment-link", token],
    queryFn: async () => {
      const result = await supabase.rpc("fn_resolve_secure_link", { p_token: token });
      if (result.error) throw result.error;
      return (result.data ?? {}) as ResolvedLink;
    },
    retry: false,
  });

  if (isLoading) return <Shell><p className="text-sm text-muted-foreground">Loading your assessment...</p></Shell>;
  if (error || !data || data.ok === false || data.valid === false) return <Shell><AlertCircle className="h-10 w-10 text-destructive mx-auto" /><h1 className="mt-3 font-display text-xl text-navy">This link is unavailable</h1><p className="mt-2 text-sm text-muted-foreground">{data?.message ?? data?.error ?? "Please ask your advisor for a new link."}</p></Shell>;

  const answers = data.assessment ?? data.payload ?? {};
  return <Shell><ClipboardCheck className="h-10 w-10 text-primary mx-auto" /><h1 className="mt-3 font-display text-xl text-navy">Review your assessment</h1><p className="mt-2 text-sm text-muted-foreground">{data.client_name ?? data.full_name ? `Hello ${data.client_name ?? data.full_name}.` : "Please review the answers below."}</p><div className="mt-5 rounded-md border border-border bg-card p-4 text-left space-y-3">{Object.entries(answers).length === 0 ? <p className="text-sm text-muted-foreground">Your advisor will share the assessment details with you.</p> : Object.entries(answers).map(([key, value]) => <div key={key} className="border-b border-border pb-2 last:border-0"><div className="text-xs uppercase tracking-wide text-muted-foreground">{key.replace(/_/g, " ")}</div><div className="mt-1 text-sm font-medium">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</div></div>)}</div><div className="mt-5 flex items-start gap-2 rounded-md bg-muted p-3 text-left text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-success" /><span>Please reply to your advisor by the channel they used to send this link. A staff member will record your reply and confirm the assessment.</span></div><Button className="mt-4" onClick={() => window.close()}>Done</Button></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) { return <main className="min-h-screen bg-gradient-to-br from-navy/5 via-background to-gold/5 flex items-center justify-center p-4"><div className="w-full max-w-xl card-surface p-6 text-center">{children}</div></main>; }
