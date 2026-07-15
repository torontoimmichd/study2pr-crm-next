"use client";

// src/components/family/FamilyUnitSheet.tsx
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Loader2, Users, Mail, Phone, MapPin, Target } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";

type View =
  | { type: "family_overview" }
  | { type: "member"; memberId: string; memberType: "lead" | "client"; fromOverview: true }
  | { type: "application"; caseId: string; fromMemberId: string };

interface FamilyData {
  id: string;
  unit_name: string;
  origin_country: string | null;
  lifetime_revenue_cad: number;
  expected_lifetime_revenue_cad: number;
  members: Array<{
    id: string;
    type: "lead" | "client";
    full_name: string;
    family_role: string;
    primary_application: string | null;
    open_count: number;
  }>;
  prospectives: Array<{
    id: string;
    target_application_type: string;
    trigger_date: string;
    for_person_name: string;
  }>;
}

interface Props {
  familyUnitId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onOpenProspective: (id: string) => void;
}

export function FamilyUnitSheet({ familyUnitId, open, onOpenChange, onOpenProspective }: Props) {
  const navigate = useNavigate();
  const [view, setView] = useState<View>({ type: "family_overview" });
  const [data, setData] = useState<FamilyData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setView({ type: "family_overview" });
  }, [open, familyUnitId]);

  useEffect(() => {
    if (!familyUnitId || !open) return;
    setLoading(true);
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: family } = await (supabase as any).from("family_units").select("*").eq("id", familyUnitId).single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: members } = await (supabase as any).rpc("get_family_members", { p_family_unit_id: familyUnitId });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prosp } = await (supabase as any)
        .from("prospective_applications")
        .select("id, target_application_type, trigger_date, for_person_id, for_person_type")
        .eq("family_unit_id", familyUnitId)
        .eq("status", "pending_counselor_action");

      setData({
        id: family?.id || familyUnitId,
        unit_name: family?.unit_name || "Family unit",
        origin_country: family?.origin_country || null,
        lifetime_revenue_cad: family?.lifetime_revenue_cad || 0,
        expected_lifetime_revenue_cad: family?.expected_lifetime_revenue_cad || 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        members: (members || []).map((m: any) => ({
          id: m.lead_id || m.client_id,
          type: m.lead_id ? "lead" : "client",
          full_name: m.full_name,
          family_role: m.family_role,
          primary_application: m.primary_application,
          open_count: 0,
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prospectives: (prosp || []).map((p: any) => ({
          id: p.id,
          target_application_type: p.target_application_type,
          trigger_date: p.trigger_date,
          for_person_name: "—",
        })),
      });
      setLoading(false);
    })();
  }, [familyUnitId, open]);

  function back() {
    if (view.type === "member") setView({ type: "family_overview" });
    else if (view.type === "application") setView({ type: "member", memberId: view.fromMemberId, memberType: "lead", fromOverview: true });
  }

  const showBack = view.type !== "family_overview";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[560px] flex flex-col">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {showBack && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={back}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              )}
              <SheetTitle>
                {view.type === "family_overview" && (data?.unit_name || "Family unit")}
                {view.type === "member" && "Member detail"}
                {view.type === "application" && "Application detail"}
              </SheetTitle>
            </div>
          </div>
        </SheetHeader>

        {loading || !data ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto mt-4">
            {view.type === "family_overview" && (
              <FamilyOverview
                data={data}
                onOpenMember={(memberId, memberType) =>
                  setView({ type: "member", memberId, memberType, fromOverview: true })}
                onOpenProspective={(id) => onOpenProspective(id)}
                onNavigateOut={() => navigate(`/family-units/${data.id}`)}
              />
            )}
            {view.type === "member" && (
              <MemberDetail
                memberId={view.memberId}
                memberType={view.memberType}
                onNavigateOut={() => navigate(view.memberType === "lead" ? `/leads/${view.memberId}` : `/clients/${view.memberId}`)}
              />
            )}
            {view.type === "application" && (
              <ApplicationDetail caseId={view.caseId} onNavigateOut={() => navigate(`/cases/${view.caseId}`)} />
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function FamilyOverview({
  data, onOpenMember, onOpenProspective, onNavigateOut
}: {
  data: FamilyData;
  onOpenMember: (id: string, type: "lead" | "client") => void;
  onOpenProspective: (id: string) => void;
  onNavigateOut: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-slate-50 rounded-md p-3">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-medium">{data.members.length} members</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Lifetime revenue</p>
            <p className="font-medium">CAD {data.lifetime_revenue_cad.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Expected</p>
            <p className="font-medium text-emerald-700">CAD {data.expected_lifetime_revenue_cad.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">Members</p>
        <div className="divide-y">
          {data.members.map(m => (
            <button
              key={`${m.type}-${m.id}`}
              onClick={() => onOpenMember(m.id, m.type)}
              className="w-full flex items-center gap-2 py-2 hover:bg-muted/50 -mx-2 px-2 rounded"
            >
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{m.full_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {m.family_role} · {m.type}
                  {m.primary_application && ` · ${m.primary_application}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {data.prospectives.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">Open prospectives</p>
          <div className="space-y-2">
            {data.prospectives.map(p => (
              <button
                key={p.id}
                onClick={() => onOpenProspective(p.id)}
                className="w-full text-left bg-amber-50 border border-amber-200 rounded-md p-2 hover:bg-amber-100"
              >
                <p className="text-sm font-medium text-amber-900">{p.target_application_type}</p>
                <p className="text-[10px] text-amber-700">
                  Triggers {new Date(p.trigger_date).toLocaleDateString("en-IN")} · for {p.for_person_name}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t pt-3">
        <Button variant="outline" size="sm" className="w-full" onClick={onNavigateOut}>
          <ExternalLink className="w-3 h-3 mr-1" /> Open as full page
        </Button>
      </div>
    </div>
  );
}

function MemberDetail({ memberId, memberType, onNavigateOut }: { memberId: string; memberType: "lead" | "client"; onNavigateOut: () => void }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const table = memberType === "lead" ? "leads" : "clients";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: row } = await (supabase as any).from(table).select("*").eq("id", memberId).maybeSingle();
        setData(row ?? null);
      } catch { setData(null); }
      finally { setLoading(false); }
    })();
  }, [memberId, memberType]);

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  if (!data) return <div className="text-sm text-muted-foreground py-4 text-center">Member not found.</div>;

  const fullName = (data.full_name as string) ?? "—";
  const stage = (data.lifecycle_state || data.stage || data.status) as string | null;

  const infoRows = [
    { icon: Mail,   value: data.email as string | null },
    { icon: Phone,  value: data.phone as string | null },
    { icon: MapPin, value: data.country_of_residence as string | null },
    { icon: Target, value: null as string | null }, // visa resolved separately
  ].filter(r => r.value);

  return (
    <div className="space-y-4">
      {/* Member header */}
      <div className="bg-slate-50 rounded-md p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
            {fullName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold">{fullName}</p>
            {stage && (
              <p className="text-[10px] text-muted-foreground capitalize">{stage.replace(/_/g, " ")}</p>
            )}
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div className="space-y-1.5">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Contact</p>
        {infoRows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No contact details on record.</p>
        ) : (
          infoRows.map((r, i) => {
            const Icon = r.icon;
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Icon className="w-3 h-3 text-muted-foreground" />
                <span>{r.value}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Key fields */}
      {(data.nationality || data.country_of_interest || data.source_code) && (
        <div className="space-y-1 text-xs">
          {data.nationality && <div className="flex justify-between"><span className="text-muted-foreground">Nationality</span><span>{data.nationality as string}</span></div>}
          {data.country_of_interest && <div className="flex justify-between"><span className="text-muted-foreground">Destination</span><span>{data.country_of_interest as string}</span></div>}
          {data.source_code && <div className="flex justify-between"><span className="text-muted-foreground">Source</span><span>{data.source_code as string}</span></div>}
        </div>
      )}

      {data.notes && (
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Notes</p>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{data.notes as string}</p>
        </div>
      )}

      <div className="border-t pt-3">
        <Button variant="outline" size="sm" className="w-full" onClick={onNavigateOut}>
          <ExternalLink className="w-3 h-3 mr-1" /> Open full profile
        </Button>
      </div>
    </div>
  );
}

function ApplicationDetail({ caseId, onNavigateOut }: { caseId: string; onNavigateOut: () => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Case {caseId}</p>
      <Button variant="outline" size="sm" className="w-full" onClick={onNavigateOut}>
        <ExternalLink className="w-3 h-3 mr-1" /> Open as full page
      </Button>
    </div>
  );
}
