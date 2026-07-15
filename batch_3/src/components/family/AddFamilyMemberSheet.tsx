"use client";

// src/components/family/AddFamilyMemberSheet.tsx
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FamilyMemberSearchInput } from "./FamilyMemberSearchInput";
import type { Lead, FamilyMember } from "@/lib/types";

type FamilyRole = "spouse" | "parent" | "child" | "sibling";

const VISA_DEFAULTS: Record<FamilyRole, string> = {
  spouse: "SOWP",
  parent: "Super Visa",
  child: "Visitor Visa",
  sibling: "Visitor Visa",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLead: Lead;
  familyUnitId: string | null;
  onAdded: (newMember: FamilyMember) => void;
}

export function AddFamilyMemberSheet({
  open, onOpenChange, currentLead, familyUnitId, onAdded
}: Props) {
  const [tab, setTab] = useState<"link" | "create">("link");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[480px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Add to family unit</SheetTitle>
          <SheetDescription>
            Link an existing lead/client or create a new family member.
          </SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={v => setTab(v as "link" | "create")} className="flex-1 flex flex-col mt-4">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="link">Link existing</TabsTrigger>
            <TabsTrigger value="create">Create new</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="flex-1 mt-4 overflow-y-auto">
            <LinkExistingTab
              currentLead={currentLead}
              familyUnitId={familyUnitId}
              onAdded={onAdded}
            />
          </TabsContent>

          <TabsContent value="create" className="flex-1 mt-4 overflow-y-auto">
            <CreateNewTab
              currentLead={currentLead}
              familyUnitId={familyUnitId}
              onAdded={onAdded}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function LinkExistingTab({
  currentLead, familyUnitId, onAdded
}: { currentLead: Lead; familyUnitId: string | null; onAdded: (m: FamilyMember) => void }) {
  const [role, setRole] = useState<FamilyRole>("spouse");
  const [linking, setLinking] = useState<string | null>(null);

  async function link(personId: string, personType: "lead" | "client", fullName: string) {
    setLinking(personId);
    try {
      let unitId = familyUnitId;
      if (!unitId) {
        // Create a family unit if one doesn't exist
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).rpc("ensure_family_unit", { p_lead_id: currentLead.id });
        if (error) {
          // Fallback: create a family unit directly
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: fu, error: fuErr } = await (supabase as any)
            .from("family_units")
            .insert({
              organization_id: currentLead.organization_id,
              unit_name: (currentLead.full_name || currentLead.first_name || "Family") + " Unit",
              origin_country: currentLead.country_of_residence || currentLead.country || null,
            })
            .select("id")
            .single();
          if (fuErr) throw fuErr;
          unitId = fu.id;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("leads").update({ family_unit_id: unitId, family_role: "primary" }).eq("id", currentLead.id);
        } else {
          unitId = data as string;
        }
      }

      const table = personType === "lead" ? "leads" : "clients";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from(table)
        .update({ family_unit_id: unitId, family_role: role })
        .eq("id", personId);
      if (error) throw error;

      onAdded({
        id: personId,
        lead_id: personType === "lead" ? personId : null,
        client_id: personType === "client" ? personId : null,
        full_name: fullName,
        family_role: role,
        primary_application: null,
        expected_revenue_cad: null,
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to link family member.");
    } finally {
      setLinking(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label className="text-xs whitespace-nowrap">Add as</Label>
        <Select value={role} onValueChange={v => setRole(v as FamilyRole)}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="spouse">Spouse</SelectItem>
            <SelectItem value="parent">Parent</SelectItem>
            <SelectItem value="child">Child</SelectItem>
            <SelectItem value="sibling">Sibling</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <FamilyMemberSearchInput
        organizationId={currentLead.organization_id || ""}
        excludeId={currentLead.id}
        renderRow={(person) => (
          <div className="flex items-center gap-2 py-2 px-1 border-b last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{person.full_name}</p>
              <p className="text-[10px] text-muted-foreground">
                {person.type} · {person.phone || person.email || "—"}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={linking === person.id}
              onClick={() => link(person.id, person.type, person.full_name)}
            >
              {linking === person.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Link"}
            </Button>
          </div>
        )}
      />
    </div>
  );
}

function CreateNewTab({
  currentLead, familyUnitId, onAdded
}: { currentLead: Lead; familyUnitId: string | null; onAdded: (m: FamilyMember) => void }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<FamilyRole>("spouse");
  const [visa, setVisa] = useState<string>(VISA_DEFAULTS.spouse);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function changeRole(r: FamilyRole) {
    setRole(r);
    setVisa(VISA_DEFAULTS[r]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    setBusy(true);
    try {
      let unitId = familyUnitId;
      if (!unitId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).rpc("ensure_family_unit", { p_lead_id: currentLead.id });
        if (error) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: fu, error: fuErr } = await (supabase as any)
            .from("family_units")
            .insert({
              organization_id: currentLead.organization_id,
              unit_name: (currentLead.full_name || "Family") + " Unit",
              origin_country: currentLead.country_of_residence || currentLead.country || null,
            })
            .select("id")
            .single();
          if (fuErr) throw fuErr;
          unitId = fu.id;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("leads").update({ family_unit_id: unitId, family_role: "primary" }).eq("id", currentLead.id);
        } else {
          unitId = data as string;
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("leads")
        .insert({
          organization_id: currentLead.organization_id,
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          country_of_residence: currentLead.country_of_residence || currentLead.country || null,
          lifecycle_state: "new_enquiry",
          family_unit_id: unitId,
          family_role: role,
          notes: note.trim() || null,
        })
        .select("id, full_name, family_role")
        .single();
      if (error) throw error;

      onAdded({
        id: data.id,
        lead_id: data.id,
        client_id: null,
        full_name: data.full_name,
        family_role: data.family_role,
        primary_application: visa || null,
        expected_revenue_cad: null,
      });
      toast.success(`Created ${data.full_name} and added to family unit`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to create family member.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label htmlFor="fn" className="text-xs">Full name *</Label>
        <Input id="fn" value={fullName} onChange={e => setFullName(e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="ph" className="text-xs">Phone</Label>
          <Input id="ph" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91..." />
        </div>
        <div>
          <Label htmlFor="em" className="text-xs">Email</Label>
          <Input id="em" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Family role *</Label>
          <Select value={role} onValueChange={v => changeRole(v as FamilyRole)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="spouse">Spouse</SelectItem>
              <SelectItem value="parent">Parent</SelectItem>
              <SelectItem value="child">Child</SelectItem>
              <SelectItem value="sibling">Sibling</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Visa interest</Label>
          <Select value={visa} onValueChange={setVisa}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Study Permit">Study Permit</SelectItem>
              <SelectItem value="SOWP">SOWP</SelectItem>
              <SelectItem value="Super Visa">Super Visa</SelectItem>
              <SelectItem value="Visitor Visa">Visitor Visa</SelectItem>
              <SelectItem value="Work Permit">Work Permit</SelectItem>
              <SelectItem value="PR">PR</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="note" className="text-xs">Relationship note</Label>
        <Textarea id="note" rows={2} value={note} onChange={e => setNote(e.target.value)}
          placeholder="e.g. Spouse currently in master's program at SAIT" />
      </div>

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Create &amp; link
      </Button>
    </form>
  );
}
