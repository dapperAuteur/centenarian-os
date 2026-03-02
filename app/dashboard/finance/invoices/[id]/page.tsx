'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, FileText, Clock, CheckCircle2, AlertTriangle, X,
  ArrowDownLeft, ArrowUpRight, Calendar, DollarSign, Copy,
  Bookmark, Trash2, Loader2, Send, CreditCard, Undo2,
} from 'lucide-react';
import Link from 'next/link';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import ActivityLinker from '@/components/ui/ActivityLinker';
import LifeCategoryTagger from '@/components/ui/LifeCategoryTagger';
import InvoiceTemplateModal from '@/components/finance/InvoiceTemplateModal';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
}

interface Invoice {
  id: string;
  direction: 'receivable' | 'payable';
  status: string;
  contact_name: string;
  contact_id: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  invoice_date: string;
  due_date: string | null;
  paid_date: string | null;
  invoice_number: string | null;
  account_id: string | null;
  brand_id: string | null;
  category_id: string | null;
  transaction_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  invoice_items: InvoiceItem[];
  budget_categories: { id: string; name: string; color: string } | null;
}

interface LinkedTransaction {
  id: string;
  amount: number;
  transaction_date: string;
  description: string;
}

const STATUS_BADGE: Record<string, { bg: string; text: string; Icon: typeof Clock }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', Icon: FileText },
  sent: { bg: 'bg-blue-100', text: 'text-blue-700', Icon: Clock },
  paid: { bg: 'bg-green-100', text: 'text-green-700', Icon: CheckCircle2 },
  overdue: { bg: 'bg-red-100', text: 'text-red-700', Icon: AlertTriangle },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', Icon: X },
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtCurrency(n: number) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [linkedTx, setLinkedTx] = useState<LinkedTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await offlineFetch(`/api/finance/invoices/${id}`);
      if (res.ok) {
        const data = await res.json();
        setInvoice(data.invoice || null);
        setLinkedTx(data.linked_transaction || null);
      }
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (action: string, body: Record<string, unknown> = {}) => {
    setActionLoading(action);
    try {
      const res = await offlineFetch(`/api/finance/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) load();
      else {
        const err = await res.json();
        alert(err.error || 'Action failed');
      }
    } finally { setActionLoading(null); }
  };

  const handleDuplicate = async () => {
    setActionLoading('duplicate');
    try {
      const res = await offlineFetch(`/api/finance/invoices/${id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        router.push(`/dashboard/finance/invoices/${data.id}`);
      } else {
        const err = await res.json();
        alert(err.error || 'Duplicate failed');
      }
    } finally { setActionLoading(null); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this invoice? This cannot be undone.')) return;
    setActionLoading('delete');
    try {
      const res = await offlineFetch(`/api/finance/invoices/${id}`, { method: 'DELETE' });
      if (res.ok) router.push('/dashboard/finance/invoices');
      else {
        const err = await res.json();
        alert(err.error || 'Delete failed');
      }
    } finally { setActionLoading(null); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin h-8 w-8 text-fuchsia-600" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center text-gray-400">
        <p>Invoice not found.</p>
        <Link href="/dashboard/finance/invoices" className="text-fuchsia-600 hover:underline mt-2 inline-block">Back to invoices</Link>
      </div>
    );
  }

  const badge = STATUS_BADGE[invoice.status] || STATUS_BADGE.draft;
  const StatusIcon = badge.Icon;
  const balanceDue = invoice.total - invoice.amount_paid;
  const isReceivable = invoice.direction === 'receivable';

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/finance/invoices" className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                <StatusIcon className="w-3 h-3" />
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isReceivable ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                {isReceivable ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                {isReceivable ? 'Receivable' : 'Payable'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {invoice.invoice_number ? `Invoice ${invoice.invoice_number}` : 'Invoice'}
            </h1>
            <p className="text-gray-500 text-sm">{invoice.contact_name}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-gray-900">{fmtCurrency(invoice.total)}</div>
          {balanceDue > 0 && invoice.status !== 'paid' && (
            <div className="text-sm text-red-600 font-medium">Balance due: {fmtCurrency(balanceDue)}</div>
          )}
        </div>
      </div>

      {/* Details Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400 text-xs block">Invoice Date</span>
            <span className="text-gray-900 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {fmtDate(invoice.invoice_date)}
            </span>
          </div>
          <div>
            <span className="text-gray-400 text-xs block">Due Date</span>
            <span className="text-gray-900 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {fmtDate(invoice.due_date)}
            </span>
          </div>
          {invoice.paid_date && (
            <div>
              <span className="text-gray-400 text-xs block">Paid Date</span>
              <span className="text-green-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {fmtDate(invoice.paid_date)}
              </span>
            </div>
          )}
        </div>

        {invoice.budget_categories && (
          <div className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: invoice.budget_categories.color }} />
            <span className="text-gray-600">{invoice.budget_categories.name}</span>
          </div>
        )}

        {invoice.notes && (
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            {invoice.notes}
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Line Items</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-3 text-left">Description</th>
              <th className="px-6 py-3 text-right">Qty</th>
              <th className="px-6 py-3 text-right">Unit Price</th>
              <th className="px-6 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {invoice.invoice_items.map((item) => (
              <tr key={item.id}>
                <td className="px-6 py-3 text-gray-900">{item.description}</td>
                <td className="px-6 py-3 text-right text-gray-600">{item.quantity}</td>
                <td className="px-6 py-3 text-right text-gray-600">{fmtCurrency(item.unit_price)}</td>
                <td className="px-6 py-3 text-right font-medium text-gray-900">{fmtCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-gray-200 bg-gray-50/50">
            <tr>
              <td colSpan={3} className="px-6 py-2 text-right text-gray-500 text-xs">Subtotal</td>
              <td className="px-6 py-2 text-right font-medium text-gray-900">{fmtCurrency(invoice.subtotal)}</td>
            </tr>
            {invoice.tax_amount > 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-2 text-right text-gray-500 text-xs">Tax</td>
                <td className="px-6 py-2 text-right font-medium text-gray-900">{fmtCurrency(invoice.tax_amount)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={3} className="px-6 py-2 text-right font-semibold text-gray-900">Total</td>
              <td className="px-6 py-2 text-right font-bold text-gray-900 text-base">{fmtCurrency(invoice.total)}</td>
            </tr>
            {invoice.amount_paid > 0 && invoice.status !== 'paid' && (
              <>
                <tr>
                  <td colSpan={3} className="px-6 py-2 text-right text-gray-500 text-xs">Paid</td>
                  <td className="px-6 py-2 text-right text-green-600">{fmtCurrency(invoice.amount_paid)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-6 py-2 text-right font-semibold text-red-600">Balance Due</td>
                  <td className="px-6 py-2 text-right font-bold text-red-600">{fmtCurrency(balanceDue)}</td>
                </tr>
              </>
            )}
          </tfoot>
        </table>
      </div>

      {/* Linked Transaction */}
      {linkedTx && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
          <h3 className="text-sm font-medium text-green-800 mb-1 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4" />
            Linked Transaction
          </h3>
          <p className="text-sm text-green-700">
            {linkedTx.description} &mdash; {fmtCurrency(linkedTx.amount)} on {fmtDate(linkedTx.transaction_date)}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Actions</h3>
        <div className="flex flex-wrap gap-2">
          {/* Status actions */}
          {invoice.status === 'draft' && (
            <button
              onClick={() => handleAction('mark_sent', { status: 'sent' })}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              <Send className="w-3.5 h-3.5" /> Mark Sent
            </button>
          )}
          {(invoice.status === 'draft' || invoice.status === 'sent' || invoice.status === 'overdue') && (
            <button
              onClick={() => handleAction('mark_paid', { mark_paid: true })}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
            >
              <CreditCard className="w-3.5 h-3.5" /> Mark Paid
            </button>
          )}
          {invoice.status === 'paid' && (
            <button
              onClick={() => handleAction('unmark_paid', { unmark_paid: true })}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium hover:bg-amber-200 disabled:opacity-50 transition"
            >
              <Undo2 className="w-3.5 h-3.5" /> Un-mark Paid
            </button>
          )}
          {(invoice.status === 'sent' || invoice.status === 'overdue') && (
            <button
              onClick={() => handleAction('unmark_sent', { unmark_sent: true })}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition"
            >
              <Undo2 className="w-3.5 h-3.5" /> Revert to Draft
            </button>
          )}

          {/* Duplicate */}
          <button
            onClick={handleDuplicate}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-fuchsia-50 text-fuchsia-700 rounded-lg text-sm font-medium hover:bg-fuchsia-100 disabled:opacity-50 transition"
          >
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>

          {/* Save as Template */}
          <button
            onClick={() => setShowTemplateModal(true)}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-50 text-violet-700 rounded-lg text-sm font-medium hover:bg-violet-100 disabled:opacity-50 transition"
          >
            <Bookmark className="w-3.5 h-3.5" /> Save as Template
          </button>

          {/* Delete */}
          {invoice.status !== 'paid' && (
            <button
              onClick={handleDelete}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}

          {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400 self-center" />}
        </div>
      </div>

      {/* Activity Links */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <ActivityLinker entityType="invoice" entityId={invoice.id} />
      </div>

      {/* Life Categories */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <LifeCategoryTagger entityType="invoice" entityId={invoice.id} />
      </div>

      {/* Template Modal */}
      <InvoiceTemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        invoice={invoice}
        onSaved={() => {}}
      />
    </div>
  );
}
