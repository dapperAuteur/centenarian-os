'use client';

// app/dashboard/finance/accounts/page.tsx
// Financial accounts management: add, edit, deactivate bank/card/loan/cash accounts.

import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, Plus, Pencil, Trash2, Loader2, CreditCard,
  Building2, Check, X,
} from 'lucide-react';
import Link from 'next/link';

interface Account {
  id: string;
  name: string;
  account_type: 'checking' | 'savings' | 'credit_card' | 'loan' | 'cash';
  institution_name: string | null;
  last_four: string | null;
  interest_rate: number | null;
  credit_limit: number | null;
  opening_balance: number;
  monthly_fee: number | null;
  due_date: number | null;
  statement_date: number | null;
  is_active: boolean;
  notes: string | null;
  balance: number;
}

const TYPE_LABELS: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit Card',
  loan: 'Loan',
  cash: 'Cash',
};

const TYPE_COLORS: Record<string, string> = {
  checking: 'bg-blue-100 text-blue-700',
  savings: 'bg-green-100 text-green-700',
  credit_card: 'bg-purple-100 text-purple-700',
  loan: 'bg-orange-100 text-orange-700',
  cash: 'bg-gray-100 text-gray-700',
};

const emptyForm = {
  name: '', account_type: 'checking', institution_name: '', last_four: '',
  interest_rate: '', credit_limit: '', opening_balance: '0',
  monthly_fee: '', due_date: '', statement_date: '', notes: '',
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/accounts');
      if (res.ok) setAccounts(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, string | number | null> = {
        name: form.name,
        account_type: form.account_type,
        institution_name: form.institution_name || null,
        last_four: form.last_four || null,
        opening_balance: Number(form.opening_balance) || 0,
        interest_rate: form.interest_rate ? Number(form.interest_rate) : null,
        credit_limit: form.credit_limit ? Number(form.credit_limit) : null,
        monthly_fee: form.monthly_fee ? Number(form.monthly_fee) : null,
        due_date: form.due_date ? Number(form.due_date) : null,
        statement_date: form.statement_date ? Number(form.statement_date) : null,
        notes: form.notes || null,
      };
      const res = await fetch('/api/finance/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) { setShowAdd(false); setForm({ ...emptyForm }); load(); }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    const body: Record<string, string | number | null> = {};
    for (const [k, v] of Object.entries(editForm)) {
      if (['interest_rate', 'credit_limit', 'opening_balance', 'monthly_fee', 'due_date', 'statement_date'].includes(k)) {
        body[k] = v !== '' ? Number(v) : null;
      } else {
        body[k] = v || null;
      }
    }
    const res = await fetch(`/api/finance/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) { setEditId(null); load(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this account? If it has transactions it will be deactivated instead of deleted.')) return;
    await fetch(`/api/finance/accounts/${id}`, { method: 'DELETE' });
    load();
  };

  const handleToggleActive = async (acct: Account) => {
    await fetch(`/api/finance/accounts/${acct.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !acct.is_active }),
    });
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
              <CreditCard className="w-6 h-6 text-fuchsia-600" />
              Financial Accounts
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Manage your bank accounts, credit cards, and loans</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p>No accounts yet. Add your first account to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acct) => (
            <div key={acct.id} className={`bg-white border rounded-2xl p-5 ${!acct.is_active ? 'opacity-60' : 'border-gray-200'}`}>
              {editId === acct.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Name</label>
                      <input value={editForm.name ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Type</label>
                      <select value={editForm.account_type ?? 'checking'} onChange={(e) => setEditForm((f) => ({ ...f, account_type: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg">
                        {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Institution</label>
                      <input value={editForm.institution_name ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, institution_name: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="Bank name" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Last 4 digits</label>
                      <input maxLength={4} value={editForm.last_four ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, last_four: e.target.value.replace(/\D/g, '') }))}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="1234" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Opening Balance ($)</label>
                      <input type="number" step="0.01" value={editForm.opening_balance ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, opening_balance: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Interest Rate (%)</label>
                      <input type="number" step="0.01" value={editForm.interest_rate ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, interest_rate: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Credit Limit ($)</label>
                      <input type="number" step="0.01" value={editForm.credit_limit ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, credit_limit: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Monthly Fee ($)</label>
                      <input type="number" step="0.01" value={editForm.monthly_fee ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, monthly_fee: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Due Date (day)</label>
                      <input type="number" min="1" max="28" value={editForm.due_date ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, due_date: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="e.g. 15" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Statement Date (day)</label>
                      <input type="number" min="1" max="28" value={editForm.statement_date ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, statement_date: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="e.g. 1" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Notes</label>
                    <input value={editForm.notes ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => handleSaveEdit(acct.id)}
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
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[acct.account_type] ?? 'bg-gray-100 text-gray-700'}`}>
                        {TYPE_LABELS[acct.account_type] ?? acct.account_type}
                      </span>
                      {!acct.is_active && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Inactive</span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900">
                      {acct.name}
                      {acct.last_four && <span className="text-gray-400 font-normal ml-2 text-sm">··{acct.last_four}</span>}
                    </p>
                    {acct.institution_name && (
                      <p className="text-sm text-gray-500 mt-0.5">{acct.institution_name}</p>
                    )}
                    <div className="flex flex-wrap gap-4 mt-2 text-sm">
                      <div>
                        <span className="text-gray-400 text-xs">Balance</span>
                        <p className={`font-bold ${acct.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          {acct.balance < 0 ? '-' : ''}${Math.abs(acct.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      {acct.credit_limit != null && (
                        <div>
                          <span className="text-gray-400 text-xs">Credit Limit</span>
                          <p className="text-gray-700">${Number(acct.credit_limit).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        </div>
                      )}
                      {acct.interest_rate != null && (
                        <div>
                          <span className="text-gray-400 text-xs">APR</span>
                          <p className="text-gray-700">{acct.interest_rate}%</p>
                        </div>
                      )}
                      {acct.monthly_fee != null && (
                        <div>
                          <span className="text-gray-400 text-xs">Monthly Fee</span>
                          <p className="text-gray-700">${Number(acct.monthly_fee).toFixed(2)}</p>
                        </div>
                      )}
                      {acct.due_date != null && (
                        <div>
                          <span className="text-gray-400 text-xs">Due</span>
                          <p className="text-gray-700">Day {acct.due_date}</p>
                        </div>
                      )}
                      {acct.statement_date != null && (
                        <div>
                          <span className="text-gray-400 text-xs">Statement</span>
                          <p className="text-gray-700">Day {acct.statement_date}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setEditId(acct.id); setEditForm({ name: acct.name, account_type: acct.account_type, institution_name: acct.institution_name ?? '', last_four: acct.last_four ?? '', interest_rate: acct.interest_rate?.toString() ?? '', credit_limit: acct.credit_limit?.toString() ?? '', opening_balance: acct.opening_balance.toString(), monthly_fee: acct.monthly_fee?.toString() ?? '', due_date: acct.due_date?.toString() ?? '', statement_date: acct.statement_date?.toString() ?? '', notes: acct.notes ?? '' }); }}
                      className="p-1.5 text-gray-400 hover:text-fuchsia-600 hover:bg-fuchsia-50 rounded-lg transition"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(acct)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition text-xs font-medium"
                      title={acct.is_active ? 'Deactivate' : 'Reactivate'}
                    >
                      {acct.is_active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(acct.id)}
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

      {/* Add Account Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 my-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900">Add Account</h3>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Name *</label>
                  <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="e.g. Chase Checking" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Type *</label>
                  <select required value={form.account_type} onChange={(e) => setForm((f) => ({ ...f, account_type: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg">
                    {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Institution</label>
                  <input value={form.institution_name} onChange={(e) => setForm((f) => ({ ...f, institution_name: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="Bank or lender name" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Last 4 digits</label>
                  <input maxLength={4} value={form.last_four} onChange={(e) => setForm((f) => ({ ...f, last_four: e.target.value.replace(/\D/g, '') }))}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="1234" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Opening Balance ($)</label>
                  <input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm((f) => ({ ...f, opening_balance: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Interest Rate (%)</label>
                  <input type="number" step="0.01" min="0" value={form.interest_rate} onChange={(e) => setForm((f) => ({ ...f, interest_rate: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="e.g. 24.99" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Credit Limit ($)</label>
                  <input type="number" step="0.01" min="0" value={form.credit_limit} onChange={(e) => setForm((f) => ({ ...f, credit_limit: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="Credit cards / loans" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Monthly Fee ($)</label>
                  <input type="number" step="0.01" min="0" value={form.monthly_fee} onChange={(e) => setForm((f) => ({ ...f, monthly_fee: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="Annual fee / 12" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Payment Due Date (day of month)</label>
                  <input type="number" min="1" max="28" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="e.g. 15" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Statement Date (day of month)</label>
                  <input type="number" min="1" max="28" value={form.statement_date} onChange={(e) => setForm((f) => ({ ...f, statement_date: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="e.g. 1" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Notes</label>
                <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="Optional notes" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Add Account
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
