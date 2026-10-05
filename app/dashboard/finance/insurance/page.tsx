// app/dashboard/finance/insurance/page.tsx
// Life insurance: policies with coverage, premium, paid to date (premium payments matched from
// transactions by category or vendor and amount), next due date and whether it is covered, cash
// value for permanent policies, and term-end warnings in amber. Totals: coverage, cash value,
// yearly premiums. Opening the page also brings premium due-date planner tasks up to date for
// policies that ask for them (Inbox › Bills).
//
// Data: GET/POST /api/finance/insurance, PATCH/DELETE /api/finance/insurance/[id],
// POST /api/finance/insurance/premium-tasks. Rules: lib/finance/insurance/logic.ts.
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Check, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTrackPageView } from '@/lib/hooks/useTrackPageView';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { todayLocal } from '@/lib/dates/local';
import { POLICY_KIND_LABEL, PREMIUM_FREQUENCY_LABEL } from '@/lib/finance/insurance/logic';
import type { PolicyKind, PremiumFrequency } from '@/lib/finance/insurance/logic';
import type { InsuranceOverview, PolicyView } from '@/lib/finance/insurance/server';
import PolicyForm from '@/components/finance/insurance/PolicyForm';
import { formatDate, moneyIn } from '@/components/finance/retirement/format';

export default function InsurancePage() {
  useTrackPageView('finance', '/dashboard/finance/insurance');
  const [today] = useState(() => todayLocal());
  const [data, setData] = useState<InsuranceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<PolicyView | null | 'new'>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await offlineFetch(`/api/finance/insurance?today=${today}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load policies.');
      setData(json as InsuranceOverview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load policies.');
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    load();
    // A planner task is a convenience: failures here never block the page.
    offlineFetch(`/api/finance/insurance/premium-tasks?today=${today}`, { method: 'POST' }).catch(() => {});
  }, [load, today]);

  const saved = (message: string) => {
    setEditing(null);
    setNotice(message);
    load();
    offlineFetch(`/api/finance/insurance/premium-tasks?today=${today}`, { method: 'POST' }).catch(() => {});
  };

  const remove = async (p: PolicyView) => {
    if (!window.confirm(`Delete the ${p.insurer} policy?`)) return;
    const res = await offlineFetch(`/api/finance/insurance/${p.id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error || 'Could not delete the policy.');
    saved('Policy deleted.');
  };

  const cur = data?.home_currency ?? 'USD';
  const endingSoon = (data?.policies ?? []).filter((p) => p.is_active && p.term.status === 'ending_soon');

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/finance" className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-gray-100" aria-label="Back to Finance">
            <ArrowLeft className="w-5 h-5 text-gray-600" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Life insurance</h1>
            <p className="text-sm text-gray-500">Policies, coverage and premiums in one place.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          disabled={!data?.ready}
          className="min-h-11 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> Add policy
        </button>
      </div>

      {error && <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {notice && (
        <div role="status" className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" /> {notice}
        </div>
      )}
      {loading && !data && (
        <div className="flex justify-center py-16" role="status">
          <Loader2 className="w-6 h-6 animate-spin text-sky-600" aria-hidden="true" />
          <span className="sr-only">Loading...</span>
        </div>
      )}

      {data && !data.ready && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">Run migration 215 first.</p>
            <p>Insurance policies need a database update (supabase/migrations/215_retirement_insurance.sql). Nothing else changes until it is applied.</p>
          </div>
        </div>
      )}

      {data?.ready && (
        <>
          <section aria-label="Totals" className="bg-white border border-gray-200 rounded-2xl p-5">
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <dt className="text-xs text-gray-500">Total coverage</dt>
                <dd className="text-xl font-bold text-gray-900">{moneyIn(data.totals.coverage, cur, true)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Premiums per year</dt>
                <dd className="text-xl font-bold text-gray-900">{moneyIn(data.totals.yearly_premiums, cur)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Cash value (permanent)</dt>
                <dd className="text-xl font-bold text-gray-900">{moneyIn(data.totals.cash_value, cur)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Policies in force</dt>
                <dd className="text-xl font-bold text-gray-900">{data.totals.active}</dd>
              </div>
            </dl>
            <p className="text-xs text-gray-500 mt-3">
              Cash value also counts toward net worth on the <Link href="/dashboard/finance/retirement" className="text-sky-700 underline">Retirement</Link> page.
              If you also track it there as a &quot;Whole life cash value&quot; account, keep it in one place only so it isn&apos;t counted twice.
            </p>
          </section>

          {endingSoon.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
              <p>
                {endingSoon.length === 1 ? 'A term policy ends' : `${endingSoon.length} term policies end`} within a year:{' '}
                {endingSoon.map((p) => `${p.insurer} (${formatDate(p.term_end_date)})`).join(', ')}. Check whether you still need the coverage.
              </p>
            </div>
          )}

          {data.policies.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-6 text-center text-sm text-gray-600">
              No policies yet. Add a term or permanent life policy to track its coverage and premiums.
            </div>
          ) : (
            <ul className="space-y-3">
              {data.policies.map((p) => (
                <PolicyCard key={p.id} policy={p} homeCurrency={cur} onEdit={() => setEditing(p)} onDelete={() => remove(p)} />
              ))}
            </ul>
          )}
        </>
      )}

      {editing && data && (
        <PolicyForm
          policy={editing === 'new' ? null : editing}
          homeCurrency={cur}
          categories={data.categories}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
    </div>
  );
}

function PolicyCard({ policy: p, homeCurrency, onEdit, onDelete }: { policy: PolicyView; homeCurrency: string; onEdit: () => void; onDelete: () => void }) {
  const c = p.currency || homeCurrency;
  const term = p.term;
  const matchedBy = [p.category_name ? `category "${p.category_name}"` : null, p.premium_vendor ? `vendor "${p.premium_vendor}"` : null].filter(Boolean).join(' or ');
  return (
    <li className={`bg-white border rounded-2xl p-4 space-y-2 ${term.status === 'ending_soon' && p.is_active ? 'border-amber-300' : 'border-gray-200'}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">
            {p.insurer}{' '}
            <span className="text-xs font-normal text-gray-500">
              {POLICY_KIND_LABEL[p.kind as PolicyKind] ?? p.kind}
              {p.policy_last_four ? ` · ••${p.policy_last_four}` : ''}
              {p.is_active ? '' : ' · not in force'}
              {c !== homeCurrency ? ` · ${c} (not in totals)` : ''}
            </span>
          </p>
          <p className="text-2xl font-bold text-gray-900">{p.coverage_amount != null ? `${moneyIn(Number(p.coverage_amount), c, true)} coverage` : 'Coverage not set'}</p>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={onEdit} className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-gray-100" aria-label={`Edit the ${p.insurer} policy`}>
            <Pencil className="w-4 h-4 text-gray-600" aria-hidden="true" />
          </button>
          <button type="button" onClick={onDelete} className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-red-50" aria-label={`Delete the ${p.insurer} policy`}>
            <Trash2 className="w-4 h-4 text-red-600" aria-hidden="true" />
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <dt className="text-xs text-gray-500">Premium</dt>
          <dd className="text-gray-900">
            {p.premium_amount != null ? `${moneyIn(Number(p.premium_amount), c)} ${PREMIUM_FREQUENCY_LABEL[p.premium_frequency as PremiumFrequency]?.toLowerCase() ?? ''}` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Paid to date</dt>
          <dd className="text-gray-900">
            {moneyIn(p.premium.paid_to_date, c)}
            <span className="text-xs text-gray-500"> ({moneyIn(p.premium.paid_this_year, c)} this year)</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Next due</dt>
          <dd className="text-gray-900">
            {p.premium.next_due ? (
              <>
                {formatDate(p.premium.next_due)}{' '}
                {p.premium.next_due_paid ? (
                  <span className="text-xs text-green-700">paid</span>
                ) : (
                  <span className="text-xs text-gray-500">not paid yet</span>
                )}
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">{p.kind === 'term_life' ? 'Term ends' : 'Started'}</dt>
          <dd className={term.status === 'ending_soon' || term.status === 'ended' ? 'text-amber-800 font-medium' : 'text-gray-900'}>
            {p.kind === 'term_life' || p.term_end_date ? (p.term_end_date ? formatDate(p.term_end_date) : '—') : formatDate(p.start_date) || '—'}
            {term.status === 'ending_soon' && term.days_left !== null && <span className="block text-xs">in {term.days_left} days</span>}
            {term.status === 'ended' && <span className="block text-xs">ended</span>}
          </dd>
        </div>
      </dl>

      {p.permanent && (
        <p className="text-sm text-gray-700">
          Cash value: {p.cash_value != null ? moneyIn(Number(p.cash_value), c) : 'not entered'}
          {p.cash_value_as_of ? ` (as of ${formatDate(p.cash_value_as_of)})` : ''}
        </p>
      )}
      {p.beneficiaries && <p className="text-sm text-gray-700">Beneficiaries: {p.beneficiaries}</p>}
      <p className="text-xs text-gray-500">
        {matchedBy
          ? `Premium payments are found by ${matchedBy}. ${p.premium.payments.length} found${p.premium.last_paid ? `, last on ${formatDate(p.premium.last_paid)}` : ''}.`
          : 'Link a category or vendor to find premium payments in your transactions.'}
        {p.premium_tasks ? ' Due dates go to Inbox › Bills in the planner.' : ''}
      </p>
    </li>
  );
}
