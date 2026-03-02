'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Calendar, DollarSign, Tag, Copy, Trash2,
  Loader2, ArrowDownLeft, ArrowUpRight, Building2, CreditCard, FileText,
} from 'lucide-react';
import Link from 'next/link';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import ActivityLinker from '@/components/ui/ActivityLinker';
import LifeCategoryTagger from '@/components/ui/LifeCategoryTagger';

interface Transaction {
  id: string;
  amount: number;
  type: 'expense' | 'income';
  description: string | null;
  vendor: string | null;
  transaction_date: string;
  source: string;
  source_module: string | null;
  source_module_id: string | null;
  category_id: string | null;
  account_id: string | null;
  brand_id: string | null;
  transfer_group_id: string | null;
  tags: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  budget_categories: { id: string; name: string; color: string } | null;
  financial_accounts: { id: string; name: string; account_type: string } | null;
  user_brands: { id: string; name: string } | null;
}

interface LinkedInvoice {
  id: string;
  invoice_number: string | null;
  contact_name: string;
  total: number;
  direction: string;
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtCurrency(n: number) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  csv_import: 'CSV Import',
  stripe: 'Stripe',
  fuel_log: 'Fuel Log',
  vehicle_maintenance: 'Maintenance',
  trip: 'Trip',
  transfer: 'Transfer',
  interest: 'Interest',
  recurring: 'Recurring',
};

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [linkedInvoice, setLinkedInvoice] = useState<LinkedInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await offlineFetch(`/api/finance/transactions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setTransaction(data.transaction || null);
        setLinkedInvoice(data.linked_invoice || null);
      }
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDuplicate = async () => {
    setActionLoading('duplicate');
    try {
      const res = await offlineFetch(`/api/finance/transactions/${id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        router.push(`/dashboard/finance/transactions/${data.id}`);
      } else {
        const err = await res.json();
        alert(err.error || 'Duplicate failed');
      }
    } finally { setActionLoading(null); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this transaction? This cannot be undone.')) return;
    setActionLoading('delete');
    try {
      const res = await offlineFetch(`/api/finance/transactions?id=${id}`, { method: 'DELETE' });
      if (res.ok) router.push('/dashboard/finance/transactions');
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

  if (!transaction) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center text-gray-400">
        <p>Transaction not found.</p>
        <Link href="/dashboard/finance/transactions" className="text-fuchsia-600 hover:underline mt-2 inline-block">Back to transactions</Link>
      </div>
    );
  }

  const isIncome = transaction.type === 'income';

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/finance/transactions" className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isIncome ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {isIncome ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                {isIncome ? 'Income' : 'Expense'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                {SOURCE_LABELS[transaction.source] || transaction.source}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {transaction.description || transaction.vendor || 'Transaction'}
            </h1>
            {transaction.vendor && transaction.description && (
              <p className="text-gray-500 text-sm">{transaction.vendor}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
            {isIncome ? '+' : '-'}{fmtCurrency(transaction.amount)}
          </div>
        </div>
      </div>

      {/* Details Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400 text-xs block">Date</span>
            <span className="text-gray-900 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {fmtDate(transaction.transaction_date)}
            </span>
          </div>
          {transaction.financial_accounts && (
            <div>
              <span className="text-gray-400 text-xs block">Account</span>
              <span className="text-gray-900 font-medium flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                {transaction.financial_accounts.name}
              </span>
            </div>
          )}
          {transaction.user_brands && (
            <div>
              <span className="text-gray-400 text-xs block">Brand</span>
              <span className="text-gray-900 font-medium flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                {transaction.user_brands.name}
              </span>
            </div>
          )}
        </div>

        {transaction.budget_categories && (
          <div className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: transaction.budget_categories.color }} />
            <span className="text-gray-600">{transaction.budget_categories.name}</span>
          </div>
        )}

        {transaction.tags && transaction.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-3.5 h-3.5 text-gray-400" />
            {transaction.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{tag}</span>
            ))}
          </div>
        )}

        {transaction.notes && (
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            {transaction.notes}
          </div>
        )}
      </div>

      {/* Linked Invoice */}
      {linkedInvoice && (
        <Link
          href={`/dashboard/finance/invoices/${linkedInvoice.id}`}
          className="block bg-fuchsia-50 border border-fuchsia-200 rounded-2xl p-4 hover:bg-fuchsia-100 transition"
        >
          <h3 className="text-sm font-medium text-fuchsia-800 mb-1 flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            Linked Invoice
          </h3>
          <p className="text-sm text-fuchsia-700">
            {linkedInvoice.invoice_number ? `Invoice ${linkedInvoice.invoice_number}` : 'Invoice'} — {linkedInvoice.contact_name} — {fmtCurrency(linkedInvoice.total)}
          </p>
        </Link>
      )}

      {/* Source Module Link */}
      {transaction.source_module && transaction.source_module_id && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-1 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4" />
            Source
          </h3>
          <p className="text-sm text-blue-700">
            Created from {SOURCE_LABELS[transaction.source_module] || transaction.source_module}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDuplicate}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-fuchsia-50 text-fuchsia-700 rounded-lg text-sm font-medium hover:bg-fuchsia-100 disabled:opacity-50 transition"
          >
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>
          <button
            onClick={handleDelete}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
          {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400 self-center" />}
        </div>
      </div>

      {/* Activity Links */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <ActivityLinker entityType="transaction" entityId={transaction.id} />
      </div>

      {/* Life Categories */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <LifeCategoryTagger entityType="transaction" entityId={transaction.id} />
      </div>
    </div>
  );
}
