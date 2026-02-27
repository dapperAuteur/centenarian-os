'use client';

// app/dashboard/finance/recurring/page.tsx
// Manage recurring payments: add, edit, toggle, delete.
// On mount, auto-generates any due transactions.

import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, Plus, Pencil, Trash2, Loader2, RefreshCw,
  Check, X, Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Account {
  id: string;
  name: string;
  account_type: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface RecurringPayment {
  id: string;
  account_id: string;
  description: string;
  amount: number;
  type: 'expense' | 'income';
  category_id: string | null;
  day_of_month: number;
  is_active: boolean;
  last_generated: string | null;
  financial_accounts: Account | null;
  budget_categories: Category | null;
}

const emptyForm = {
  account_id: '',
  description: '',
  amount: '',
  type: 'expense',
  category_id: '',
  day_of_month: '',
};

export default function RecurringPage() {
  const [items, setItems] = useState<RecurringPayment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [generated, setGenerated] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rpRes, acctRes, catRes] = await Promise.all([
        offlineFetch('/api/finance/recurring'),
        offlineFetch('/api/finance/accounts'),
        offlineFetch('/api/finance/categories'),
      ]);
      if (rpRes.ok) setItems(await rpRes.json());
      if (acctRes.ok) {
        const all = await acctRes.json();
        setAccounts(all.filter((a: { is_active: boolean }) => a.is_active));
      }
      if (catRes.ok) setCategories(await catRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Auto-generate due transactions on mount
    offlineFetch('/api/finance/recurring/generate', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => { if (d.generated > 0) { setGenerated(d.generated); load(); } })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await offlineFetch('/api/finance/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: form.account_id,
          description: form.description,
          amount: Number(form.amount),
          type: form.type,
          category_id: form.category_id || null,
          day_of_month: Number(form.day_of_month),
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        setForm({ ...emptyForm });
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(editForm)) {
      if (['amount', 'day_of_month'].includes(k)) {
        body[k] = v !== '' ? Number(v) : null;
      } else {
        body[k] = v || null;
      }
    }
    body.id = id;
    const res = await offlineFetch('/api/finance/recurring', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) { setEditId(null); load(); }
  };

  const handleToggle = async (rp: RecurringPayment) => {
    await offlineFetch('/api/finance/recurring', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rp.id, is_active: !rp.is_active }),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recurring payment?')) return;
    await offlineFetch(`/api/finance/recurring?id=${id}`, { method: 'DELETE' });
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin h-8 w-8 text-fuchsia-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/finance" className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <RefreshCw className="w-6 h-6 text-fuchsia-600" />
              Recurring Payments
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Auto-generated on each visit when due</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Recurring
        </button>
      </div>

      {generated != null && generated > 0 && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          {generated} recurring transaction{generated !== 1 ? 's' : ''} auto-generated for this period.
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p>No recurring payments yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((rp) => (
            <div key={rp.id} className={`bg-white border rounded-2xl p-5 ${!rp.is_active ? 'opacity-60' : 'border-gray-200'}`}>
              {editId === rp.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Description</label>
                      <input value={editForm.description ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Account</label>
                      <select value={editForm.account_id ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, account_id: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg">
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Amount ($)</label>
                      <input type="number" step="0.01" value={editForm.amount ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Type</label>
                      <select value={editForm.type ?? 'expense'} onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg">
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Day of Month</label>
                      <input type="number" min="1" max="28" value={editForm.day_of_month ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, day_of_month: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Category</label>
                    <select value={editForm.category_id ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, category_id: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg">
                      <option value="">None</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => handleSaveEdit(rp.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 transition">
                      <Check className="w-3.5 h-3.5" /> Save
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition">
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rp.type === 'expense' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                        {rp.type === 'expense' ? 'Expense' : 'Income'}
                      </span>
                      {!rp.is_active && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Paused</span>
                      )}
                      {rp.budget_categories && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{rp.budget_categories.name}</span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900">{rp.description}</p>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm">
                      <div>
                        <span className="text-gray-400 text-xs">Amount</span>
                        <p className="font-bold text-gray-900">${Number(rp.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs">Account</span>
                        <p className="text-gray-700">{rp.financial_accounts?.name ?? '—'}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs">Due</span>
                        <p className="text-gray-700">Day {rp.day_of_month}</p>
                      </div>
                      {rp.last_generated && (
                        <div>
                          <span className="text-gray-400 text-xs">Last Generated</span>
                          <p className="text-gray-700">{new Date(rp.last_generated).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditId(rp.id);
                        setEditForm({
                          description: rp.description,
                          account_id: rp.account_id,
                          amount: Number(rp.amount).toString(),
                          type: rp.type,
                          day_of_month: rp.day_of_month.toString(),
                          category_id: rp.category_id ?? '',
                        });
                      }}
                      className="p-1.5 text-gray-400 hover:text-fuchsia-600 hover:bg-fuchsia-50 rounded-lg transition"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggle(rp)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                      title={rp.is_active ? 'Pause' : 'Resume'}
                    >
                      {rp.is_active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(rp.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Recurring Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 my-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900">Add Recurring Payment</h3>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Description *</label>
                <input required value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="e.g. Car payment" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Account *</label>
                  <select required value={form.account_id} onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg">
                    <option value="">Select…</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Amount ($) *</label>
                  <input required type="number" step="0.01" min="0.01" value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Type</label>
                  <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg">
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Day of Month (1–28) *</label>
                  <input required type="number" min="1" max="28" value={form.day_of_month}
                    onChange={(e) => setForm((f) => ({ ...f, day_of_month: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="e.g. 15" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Category</label>
                <select value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg">
                  <option value="">None</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Add Recurring
                </button>
                <button type="button" onClick={() => setShowAdd(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
