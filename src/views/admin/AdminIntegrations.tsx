"use client";

/**
 * AdminIntegrations.tsx
 * Integrations hub — shows connected/disconnected status for each supported
 * integration, with setup instructions and quick-action buttons.
 *
 * Integrations covered:
 *  1. WhatsApp Business API (via wa.me links — no additional setup needed)
 *  2. Gmail / Google Workspace (OAuth guide)
 *  3. Outlook / Microsoft 365 (OAuth guide)
 *  4. IRCC email inbox (IMAP polling)
 *  5. Supabase (always connected — shows project info)
 *  6. Vercel (deployment platform)
 *  7. Anthropic AI (Ask AI edge function — shows key status)
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Mail,
  Globe,
  Database,
  Zap,
  Bot,
  Copy,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ─── Types ─────────────────────────────────────────────── */

type IntegrationStatus = "connected" | "partial" | "not_configured" | "native";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: IntegrationStatus;
  statusLabel: string;
  category: string;
  docsUrl?: string;
  setupSteps?: { title: string; body: string }[];
  note?: string;
}

/* ─── Status badge helper ───────────────────────────────── */

function StatusBadge({ status, label }: { status: IntegrationStatus; label: string }) {
  const map: Record<IntegrationStatus, { icon: React.ReactNode; cls: string }> = {
    connected:      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, cls: "bg-success/15 text-success border-success/30" },
    partial:        { icon: <AlertCircle className="h-3.5 w-3.5" />,   cls: "bg-amber-500/15 text-amber-600 border-amber-400/30" },
    not_configured: { icon: <XCircle className="h-3.5 w-3.5" />,       cls: "bg-muted text-muted-foreground border-border" },
    native:         { icon: <CheckCircle2 className="h-3.5 w-3.5" />, cls: "bg-primary/10 text-primary border-primary/20" },
  };
  const { icon, cls } = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border", cls)}>
      {icon} {label}
    </span>
  );
}

/* ─── Copy-to-clipboard helper ──────────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={() => void handleCopy()}
      className="ml-1.5 p-0.5 rounded hover:bg-muted transition-colors"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
}

/* ─── Integration card ──────────────────────────────────── */

function IntegrationCard({ integration }: { integration: Integration }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 text-foreground">
              {integration.icon}
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{integration.name}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{integration.description}</CardDescription>
            </div>
          </div>
          <StatusBadge status={integration.status} label={integration.statusLabel} />
        </div>
      </CardHeader>

      {(integration.setupSteps || integration.note) && (
        <>
          <Separator />
          <CardContent className="pt-3 pb-3">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? "Hide" : "Show"} setup guide
            </button>

            {expanded && (
              <div className="mt-3 space-y-3">
                {integration.note && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                    {integration.note}
                  </p>
                )}
                {integration.setupSteps && (
                  <ol className="space-y-3">
                    {integration.setupSteps.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-xs font-semibold">{step.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{step.body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                {integration.docsUrl && (
                  <a
                    href={integration.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Official documentation
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </>
      )}
    </Card>
  );
}

/* ─── Main page ─────────────────────────────────────────── */

export default function AdminIntegrations() {
  // Check if IRCC email is configured (any ircc_emails rows exist)
  const { data: irccCount } = useQuery({
    queryKey: ["ircc-configured"],
    queryFn: async () => {
      const { count } = await supabase
        .from("ircc_emails")
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const integrations: Integration[] = [
    {
      id: "whatsapp",
      name: "WhatsApp Business",
      description: "Send templated messages to leads via wa.me links. No API key required — opens WhatsApp Web or the app.",
      icon: <MessageCircle className="h-5 w-5 text-green-600" />,
      status: "native",
      statusLabel: "Built-in (wa.me)",
      category: "Messaging",
      note: "WhatsApp outreach is built into Study2PR and requires no additional setup. When you click 'Open WhatsApp' on a lead, the system generates a pre-filled wa.me link and opens it in a new tab. The message is sent from your personal or business WhatsApp account.",
      setupSteps: [
        {
          title: "Optional: Set up WhatsApp Business API",
          body: "For higher-volume automated messaging, sign up for the WhatsApp Business Platform at business.whatsapp.com. You'll need a Facebook Business account and phone number verification.",
        },
        {
          title: "Create message templates",
          body: "In the Control Center → Templates section, create WhatsApp message templates with placeholders like {{name}} and {{advisor_name}}. These auto-populate in the outreach dialog.",
        },
        {
          title: "Test the flow",
          body: "Go to any lead → click the green Message button → select WhatsApp → compose or pick a template → click 'Open WhatsApp'. Your WhatsApp client will open with the message pre-filled.",
        },
      ],
      docsUrl: "https://business.whatsapp.com/products/business-platform",
    },
    {
      id: "gmail",
      name: "Gmail / Google Workspace",
      description: "Send emails to leads and clients using your Gmail or Google Workspace account.",
      icon: <Mail className="h-5 w-5 text-red-500" />,
      status: "native",
      statusLabel: "Built-in (mailto:)",
      category: "Email",
      note: "Email outreach currently uses mailto: links which open your default mail client. Full Gmail OAuth integration (send directly from the app) is on the roadmap.",
      setupSteps: [
        {
          title: "Current workflow (mailto)",
          body: "Go to Lead Detail → Message button → Email tab. Compose your message, click 'Open email client'. Your default mail app (Gmail, Outlook, Apple Mail) opens with the message pre-filled.",
        },
        {
          title: "Set a default mail app",
          body: "To ensure mailto: links open Gmail: in Chrome, visit gmail.com → click the protocol handler icon in the address bar → Allow. Gmail will now open for all mailto: links.",
        },
        {
          title: "Create email templates",
          body: "Go to Control Center → Templates → create templates with channel set to 'Email'. Add a Subject and Body with {{name}} placeholders. These appear in the outreach dialog.",
        },
      ],
      docsUrl: "https://support.google.com/mail/answer/8494?hl=en",
    },
    {
      id: "outlook",
      name: "Outlook / Microsoft 365",
      description: "Use Outlook as your email client for lead and client outreach.",
      icon: <Mail className="h-5 w-5 text-blue-600" />,
      status: "native",
      statusLabel: "Built-in (mailto:)",
      category: "Email",
      note: "Outlook works out of the box when set as your default mail client. The mailto: links generated by Study2PR include the subject and body pre-filled.",
      setupSteps: [
        {
          title: "Set Outlook as default mail app (Windows)",
          body: "Settings → Apps → Default apps → search 'Mail' → set to Outlook. All mailto: links from Study2PR will now open in Outlook.",
        },
        {
          title: "Set Outlook as default mail app (Mac)",
          body: "Open Mail.app → Preferences → General → Default email reader → select Microsoft Outlook.",
        },
        {
          title: "Test the integration",
          body: "Go to any lead with an email address → Message → Email → compose a message → click 'Open email client'. Outlook should open with the recipient, subject, and body pre-filled.",
        },
      ],
    },
    {
      id: "ircc",
      name: "IRCC Email Inbox",
      description: "Forward IRCC correspondence to a monitored inbox. Study2PR parses and displays these in the IRCC Emails section.",
      icon: <Mail className="h-5 w-5 text-navy" />,
      status: (irccCount ?? 0) > 0 ? "connected" : "not_configured",
      statusLabel: (irccCount ?? 0) > 0 ? `${irccCount} emails logged` : "Not configured",
      category: "Email",
      note: "IRCC emails are stored and tracked in Study2PR. You can flag emails that require action and link them to specific cases.",
      setupSteps: [
        {
          title: "Forward IRCC emails to your team",
          body: "When IRCC sends a correspondence, forward it to your designated team email. A team member then logs it manually in the IRCC Emails section (Comms → IRCC Emails).",
        },
        {
          title: "Log an IRCC email",
          body: "Go to IRCC Emails → New Email → fill in the subject, reference number, and body. Tag it with 'requires_action' if it needs follow-up.",
        },
        {
          title: "Link to a case",
          body: "From the IRCC email detail, assign it to a specific case so the case manager is notified and can respond.",
        },
      ],
    },
    {
      id: "supabase",
      name: "Supabase",
      description: "Postgres database, authentication, storage, and real-time subscriptions powering Study2PR.",
      icon: <Database className="h-5 w-5 text-emerald-600" />,
      status: "connected",
      statusLabel: "Connected",
      category: "Infrastructure",
      note: "Supabase is the core backend for Study2PR. The connection is configured at build time via environment variables and is always active.",
      setupSteps: [
        {
          title: "Project reference",
          body: "Project ref: ocnsavosheduqzmeyvcd (ap-south-1 region). Manage your database, RLS policies, and edge functions at supabase.com/dashboard.",
        },
        {
          title: "Run schema migrations",
          body: "Open the file RUN_IN_SUPABASE_SQL_EDITOR.sql from the project root and paste each section into the Supabase SQL Editor to apply schema changes.",
        },
        {
          title: "Manage secrets",
          body: "Store sensitive keys (e.g. ANTHROPIC_API_KEY) in Supabase Vault: Dashboard → Settings → Vault → New secret.",
        },
      ],
      docsUrl: "https://supabase.com/docs",
    },
    {
      id: "vercel",
      name: "Vercel",
      description: "Hosting and CI/CD for the Study2PR frontend. Each push to main auto-deploys.",
      icon: <Zap className="h-5 w-5 text-foreground" />,
      status: "connected",
      statusLabel: "Connected",
      category: "Infrastructure",
      note: "Vercel is configured for automatic deployments. Push to the main branch via the torontoimmichd GitHub account to trigger a production build.",
      setupSteps: [
        {
          title: "Deploy a new version",
          body: 'Commit your changes and push to GitHub:\n\ngit add -A\ngit commit --author="torontoimmichd <torontoimmichd@gmail.com>" -m "feat: your message"\ngit push origin main\n\nVercel will build and deploy automatically in ~2 minutes.',
        },
        {
          title: "Check deployment status",
          body: "Visit vercel.com/dashboard → select the Study2PR project → view the latest deployment. Click 'Visit' to preview the live URL.",
        },
        {
          title: "Environment variables",
          body: "Vercel env vars are managed at vercel.com → Project → Settings → Environment Variables. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set for the app to connect to Supabase.",
        },
      ],
      docsUrl: "https://vercel.com/docs",
    },
    {
      id: "anthropic",
      name: "Anthropic AI (Ask AI)",
      description: "Powers the Ask AI feature in the Knowledge section using Claude Haiku via a Supabase Edge Function.",
      icon: <Bot className="h-5 w-5 text-primary" />,
      status: "partial",
      statusLabel: "Needs API key",
      category: "AI",
      note: "The Ask AI edge function (ask-immigration-ai) is deployed but requires the ANTHROPIC_API_KEY secret to be set in Supabase Vault before it can respond to queries.",
      setupSteps: [
        {
          title: "Get an Anthropic API key",
          body: "Sign up or log in at console.anthropic.com → API Keys → Create Key. Copy the key (shown only once).",
        },
        {
          title: "Add the key to Supabase Vault",
          body: "Supabase Dashboard → Settings → Vault → New secret → Name: ANTHROPIC_API_KEY → Value: paste your key → Save.",
        },
        {
          title: "Deploy the edge function",
          body: "In your terminal, run:\n\nnpx supabase functions deploy ask-immigration-ai --project-ref ocnsavosheduqzmeyvcd\n\nThis deploys (or re-deploys) the function with the new secret available.",
        },
        {
          title: "Test the integration",
          body: "Go to Knowledge → Ask AI → type a question about Canadian immigration. You should receive a response from Claude Haiku within a few seconds.",
        },
      ],
      docsUrl: "https://console.anthropic.com",
    },
  ];

  const categories = Array.from(new Set(integrations.map((i) => i.category)));

  const connectedCount = integrations.filter((i) => i.status === "connected" || i.status === "native").length;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-navy">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage connected services and view setup guides for each integration.
        </p>
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-success/10 text-success text-sm font-medium px-3 py-1.5 rounded-full border border-success/20">
          <CheckCircle2 className="h-4 w-4" />
          {connectedCount} active
        </div>
        <div className="flex items-center gap-2 bg-amber-500/10 text-amber-600 text-sm font-medium px-3 py-1.5 rounded-full border border-amber-400/20">
          <AlertCircle className="h-4 w-4" />
          {integrations.filter((i) => i.status === "partial").length} needs attention
        </div>
        <div className="flex items-center gap-2 bg-muted text-muted-foreground text-sm font-medium px-3 py-1.5 rounded-full border border-border">
          <XCircle className="h-4 w-4" />
          {integrations.filter((i) => i.status === "not_configured").length} not configured
        </div>
      </div>

      {/* Grouped integration cards */}
      {categories.map((cat) => (
        <div key={cat}>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{cat}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {integrations.filter((i) => i.category === cat).map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </div>
      ))}

      {/* Footer note */}
      <p className="text-xs text-muted-foreground pt-2">
        Need a new integration? Contact your administrator or open a GitHub issue on the Study2PR repository.
      </p>
    </div>
  );
}
