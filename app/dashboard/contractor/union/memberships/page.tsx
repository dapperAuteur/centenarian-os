'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, Plus, Trash2, DollarSign, Calendar, CreditCard, Edit2, X, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Clock,
} from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Membership {
  id: string;
  union_name: string;
  local_number: string;
  member_id: string | null;
  status: string;
  join_date: string | null;
  expiration_date: string | null;
  dues_amount: number | null;
  dues_frequency: string | null;
  next_dues_date: string | null;
  auto_pay: boolean;
  initiation_fee: number | null;
  initiation_paid: boolean;
  notes: string | null;
}

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  period_start: string | null;
  period_end: string | null;
  payment_method: string | null;
  confirmation_number: string | null;
  notes: string | null;
}

const STATUS_STYLES: Record<string, { color: string; icon: typeof CheckCircle }> = {
  active: { color: 'text-green-400 bg-green-500/20', icon: CheckCircle },
  inactive: { color: 'text-neutral-400 bg-neutral-500/20', icon: Clock },
  suspended: { color: 'text-red-400 bg-red-500/20', icon: AlertTriangle },
  retired: { color: 'text-blue-400 bg-blue-500/20', icon: CheckCircle },
  honorary: { color: 'text-purple-400 bg-purple-500/20', icon: CheckCircle },
};

const FREQ_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annual: 'Semi-Annual',
  annual: 'Annual',
};

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const inputClass = 'w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40';

function getDuesUrgency(nextDate: string | null): 'overdue' | 'due_soon' | 'current' | 'none' {
  if (!nextDate) return 'none';
  const today = new Date();
  const due = new Date(nextDate);
  const diffDays = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 30) return 'due_soon';
  return 'current';
}

const URGENCY_STYLES: Record<string, string> = {
  overdue: 'border-red-700/50 bg-red-900/10',
  due_soon: 'border-yellow-700/50 bg-yellow-900/10',
  current: 'border-neutral-800',
  none: 'border-neutral-800',
};

const emptyForm = {
  union_name: '', local_number: '', member_id: '', status: 'active',
  join_date: '', expiration_date: '', dues_amount: '', dues_frequency: 'quarterly',
  next_dues_date: '', auto_pay: false, initiation_fee: '', initiation_paid: false, notes: '',
};

const emptyPayment = {
  amount: '', payment_date: new Date().toISOString().split('T')[0],
  period_start: '', period_end: '', payment_method: '', confirmation_number: '', notes: '',
};

export default function UnionMembershipsPage() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState(emptyPayment);
  const [savingPayment, setSavingPayment] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    offlineFetch('/api/contractor/union/memberships')
      .then((r) => r.json())
      .then((d) => setMemberships(d.memberships ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(m: Membership) {
    setForm({
      union_name: m.union_name,
      local_number: m.local_number,
      member_id: m.member_id || '',
      status: m.status,
      join_date: m.join_date || '',
      expiration_date: m.expiration_date || '',
      dues_amount: m.dues_amount != null ? String(m.dues_amount) : '',
      dues_frequency: m.dues_frequency || 'quarterly',
      next_dues_date: m.next_dues_date || '',
      auto_pay: m.auto_pay,
      initiation_fee: m.initiation_fee != null ? String(m.initiation_fee) : '',
      initiation_paid: m.initiation_paid,
      notes: m.notes || '',
    });
    setEditingId(m.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.union_name.trim() || !form.local_number.trim()) return;
    setSaving(true);

    const payload = {
      ...form,
      dues_amount: form.dues_amount ? parseFloat(form.dues_amount) : null,
      initiation_fee: form.initiation_fee ? parseFloat(form.initiation_fee) : null,
      join_date: form.join_date || null,
      expiration_date: form.expiration_date || null,
      next_dues_date: form.next_dues_date || null,
    };

    const url = editingId
      ? `/api/contractor/union/memberships/${editingId}`
      : '/api/contractor/union/memberships';

    const res = await offlineFetch(url, {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      load();
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await offlineFetch(`/api/contractor/union/memberships/${id}`, { method: 'DELETE' });
    setDeletingId(null);
    if (expandedId === id) setExpandedId(null);
    load();
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setLoadingPayments(true);
    const res = await offlineFetch(`/api/contractor/union/memberships/${id}/payments`);
    const data = await res.json();
    setPayments(data.payments ?? []);
    setLoadingPayments(false);
  }

  async function recordPayment() {
    if (!expandedId || !paymentForm.amount || !paymentForm.payment_date) return;
    setSavingPayment(true);

    const res = await offlineFetch(`/api/contractor/union/memberships/${expandedId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...paymentForm,
        amount: parseFloat(paymentForm.amount),
        period_start: paymentForm.period_start || null,
        period_end: paymentForm.period_end || null,
      }),
    });

    setSavingPayment(false);
    if (res.ok) {
      setShowPayment(false);
      setPaymentForm(emptyPayment);
      // Reload payments and memberships (next_dues_date may have advanced)
      toggleExpand(expandedId);
      load();
    }
  }

  const set = (field: string, value: string | boolean) => setForm((p) => ({ ...p, [field]: value }));
  const setP = (field: string, value: string) => setPaymentForm((p) => ({ ...p, [field]: value }));

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-neutral-100">Union Memberships</h1>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-11"
          aria-label="Add new union membership"
        >
          <Plus size={14} aria-hidden="true" /> Add Membership
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-100">
              {editingId ? 'Edit Membership' : 'New Membership'}
            </h2>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="min-h-11 min-w-11 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
              aria-label="Close form"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Union Name *</span>
              <input type="text" value={form.union_name} onChange={(e) => set('union_name', e.target.value)} className={inputClass} placeholder="IATSE" aria-required="true" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Local Number *</span>
              <input type="text" value={form.local_number} onChange={(e) => set('local_number', e.target.value)} className={inputClass} placeholder="317" aria-required="true" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Member ID</span>
              <input type="text" value={form.member_id} onChange={(e) => set('member_id', e.target.value)} className={inputClass} placeholder="Card/ID number" />
            </label>
          </div>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Status</span>
              <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputClass}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
                <option value="retired">Retired</option>
                <option value="honorary">Honorary</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Join Date</span>
              <input type="date" value={form.join_date} onChange={(e) => set('join_date', e.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Expiration Date</span>
              <input type="date" value={form.expiration_date} onChange={(e) => set('expiration_date', e.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Dues Frequency</span>
              <select value={form.dues_frequency} onChange={(e) => set('dues_frequency', e.target.value)} className={inputClass}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="semi_annual">Semi-Annual</option>
                <option value="annual">Annual</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Dues Amount ($)</span>
              <input type="number" step="0.01" value={form.dues_amount} onChange={(e) => set('dues_amount', e.target.value)} className={inputClass} placeholder="0.00" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Next Dues Date</span>
              <input type="date" value={form.next_dues_date} onChange={(e) => set('next_dues_date', e.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-neutral-400">Initiation Fee ($)</span>
              <input type="number" step="0.01" value={form.initiation_fee} onChange={(e) => set('initiation_fee', e.target.value)} className={inputClass} placeholder="0.00" />
            </label>
            <div className="flex flex-col gap-2 justify-end pb-1">
              <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                <input type="checkbox" checked={form.auto_pay} onChange={(e) => set('auto_pay', e.target.checked)} className="rounded border-neutral-600 bg-neutral-800 text-amber-500 focus:ring-amber-500" />
                Auto-pay
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                <input type="checkbox" checked={form.initiation_paid} onChange={(e) => set('initiation_paid', e.target.checked)} className="rounded border-neutral-600 bg-neutral-800 text-amber-500 focus:ring-amber-500" />
                Initiation paid
              </label>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-neutral-400">Notes</span>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className={inputClass} placeholder="Optional notes..." />
          </label>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || !form.union_name.trim() || !form.local_number.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-11"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {editingId ? 'Update' : 'Create'} Membership
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-400 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-11"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-neutral-500" size={24} aria-label="Loading memberships" />
        </div>
      ) : memberships.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          No memberships yet. Add your first union membership to start tracking dues.
        </div>
      ) : (
        <div className="space-y-3" role="list" aria-label="Union memberships">
          {memberships.map((m) => {
            const st = STATUS_STYLES[m.status] ?? STATUS_STYLES.active;
            const StatusIcon = st.icon;
            const urgency = getDuesUrgency(m.next_dues_date);
            const isExpanded = expandedId === m.id;

            return (
              <article key={m.id} role="listitem" className={`rounded-xl border bg-neutral-900 ${URGENCY_STYLES[urgency]} transition-colors`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => toggleExpand(m.id)}
                      className="flex-1 text-left min-w-0"
                      aria-expanded={isExpanded}
                      aria-label={`${m.union_name} Local ${m.local_number}, click to ${isExpanded ? 'collapse' : 'expand'}`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-neutral-100">{m.union_name}</span>
                        <span className="text-neutral-400">Local {m.local_number}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium inline-flex items-center gap-1 ${st.color}`}>
                          <StatusIcon size={10} aria-hidden="true" />
                          {m.status}
                        </span>
                        {urgency === 'overdue' && (
                          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400 flex items-center gap-1">
                            <AlertTriangle size={10} aria-hidden="true" /> Overdue
                          </span>
                        )}
                        {urgency === 'due_soon' && (
                          <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-400 flex items-center gap-1">
                            <Clock size={10} aria-hidden="true" /> Due Soon
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
                        {m.member_id && <span>ID: {m.member_id}</span>}
                        {m.dues_amount != null && (
                          <span>{fmt(m.dues_amount)} {FREQ_LABELS[m.dues_frequency ?? 'quarterly']?.toLowerCase()}</span>
                        )}
                        {m.next_dues_date && (
                          <span className="flex items-center gap-1">
                            <Calendar size={10} aria-hidden="true" />
                            Next: {new Date(m.next_dues_date).toLocaleDateString()}
                          </span>
                        )}
                        {m.auto_pay && <span className="text-green-400">Auto-pay</span>}
                      </div>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(m)}
                        className="min-h-11 min-w-11 flex items-center justify-center rounded text-neutral-500 hover:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        aria-label={`Edit ${m.union_name} Local ${m.local_number}`}
                      >
                        <Edit2 size={14} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        disabled={deletingId === m.id}
                        className="min-h-11 min-w-11 flex items-center justify-center rounded text-neutral-500 hover:text-red-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        aria-label={`Delete ${m.union_name} Local ${m.local_number}`}
                      >
                        {deletingId === m.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} aria-hidden="true" />}
                      </button>
                      {isExpanded ? <ChevronUp size={16} className="text-neutral-500" aria-hidden="true" /> : <ChevronDown size={16} className="text-neutral-500" aria-hidden="true" />}
                    </div>
                  </div>
                </div>

                {/* Expanded: payment history */}
                {isExpanded && (
                  <div className="border-t border-neutral-800 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-neutral-300">Payment History</h3>
                      <button
                        onClick={() => { setShowPayment(true); setPaymentForm(emptyPayment); }}
                        className="flex items-center gap-1 rounded-lg bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-11"
                        aria-label="Record new dues payment"
                      >
                        <DollarSign size={12} aria-hidden="true" /> Record Payment
                      </button>
                    </div>

                    {/* Payment form */}
                    {showPayment && (
                      <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-3 space-y-2">
                        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                          <label className="block">
                            <span className="text-xs text-neutral-500">Amount ($) *</span>
                            <input type="number" step="0.01" value={paymentForm.amount} onChange={(e) => setP('amount', e.target.value)} className={inputClass} placeholder="0.00" aria-required="true" />
                          </label>
                          <label className="block">
                            <span className="text-xs text-neutral-500">Payment Date *</span>
                            <input type="date" value={paymentForm.payment_date} onChange={(e) => setP('payment_date', e.target.value)} className={inputClass} aria-required="true" />
                          </label>
                          <label className="block">
                            <span className="text-xs text-neutral-500">Method</span>
                            <input type="text" value={paymentForm.payment_method} onChange={(e) => setP('payment_method', e.target.value)} className={inputClass} placeholder="Check, online, cash..." />
                          </label>
                        </div>
                        <div className="grid gap-2 grid-cols-1 sm:grid-cols-3">
                          <label className="block">
                            <span className="text-xs text-neutral-500">Period Start</span>
                            <input type="date" value={paymentForm.period_start} onChange={(e) => setP('period_start', e.target.value)} className={inputClass} />
                          </label>
                          <label className="block">
                            <span className="text-xs text-neutral-500">Period End</span>
                            <input type="date" value={paymentForm.period_end} onChange={(e) => setP('period_end', e.target.value)} className={inputClass} />
                          </label>
                          <label className="block">
                            <span className="text-xs text-neutral-500">Confirmation #</span>
                            <input type="text" value={paymentForm.confirmation_number} onChange={(e) => setP('confirmation_number', e.target.value)} className={inputClass} placeholder="Optional" />
                          </label>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={recordPayment}
                            disabled={savingPayment || !paymentForm.amount || !paymentForm.payment_date}
                            className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-11"
                          >
                            {savingPayment && <Loader2 size={14} className="animate-spin" />}
                            Save Payment
                          </button>
                          <button
                            onClick={() => setShowPayment(false)}
                            className="rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-11"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Payment list */}
                    {loadingPayments ? (
                      <div className="flex justify-center py-4">
                        <Loader2 size={16} className="animate-spin text-neutral-500" aria-label="Loading payments" />
                      </div>
                    ) : payments.length === 0 ? (
                      <p className="text-xs text-neutral-500 py-2">No payments recorded yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {payments.map((p) => (
                          <div key={p.id} className="flex items-center justify-between rounded-lg bg-neutral-800/50 px-3 py-2 text-sm">
                            <div className="flex items-center gap-3 flex-wrap min-w-0">
                              <CreditCard size={12} className="text-neutral-500 shrink-0" aria-hidden="true" />
                              <span className="font-medium text-amber-400">{fmt(p.amount)}</span>
                              <span className="text-neutral-500">{new Date(p.payment_date).toLocaleDateString()}</span>
                              {p.period_start && p.period_end && (
                                <span className="text-xs text-neutral-500">
                                  ({new Date(p.period_start).toLocaleDateString()} – {new Date(p.period_end).toLocaleDateString()})
                                </span>
                              )}
                              {p.payment_method && <span className="text-xs text-neutral-500">{p.payment_method}</span>}
                            </div>
                            {p.confirmation_number && (
                              <span className="text-xs text-neutral-500">#{p.confirmation_number}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Membership details */}
                    {m.notes && (
                      <p className="text-xs text-neutral-500 pt-2 border-t border-neutral-800">{m.notes}</p>
                    )}
                    <div className="flex gap-4 text-xs text-neutral-500 pt-1 flex-wrap">
                      {m.join_date && <span>Joined: {new Date(m.join_date).toLocaleDateString()}</span>}
                      {m.expiration_date && <span>Expires: {new Date(m.expiration_date).toLocaleDateString()}</span>}
                      {m.initiation_fee != null && (
                        <span>Initiation: {fmt(m.initiation_fee)} {m.initiation_paid ? '(paid)' : '(unpaid)'}</span>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
