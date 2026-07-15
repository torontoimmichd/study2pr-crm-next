"use client";

// src/components/lead-detail/BasicInfoCard.tsx
// Editable sidebar card showing lead contact + visa details.
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Phone, MapPin, Target, Globe, Pencil, Check, X, User, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Lead } from "@/lib/types";

const COUNTRIES = [
  "India", "Canada", "USA", "United Kingdom", "New Zealand", "Australia",
  "Pakistan", "Bangladesh", "Sri Lanka", "Nepal", "Philippines", "China",
  "Indonesia", "Malaysia", "Vietnam", "Singapore", "Thailand", "UAE",
  "Saudi Arabia", "South Korea", "Iran", "Nigeria", "Kenya", "Ghana",
  "Egypt", "Ethiopia", "Mexico", "Brazil", "Germany", "France",
  "Jamaica", "Trinidad and Tobago", "Other",
];

const DESTINATION_COUNTRIES = [
  "Canada", "Australia", "United Kingdom", "United States", "Germany",
  "New Zealand", "Ireland", "France", "Netherlands", "Other",
];

interface EditState {
  email: string;
  phone: string;
  nationality: string;
  country_of_residence: string;
  country_of_interest: string;
}

export function BasicInfoCard({ lead, onUpdate }: { lead: Lead; onUpdate?: (patch: Record<string, unknown>) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<EditState>({
    email: (lead as unknown as Record<string, unknown>).email as string ?? "",
    phone: (lead as unknown as Record<string, unknown>).phone as string ?? "",
    nationality: (lead as unknown as Record<string, unknown>).nationality as string ?? "",
    country_of_residence: lead.country_of_residence ?? lead.country ?? "",
    country_of_interest: (lead as unknown as Record<string, unknown>).country_of_interest as string ?? lead.destination_country ?? "",
  });

  const raw = lead as unknown as Record<string, unknown>;
  const country = lead.country_of_residence ?? lead.country ?? null;
  const destCountry = (raw.country_of_interest as string | null) ?? lead.destination_country ?? null;
  const nationality = raw.nationality as string | null;

  const startEdit = () => {
    setDraft({
      email: (raw.email as string) ?? "",
      phone: (raw.phone as string) ?? "",
      nationality: (raw.nationality as string) ?? "",
      country_of_residence: country ?? "",
      country_of_interest: destCountry ?? "",
    });
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  const save = async () => {
    setSaving(true);
    const patch = {
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
      nationality: draft.nationality || null,
      country_of_residence: draft.country_of_residence || null,
      country_of_interest: draft.country_of_interest || null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("leads").update(patch).eq("id", lead.id);
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Contact info updated");
    onUpdate?.(patch);
    setEditing(false);
    setSaving(false);
  };

  if (editing) {
    return (
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Basic info</p>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={cancel} disabled={saving}>
              <X className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={save} disabled={saving}>
              <Check className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase">Email</Label>
            <Input className="h-7 text-xs" value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} placeholder="email@example.com" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase">Phone</Label>
            <Input className="h-7 text-xs" value={draft.phone} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))} placeholder="+91 98765 43210" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase">Nationality</Label>
            <Select value={draft.nationality} onValueChange={v => setDraft(d => ({ ...d, nationality: v }))}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase">Country of residence</Label>
            <Select value={draft.country_of_residence} onValueChange={v => setDraft(d => ({ ...d, country_of_residence: v }))}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase">Country of interest</Label>
            <Select value={draft.country_of_interest} onValueChange={v => setDraft(d => ({ ...d, country_of_interest: v }))}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>{DESTINATION_COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </Card>
    );
  }

  const rows = [
    { icon: Mail,  label: "Email",       value: (raw.email as string | null) || null },
    { icon: Phone, label: "Phone",       value: (raw.phone as string | null) || null },
    { icon: Flag,  label: "Nationality", value: nationality || null },
    { icon: MapPin,label: "Residence",   value: country || null },
    { icon: Globe, label: "Destination", value: destCountry ? `→ ${destCountry}` : null },
    { icon: Target,label: "Visa",        value: lead.visa_interest || null },
    { icon: User,  label: "Source",      value: lead.source || (raw.source_code as string | null) || null },
  ].filter(r => r.value !== null) as Array<{ icon: React.ComponentType<{ className?: string }>; label: string; value: string }>;

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Basic info</p>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={startEdit}>
          <Pencil className="w-3 h-3" />
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No info recorded. <button className="underline text-primary" onClick={startEdit}>Add details</button></p>
      ) : (
        <div className="space-y-1">
          {rows.map((r, i) => {
            const Icon = r.icon;
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="truncate text-foreground">{r.value}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
