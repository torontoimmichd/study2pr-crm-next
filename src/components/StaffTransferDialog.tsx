"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Briefcase, CheckCircle2, Loader2, UserRoundCheck, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { writeAudit } from "@/lib/audit";
import { writeTimeline } from "@/lib/timeline";
import { cn } from "@/lib/utils";

type TransferType = "leads" | "applications";

interface TransferRecord {
  id: string;
  title: string;
  subtitle: string | null;
  assignedId: string | null;
  clientId?: string | null;
  leadId?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: TransferType;
  defaultFromStaffId?: string | null;
  defaultRecordId?: string | null;
  onTransferred?: () => void;
}

const NONE = "__none__";

export function StaffTransferDialog({
  open,
  onOpenChange,
  defaultType = "leads",
  defaultFromStaffId = null,
  defaultRecordId = null,
  onTransferred,
}: Props) {
  const qc = useQueryClient();
  const [type, setType] = useState<TransferType>(defaultType);
  const [fromStaffId, setFromStaffId] = useState(defaultFromStaffId ?? "");
  const [toStaffId, setToStaffId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultRecordId ? [defaultRecordId] : []);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setFromStaffId(defaultFromStaffId ?? "");
    setToStaffId("");
    setSelectedIds(defaultRecordId ? [defaultRecordId] : []);
  }, [defaultFromStaffId, defaultRecordId, defaultType, open]);

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-transfer-active"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_profiles")
        .select("id, full_name, role, is_active")
        .order("is_active", { ascending: false })
        .order("full_name");
      return (data ?? []) as { id: string; full_name: string; role: string; is_active: boolean | null }[];
    },
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["staff-transfer-records", type, fromStaffId, defaultRecordId],
    enabled: open && (!!fromStaffId || !!defaultRecordId),
    queryFn: async () => {
      if (type === "leads") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = (supabase as any)
          .from("leads")
          .select("id, full_name, phone, email, lifecycle_state, assigned_to, updated_at")
          .neq("lifecycle_state", "converted")
          .order("updated_at", { ascending: false })
          .limit(300);
        if (defaultRecordId) q = q.eq("id", defaultRecordId);
        else if (fromStaffId === NONE) q = q.is("assigned_to", null);
        else q = q.eq("assigned_to", fromStaffId);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as Array<{
        id: string;
        full_name: string;
        phone: string | null;
        email: string | null;
        lifecycle_state: string | null;
        assigned_to: string | null;
      }>).map((lead): TransferRecord => ({
        id: lead.id,
        title: lead.full_name,
        subtitle: [lead.lifecycle_state?.replace(/_/g, " "), lead.phone, lead.email].filter(Boolean).join(" | ") || null,
        assignedId: lead.assigned_to,
          leadId: lead.id,
        }));
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from("cases")
        .select("id, case_code, application_number, current_stage_code, case_manager_id, client_id, client:client_id(full_name), visa:visa_type_id(label), updated_at")
        .order("updated_at", { ascending: false })
        .limit(300);
      if (defaultRecordId) q = q.eq("id", defaultRecordId);
      else if (fromStaffId === NONE) q = q.is("case_manager_id", null);
      else q = q.eq("case_manager_id", fromStaffId);
      const { data, error } = await q;
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data ?? []) as any[]).map((app): TransferRecord => ({
        id: app.id,
        title: app.case_code || app.application_number || app.id.slice(0, 8),
        subtitle: [app.client?.full_name, app.visa?.label, app.current_stage_code?.replace(/_/g, " ")].filter(Boolean).join(" | ") || null,
        assignedId: app.case_manager_id ?? null,
        clientId: app.client_id ?? null,
      }));
    },
  });

  const selectedRecords = useMemo(
    () => records.filter((record) => selectedIds.includes(record.id)),
    [records, selectedIds],
  );
  const allSelected = records.length > 0 && selectedIds.length === records.length;

  const toggleRecord = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const transfer = async () => {
    if (!toStaffId) {
      toast.error("Choose who should receive the work");
      return;
    }
    if (selectedRecords.length === 0) {
      toast.error(`Select at least one ${type === "leads" ? "lead" : "application"}`);
      return;
    }
    setBusy(true);
    try {
      if (type === "leads") {
        const { error } = await supabase
          .from("leads")
          .update({ assigned_to: toStaffId })
          .in("id", selectedRecords.map((record) => record.id));
        if (error) throw error;
        for (const record of selectedRecords) {
          void writeAudit({
            action: "TRANSFER",
            entity_type: "leads",
            entity_id: record.id,
            changes: { from_staff_id: record.assignedId, to_staff_id: toStaffId },
          });
          void writeTimeline({
            event_type: "assignment_changed",
            title: `Lead transferred to ${staff.find((s) => s.id === toStaffId)?.full_name ?? "new owner"}`,
            lead_id: record.id,
            metadata: { from_staff_id: record.assignedId, to_staff_id: toStaffId },
          });
        }
        void qc.invalidateQueries({ queryKey: ["leads-list"] });
        void qc.invalidateQueries({ queryKey: ["leads-counts"] });
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("cases")
          .update({ case_manager_id: toStaffId })
          .in("id", selectedRecords.map((record) => record.id));
        if (error) throw error;
        for (const record of selectedRecords) {
          void writeAudit({
            action: "TRANSFER",
            entity_type: "cases",
            entity_id: record.id,
            changes: { from_staff_id: record.assignedId, to_staff_id: toStaffId },
          });
          void writeTimeline({
            event_type: "assignment_changed",
            title: `Application transferred to ${staff.find((s) => s.id === toStaffId)?.full_name ?? "new manager"}`,
            case_id: record.id,
            client_id: record.clientId ?? null,
            metadata: { from_staff_id: record.assignedId, to_staff_id: toStaffId },
          });
        }
        void qc.invalidateQueries({ queryKey: ["cases-all"] });
        void qc.invalidateQueries({ queryKey: ["applications-page"] });
      }

      toast.success(`${selectedRecords.length} ${type === "leads" ? "lead" : "application"}${selectedRecords.length === 1 ? "" : "s"} transferred`);
      onTransferred?.();
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message ?? "Transfer failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !busy && onOpenChange(value)}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b bg-gradient-to-r from-sky-50 via-white to-amber-50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="font-display text-navy">Transfer Work</DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Move one item, selected items, or everything from someone who is on leave.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4">
          <Tabs value={type} onValueChange={(value) => {
            setType(value as TransferType);
            setSelectedIds([]);
          }}>
            <TabsList className="grid grid-cols-2 w-full bg-slate-100">
              <TabsTrigger value="leads" className="gap-2">
                <UsersRound className="h-3.5 w-3.5" /> Leads
              </TabsTrigger>
              <TabsTrigger value="applications" className="gap-2">
                <Briefcase className="h-3.5 w-3.5" /> Applications
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Transfer from</Label>
              <Select value={fromStaffId} onValueChange={(value) => {
                setFromStaffId(value);
                setSelectedIds([]);
              }} disabled={!!defaultRecordId}>
                <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Unassigned</SelectItem>
                  {staff.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.full_name}{person.is_active === false ? " (inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="hidden sm:flex h-10 items-center justify-center text-muted-foreground">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div className="space-y-1.5">
              <Label>Transfer to</Label>
              <Select value={toStaffId} onValueChange={setToStaffId}>
                <SelectTrigger><SelectValue placeholder="New owner / manager" /></SelectTrigger>
                <SelectContent>
                  {staff.filter((person) => person.is_active !== false).map((person) => (
                    <SelectItem key={person.id} value={person.id}>{person.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="px-3 py-2 border-b bg-slate-50 flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs font-medium">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => setSelectedIds(checked ? records.map((record) => record.id) : [])}
                  disabled={records.length === 0}
                />
                Select all visible
              </label>
              <span className="text-xs text-muted-foreground">
                {selectedIds.length} of {records.length} selected
              </span>
            </div>

            <ScrollArea className="h-72">
              {isLoading ? (
                <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading work...
                </div>
              ) : records.length === 0 ? (
                <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
                  No {type === "leads" ? "leads" : "applications"} found for this selection.
                </div>
              ) : (
                <div className="divide-y">
                  {records.map((record) => {
                    const checked = selectedIds.includes(record.id);
                    return (
                      <div
                        key={record.id}
                        onClick={() => toggleRecord(record.id)}
                        className={cn(
                          "w-full px-3 py-3 text-left flex items-start gap-3 hover:bg-sky-50/80 transition-colors cursor-pointer",
                          checked && "bg-primary/5",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onClick={(event) => event.stopPropagation()}
                          onCheckedChange={() => toggleRecord(record.id)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{record.title}</p>
                          {record.subtitle && <p className="text-xs text-muted-foreground truncate mt-0.5">{record.subtitle}</p>}
                        </div>
                        {checked && <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-slate-50">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button type="button" onClick={() => void transfer()} disabled={busy || selectedIds.length === 0 || !toStaffId}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserRoundCheck className="h-4 w-4 mr-2" />}
            Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
