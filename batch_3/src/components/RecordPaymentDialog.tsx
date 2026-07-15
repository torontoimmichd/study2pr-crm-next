"use client";

import { useState, FormEvent, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { writeAudit } from "@/lib/audit";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  caseId: string;
  clientId: string;
  onRecorded?: () => void;
}

interface InvoiceLite { id: string; invoice_number: string; total: number; currency: string; status: string | null; }

export function RecordPaymentDialog({ open, onOpenChange, caseId, clientId, onRecorded }: Props) {
  const [invoices, setInvoices] = useState<InvoiceLite[]>([]);
  const [invoiceId, setInvoiceId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [provider, setProvider] = useState("manual");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [creatingShellInvoice, setCreatingShellInvoice] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data } = await supabase.from("invoices").select("id, invoice_number, total, currency, status").eq("case_id", caseId).order("created_at", { ascending: false });
      setInvoices(data ?? []);
      if ((data ?? []).length > 0) setInvoiceId(data![0].id);
      else setInvoiceId("");
    })();
  }, [open, caseId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    setBusy(true);

    let useInvoiceId = invoiceId;

    // If no invoice exists, auto-create a shell invoice so the FK is satisfied.
    if (!useInvoiceId) {
      setCreatingShellInvoice(true);
      const number = `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`;
      const shell = {
        client_id: clientId,
        case_id: caseId,
        invoice_number: number,
        currency,
        subtotal: amt,
        tax: 0,
        total: amt,
        status: "paid",
        line_items: [{ description: "Auto-created from payment", amount: amt }] as never,
      };
      const { data, error } = await supabase.from("invoices").insert(shell).select("id").single();
      if (error) { setBusy(false); setCreatingShellInvoice(false); toast.error(error.message); return; }
      useInvoiceId = data.id;
      void writeAudit({ action: "CREATE", entity_type: "invoices", entity_id: data.id, changes: shell });
      setCreatingShellInvoice(false);
    }

    const insert = {
      invoice_id: useInvoiceId,
      amount: amt,
      currency,
      provider,
      provider_reference: reference || null,
      paid_at: new Date(paidAt).toISOString(),
      notes: notes || null,
      status: "succeeded",
    };
    const { data: pay, error } = await supabase.from("payments").insert(insert).select("id").single();
    if (error) { setBusy(false); toast.error(error.message); return; }
    void writeAudit({ action: "PAYMENT", entity_type: "payments", entity_id: pay.id, changes: insert });

    // bump invoice paid_total
    const inv = invoices.find(i => i.id === useInvoiceId);
    if (inv) {
      const { data: existing } = await supabase.from("invoices").select("paid_total, total").eq("id", useInvoiceId).single();
      const newPaid = Number(existing?.paid_total ?? 0) + amt;
      const newStatus = newPaid >= Number(existing?.total ?? 0) ? "paid" : "partial";
      await supabase.from("invoices").update({ paid_total: newPaid, status: newStatus }).eq("id", useInvoiceId);
    }

    setBusy(false);
    toast.success("Payment recorded");
    setAmount(""); setReference(""); setNotes("");
    onRecorded?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>

          <div className="space-y-2">
            <Label>Apply to invoice</Label>
            {invoices.length === 0 ? (
              <p className="text-xs text-muted-foreground">No invoices yet — a shell invoice will be auto-created.</p>
            ) : (
              <Select value={invoiceId} onValueChange={setInvoiceId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {invoices.map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.invoice_number} · {i.currency} {i.total} · {i.status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual / Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="razorpay">Razorpay</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Txn ID / cheque #" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Paid at</Label>
            <Input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? (creatingShellInvoice ? "Creating invoice…" : "Saving…") : "Record payment"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
