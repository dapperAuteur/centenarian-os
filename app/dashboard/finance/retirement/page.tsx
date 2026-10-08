// app/dashboard/finance/retirement/page.tsx
// Retirement: investment accounts (401(k), IRA, HSA, brokerage, pension...) with their latest
// balance, "add balance" per account, the projection to retirement age (your plan and the three
// presets, in today's dollars), the target and gap, the extra needed per month, a small net worth
// line, and the planner's settings. Every figure is an estimate, not financial advice.
//
// Balances are typed in by hand for now; a statement import may add them later.
// Data: GET /api/finance/retirement, /api/finance/accounts (net worth); POST/PATCH/DELETE
// .../retirement/accounts, POST/DELETE .../retirement/snapshots, PUT .../retirement/settings.
// Math: lib/finance/retirement/logic.ts.
'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Check, Info, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTrackPageView } from '@/lib/hooks/useTrackPageView';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { todayLocal } from '@/lib/dates/local';
import { ACCOUNT_KIND_LABEL, FREQUENCY_LABEL, PRESET_LABEL } from '@/lib/finance/retirement/logic';
import type { AccountKind, ContributionFrequency } from '@/lib/finance/retirement/logic';
import type { AccountView, RetirementOverview } from '@/lib/finance/retirement/server';
import AccountForm from '@/components/finance/retirement/AccountForm';
import PlannerSettings from '@/components/finance/retirement/PlannerSettings';
import ProjectionChart from '@/components/finance/retirement/ProjectionChart';
import { formatDate, moneyIn, numOrNull, pct } from '@/components/finance/retirement/format';

interface CashAccount {
  balance: number;
  balance_home?: number | null;
  currency?: string;
  home_currency?: string;
  is_active?: boolean;
}

export default function RetirementPage() {
  useTrackPageView('finance', '/dashboard/finance/retirement');
  const [today] = useState(() => todayLocal());
  const [data, setData] = useState<RetirementOverview | null>(null);
  const [cashTotal, setCashTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<AccountView | null | 'new'>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, accRes] = await Promise.all([
        offlineFetch(`/api/finance/retirement?today=${today}`),
        offlineFetch('/api/finance/accounts'),
      ]);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load retirement accounts.');
      setData(json as RetirementOverview);
      if (accRes.ok) {
        const accounts = (await accRes.json()) as CashAccount[];
        const total = accounts.reduce((s, a) => {
          const same = !a.currency || !a.home_currency || a.currency === a.home_currency;
          const v = same ? Number(a.balance) : a.balance_home;
          return v === null || v === undefined || !Number.isFinite(v) ? s : s + v;
        }, 0);
        setCashTotal(Math.round(total * 100) / 100);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load retirement accounts.');
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const saved = (message: string) => {
    setEditing(null);
    setNotice(message);
    load();
  };

  const removeAccount = async (a: AccountView) => {
    if (!window.confirm(`Delete ${a.name} and its balance history?`)) return;
    const res = await offlineFetch(`/api/finance/retirement/accounts/${a.id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error || 'Could not delete the account.');
    saved('Account deleted.');
  };

  const cur = data?.home_currency ?? 'USD';
  const plan = data?.plan ?? null;
  const settings = data?.settings;
  const investTotal = plan?.current_total ?? 0;
  const netWorth = cashTotal === null ? null : cashTotal + investTotal + (data?.policy_cash_value ?? 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/finance" className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-gray-100" aria-label="Back to Finance">
            <ArrowLeft className="w-5 h-5 text-gray-600" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Retirement</h1>
            <p className="text-sm text-gray-500">Your retirement accounts and a planner. Estimates, not financial advice.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          disabled={!data?.ready}
          className="min-h-11 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> Add account
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
            <p>Retirement accounts need a database update (supabase/migrations/215_retirement_insurance.sql). Nothing else changes until it is applied.</p>
          </div>
        </div>
      )}

      {data?.ready && settings && (
        <>
          {/* Headline figures */}
          <section aria-labelledby="plan-heading" className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <h2 id="plan-heading" className="text-lg font-semibold text-gray-900">The plan, in today&apos;s dollars</h2>
            {plan?.years_to_retirement === null || plan === null ? (
              <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Enter your age or birth year in the planner settings below to see a projection.
              </p>
            ) : (
              <>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Stat label="Saved now" value={moneyIn(plan.current_total, cur, true)} />
                  <Stat
                    label={plan.retired ? 'Saved at retirement' : `Projected at ${settings.retirement_age}`}
                    value={moneyIn(plan.projected_real, cur, true)}
                    sub={plan.projected_nominal !== null && !plan.retired ? `${moneyIn(plan.projected_nominal, cur, true)} before inflation` : undefined}
                  />
                  <Stat
                    label="Target"
                    value={plan.target.target === null ? 'Set spending' : moneyIn(plan.target.target, cur, true)}
                    sub={plan.target.yearly_spending !== null ? `${moneyIn(plan.target.yearly_spending, cur, true)} a year for ${plan.target.years_in_retirement} years` : undefined}
                  />
                  <Stat
                    label={plan.gap !== null && plan.gap <= 0 ? 'Ahead of target' : 'Gap'}
                    value={plan.gap === null ? '—' : moneyIn(Math.abs(plan.gap), cur, true)}
                    tone={plan.gap !== null && plan.gap > 0 ? 'amber' : plan.gap !== null ? 'green' : undefined}
                  />
                </dl>

                {plan.gap !== null && plan.gap > 0 && plan.extra_monthly_needed !== null && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
                    <p className="font-medium">
                      About {moneyIn(plan.extra_monthly_needed, cur, true)} more a month would close the gap
                      ({moneyIn(plan.total_monthly_needed, cur, true)} a month in total, including the{' '}
                      {moneyIn(plan.monthly_contributions, cur, true)} going in now with any match).
                    </p>
                    <p className="text-xs mt-1">
                      Figured at the {PRESET_LABEL[settings.selected_preset].toLowerCase()} preset ({pct(settings.returns[settings.selected_preset])} a year, about{' '}
                      {pct(plan.selected_real_return)} after {pct(settings.inflation_rate)} inflation).
                    </p>
                  </div>
                )}
                {plan.retired && <p className="text-sm text-gray-600">You are at or past your retirement age, so there is no &quot;per month&quot; figure.</p>}
                {plan.target.social_security_yearly > 0 && plan.target.target !== null && (
                  <p className="text-sm text-gray-600">
                    Social Security ({moneyIn(plan.target.social_security_yearly, cur, true)} a year from age {settings.social_security_start_age}) lowers the target by{' '}
                    {moneyIn(plan.target.social_security_offset, cur, true)}.
                  </p>
                )}
                {plan.target.target === null && settings.spending_mode === 'multiple' && (
                  <p className="text-sm text-amber-900">No spending history yet to base the target on. Enter a yearly amount instead.</p>
                )}

                <ProjectionChart series={plan.series} target={plan.target.target} currency={cur} returns={settings.returns} />
              </>
            )}

            {netWorth !== null && (
              <p className="text-sm text-gray-700 border-t border-gray-100 pt-3">
                <span className="font-medium">Net worth (estimate): {moneyIn(netWorth, cur, true)}</span>{' '}
                <span className="text-gray-500">
                  = accounts {moneyIn(cashTotal, cur, true)} (cards and loans subtracted) + retirement {moneyIn(investTotal, cur, true)}
                  {data.policy_cash_value > 0 ? ` + policy cash value ${moneyIn(data.policy_cash_value, cur, true)}` : ''}.
                </span>{' '}
                <Link href="/dashboard/finance/wallet" className="inline-flex min-h-11 items-center text-sky-700 underline underline-offset-2">
                  Full net worth, with equipment and vehicles, in the Wallet
                </Link>
              </p>
            )}
            {data.unconverted > 0 && (
              <p className="text-xs text-amber-900">
                {data.unconverted} account{data.unconverted === 1 ? ' is' : 's are'} in another currency with no exchange rate yet, so not counted in the totals.
              </p>
            )}
            {settings.defaulted.length > 0 && (
              <p className="text-xs text-gray-500 flex gap-1">
                <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
                Using default assumptions for: {settings.defaulted.map((d) => d.replace(/_/g, ' ')).join(', ')}. Change them in the planner settings.
              </p>
            )}
          </section>

          {/* Accounts */}
          <section aria-labelledby="accounts-heading" className="space-y-3">
            <h2 id="accounts-heading" className="text-lg font-semibold text-gray-900">Accounts</h2>
            {data.accounts.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-6 text-center text-sm text-gray-600">
                No retirement accounts yet. Add a 401(k), IRA, HSA, brokerage account or pension to start.
              </div>
            ) : (
              <ul className="space-y-3">
                {data.accounts.map((a) => (
                  <AccountCard
                    key={a.id}
                    account={a}
                    today={today}
                    projection={plan?.accounts.find((p) => p.id === a.id)}
                    retirementAge={settings.retirement_age}
                    homeCurrency={cur}
                    onEdit={() => setEditing(a)}
                    onDelete={() => removeAccount(a)}
                    onChanged={saved}
                    onError={setError}
                  />
                ))}
              </ul>
            )}
            <p className="text-xs text-gray-500">
              Balances are entered by hand for now: add one from each statement. Importing them from statements may come later.
            </p>
          </section>

          {/* Settings */}
          <section aria-labelledby="settings-heading" className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
            <h2 id="settings-heading" className="text-lg font-semibold text-gray-900">Planner settings</h2>
            <PlannerSettings row={data.settings_row} currentYearly={data.current_spending.yearly} currency={cur} onSaved={saved} />
          </section>

          <p className="text-xs text-gray-500">
            These figures are estimates from your own numbers and the assumptions shown. Real returns, inflation, taxes, fees and benefits will differ. This is not financial advice.{' '}
            <Link href="/dashboard/finance/insurance" className="text-sky-700 underline">Life insurance</Link>
          </p>
        </>
      )}

      {editing && (
        <AccountForm account={editing === 'new' ? null : editing} homeCurrency={cur} onClose={() => setEditing(null)} onSaved={saved} />
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'amber' | 'green' }) {
  const color = tone === 'amber' ? 'text-amber-700' : tone === 'green' ? 'text-green-700' : 'text-gray-900';
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={`text-xl font-bold ${color}`}>{value}</dd>
      {sub && <dd className="text-xs text-gray-500">{sub}</dd>}
    </div>
  );
}

function AccountCard({
  account: a,
  today,
  projection,
  retirementAge,
  homeCurrency,
  onEdit,
  onDelete,
  onChanged,
  onError,
}: {
  account: AccountView;
  today: string;
  projection: { real: number; rate: number; rate_source: string } | undefined;
  retirementAge: number;
  homeCurrency: string;
  onEdit: () => void;
  onDelete: () => void;
  onChanged: (message: string) => void;
  onError: (message: string) => void;
}) {
  const id = useId();
  const [adding, setAdding] = useState(false);
  const [asOf, setAsOf] = useState(today);
  const [balance, setBalance] = useState('');
  const [ytd, setYtd] = useState('');
  const [busy, setBusy] = useState(false);
  const yearly = a.annual_contribution + a.annual_match;

  const addSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await offlineFetch('/api/finance/retirement/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: a.id, as_of: asOf, balance: numOrNull(balance), contributions_ytd: numOrNull(ytd) }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return onError(json.error || 'Could not save the balance.');
    setAdding(false);
    setBalance('');
    setYtd('');
    onChanged('Balance saved.');
  };

  const removeSnapshot = async (snapId: string) => {
    if (!window.confirm('Delete this balance?')) return;
    const res = await offlineFetch(`/api/finance/retirement/snapshots/${snapId}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return onError(json.error || 'Could not delete the balance.');
    onChanged('Balance deleted.');
  };

  return (
    <li className={`bg-white border rounded-2xl p-4 space-y-3 ${a.is_active ? 'border-gray-200' : 'border-gray-200 opacity-80'}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">
            {a.name}{' '}
            <span className="text-xs font-normal text-gray-500">
              {ACCOUNT_KIND_LABEL[a.kind as AccountKind] ?? a.kind}
              {a.institution ? ` · ${a.institution}` : ''}
              {a.last_four ? ` · ••${a.last_four}` : ''}
              {a.is_active ? '' : ' · closed / not contributing'}
            </span>
          </p>
          <p className="text-2xl font-bold text-gray-900">{a.latest ? moneyIn(a.latest.balance, a.currency) : 'No balance yet'}</p>
          <p className="text-xs text-gray-500">
            {a.latest ? `As of ${formatDate(a.latest.as_of)}` : 'Add a balance from your latest statement.'}
            {a.latest?.contributions_ytd != null ? ` · ${moneyIn(a.latest.contributions_ytd, a.currency)} contributed this year` : ''}
          </p>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={() => setAdding((v) => !v)} className="min-h-11 px-3 rounded-lg bg-sky-50 text-sky-700 text-sm font-medium hover:bg-sky-100" aria-expanded={adding}>
            Add balance
          </button>
          <button type="button" onClick={onEdit} className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-gray-100" aria-label={`Edit ${a.name}`}>
            <Pencil className="w-4 h-4 text-gray-600" aria-hidden="true" />
          </button>
          <button type="button" onClick={onDelete} className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-red-50" aria-label={`Delete ${a.name}`}>
            <Trash2 className="w-4 h-4 text-red-600" aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-700">
        {yearly > 0 ? (
          <>
            {moneyIn(a.annual_contribution, a.currency, true)} a year from you
            {a.contribution_type === 'amount' ? ` (${FREQUENCY_LABEL[a.contribution_frequency as ContributionFrequency]?.toLowerCase() ?? ''})` : ''}
            {a.annual_match > 0 ? ` + ${moneyIn(a.annual_match, a.currency, true)} employer match` : ''}
          </>
        ) : (
          'No contributions set.'
        )}
        {a.match_summary ? ` · ${a.match_summary}` : ''}
      </p>
      {a.match_needs_pay && <p className="text-xs text-amber-900">Add your yearly pay to work out the match (it is limited to a percent of pay).</p>}
      {projection && (
        <p className="text-xs text-gray-500">
          Projected at {retirementAge}: {moneyIn(projection.real, homeCurrency, true)} in today&apos;s dollars at {pct(projection.rate)} a year
          {projection.rate_source === 'account' ? ' (this account’s own rate)' : ' (preset)'}.
        </p>
      )}

      {adding && (
        <form onSubmit={addSnapshot} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end border-t border-gray-100 pt-3">
          <div>
            <label htmlFor={`${id}-asof`} className="block text-xs text-gray-600 mb-1">As of</label>
            <input id={`${id}-asof`} type="date" required value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-full min-h-11 px-3 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label htmlFor={`${id}-bal`} className="block text-xs text-gray-600 mb-1">Balance</label>
            <input id={`${id}-bal`} type="number" step="0.01" required value={balance} onChange={(e) => setBalance(e.target.value)} className="w-full min-h-11 px-3 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label htmlFor={`${id}-ytd`} className="block text-xs text-gray-600 mb-1">Contributed this year (optional)</label>
            <input id={`${id}-ytd`} type="number" step="0.01" min="0" value={ytd} onChange={(e) => setYtd(e.target.value)} className="w-full min-h-11 px-3 border border-gray-300 rounded-lg text-sm" />
          </div>
          <button type="submit" disabled={busy} className="min-h-11 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50">
            Save balance
          </button>
        </form>
      )}

      {a.history.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-sky-700 min-h-11 flex items-center">Balance history ({a.history.length})</summary>
          <ul className="divide-y divide-gray-100">
            {a.history.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-1">
                <span className="text-gray-700">{formatDate(s.as_of)}</span>
                <span className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{moneyIn(s.balance, a.currency)}</span>
                  <button type="button" onClick={() => removeSnapshot(s.id)} className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-red-50" aria-label={`Delete the balance from ${formatDate(s.as_of)}`}>
                    <Trash2 className="w-4 h-4 text-red-600" aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}
