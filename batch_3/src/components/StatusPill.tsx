"use client";

import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "gold";

const TONE: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning-foreground",
  danger: "bg-destructive/10 text-destructive",
  gold: "bg-gold/15 text-gold-foreground",
};

interface Props {
  tone?: StatusTone;
  className?: string;
  children: React.ReactNode;
}

export function StatusPill({ tone = "neutral", className, children }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const LEAD_STATUS_TONE: Record<string, StatusTone> = {
  // Blueprint v1.0 stages
  new_enquiry:   "info",
  contacted:     "neutral",
  assessed:      "neutral",
  proposal_sent: "gold",
  negotiating:   "gold",
  waiting:       "warning",
  nurturing:     "warning",
  converted:     "success",
  cold:          "neutral",
  not_eligible:  "danger",
  lost:          "danger",
  // Legacy fallbacks
  new:           "info",
  qualified:     "gold",
};

export function LeadStatusPill({ status }: { status: string }) {
  return (
    <StatusPill tone={LEAD_STATUS_TONE[status] ?? "neutral"} className="capitalize">
      {status.replace(/_/g, " ")}
    </StatusPill>
  );
}

const PRIORITY_TONE: Record<string, StatusTone> = {
  low: "neutral",
  normal: "neutral",
  high: "warning",
  urgent: "danger",
};

export function PriorityPill({ priority }: { priority: string | null }) {
  if (!priority) return null;
  return (
    <StatusPill tone={PRIORITY_TONE[priority] ?? "neutral"} className="capitalize">
      {priority}
    </StatusPill>
  );
}

const RISK_TONE: Record<string, StatusTone> = {
  green: "success",
  yellow: "warning",
  red: "danger",
};

export function RiskPill({ risk }: { risk: string | null }) {
  if (!risk) return null;
  return (
    <StatusPill tone={RISK_TONE[risk] ?? "neutral"} className="capitalize">
      {risk} risk
    </StatusPill>
  );
}
