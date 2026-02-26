'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus, FileText, ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2,
  AlertTriangle, Trash2, Loader2, X,
} from 'lucide-react';
import Link from 'next/link';
import ContactAutocomplete from '@/components/ui/ContactAutocomplete';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface Invoice {
  id: string;
  direction: 'receivable' | 'payable';
  status: string;
  contact_name: string;
  contact_id: string | null;
  subtotal: number;
  total: number;
  amount_paid: number;
  invoice_date: string;
  due_date: string | null;
  paid_date: string | null;
  invoice_number: string | null;
  account_id: string | null;
  brand_id: string | null;
  category_id: string | null;
  notes: string | null;
  invoice_items: InvoiceItem[];
}

interface Account {
  id: string;
  name: string;
  account_type: string;
}

interface Category {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
}

const STATUS_BADGE: Record<string, { bg: string; text: string; Icon: typeof Clock }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', Icon: FileText },
  sent: { bg: 'bg-blue-100', text: 'text-blue-700', Icon: Clock },
  paid: { bg: 'bg-green-100', text: 'text-green-700', Icon: CheckCircle2 },
  overdue: { bg: 'bg-red-100', text: 'text-red-700', Icon: AlertTriangle },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', Icon: X },
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'receivable' | 'payable'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    direction: 'receivable' as 'receivable' | 'payable',
    contact_name: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    account_id: '',
    brand_id: '',
    category_id: '',
    notes: '',
  });
  const [lineItems, setLineItems] = useState<{ description: string; quantity: string; unit_price: string }[]>([
    { description: '', quantity: '1', unit_price: '' },
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    const [invRes, acctRes, catRes, brandRes] = await Promise.all([
      offlineFetch(`/api/finance/invoices${filter !== 'all' ? `?direction=${filter}` : ''}`),
      offlineFetch('/api/finance/accounts'),
      offlineFetch('/api/finance/categories'),
      offlineFetch('/api/finance/brands'),
    ]);

    const invData = await invRes.json();
    const acctData = await acctRes.json();
    const catData = await catRes.json();
    const brandData = await brandRes.json();

    setInvoices(invData.invoices ?? []);
    setAccounts(Array.isArray(acctData) ? acctData.filter((a: Account & { is_active: boolean }) => a.is_active) : []);
    setCategories(Array.isArray(catData) ? catData : []);
    setBrands(Array.isArray(brandData) ? brandData : []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter === 'active') return inv.status !== 'paid' && inv.status !== 'cancelled';
    if (statusFilter === 'paid') return inv.status === 'paid';
    return true;
  });

  const overdue = invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled' && i.due_date && i.due_date < new Date().toISOString().split('T')[0]);
  const totalReceivable = invoices.filter((i) => i.direction === 'receivable' && i.status !== 'paid' && i.status !== 'cancelled').reduce((s, i) => s + Number(i.total) - Number(i.amount_paid), 0);
  const totalPayable = invoices.filter((i) => i.direction === 'payable' && i.status !== 'paid' && i.status !== 'cancelled').reduce((s, i) => s + Number(i.total) - Number(i.amount_paid), 0);

  async function handleCreate() {
    setSaving(true);
    const items = lineItems
      .filter((li) => li.description.trim() && Number(li.unit_price) > 0)
      .map((li, i) => ({
        description: li.description,
        quantity: Number(li.quantity) || 1,
        unit_price: Number(li.unit_price),
        sort_order: i,
      }));

    const res = await offlineFetch('/api/finance/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        account_id: form.account_id || null,
        brand_id: form.brand_id || null,
        category_id: form.category_id || null,
        due_date: form.due_date || null,
        items,
      }),
    });

    if (res.ok) {
      setShowCreate(false);
      setForm({
        direction: 'receivable', contact_name: '', invoice_number: '',
        invoice_date: new Date().toISOString().split('T')[0], due_date: '',
        account_id: '', brand_id: '', category_id: '', notes: '',
      });
      setLineItems([{ description: '', quantity: '1', unit_price: '' }]);
      load();
    }
    setSaving(false);
  }

  async function markPaid(id: string) {
    await offlineFetch(`/api/finance/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_paid: true }),
    });
    load();
  }

  async function markSent(id: string) {
    await offlineFetch(`/api/finance/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sent' }),
    });
    load();
  }

  async function deleteInvoice(id: string) {
    await offlineFetch(`/api/finance/invoices/${id}`, { method: 'DELETE' });
    load();
  }

  function addLineItem() {
    setLineItems([...lineItems, { description: '', quantity: '1', unit_price: '' }]);
  }

  function updateLineItem(index: number, field: string, value: string) {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  }

  function removeLineItem(index: number) {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  }

  const lineTotal = lineItems.reduce((s, li) => s + (Number(li.quantity) || 1) * (Number(li.unit_price) || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-fuchsia-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices & Receivables</h1>
          <p className="text-sm text-gray-500 mt-1">
            <Link href="/dashboard/finance" className="text-fuchsia-600 hover:underline">Finance</Link>
            {' / '}Invoices
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Invoice
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Owed to You</p>
          <p className="text-xl font-bold text-green-600">${totalReceivable.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">You Owe</p>
          <p className="text-xl font-bold text-red-600">${totalPayable.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className={`bg-white border rounded-xl p-4 ${overdue.length > 0 ? 'border-red-300' : ''}`}>
          <p className="text-xs font-medium text-gray-500 uppercase">Overdue</p>
          <p className={`text-xl font-bold ${overdue.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>{overdue.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['all', 'receivable', 'payable'] as const).map((d) => (
          <button
            key={d}
            onClick={() => setFilter(d)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === d ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {d === 'all' ? 'All' : d === 'receivable' ? 'Receivable' : 'Payable'}
          </button>
        ))}
        <div className="w-px bg-gray-200 mx-1" />
        {(['active', 'paid', 'all'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              statusFilter === s ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === 'active' ? 'Active' : s === 'paid' ? 'Paid' : 'All Status'}
          </button>
        ))}
      </div>

      {/* Invoice list */}
      <div className="space-y-3">
        {filteredInvoices.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3" />
            <p>No invoices yet. Create one to start tracking.</p>
          </div>
        )}
        {filteredInvoices.map((inv) => {
          const badge = STATUS_BADGE[inv.status] ?? STATUS_BADGE.draft;
          const BadgeIcon = badge.Icon;
          const balanceDue = Number(inv.total) - Number(inv.amount_paid);
          const isOverdue = inv.due_date && inv.due_date < new Date().toISOString().split('T')[0] && inv.status !== 'paid' && inv.status !== 'cancelled';

          return (
            <div key={inv.id} className={`bg-white border rounded-xl p-4 ${isOverdue ? 'border-red-300' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {inv.direction === 'receivable' ? (
                    <ArrowDownLeft className="w-5 h-5 text-green-500 shrink-0" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5 text-red-500 shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{inv.contact_name}</p>
                    <p className="text-xs text-gray-500">
                      {inv.invoice_number && `${inv.invoice_number} · `}
                      {new Date(inv.invoice_date).toLocaleDateString()}
                      {inv.due_date && ` · Due ${new Date(inv.due_date).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`font-bold ${inv.direction === 'receivable' ? 'text-green-600' : 'text-red-600'}`}>
                      {inv.direction === 'receivable' ? '+' : '-'}${Number(inv.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    {balanceDue > 0 && balanceDue < Number(inv.total) && (
                      <p className="text-xs text-gray-500">
                        ${balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })} remaining
                      </p>
                    )}
                  </div>
                  <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                    <BadgeIcon className="w-3 h-3" />
                    {inv.status}
                  </span>
                </div>
              </div>

              {/* Line items summary */}
              {inv.invoice_items?.length > 0 && (
                <div className="mt-2 pl-8 text-xs text-gray-500">
                  {inv.invoice_items.map((item, i) => (
                    <span key={i}>
                      {i > 0 && ' · '}
                      {item.description} ({item.quantity}x ${Number(item.unit_price).toFixed(2)})
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                <div className="mt-3 pl-8 flex flex-wrap gap-2">
                  {inv.status === 'draft' && (
                    <button
                      onClick={() => markSent(inv.id)}
                      className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                    >
                      Mark Sent
                    </button>
                  )}
                  <button
                    onClick={() => markPaid(inv.id)}
                    className="px-3 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
                  >
                    Mark Paid
                  </button>
                  <button
                    onClick={() => deleteInvoice(inv.id)}
                    className="px-3 py-1 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                  >
                    <Trash2 className="w-3 h-3 inline mr-1" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">New Invoice</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Direction */}
              <div className="flex gap-2">
                <button
                  onClick={() => setForm({ ...form, direction: 'receivable' })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition ${
                    form.direction === 'receivable' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  Receivable
                </button>
                <button
                  onClick={() => setForm({ ...form, direction: 'payable' })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition ${
                    form.direction === 'payable' ? 'bg-red-50 border-red-300 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Payable
                </button>
              </div>

              {/* Contact */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {form.direction === 'receivable' ? 'Client / Customer' : 'Vendor / Creditor'}
                </label>
                <ContactAutocomplete
                  value={form.contact_name}
                  onChange={(val) => setForm({ ...form, contact_name: val })}
                  contactType={form.direction === 'receivable' ? 'customer' : 'vendor'}
                />
              </div>

              {/* Invoice number + dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Invoice #</label>
                  <input
                    type="text"
                    value={form.invoice_number}
                    onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                    placeholder="INV-001"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={form.invoice_date}
                    onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Line items */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Line Items</label>
                <div className="space-y-2">
                  {lineItems.map((li, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <input
                        type="text"
                        placeholder="Description"
                        value={li.description}
                        onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                        className="flex-1 border rounded-lg px-3 py-2 text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        value={li.quantity}
                        onChange={(e) => updateLineItem(i, 'quantity', e.target.value)}
                        className="w-16 border rounded-lg px-2 py-2 text-sm text-center"
                        min="1"
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        value={li.unit_price}
                        onChange={(e) => updateLineItem(i, 'unit_price', e.target.value)}
                        className="w-24 border rounded-lg px-2 py-2 text-sm text-right"
                        step="0.01"
                        min="0"
                      />
                      {lineItems.length > 1 && (
                        <button onClick={() => removeLineItem(i)} className="p-2 text-gray-400 hover:text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addLineItem}
                  className="mt-2 text-xs text-fuchsia-600 hover:underline font-medium"
                >
                  + Add line item
                </button>
                <p className="text-right text-sm font-bold text-gray-900 mt-2">
                  Total: ${lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>

              {/* Optional fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Account</label>
                  <select
                    value={form.account_id}
                    onChange={(e) => setForm({ ...form, account_id: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">None</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">None</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {brands.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Brand</label>
                  <select
                    value={form.brand_id}
                    onChange={(e) => setForm({ ...form, brand_id: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">None</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <button
                onClick={handleCreate}
                disabled={saving || !form.contact_name.trim() || lineTotal <= 0}
                className="w-full py-2.5 bg-fuchsia-600 text-white rounded-lg font-medium text-sm hover:bg-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
