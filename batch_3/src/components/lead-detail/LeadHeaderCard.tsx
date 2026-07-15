"use client";

// src/components/lead-detail/LeadHeaderCard.tsx
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, ArrowRight, Phone, MessageCircle, Mail, MapPin, Target, Calendar } from "lucide-react";
import { MaskedContact } from "@/components/MaskedContact";
import type { Lead } from "@/lib/types";

interface Props {
  lead: Lead;
  onEdit?: () => void;
  onConvert?: () => void;
  onCall?: () => void;
  onWhatsApp?: () => void;
  onEmail?: () => void;
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function daysInStage(updatedAt: string | null) {
  if (!updatedAt) return 0;
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000);
}

const STAGE_COLORS: Record<string, string> = {
  new: "bg-emerald-50 text-emerald-900 border-emerald-200",
  new_enquiry: "bg-emerald-50 text-emerald-900 border-emerald-200",
  contacted: "bg-blue-50 text-blue-900 border-blue-200",
  assessed: "bg-purple-50 text-purple-900 border-purple-200",
  qualified: "bg-purple-50 text-purple-900 border-purple-200",
  proposal_sent: "bg-indigo-50 text-indigo-900 border-indigo-200",
  negotiating: "bg-orange-50 text-orange-900 border-orange-200",
  documents_pending: "bg-pink-50 text-pink-900 border-pink-200",
  follow_up: "bg-amber-50 text-amber-900 border-amber-200",
  waiting: "bg-sky-50 text-sky-900 border-sky-200",
  nurturing: "bg-violet-50 text-violet-900 border-violet-200",
  cold: "bg-slate-100 text-slate-700 border-slate-200",
  not_eligible: "bg-gray-100 text-gray-700 border-gray-200",
  lost: "bg-red-50 text-red-900 border-red-200",
  converted: "bg-teal-50 text-teal-900 border-teal-200",
};

export function LeadHeaderCard({ lead, onEdit, onConvert, onCall, onWhatsApp, onEmail }: Props) {
  // Support both full_name (existing schema) and first_name/last_name (new schema)
  const fullName = lead.full_name ||
    `${lead.salutation || ""} ${lead.first_name || ""} ${lead.last_name || ""}`.trim() ||
    "—";
  const stage = lead.stage || lead.lifecycle_state || "new";
  const stageKey = stage.toLowerCase().replace(/\s+/g, "_");
  const country = lead.country || lead.country_of_residence || null;

  return (
    <Card className="p-4 lg:p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center font-semibold text-lg">
            {initials(fullName)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-lg">{fullName}</h2>
              {lead.lead_number && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-900">{lead.lead_number}</Badge>
              )}
              <Badge className={STAGE_COLORS[stageKey] || "bg-gray-100"}>{stage.replace(/_/g, " ")}</Badge>
              {lead.source && (
                <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-200">{lead.source}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
              {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> <MaskedContact value={lead.phone} field="phone" entityType="lead" entityId={lead.id} /></span>}
              {country && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {country}{lead.destination_country ? ` → ${lead.destination_country}` : ""}
                </span>
              )}
              {lead.visa_interest && (
                <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {lead.visa_interest}</span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {daysInStage(lead.updated_at)} days in stage
              </span>
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="border-violet-200 text-violet-700 hover:bg-violet-50 hover:border-violet-400"
          >
            <GitBranch className="w-4 h-4 mr-1" />Change Stage
          </Button>
          <Button
            size="sm"
            onClick={onConvert}
            disabled={lead.lifecycle_state === "converted" || lead.stage === "converted"}
            className="bg-amber-500 hover:bg-amber-600 text-white border-0"
          >
            <ArrowRight className="w-4 h-4 mr-1" />
            {lead.lifecycle_state === "converted" || lead.stage === "converted" ? "Converted" : "Convert"}
          </Button>
          <Button variant="outline" size="sm" onClick={onCall}>
            <Phone className="w-4 h-4 mr-1" />Call
          </Button>
          <Button variant="outline" size="sm" onClick={onWhatsApp}>
            <MessageCircle className="w-4 h-4 mr-1" />WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={onEmail} disabled={!lead.email}>
            <Mail className="w-4 h-4 mr-1" />Email
          </Button>
        </div>
      </div>
    </Card>
  );
}
