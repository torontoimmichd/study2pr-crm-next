"use client";

/**
 * InvoiceViewDialog.tsx
 * Full invoice view with professional layout + browser Print → PDF support.
 * Triggered from the row action in CaseInvoicesTab.
 */

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, X, Building2, Phone, Mail, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fmtDateIST } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const STATUS_STYLES: Record<string, string> = {
  draft:   "bg-muted text-muted-foreground",
  issued:  "bg-blue-100 text-blue-800",
  partial: "bg-amber-100 text-amber-800",
  paid:    "bg-emerald-100 text-emerald-800",
  overdue: "bg-red-100 text-red-800",
  void:    "bg-gray-100 text-gray-500",
};

interface InvoiceData {
  id: string;
  invoice_number: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  paid_total: number | null;
  status: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  line_items: Array<{ description: string; amount: number }>;
  client: {
    full_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  case: {
    case_ref: string;
    visa_type?: { label: string } | null;
  } | null;
}

export function InvoiceViewDialog({ invoiceId, open, onOpenChange }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice-view", invoiceId],
    enabled: !!invoiceId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          id, invoice_number, currency, subtotal, tax, total, paid_total,
          status, due_date, notes, created_at, line_items,
          client:clients(full_name, email, phone, address),
          case:cases(case_ref, visa_type:visa_sub_types(label))
        `)
        .eq("id", invoiceId!)
        .single();
      if (error) throw error;
      return data as unknown as InvoiceData;
    },
  });

  const handlePrint = () => {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Invoice ${invoice?.invoice_number ?? ""}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: white; padding: 40px; }
            .invoice-wrap { max-width: 720px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #1a1a2e; padding-bottom: 24px; }
            .brand { display: flex; align-items: center; gap: 12px; }
            .brand-logo { width: 44px; height: 44px; background: #c9a227; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 18px; }
            .brand-name { font-size: 22px; font-weight: 700; color: #1a1a2e; letter-spacing: -0.5px; }
            .brand-sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
            .invoice-title { text-align: right; }
            .invoice-title h1 { font-size: 28px; font-weight: 800; color: #c9a227; letter-spacing: -1px; }
            .invoice-title .number { font-size: 13px; color: #6b7280; margin-top: 4px; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
            .meta-section h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 8px; }
            .meta-section p { font-size: 13px; line-height: 1.6; color: #374151; }
            .meta-section .name { font-size: 15px; font-weight: 600; color: #1a1a2e; }
            .status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 6px; }
            .status-paid { background: #d1fae5; color: #065f46; }
            .status-issued { background: #dbeafe; color: #1e40af; }
            .status-overdue { background: #fee2e2; color: #991b1b; }
            .status-partial { background: #fef3c7; color: #92400e; }
            .status-draft { background: #f3f4f6; color: #6b7280; }
            .dates { display: flex; gap: 32px; margin-bottom: 32px; }
            .date-item { }
            .date-item label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; display: block; margin-bottom: 4px; }
            .date-item span { font-size: 13px; font-weight: 500; color: #1a1a2e; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            thead { background: #1a1a2e; color: white; }
            thead th { padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
            thead th:last-child { text-align: right; }
            tbody tr { border-bottom: 1px solid #e5e7eb; }
            tbody tr:last-child { border-bottom: none; }
            tbody td { padding: 12px 14px; font-size: 13px; color: #374151; }
            tbody td:last-child { text-align: right; font-weight: 500; }
            .totals { margin-left: auto; width: 280px; }
            .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #374151; }
            .totals-row.total { font-size: 16px; font-weight: 700; color: #1a1a2e; border-top: 2px solid #1a1a2e; padding-top: 12px; margin-top: 4px; }
            .totals-row.paid { color: #059669; }
            .totals-row.due { color: #dc2626; font-weight: 600; }
            .notes { margin-top: 32px; padding: 16px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #c9a227; }
            .notes h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 8px; }
            .notes p { font-size: 13px; color: #374151; line-height: 1.6; }
            .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 11px; line-height: 1.8; }
            .footer strong { color: #1a1a2e; }
            @media print {
              body { padding: 0; }
              .invoice-wrap { max-width: none; }
            }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const balance = invoice ? (invoice.total - (invoice.paid_total ?? 0)) : 0;
  const statusKey = invoice?.status ?? "draft";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border sticky top-0 bg-background z-10">
          <span className="font-medium text-sm">
            Invoice {invoice?.invoice_number ?? "…"}
          </span>
          <div className="flex items-center gap-2">
            {invoice && (
              <Button size="sm" onClick={handlePrint} className="gap-1.5">
                <Printer className="h-4 w-4" />
                Print / PDF
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground animate-pulse">Loading invoice…</div>
        ) : !invoice ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Invoice not found.</div>
        ) : (
          /* Printable area */
          <div ref={printRef} className="invoice-wrap p-8 bg-white text-gray-800">
            {/* Header */}
            <div className="header flex justify-between items-start mb-10 pb-6 border-b-2 border-gray-900">
              <div className="brand flex items-center gap-3">
                <div className="brand-logo w-11 h-11 bg-amber-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">S</div>
                <div>
                  <div className="brand-name text-xl font-bold text-gray-900">Study2PR</div>
                  <div className="brand-sub text-xs text-gray-500">Immigration Consulting Services</div>
                </div>
              </div>
              <div className="invoice-title text-right">
                <h1 className="text-4xl font-extrabold text-amber-500 tracking-tight">INVOICE</h1>
                <div className="text-sm text-gray-500 mt-1">{invoice.invoice_number}</div>
                <span className={cn("inline-block mt-2 text-[11px] font-semibold uppercase tracking-wide px-3 py-1 rounded-full", STATUS_STYLES[statusKey])}>
                  {statusKey}
                </span>
              </div>
            </div>

            {/* Bill To + Company Info */}
            <div className="meta-grid grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Bill To</h3>
                <div className="text-base font-semibold text-gray-900">{invoice.client?.full_name ?? "—"}</div>
                {invoice.client?.email && <div className="text-sm text-gray-600 flex items-center gap-1.5 mt-1"><Mail className="h-3.5 w-3.5" />{invoice.client.email}</div>}
                {invoice.client?.phone && <div className="text-sm text-gray-600 flex items-center gap-1.5 mt-0.5"><Phone className="h-3.5 w-3.5" />{invoice.client.phone}</div>}
                {invoice.client?.address && <div className="text-sm text-gray-500 mt-1">{invoice.client.address}</div>}
                {invoice.case && (
                  <div className="text-sm text-gray-500 mt-2">
                    Case: <span className="font-mono font-medium text-gray-700">{invoice.case.case_ref}</span>
                    {invoice.case.visa_type?.label && <span className="ml-1 text-gray-400">({invoice.case.visa_type.label})</span>}
                  </div>
                )}
              </div>
              <div className="text-right">
                <h3 className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">From</h3>
                <div className="text-base font-semibold text-gray-900">Study2PR Immigration</div>
                <div className="text-sm text-gray-600 flex items-center justify-end gap-1.5 mt-1"><Globe className="h-3.5 w-3.5" />study2pr.in</div>
                <div className="text-sm text-gray-600 flex items-center justify-end gap-1.5 mt-0.5"><Mail className="h-3.5 w-3.5" />info@study2pr.in</div>
                <div className="text-sm text-gray-600 flex items-center justify-end gap-1.5 mt-0.5"><Building2 className="h-3.5 w-3.5" />Toronto, Canada</div>
              </div>
            </div>

            {/* Dates */}
            <div className="dates flex gap-8 mb-8">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-gray-400 block mb-1">Issue Date</label>
                <span className="text-sm font-medium">{fmtDateIST(invoice.created_at)}</span>
              </div>
              {invoice.due_date && (
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-gray-400 block mb-1">Due Date</label>
                  <span className="text-sm font-medium">{fmtDateIST(invoice.due_date)}</span>
                </div>
              )}
            </div>

            {/* Line items */}
            <table className="w-full text-sm border-collapse mb-6">
              <thead className="bg-gray-900 text-white">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider">Description</th>
                  <th className="text-right px-4 py-3 text-[11px] uppercase tracking-wider">Amount ({invoice.currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(Array.isArray(invoice.line_items) ? invoice.line_items : []).map((li, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3 text-gray-700">{li.description}</td>
                    <td className="px-4 py-3 text-right font-medium">{Number(li.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-72 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span>
                  <span>{invoice.currency} {Number(invoice.subtotal ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                {Number(invoice.tax ?? 0) > 0 && (
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>GST / Tax</span>
                    <span>{invoice.currency} {Number(invoice.tax).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-gray-900 border-t-2 border-gray-900 pt-2 mt-1">
                  <span>Total</span>
                  <span>{invoice.currency} {Number(invoice.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                {Number(invoice.paid_total ?? 0) > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600 font-medium">
                    <span>Amount Paid</span>
                    <span>− {invoice.currency} {Number(invoice.paid_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {balance > 0 && (
                  <div className="flex justify-between text-sm text-red-600 font-semibold">
                    <span>Balance Due</span>
                    <span>{invoice.currency} {balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="notes mt-8 p-4 bg-gray-50 rounded-lg border-l-4 border-amber-500">
                <h4 className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Notes</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{invoice.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="footer mt-12 pt-6 border-t border-gray-200 text-center text-xs text-gray-400 leading-relaxed">
              <p>Thank you for choosing <strong className="text-gray-700">Study2PR Immigration</strong>. This is a computer-generated invoice.</p>
              <p className="mt-1">For queries, contact <strong>info@study2pr.in</strong> · study2pr.in</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
