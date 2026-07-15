"use client";

// src/pages/manager/ManagerDashboardPage.tsx
//
// Top-level page for managers and owners. Every drill-down opens in a
// side sheet — the page itself never navigates away.
//
// Route: /manager

import { useState } from "react";
import { KpiHeader } from "@/components/manager/KpiHeader";
import { DateRangeBranchFilter, type DateRange } from "@/components/manager/DateRangeBranchFilter";
import { CounselorRiskPanel } from "@/components/manager/CounselorRiskPanel";
import { BranchHealthPanel } from "@/components/manager/BranchHealthPanel";
import { TopFamilyUnitsPanel } from "@/components/manager/TopFamilyUnitsPanel";
import { RecentChainFiringsPanel } from "@/components/manager/RecentChainFiringsPanel";
import { AllCounselorsTable } from "@/components/manager/AllCounselorsTable";
import { CounselorDetailSheet } from "@/components/manager/CounselorDetailSheet";
import { FamilyUnitSheet } from "@/components/family/FamilyUnitSheet";
import { ProspectiveDetailSheet } from "@/components/applications/ProspectiveDetailSheet";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function ManagerDashboardPage() {
  const currentUser = useCurrentUser();
  const isOwner = currentUser?.roles?.includes("owner") ?? false;

  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [branchFilter, setBranchFilter] = useState<string[]>([]);

  // Sheet state — page stays mounted, sheets overlay
  const [counselorSheetId, setCounselorSheetId] = useState<string | null>(null);
  const [familyUnitSheetId, setFamilyUnitSheetId] = useState<string | null>(null);
  const [prospectiveSheetId, setProspectiveSheetId] = useState<string | null>(null);

  return (
    <div className="bg-slate-50 min-h-screen p-4 lg:p-6">
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Team performance</h1>
          <p className="text-sm text-muted-foreground">
            Chain SLA hit rate, counselor ratings, and pipeline health.
          </p>
        </div>
        <DateRangeBranchFilter
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          branchFilter={branchFilter}
          onBranchFilterChange={setBranchFilter}
        />
      </div>

      <KpiHeader dateRange={dateRange} branchFilter={branchFilter} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
        <CounselorRiskPanel
          dateRange={dateRange}
          branchFilter={branchFilter}
          onOpenCounselor={setCounselorSheetId}
        />
        <BranchHealthPanel branchFilter={branchFilter} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
        <TopFamilyUnitsPanel onOpenFamily={setFamilyUnitSheetId} />
        <RecentChainFiringsPanel
          dateRange={dateRange}
          branchFilter={branchFilter}
          onOpenProspective={setProspectiveSheetId}
        />
      </div>

      {isOwner && (
        <div className="mt-3">
          <AllCounselorsTable
            dateRange={dateRange}
            branchFilter={branchFilter}
            onOpenCounselor={setCounselorSheetId}
          />
        </div>
      )}

      {/* Drill-down sheets — page stays mounted underneath */}
      <CounselorDetailSheet
        counselorId={counselorSheetId}
        open={counselorSheetId !== null}
        onOpenChange={(o) => { if (!o) setCounselorSheetId(null); }}
        onOpenFamily={setFamilyUnitSheetId}
        onOpenProspective={setProspectiveSheetId}
      />
      <FamilyUnitSheet
        familyUnitId={familyUnitSheetId}
        open={familyUnitSheetId !== null}
        onOpenChange={(o) => { if (!o) setFamilyUnitSheetId(null); }}
        onOpenProspective={setProspectiveSheetId}
      />
      <ProspectiveDetailSheet
        prospectiveId={prospectiveSheetId}
        open={prospectiveSheetId !== null}
        onOpenChange={(o) => { if (!o) setProspectiveSheetId(null); }}
        onUpdated={() => {/* Realtime channel handles propagation back to panels */}}
      />
    </div>
  );
}
