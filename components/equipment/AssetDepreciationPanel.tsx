'use client';

// Depreciation + Work use sections for one equipment item or vehicle
// (migration 214, lib/equipment/depreciation.ts). Estimates, not tax advice.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Target, TrendingDown } from 'lucide-react';
import BookValueChart from '@/components/equipment/BookValueChart';
import { METHOD_LABELS, type DepreciationMethod } from '@/lib/equipment/depreciation';
import {
  normalizeSettings,
  replacementGoalHref,
  type AssetKind,
  type DepreciationReport,
} from '@/lib/equipment/depreciation-settings';

interface Props {
  kind: AssetKind;
  id: string;
  name: string;
}

type Form = Record<
  | 'cost_basis' | 'in_service_date' | 'method' | 'life_years' | 'life_units' | 'salvage_value' | 'db_factor'
  | 'work_share_override' | 'manual_uses' | 'manual_work_uses' | 'replacement_cost' | 'replacement_date',
  string
> & { used_for_work: boolean };

const money = (n: number | null | undefined) =>
  n === null || n === undefined ? '-' : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number | null) => (n === null ? '-' : `${Math.round(n * 100)}%`);
const str = (n: number | null) => (n === null ? '' : String(n));

const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-11';
const label = 'block text-xs font-medium text-gray-600 mb-1';

export default function AssetDepreciationPanel({ kind, id, name }: Props) {
  const [ready, setReady] = useState(true);
  const [report, setReport] = useState<DepreciationReport | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const unit = kind === 'vehicle' ? 'miles' : 'uses';

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/equipment/depreciation?kind=${kind}&id=${id}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load depreciation');
      setReady(data.ready !== false);
      setReport(data.report);
      const s = normalizeSettings(data.settings);
      setForm({
        cost_basis: str(s.cost_basis),
        in_service_date: s.in_service_date ?? '',
        method: s.method,
        life_years: str(s.life_years),
        life_units: str(s.life_units),
        salvage_value: String(s.salvage_value),
        db_factor: String(s.db_factor),
        used_for_work: s.used_for_work,
        work_share_override: str(s.work_share_override),
        manual_uses: String(s.manual_uses),
        manual_work_uses: String(s.manual_work_uses),
        replacement_cost: str(s.replacement_cost),
        replacement_date: s.replacement_date ?? '',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load depreciation');
    }
  }, [kind, id]);

  useEffect(() => { load(); }, [load]);

  const set = (key: keyof Form, value: string | boolean) => {
    setSaved(false);
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/equipment/depreciation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      setSaved(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (!form || !report) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-5 text-sm text-gray-500" role="status">
        {error ? <span role="alert" className="text-red-600">{error}</span> : 'Loading depreciation...'}
      </div>
    );
  }

  const s = report.summary;
  const year = new Date().getFullYear();
  const replacementHref = replacementGoalHref(kind, id, name, {
    replacement_cost: form.replacement_cost ? Number(form.replacement_cost) : null,
    replacement_date: form.replacement_date || null,
  });

  return (
    <form onSubmit={save} className="space-y-6">
      {/* ── Depreciation ── */}
      <section aria-labelledby={`dep-${id}`} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id={`dep-${id}`} className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-sky-600" aria-hidden="true" /> Depreciation
          </h2>
          <span className="text-[11px] text-gray-400">Estimates, not tax advice</span>
        </div>

        {!ready && (
          <p role="alert" className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Run migration 214 first (supabase/migrations/214_asset_depreciation.sql). Until then these settings can&apos;t be saved.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor={`m-${id}`} className={label}>Method</label>
            <select id={`m-${id}`} className={input} value={form.method} onChange={(e) => set('method', e.target.value)}>
              {(Object.keys(METHOD_LABELS) as DepreciationMethod[]).map((m) => (
                <option key={m} value={m}>{m === 'units_of_use' && kind === 'vehicle' ? 'Units of use (miles)' : METHOD_LABELS[m]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`ly-${id}`} className={label}>Expected life (years)</label>
            <input id={`ly-${id}`} type="number" min="0" step="0.5" className={input} value={form.life_years} onChange={(e) => set('life_years', e.target.value)} />
          </div>
          <div>
            <label htmlFor={`lu-${id}`} className={label}>Expected life ({unit})</label>
            <input id={`lu-${id}`} type="number" min="0" step="1" className={input} value={form.life_units} onChange={(e) => set('life_units', e.target.value)} />
          </div>
          <div>
            <label htmlFor={`cb-${id}`} className={label}>Cost {kind === 'equipment' ? '(blank = purchase price)' : ''}</label>
            <input id={`cb-${id}`} type="number" min="0" step="0.01" className={input} value={form.cost_basis} onChange={(e) => set('cost_basis', e.target.value)} placeholder={report.cost !== null && !form.cost_basis ? String(report.cost) : ''} />
          </div>
          <div>
            <label htmlFor={`sv-${id}`} className={label}>Salvage value</label>
            <input id={`sv-${id}`} type="number" min="0" step="0.01" className={input} value={form.salvage_value} onChange={(e) => set('salvage_value', e.target.value)} />
          </div>
          <div>
            <label htmlFor={`is-${id}`} className={label}>In service {kind === 'equipment' ? '(blank = purchase date)' : ''}</label>
            <input id={`is-${id}`} type="date" className={input} value={form.in_service_date} onChange={(e) => set('in_service_date', e.target.value)} />
          </div>
          {form.method === 'declining_balance' && (
            <div>
              <label htmlFor={`db-${id}`} className={label}>Declining factor (2 = double)</label>
              <input id={`db-${id}`} type="number" min="0.5" step="0.25" className={input} value={form.db_factor} onChange={(e) => set('db_factor', e.target.value)} />
            </div>
          )}
        </div>

        {report.needs ? (
          <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">{report.needs}</p>
        ) : s && (
          <>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat term="Book value today" value={money(s.bookValue)} />
              <Stat term="Depreciated so far" value={money(s.accumulated)} />
              <Stat term={`${year} to date`} value={money(s.thisYearToDate)} />
              <Stat term={s.ratePerUnit !== null ? `Per ${kind === 'vehicle' ? 'mile' : 'use'}` : 'Fully depreciated'} value={s.ratePerUnit !== null ? money(s.ratePerUnit) : s.fullyDepreciatedOn ? new Date(s.fullyDepreciatedOn + 'T00:00:00').toLocaleDateString() : '-'} />
            </dl>
            {report.cost !== null && report.inServiceDate && (
              <BookValueChart cost={report.cost} inServiceDate={report.inServiceDate} schedule={report.schedule} />
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <caption className="sr-only">Depreciation schedule by calendar year</caption>
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th scope="col" className="py-1.5 pr-3 font-medium">Year</th>
                    <th scope="col" className="py-1.5 pr-3 font-medium text-right">Depreciation</th>
                    <th scope="col" className="py-1.5 pr-3 font-medium text-right">Accumulated</th>
                    <th scope="col" className="py-1.5 font-medium text-right">Book value (end)</th>
                  </tr>
                </thead>
                <tbody>
                  {report.schedule.map((r) => (
                    <tr key={r.period} className={`border-b border-gray-50 ${r.period === String(year) ? 'bg-sky-50' : ''}`}>
                      <td className="py-1.5 pr-3 text-gray-700">{r.period}</td>
                      <td className="py-1.5 pr-3 text-right text-gray-700">{money(r.depreciation)}</td>
                      <td className="py-1.5 pr-3 text-right text-gray-500">{money(r.accumulated)}</td>
                      <td className="py-1.5 text-right font-medium text-gray-900">{money(r.bookValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
          <div>
            <label htmlFor={`rc-${id}`} className={label}>Replacement cost</label>
            <input id={`rc-${id}`} type="number" min="0" step="0.01" className={input} value={form.replacement_cost} onChange={(e) => set('replacement_cost', e.target.value)} />
          </div>
          <div>
            <label htmlFor={`rd-${id}`} className={label}>Replace by</label>
            <input id={`rd-${id}`} type="date" className={input} value={form.replacement_date} onChange={(e) => set('replacement_date', e.target.value)} />
          </div>
          <div className="flex items-end">
            <Link href={replacementHref} className="min-h-11 w-full flex items-center justify-center gap-1.5 px-3 rounded-lg text-sm font-medium bg-sky-50 text-sky-700 hover:bg-sky-100 transition">
              <Target className="w-4 h-4" aria-hidden="true" /> Save for replacement
            </Link>
          </div>
        </div>
      </section>

      {/* ── Work use ── */}
      <section aria-labelledby={`work-${id}`} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <h2 id={`work-${id}`} className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <Briefcase className="w-4 h-4 text-sky-600" aria-hidden="true" /> Work use
        </h2>
        <label className="flex items-center gap-2 text-sm text-gray-700 min-h-11">
          <input type="checkbox" className="w-4 h-4" checked={form.used_for_work} onChange={(e) => set('used_for_work', e.target.checked)} />
          Used for work
        </label>
        <p className="text-xs text-gray-500">
          {kind === 'equipment'
            ? 'Each planner task (including synced Google Calendar events), workout, trip or focus session linked to this item counts as a use. In a task, use "Used equipment" and tick "for work" to count it as a work use.'
            : 'Miles come from this vehicle\'s trips. Trips with purpose "work" or tax category "business" count as work miles.'}
        </p>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat term={`All ${unit}`} value={report.uses.all.toLocaleString()} />
          <Stat term={`Work ${unit}`} value={report.uses.work.toLocaleString()} />
          <Stat term={`Work share ${year}`} value={pct(report.workShareThisYear)} />
          <Stat term={`Cost per ${kind === 'vehicle' ? 'mile' : 'use'}`} value={money(report.costPerUse)} />
        </dl>
        {form.used_for_work && s && (
          <p className="text-sm text-gray-700 bg-sky-50 rounded-lg p-3">
            Work-share depreciation for {year} so far: <strong>{money(report.workDepreciationThisYear)}</strong>
            {' '}({pct(report.workShareThisYear)} of {money(s.thisYearToDate)}). Keep this with your business expense records; confirm the tax treatment with a tax professional.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor={`mu-${id}`} className={label}>{kind === 'vehicle' ? 'Miles' : 'Uses'} outside the app</label>
            <input id={`mu-${id}`} type="number" min="0" step="1" className={input} value={form.manual_uses} onChange={(e) => set('manual_uses', e.target.value)} />
          </div>
          <div>
            <label htmlFor={`mw-${id}`} className={label}>...of which for work</label>
            <input id={`mw-${id}`} type="number" min="0" step="1" className={input} value={form.manual_work_uses} onChange={(e) => set('manual_work_uses', e.target.value)} />
          </div>
          <div>
            <label htmlFor={`wo-${id}`} className={label}>Work share override (%)</label>
            <input id={`wo-${id}`} type="number" min="0" max="100" step="1" className={input} value={form.work_share_override} onChange={(e) => set('work_share_override', e.target.value)} placeholder="Computed" />
          </div>
        </div>
      </section>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button type="submit" disabled={saving || !ready} className="min-h-11 px-4 rounded-lg text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 transition">
          {saving ? 'Saving...' : 'Save depreciation and work use'}
        </button>
        {saved && <span role="status" className="text-sm text-emerald-700">Saved.</span>}
        {error && <span role="alert" className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}

function Stat({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] text-gray-500 uppercase tracking-wide">{term}</dt>
      <dd className="text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  );
}
