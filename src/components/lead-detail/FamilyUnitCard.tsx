"use client";

// src/components/lead-detail/FamilyUnitCard.tsx
// Uses AddFamilyMemberSheet + optimistic updates.
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import { AddFamilyMemberSheet } from "@/components/family/AddFamilyMemberSheet";
import { toast } from "sonner";
import type { Lead, FamilyMember } from "@/lib/types";

interface Props {
  members: FamilyMember[];
  currentLead: Lead;
  familyUnitId: string | null;
  onMembersChanged?: (members: FamilyMember[]) => void;
  // Legacy prop used in LeadDetailPage v1 — ignored here
  currentLeadId?: string;
  onAddMember?: () => void;
}

const ROLE_BG: Record<string, string> = {
  primary: "bg-blue-100 text-blue-900",
  spouse: "bg-emerald-100 text-emerald-900",
  parent: "bg-amber-100 text-amber-900",
  child: "bg-pink-100 text-pink-900",
  sibling: "bg-gray-100 text-gray-900",
};

function initials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

export function FamilyUnitCard({ members: initialMembers, currentLead, familyUnitId, onMembersChanged }: Props) {
  const navigate = useNavigate();
  const [members, setMembers] = useState<FamilyMember[]>(initialMembers);
  const [sheetOpen, setSheetOpen] = useState(false);

  const totalLTV = members.reduce((s, m) => s + (m.expected_revenue_cad || 0), 0);

  const handleAdded = (newMember: FamilyMember) => {
    const updated = [newMember, ...members];
    setMembers(updated);
    onMembersChanged?.(updated);
    setSheetOpen(false);
    toast.success(`Added ${newMember.full_name} as ${newMember.family_role}`);
  };

  return (
    <>
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Family unit</p>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSheetOpen(true)}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>

        {!familyUnitId && members.length === 0 && (
          <p className="text-xs text-muted-foreground">Click + to start a family unit and add members.</p>
        )}

        <div className="divide-y">
          {members.map(m => {
            const isCurrent = m.lead_id === currentLead.id || m.client_id === currentLead.id;
            return (
              <button
                key={m.id}
                disabled={isCurrent}
                onClick={() => navigate(m.client_id ? `/clients/${m.client_id}` : `/leads/${m.lead_id}`)}
                className={`w-full flex items-center gap-2 py-2 text-left ${
                  !isCurrent && "hover:bg-muted/50 -mx-2 px-2 rounded"
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                  ROLE_BG[m.family_role] || "bg-gray-100"
                }`}>
                  {initials(m.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.full_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {m.family_role} · {m.client_id ? "Client" : "Lead"}
                    {m.primary_application && ` (${m.primary_application})`}
                  </p>
                </div>
                {isCurrent && <span className="text-[10px] text-muted-foreground">current</span>}
              </button>
            );
          })}
        </div>

        {members.length > 0 && (
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            {members.length} member{members.length > 1 ? "s" : ""} · CAD {totalLTV.toLocaleString()} potential
          </p>
        )}
      </Card>

      <AddFamilyMemberSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        currentLead={currentLead}
        familyUnitId={familyUnitId}
        onAdded={handleAdded}
      />
    </>
  );
}
