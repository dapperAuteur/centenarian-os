'use client';

// components/finance/retirement/PlannerSettings.tsx
// The planner's inputs: age (or birth year), retirement age, life expectancy, yearly spending in
// retirement (an amount or a multiple of current spending), Social Security estimate and start age,
// inflation, the three return presets, the target method and withdrawal rate. Blank = the app's
// default assumption (shown as the placeholder). Saves with PUT /api/finance/retirement/settings.

import { useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { DEFAULTS, PRESET_LABEL, PRESETS } from '@/lib/finance/retirement/logic';
import type { SettingsRow } from '@/lib/finance/retirement/logic';
import { moneyIn, numOrNull } from './format';

const field = 'w-full min-h-11 px-3 border border-gray-300 rounded-lg text-sm bg-white';
const label = 'block text-xs font-medium text-gray-600 mb-1';
const str = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v));

const NUMBER_KEYS = [
  'birth_year', 'current_age', 'retirement_age', 'life_expectancy', 'desired_yearly_spending', 'spending_multiple',
  'social_security_monthly', 'social_security_start_age', 'inflation_rate', 'return_conservative', 'return_middle',
  'return_optimistic', 'withdrawal_rate',
] as const;

export default function PlannerSettings({
  row,
  currentYearly,
  currency,
  onSaved,
}: {
  row: SettingsRow | null;
  currentYearly: number | null;
  currency: string;
  onSaved: (message: string) => void;
}) {
  const id = useId();
  const [form, setForm] = useState(() => ({
    ...Object.fromEntries(NUMBER_KEYS.map((k) => [k, str(row?.[k])])),
    spending_mode: row?.spending_mode === 'multiple' ? 'multiple' : 'amount',
    selected_preset: row?.selected_preset ?? 'middle',
    target_method: row?.target_method === 'withdrawal_rate' ? 'withdrawal_rate' : 'years',
  }) as Record<string, string>);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {
      spending_mode: form.spending_mode,
      selected_preset: form.selected_preset,
      target_method: form.target_method,
    };
    for (const k of NUMBER_KEYS) body[k] = numOrNull(form[k]);
    const res = await offlineFetch('/api/finance/retirement/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error || 'Could not save the planner settings.');
      return;
    }
    onSaved('Planner settings saved.');
  };

  const input = (key: string, text: string, opts: { placeholder?: string | number; step?: string; help?: string } = {}) => (
    <div>
      <label htmlFor={`${id}-${key}`} className={label}>{text}</label>
      <input
        id={`${id}-${key}`}
        className={field}
        type="number"
        step={opts.step ?? '1'}
        value={form[key]}
        placeholder={opts.placeholder === undefined ? '' : String(opts.placeholder)}
        onChange={(e) => set(key, e.target.value)}
      />
      {opts.help && <p className="text-xs text-gray-500 mt-1">{opts.help}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {input('birth_year', 'Birth year', { help: 'Or enter your age.' })}
        {input('current_age', 'Age now')}
        {input('retirement_age', 'Retire at age', { placeholder: DEFAULTS.retirement_age })}
        {input('life_expectancy', 'Plan to age', { placeholder: DEFAULTS.life_expectancy })}
      </div>

      <fieldset className="border border-gray-200 rounded-xl p-3 space-y-3">
        <legend className="text-sm font-medium text-gray-800 px-1">Spending in retirement (today&apos;s dollars)</legend>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 min-h-11">
            <input type="radio" name={`${id}-mode`} className="w-5 h-5" checked={form.spending_mode === 'amount'} onChange={() => set('spending_mode', 'amount')} />
            A yearly amount
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 min-h-11">
            <input type="radio" name={`${id}-mode`} className="w-5 h-5" checked={form.spending_mode === 'multiple'} onChange={() => set('spending_mode', 'multiple')} />
            A multiple of what I spend now
          </label>
        </div>
        {form.spending_mode === 'amount'
          ? input('desired_yearly_spending', 'Yearly spending', { step: '100' })
          : input('spending_multiple', 'Multiple of current spending', {
              step: '0.05',
              placeholder: DEFAULTS.spending_multiple,
              help: currentYearly === null
                ? 'No spending history yet: add transactions or enter a yearly amount instead.'
                : `You spend about ${moneyIn(currentYearly, currency, true)} a year now (transfers left out).`,
            })}
      </fieldset>

      <fieldset className="border border-gray-200 rounded-xl p-3">
        <legend className="text-sm font-medium text-gray-800 px-1">Social Security (your own estimate)</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {input('social_security_monthly', 'Monthly benefit (today’s dollars)', { step: '10', help: 'Type in the estimate from your own statement. Leave blank if none.' })}
          {input('social_security_start_age', 'Starts at age', { help: 'Blank = your retirement age.' })}
        </div>
      </fieldset>

      <fieldset className="border border-gray-200 rounded-xl p-3 space-y-3">
        <legend className="text-sm font-medium text-gray-800 px-1">Assumptions (editable)</legend>
        <p className="text-xs text-gray-500">
          Yearly returns are before inflation. The defaults are round-number assumptions, not predictions or sourced figures.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {input('return_conservative', 'Conservative %', { step: '0.1', placeholder: DEFAULTS.return_conservative })}
          {input('return_middle', 'Middle %', { step: '0.1', placeholder: DEFAULTS.return_middle })}
          {input('return_optimistic', 'Optimistic %', { step: '0.1', placeholder: DEFAULTS.return_optimistic })}
          {input('inflation_rate', 'Inflation %', { step: '0.1', placeholder: DEFAULTS.inflation_rate })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor={`${id}-preset`} className={label}>Preset for accounts without their own return</label>
            <select id={`${id}-preset`} className={field} value={form.selected_preset} onChange={(e) => set('selected_preset', e.target.value)}>
              {PRESETS.map((p) => <option key={p} value={p}>{PRESET_LABEL[p]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-method`} className={label}>How to size the target</label>
            <select id={`${id}-method`} className={field} value={form.target_method} onChange={(e) => set('target_method', e.target.value)}>
              <option value="years">Spending x years in retirement</option>
              <option value="withdrawal_rate">Withdrawal-rate rule of thumb</option>
            </select>
          </div>
          {form.target_method === 'withdrawal_rate' && input('withdrawal_rate', 'Withdrawal rate %', { step: '0.1', placeholder: DEFAULTS.withdrawal_rate, help: '4% means about 25 times the yearly need. A rule of thumb, not a guarantee.' })}
        </div>
      </fieldset>

      <div className="flex justify-end">
        <button type="submit" disabled={busy} className="min-h-11 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Save planner settings
        </button>
      </div>
    </form>
  );
}
