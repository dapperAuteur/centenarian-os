'use client';

// components/finance/insurance/PolicyForm.tsx
// Add or edit a life insurance policy: kind, insurer, policy last four, coverage, premium and how
// often, start and term-end dates, cash value (permanent policies), beneficiaries, the category or
// vendor the premium shows up as, and whether to add premium due dates to the planner.
// Saves through POST /api/finance/insurance or PATCH /api/finance/insurance/[id].

import { useId, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { isPermanent, POLICY_KIND_LABEL, POLICY_KINDS, PREMIUM_FREQUENCIES, PREMIUM_FREQUENCY_LABEL } from '@/lib/finance/insurance/logic';
import type { PolicyView } from '@/lib/finance/insurance/server';
import { numOrNull } from '@/components/finance/retirement/format';

const field = 'w-full min-h-11 px-3 border border-gray-300 rounded-lg text-sm bg-white';
const label = 'block text-xs font-medium text-gray-600 mb-1';
const str = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v));

export default function PolicyForm({
  policy,
  homeCurrency,
  categories,
  onClose,
  onSaved,
}: {
  policy: PolicyView | null;
  homeCurrency: string;
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const id = useId();
  const [form, setForm] = useState({
    kind: policy?.kind ?? 'term_life',
    insurer: policy?.insurer ?? '',
    policy_last_four: policy?.policy_last_four ?? '',
    currency: policy?.currency ?? homeCurrency,
    coverage_amount: str(policy?.coverage_amount),
    premium_amount: str(policy?.premium_amount),
    premium_frequency: policy?.premium_frequency ?? 'monthly',
    start_date: policy?.start_date ?? '',
    term_end_date: policy?.term_end_date ?? '',
    cash_value: str(policy?.cash_value),
    cash_value_as_of: policy?.cash_value_as_of ?? '',
    beneficiaries: policy?.beneficiaries ?? '',
    premium_category_id: policy?.premium_category_id ?? '',
    premium_vendor: policy?.premium_vendor ?? '',
    premium_tasks: policy?.premium_tasks ?? false,
    is_active: policy?.is_active ?? true,
    notes: policy?.notes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));
  const permanent = isPermanent(form.kind);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      ...form,
      currency: form.currency.trim().toUpperCase(),
      coverage_amount: numOrNull(form.coverage_amount),
      premium_amount: numOrNull(form.premium_amount),
      cash_value: permanent ? numOrNull(form.cash_value) : null,
      cash_value_as_of: permanent ? form.cash_value_as_of || null : null,
      start_date: form.start_date || null,
      term_end_date: form.term_end_date || null,
      premium_category_id: form.premium_category_id || null,
    };
    const res = await offlineFetch(policy ? `/api/finance/insurance/${policy.id}` : '/api/finance/insurance', {
      method: policy ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error || 'Could not save the policy.');
      return;
    }
    onSaved(policy ? 'Policy saved.' : 'Policy added.');
  };

  const text = (key: keyof typeof form, title: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`${id}-${key}`} className={label}>{title}</label>
      <input id={`${id}-${key}`} className={field} value={String(form[key])} onChange={(e) => set(key, e.target.value)} {...extra} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <form onSubmit={submit} className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 id={`${id}-title`} className="text-lg font-semibold text-gray-900">{policy ? 'Edit policy' : 'Add a life insurance policy'}</h2>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-gray-100" aria-label="Close">
            <X className="w-5 h-5 text-gray-600" aria-hidden="true" />
          </button>
        </div>
        {error && <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${id}-kind`} className={label}>Kind</label>
            <select id={`${id}-kind`} className={field} value={form.kind} onChange={(e) => set('kind', e.target.value)}>
              {POLICY_KINDS.map((k) => <option key={k} value={k}>{POLICY_KIND_LABEL[k]}</option>)}
            </select>
          </div>
          {text('insurer', 'Insurer', { required: true, maxLength: 120 })}
          <div className="grid grid-cols-2 gap-3">
            {text('policy_last_four', 'Policy no. last four', { maxLength: 4 })}
            {text('currency', 'Currency', { maxLength: 3 })}
          </div>
          {text('coverage_amount', 'Coverage (death benefit)', { type: 'number', min: 0, step: '1000' })}
          {text('premium_amount', 'Premium', { type: 'number', min: 0, step: '0.01' })}
          <div>
            <label htmlFor={`${id}-freq`} className={label}>Premium due</label>
            <select id={`${id}-freq`} className={field} value={form.premium_frequency} onChange={(e) => set('premium_frequency', e.target.value)}>
              {PREMIUM_FREQUENCIES.map((f) => <option key={f} value={f}>{PREMIUM_FREQUENCY_LABEL[f]}</option>)}
            </select>
          </div>
          {text('start_date', 'Start date (first premium)', { type: 'date' })}
          {text('term_end_date', form.kind === 'term_life' ? 'Term ends' : 'End date (optional)', { type: 'date' })}
          {permanent && text('cash_value', 'Cash value', { type: 'number', min: 0, step: '0.01' })}
          {permanent && text('cash_value_as_of', 'Cash value as of', { type: 'date' })}
        </div>
        <div>
          <label htmlFor={`${id}-ben`} className={label}>Beneficiaries (optional)</label>
          <input id={`${id}-ben`} className={field} value={form.beneficiaries} onChange={(e) => set('beneficiaries', e.target.value)} maxLength={1000} placeholder="Names and shares, as on the policy" />
        </div>

        <fieldset className="border border-gray-200 rounded-xl p-3 space-y-3">
          <legend className="text-sm font-medium text-gray-800 px-1">How the premium shows up in transactions</legend>
          <p className="text-xs text-gray-500">Used to find premium payments. A payment matches when it is in this category or names this vendor, and its amount is within 2% of the premium.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${id}-cat`} className={label}>Category</label>
              <select id={`${id}-cat`} className={field} value={form.premium_category_id} onChange={(e) => set('premium_category_id', e.target.value)}>
                <option value="">None</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {text('premium_vendor', 'Vendor name contains', { maxLength: 120 })}
          </div>
          <div className="flex items-center gap-2">
            <input id={`${id}-tasks`} type="checkbox" className="w-5 h-5" checked={form.premium_tasks} onChange={(e) => set('premium_tasks', e.target.checked)} />
            <label htmlFor={`${id}-tasks`} className="text-sm text-gray-700">Add premium due dates to the planner (Inbox › Bills)</label>
          </div>
        </fieldset>

        <div className="flex items-center gap-2">
          <input id={`${id}-active`} type="checkbox" className="w-5 h-5" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
          <label htmlFor={`${id}-active`} className="text-sm text-gray-700">Policy is in force</label>
        </div>
        <div>
          <label htmlFor={`${id}-notes`} className={label}>Notes (optional)</label>
          <textarea id={`${id}-notes`} className={`${field} py-2`} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={2000} />
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 px-4 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={busy} className="min-h-11 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Save
          </button>
        </div>
      </form>
    </div>
  );
}
