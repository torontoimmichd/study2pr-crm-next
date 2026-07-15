"use client";

// src/components/lead-detail/FeeAssignmentCard.tsx
import { Card } from "@/components/ui/card";
import type { Lead } from "@/lib/types";

export function FeeAssignmentCard({ lead }: { lead: Lead }) {
  const fmtINR = (n: number | null | undefined) =>
    n == null
      ? "—"
      : new Intl.NumberFormat("en-IN", {
          style: "currency", currency: "INR", maximumFractionDigits: 0
        }).format(n);

  const quotedFee = lead.quoted_fee_inr ?? lead.quoted_amount ?? null;
  const serviceFee = lead.service_fee ?? null;

  return (
    <Card className="p-3">
      <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">
        Fee &amp; assignment
      </p>
      <div className="text-sm space-y-1">
        <Row label="Quoted" value={fmtINR(quotedFee)} />
        {serviceFee != null && <Row label="Service fee" value={fmtINR(serviceFee)} bold />}
        {lead.estimated_govt_fee_cad_min != null && (
          <Row
            label="Govt fee"
            value={`CAD ${lead.estimated_govt_fee_cad_min}${
              lead.estimated_govt_fee_cad_max ? `–${lead.estimated_govt_fee_cad_max}` : ""
            }`}
          />
        )}
      </div>
      <div className="border-t my-2" />
      <div className="text-sm space-y-1">
        <Row label="Counselor" value={lead.assigned_team_member?.full_name || "Unassigned"} />
        <Row label="Branch" value={lead.branch_code || "—"} />
        <Row label="Created" value={new Date(lead.created_at).toLocaleDateString("en-IN")} />
      </div>
    </Card>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
