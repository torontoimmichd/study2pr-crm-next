"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { writeAudit } from "@/lib/audit";
import { fmtDateIST } from "@/lib/format";

interface Hours {
  weekday: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
  timezone: string;
}

interface Holiday {
  date: string;
  label: string;
  country: string;
}

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AdminOfficeHours() {
  const qc = useQueryClient();

  const { data: hoursData } = useQuery({
    queryKey: ["admin-office-hours"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("office_hours_config")
        .select("weekday, open_time, close_time, is_closed, timezone")
        .order("weekday");
      if (error) throw error;
      return (data ?? []) as Hours[];
    },
  });

  const { data: holidays } = useQuery({
    queryKey: ["admin-holidays"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("office_holidays")
        .select("date, label, country")
        .order("date");
      if (error) throw error;
      return (data ?? []) as Holiday[];
    },
  });

  const [draft, setDraft] = useState<Record<number, Hours>>({});
  const [tz, setTz] = useState("America/Toronto");

  useEffect(() => {
    if (hoursData) {
      const map: Record<number, Hours> = {};
      const ordered: Hours[] = [];
      for (let w = 0; w < 7; w++) {
        const found = hoursData.find((h) => h.weekday === w);
        const row: Hours = found ?? { weekday: w, open_time: "09:00", close_time: "17:00", is_closed: false, timezone: "America/Toronto" };
        map[w] = row;
        ordered.push(row);
      }
      setDraft(map);
      if (ordered[1]?.timezone) setTz(ordered[1].timezone);
    }
  }, [hoursData]);

  const updateRow = (w: number, patch: Partial<Hours>) => {
    setDraft((prev) => ({ ...prev, [w]: { ...prev[w], ...patch } }));
  };

  const handleSave = async () => {
    const rows = Object.values(draft).map((r) => ({
      weekday: r.weekday,
      open_time: r.is_closed ? null : r.open_time || null,
      close_time: r.is_closed ? null : r.close_time || null,
      is_closed: r.is_closed,
      timezone: tz,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("office_hours_config").upsert(rows, { onConflict: "weekday" });
    if (error) {
      toast.error("Save failed: " + error.message);
      return;
    }
    await writeAudit({ action: "UPDATE", entity_type: "office_hours_config", entity_id: "all", changes: { timezone: tz, weekdays: rows.length } });
    toast.success("Office hours saved");
    qc.invalidateQueries({ queryKey: ["admin-office-hours"] });
  };

  // Holiday add/delete
  const [newDate, setNewDate] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newCountry, setNewCountry] = useState("CA");
  const [deletingHoliday, setDeletingHoliday] = useState<Holiday | null>(null);

  const addHoliday = async () => {
    if (!newDate || !newLabel.trim()) {
      toast.error("Date and label required");
      return;
    }
    const payload = { date: newDate, label: newLabel.trim(), country: newCountry };
    const { error } = await supabase.from("office_holidays").insert(payload);
    if (error) {
      toast.error("Add failed: " + error.message);
      return;
    }
    await writeAudit({ action: "CREATE", entity_type: "office_holidays", entity_id: newDate, changes: payload });
    setNewDate("");
    setNewLabel("");
    qc.invalidateQueries({ queryKey: ["admin-holidays"] });
    toast.success("Holiday added");
  };

  const deleteHoliday = async () => {
    if (!deletingHoliday) return;
    const { error } = await supabase.from("office_holidays").delete().eq("date", deletingHoliday.date);
    if (error) {
      toast.error("Delete failed: " + error.message);
      return;
    }
    await writeAudit({ action: "DELETE", entity_type: "office_holidays", entity_id: deletingHoliday.date, changes: { label: deletingHoliday.label } });
    qc.invalidateQueries({ queryKey: ["admin-holidays"] });
    setDeletingHoliday(null);
    toast.success("Holiday removed");
  };

  return (
    <>
      <AdminPageHeader
        title="Office Hours"
        subtitle="SLA timers only run while the office is open. Edits here propagate to every SLA rule that respects office hours."
        actions={
          <Button size="sm" onClick={() => void handleSave()}>
            <Save className="h-4 w-4" /> Save Hours
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        <section className="card-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-base text-navy">Weekly Schedule</h3>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Timezone</Label>
              <Input value={tz} onChange={(e) => setTz(e.target.value)} className="h-8 w-44 text-sm" />
            </div>
          </div>
          <div className="space-y-2">
            {WEEKDAY_LABELS.map((label, w) => {
              const row = draft[w];
              if (!row) return null;
              return (
                <div
                  key={w}
                  className="grid grid-cols-[140px_1fr_1fr_120px] gap-3 items-center px-3 py-2 rounded-md border border-border bg-card/50"
                >
                  <div className="font-medium text-sm">{label}</div>
                  <div>
                    <Input
                      type="time"
                      value={row.open_time ?? ""}
                      onChange={(e) => updateRow(w, { open_time: e.target.value })}
                      disabled={row.is_closed}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Input
                      type="time"
                      value={row.close_time ?? ""}
                      onChange={(e) => updateRow(w, { close_time: e.target.value })}
                      disabled={row.is_closed}
                      className="h-9"
                    />
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <Switch
                      id={`closed-${w}`}
                      checked={row.is_closed}
                      onCheckedChange={(c) => updateRow(w, { is_closed: c })}
                    />
                    <Label htmlFor={`closed-${w}`} className="text-xs cursor-pointer">
                      Closed
                    </Label>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card-surface">
          <header className="px-5 py-3 border-b border-border">
            <h3 className="font-display text-base text-navy">Public Holidays</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Days the office is closed regardless of weekday hours.
            </p>
          </header>

          <div className="p-4 grid grid-cols-[160px_1fr_100px_auto] gap-2 items-end border-b border-border">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Label</Label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Diwali" className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Country</Label>
              <Input value={newCountry} onChange={(e) => setNewCountry(e.target.value.toUpperCase())} maxLength={2} className="h-9" />
            </div>
            <Button size="sm" variant="outline" onClick={() => void addHoliday()}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Date</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="w-[80px]">Country</TableHead>
                <TableHead className="w-[80px] text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!holidays || holidays.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                    No holidays configured.
                  </TableCell>
                </TableRow>
              ) : (
                holidays.map((h) => (
                  <TableRow key={h.date}>
                    <TableCell>{fmtDateIST(h.date, "EEE, dd MMM yyyy")}</TableCell>
                    <TableCell className="font-medium">{h.label}</TableCell>
                    <TableCell className="text-xs">{h.country}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeletingHoliday(h)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>
      </div>

      <ConfirmDialog
        open={!!deletingHoliday}
        onOpenChange={(o) => !o && setDeletingHoliday(null)}
        title={`Remove ${deletingHoliday?.label}?`}
        description="The office will treat this date as a normal working day going forward."
        confirmLabel="Remove"
        destructive
        onConfirm={deleteHoliday}
      />
    </>
  );
}
