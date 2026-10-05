'use client';

// components/finance/retirement/AccountForm.tsx
// Add or edit an investment account: kind, name, institution, last four, currency, the
// contribution (amount per pay period or percent of pay), the employer match rule and an optional
// expected yearly return. Saves through POST /api/finance/retirement/accounts or PATCH .../[id].

import { useId, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import {
  ACCOUNT_KIND_LABEL,
  ACCOUNT_KINDS,
  CONTRIBUTION_FREQUENCIES,
  FREQUENCY_LABEL,
} from '@/lib/finance/retirement/logic';
import type { AccountView } from '@/lib/finance/retirement/server';
import { numOrNull } from './format';

const field = 'w-full min-h-11 px-3 border border-gray-300 rounded-lg text-sm bg-white';
const label = 'block text-xs font-medium text-gray-600 mb-1';

const str = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v));

export default function AccountForm({
  account,
  homeCurrency,
  onClose,
  onSaved,
}: {
  account: AccountView | null;
  homeCurrency: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const id = useId();
  const [form, setForm] = useState({
    kind: account?.kind ?? '401k',
    name: account?.name ?? '',
    institution: account?.institution ?? '',
    last_four: account?.last_four ?? '',
    currency: account?.currency ?? homeCurrency,
    contribution_type: account?.contribution_type ?? 'none',
    contribution_amount: str(account?.contribution_amount),
    contribution_percent: str(account?.contribution_percent),
    contribution_frequency: account?.contribution_frequency ?? 'biweekly',
    annual_pay: str(account?.annual_pay),
    match_rate_percent: str(account?.match_rate_percent),
    match_limit_percent: str(account?.match_limit_percent),
    match_annual_cap: str(account?.match_annual_cap),
    expected_annual_return: str(account?.expected_annual_return),
    is_active: account?.is_active ?? true,
    notes: account?.notes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      ...form,
      contribution_amount: numOrNull(form.contribution_amount),
      contribution_percent: numOrNull(form.contribution_percent),
      annual_pay: numOrNull(form.annual_pay),
      match_rate_percent: numOrNull(form.match_rate_percent),
      match_limit_percent: numOrNull(form.match_limit_percent),
      match_annual_cap: numOrNull(form.match_annual_cap),
      expected_annual_return: numOrNull(form.expected_annual_return),
      currency: form.currency.trim().toUpperCase(),
    };
    const res = await offlineFetch(account ? `/api/finance/retirement/accounts/${account.id}` : '/api/finance/retirement/accounts', {
      method: account ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error || 'Could not save the account.');
      return;
    }
    onSaved(account ? 'Account saved.' : 'Account added. Add its balance next.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <form onSubmit={submit} className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 id={`${id}-title`} className="text-lg font-semibold text-gray-900">{account ? 'Edit account' : 'Add a retirement account'}</h2>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-gray-100" aria-label="Close">
            <X className="w-5 h-5 text-gray-600" aria-hidden="true" />
          </button>
        </div>
        {error && <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${id}-kind`} className={label}>Kind</label>
            <select id={`${id}-kind`} className={field} value={form.kind} onChange={(e) => set('kind', e.target.value)}>
              {ACCOUNT_KINDS.map((k) => <option key={k} value={k}>{ACCOUNT_KIND_LABEL[k]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-name`} className={label}>Name</label>
            <input id={`${id}-name`} className={field} value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={120} placeholder="Work 401(k)" />
          </div>
          <div>
            <label htmlFor={`${id}-inst`} className={label}>Institution (optional)</label>
            <input id={`${id}-inst`} className={field} value={form.institution} onChange={(e) => set('institution', e.target.value)} maxLength={120} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${id}-four`} className={label}>Last four</label>
              <input id={`${id}-four`} className={field} value={form.last_four} onChange={(e) => set('last_four', e.target.value)} maxLength={4} inputMode="numeric" />
            </div>
            <div>
              <label htmlFor={`${id}-cur`} className={label}>Currency</label>
              <input id={`${id}-cur`} className={field} value={form.currency} onChange={(e) => set('currency', e.target.value)} maxLength={3} />
            </div>
          </div>
        </div>

        <fieldset className="border border-gray-200 rounded-xl p-3 space-y-3">
          <legend className="text-sm font-medium text-gray-800 px-1">Your contribution</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor={`${id}-ctype`} className={label}>How you contribute</label>
              <select id={`${id}-ctype`} className={field} value={form.contribution_type} onChange={(e) => set('contribution_type', e.target.value)}>
                <option value="none">Not contributing</option>
                <option value="amount">A fixed amount</option>
                <option value="percent">A percent of pay</option>
              </select>
            </div>
            {form.contribution_type === 'amount' && (
              <>
                <div>
                  <label htmlFor={`${id}-camt`} className={label}>Amount each time</label>
                  <input id={`${id}-camt`} className={field} type="number" min="0" step="0.01" value={form.contribution_amount} onChange={(e) => set('contribution_amount', e.target.value)} />
                </div>
                <div>
                  <label htmlFor={`${id}-cfreq`} className={label}>How often</label>
                  <select id={`${id}-cfreq`} className={field} value={form.contribution_frequency} onChange={(e) => set('contribution_frequency', e.target.value)}>
                    {CONTRIBUTION_FREQUENCIES.map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}
                  </select>
                </div>
              </>
            )}
            {form.contribution_type === 'percent' && (
              <div>
                <label htmlFor={`${id}-cpct`} className={label}>Percent of pay</label>
                <input id={`${id}-cpct`} className={field} type="number" min="0" max="100" step="0.1" value={form.contribution_percent} onChange={(e) => set('contribution_percent', e.target.value)} />
              </div>
            )}
            <div>
              <label htmlFor={`${id}-pay`} className={label}>Yearly pay (for % and match)</label>
              <input id={`${id}-pay`} className={field} type="number" min="0" step="1" value={form.annual_pay} onChange={(e) => set('annual_pay', e.target.value)} />
            </div>
          </div>
        </fieldset>

        <fieldset className="border border-gray-200 rounded-xl p-3 space-y-2">
          <legend className="text-sm font-medium text-gray-800 px-1">Employer match (optional)</legend>
          <p className="text-xs text-gray-500">Example: 100% of what you put in, up to 4% of pay. Leave blank for no match.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor={`${id}-mrate`} className={label}>Match rate (%)</label>
              <input id={`${id}-mrate`} className={field} type="number" min="0" max="1000" step="1" value={form.match_rate_percent} onChange={(e) => set('match_rate_percent', e.target.value)} placeholder="100" />
            </div>
            <div>
              <label htmlFor={`${id}-mlim`} className={label}>Up to (% of pay)</label>
              <input id={`${id}-mlim`} className={field} type="number" min="0" max="100" step="0.5" value={form.match_limit_percent} onChange={(e) => set('match_limit_percent', e.target.value)} placeholder="4" />
            </div>
            <div>
              <label htmlFor={`${id}-mcap`} className={label}>Yearly cap (optional)</label>
              <input id={`${id}-mcap`} className={field} type="number" min="0" step="1" value={form.match_annual_cap} onChange={(e) => set('match_annual_cap', e.target.value)} />
            </div>
          </div>
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${id}-ret`} className={label}>Expected yearly return % (optional)</label>
            <input id={`${id}-ret`} className={field} type="number" min="-50" max="50" step="0.1" value={form.expected_annual_return} onChange={(e) => set('expected_annual_return', e.target.value)} />
            <p className="text-xs text-gray-500 mt-1">Blank = the planner&apos;s selected preset. Your own guess, not a forecast.</p>
          </div>
          <div className="flex items-center gap-2 sm:pt-6">
            <input id={`${id}-active`} type="checkbox" className="w-5 h-5" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            <label htmlFor={`${id}-active`} className="text-sm text-gray-700">Still contributing / open</label>
          </div>
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
