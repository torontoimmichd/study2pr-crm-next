"use client";

import { useState, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { writeAudit } from "@/lib/audit";
import { writeTimeline } from "@/lib/timeline";
import { createPaymentFollowUpTasks } from "@/lib/taskEngine";
import { useAuth } from "@/lib/auth-context";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caseId: string;
  clientId: string;
  onCreated?: () => void;
}

interface Line { description: string; amount: string; }

export function GenerateInvoiceDialog({ open, onOpenChange, caseId, clientId, onCreated }: Props) {
  const { user, profile } = useAuth();
  const [lines, setLines] = useState<Line[]>([{ description: "Professional fees", amount: "" }]);
  const [currency, setCurrency] = useState("INR");
  const [taxPct, setTaxPct] = useState("18");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const subtotal = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const tax = subtotal * (Number(taxPct) || 0) / 100;
  const total = subtotal + tax;

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines(lines.map((l, i) => i === idx ? { ...l, ...patch } : l));
  };
  const addLine = () => setLines([...lines, { description: "", amount: "" }]);
  const removeLine = (idx: number) => setLines(lines.length > 1 ? lines.filter((_, i) => i !== idx) : lines);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = lines.filter(l => l.description.trim() && Number(l.amount) > 0);
    if (cleaned.length === 0) { toast.error("Add at least one line item"); return; }
    setBusy(true);

    const number = `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`;
    const insert = {
      client_id: clientId,
      case_id: caseId,
      invoice_number: number,
      currency,
      subtotal,
      tax,
      total,
      status: "issued",
      due_date: dueDate || null,
      notes: notes || null,
      line_items: cleaned.map(l => ({ description: l.description, amount: Number(l.amount) })) as never,
    };
    const { data, error } = await supabase.from("invoices").insert(insert).select("id").single();
    if (error) { setBusy(false); toast.error(error.message); return; }
    void writeAudit({ action: "CREATE", entity_type: "invoices", entity_id: data.id, changes: insert });
    void writeTimeline({
      event_type: "custom",
      title: `Invoice ${number} issued — ${currency} ${total.toFixed(2)}`,
      body: notes || null,
      case_id: caseId,
      is_system: false,
    });
    // Auto-create payment follow-up tasks
    void createPaymentFollowUpTasks(caseId, number, profile?.id ?? null, user?.id ?? null);

    setBusy(false);
    toast.success(`Invoice ${number} created`);
    setLines([{ description: "Professional fees", amount: "" }]);
    setDueDate(""); setNotes("");
    onCreated?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader><DialogTitle>Generate invoice</DialogTitle></DialogHeader>

          <div className="space-y-2">
            <Label>Line items</Label>
            <div className="space-y-2">
              {lines.map((l, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input value={l.description} onChange={(e) => updateLine(idx, { description: e.target.value })} placeholder="Description" />
                  </div>
                  <div className="w-32">
                    <Input type="number" step="0.01" value={l.amount} onChange={(e) => updateLine(idx, { amount: e.target.value })} placeholder="Amount" />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(idx)} disabled={lines.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="h-3.5 w-3.5 mr-1" />Add line</Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">INR</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tax %</Label>
              <Input type="number" step="0.01" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{currency} {subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax ({taxPct || 0}%)</span><span>{currency} {tax.toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold pt-1 border-t border-border"><span>Total</span><span>{currency} {total.toFixed(2)}</span></div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create invoice"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
