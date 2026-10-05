'use client';

// components/finance/debt/PlanBuilder.tsx
// The debt-free plan: strategy, extra monthly amount, custom order, promo protection; a
// month-by-month schedule, a balance-over-time chart, the debt-free date and interest saved versus
// paying only minimums. Computed in the browser from the debts (lib/finance/debt/plan.ts);
// saving stores the settings and a baseline so progress can be checked later (migration 211).

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Loader2, Trash2 } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { todayLocal } from '@/lib/dates/local';
import { comparePlan, DEFAULT_STRATEGY, STRATEGIES, STRATEGY_LABELS } from '@/lib/finance/debt/plan';
import type { Strategy } from '@/lib/finance/debt/plan';
import { toPlanDebts } from '@/lib/finance/debt/overview';
import { money, shortDate } from '@/lib/finance/debt/due';
import type { DebtRow, SavedPlan, SavedPlanDetail } from './types';

const STRATEGY_HELP: Record<Strategy, string> = {
  avalanche:
    'Extra money goes to the debt charging the highest interest. Any deferred-interest promo balance is paid down fast enough to be cleared a payment before its deadline. Pays the least interest.',
  snowball: 'Extra money goes to the smallest balance first, for quick wins. Usually costs more interest than avalanche.',
  promo_first: 'All extra money goes to deferred-interest promo balances, earliest deadline first, then highest interest.',
  custom: 'You choose the order. Debts you leave out follow in highest-interest order.',
};

export default function PlanBuilder({ debts, today }: { debts: DebtRow[]; today: string }) {
  const id = useId();
  const [strategy, setStrategy] = useState<Strategy>(DEFAULT_STRATEGY);
  const [extra, setExtra] = useState('0');
  const [protectPromos, setProtectPromos] = useState(true);
  const [order, setOrder] = useState<string[]>(() => debts.filter((d) => d.balance > 0).map((d) => d.id));

  const planDebts = useMemo(() => toPlanDebts(debts), [debts]);
  const extraNum = Math.max(0, Number(extra) || 0);
  const result = useMemo(
    () =>
      comparePlan(planDebts, {
        strategy,
        extraMonthly: extraNum,
        customOrder: order,
        protectPromos,
        startDate: today,
      }),
    [planDebts, strategy, extraNum, order, protectPromos, today],
  );
  const { plan, minimumsOnly } = result;
  const names = useMemo(() => new Map(debts.map((d) => [d.id, d.name])), [debts]);

  const chartData = useMemo(() => {
    const len = Math.min(360, Math.max(plan.schedule.length, minimumsOnly.schedule.length));
    return Array.from({ length: len }, (_, i) => ({
      label: plan.schedule[i]?.date ?? minimumsOnly.schedule[i]?.date ?? '',
      plan: plan.schedule[i]?.balance ?? (i >= plan.schedule.length && !plan.neverPaysOff ? 0 : null),
      minimums: minimumsOnly.schedule[i]?.balance ?? (i >= minimumsOnly.schedule.length && !minimumsOnly.neverPaysOff ? 0 : null),
    }));
  }, [plan, minimumsOnly]);

  const move = (index: number, by: number) => {
    setOrder((prev) => {
      const next = [...prev];
      const target = index + by;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  if (!planDebts.length) {
    return <p className="text-sm text-gray-600 bg-white border border-gray-200 rounded-xl p-4">No balances to plan for.</p>;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-strategy`} className="block text-sm font-medium text-gray-700">Strategy</label>
          <select
            id={`${id}-strategy`}
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as Strategy)}
            className="mt-1 w-full min-h-11 rounded-lg border border-gray-300 px-3 text-sm"
          >
            {STRATEGIES.map((s) => (
              <option key={s} value={s}>{STRATEGY_LABELS[s]}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">{STRATEGY_HELP[strategy]}</p>
        </div>
        <div>
          <label htmlFor={`${id}-extra`} className="block text-sm font-medium text-gray-700">Extra each month on top of minimums ($)</label>
          <input
            id={`${id}-extra`}
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-lg border border-gray-300 px-3 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Monthly budget: {money(plan.monthlyBudget)}. When a debt is paid off, its minimum moves to the next one.
          </p>
        </div>
      </div>

      {strategy !== 'promo_first' && (
        <label className="min-h-11 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={protectPromos} onChange={(e) => setProtectPromos(e.target.checked)} className="w-5 h-5" />
          Clear deferred-interest promo balances before their deadline first
        </label>
      )}

      {strategy === 'custom' && (
        <div>
          <p className="text-sm font-medium text-gray-700" id={`${id}-order`}>Order (first paid first)</p>
          <ol aria-labelledby={`${id}-order`} className="mt-1 space-y-1">
            {order.map((debtId, i) => (
              <li key={debtId} className="flex items-center gap-2 text-sm bg-gray-50 border border-gray-200 rounded-lg pl-3">
                <span className="flex-1">{i + 1}. {names.get(debtId) ?? 'Account'}</span>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${names.get(debtId) ?? 'account'} up`}
                  className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-gray-200 disabled:opacity-40"
                >
                  <ArrowUp className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label={`Move ${names.get(debtId) ?? 'account'} down`}
                  className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-gray-200 disabled:opacity-40"
                >
                  <ArrowDown className="w-4 h-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div role="status" className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Debt-free</p>
          <p className="text-lg font-bold text-gray-900">
            {plan.neverPaysOff ? 'Not with this budget' : shortDate(plan.debtFreeDate!, today)}
          </p>
          {!plan.neverPaysOff && <p className="text-xs text-gray-500">{plan.months} months</p>}
        </div>
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Interest you&apos;ll pay</p>
          <p className="text-lg font-bold text-gray-900">{money(plan.totalInterest)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Saved versus minimums only</p>
          <p className="text-lg font-bold text-gray-900">
            {result.interestSaved !== null
              ? money(result.interestSaved)
              : minimumsOnly.neverPaysOff
                ? 'Minimums never pay it off'
                : '—'}
          </p>
          {result.monthsSooner !== null && result.monthsSooner > 0 && (
            <p className="text-xs text-gray-500">{result.monthsSooner} months sooner</p>
          )}
        </div>
      </div>

      {plan.neverPaysOff && (
        <p role="alert" className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          The monthly budget doesn&apos;t cover the interest, so the balance never reaches zero. Add an extra amount.
        </p>
      )}
      {plan.missedPromos.length > 0 && (
        <div role="alert" className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
          {plan.missedPromos.map((m) => (
            <p key={`${m.debtId}${m.promoId}`} className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              {names.get(m.debtId)}: {money(m.balance)} of a promo balance is still owed at its {shortDate(m.date, today)} deadline, so{' '}
              {m.backInterestEstimated ? 'an estimated ' : ''}
              {money(m.backInterest)} of deferred interest is charged. Raise the extra amount or protect promo deadlines.
            </p>
          ))}
        </div>
      )}
      {plan.estimatedMinimums.length > 0 && (
        <p className="text-xs text-gray-500">
          Minimum estimated (no statement yet) for {plan.estimatedMinimums.map((x) => names.get(x)).join(', ')}.
        </p>
      )}

      <figure>
        <figcaption className="text-sm font-medium text-gray-700 mb-2">Balance owed over time</figcaption>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="label" tickFormatter={(v: string) => (v ? shortDate(v, '0000') : '')} tick={{ fontSize: 11, fill: '#6b7280' }} minTickGap={32} />
              <YAxis tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} tick={{ fontSize: 11, fill: '#6b7280' }} width={48} />
              <Tooltip
                formatter={(v, name) => [money(Number(v ?? 0)), name === 'plan' ? 'This plan' : 'Minimums only']}
                labelFormatter={(v: string) => (v ? shortDate(v, '0000') : '')}
              />
              <Legend formatter={(v: string) => (v === 'plan' ? 'This plan' : 'Minimums only')} />
              <Area type="monotone" dataKey="plan" stroke="#0284c7" strokeWidth={2} fill="#0284c7" fillOpacity={0.12} connectNulls={false} />
              <Line type="monotone" dataKey="minimums" stroke="#6b7280" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </figure>

      <details className="rounded-lg border border-gray-200">
        <summary className="min-h-11 flex items-center px-3 text-sm font-medium text-sky-700 cursor-pointer">
          Month-by-month schedule ({plan.schedule.length} months)
        </summary>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <caption className="sr-only">Planned payments, interest and balance by month</caption>
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th scope="col" className="text-left px-3 py-2 font-medium text-gray-600">Month</th>
                {planDebts.map((d) => (
                  <th key={d.id} scope="col" className="text-right px-3 py-2 font-medium text-gray-600">{d.name}</th>
                ))}
                <th scope="col" className="text-right px-3 py-2 font-medium text-gray-600">Interest</th>
                <th scope="col" className="text-right px-3 py-2 font-medium text-gray-600">Still owed</th>
              </tr>
            </thead>
            <tbody>
              {plan.schedule.map((m) => (
                <tr key={m.month} className="border-t border-gray-100">
                  <th scope="row" className="text-left px-3 py-1.5 font-normal text-gray-700 whitespace-nowrap">{shortDate(m.date, '0000')}</th>
                  {planDebts.map((d) => (
                    <td key={d.id} className="text-right px-3 py-1.5 text-gray-900">
                      {m.debts[d.id]?.payment ? money(m.debts[d.id].payment) : '—'}
                    </td>
                  ))}
                  <td className="text-right px-3 py-1.5 text-gray-700">{money(m.interest)}</td>
                  <td className="text-right px-3 py-1.5 text-gray-900">{money(m.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="text-xs text-gray-500">
        Estimates, not advice: interest is balance × APR ÷ 12 a month on the interest-bearing part, minimums stay at today&apos;s
        amount, and nothing new is charged. Money above the minimum is assumed to go where the plan puts it; ask your card issuer
        to apply extra payments to a promo balance. A missed promo charges the statement&apos;s deferred interest, or an estimate.
      </p>

      <SavedPlans
        today={today}
        current={{ strategy, extra_monthly: extraNum, custom_order: order, protect_promos: protectPromos }}
        onLoad={(p) => {
          setStrategy(p.strategy);
          setExtra(String(Number(p.extra_monthly) || 0));
          setProtectPromos(p.protect_promos ?? true);
          if (p.custom_order?.length) {
            const known = p.custom_order.filter((x) => order.includes(x));
            setOrder([...known, ...order.filter((x) => !known.includes(x))]);
          }
        }}
      />
    </div>
  );
}

// ── Saved plans ─────────────────────────────────────────────────────────────────────────────────

function SavedPlans({
  today,
  current,
  onLoad,
}: {
  today: string;
  current: { strategy: Strategy; extra_monthly: number; custom_order: string[]; protect_promos: boolean };
  onLoad: (p: SavedPlan) => void;
}) {
  const id = useId();
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [notReady, setNotReady] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState('My debt-free plan');
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<SavedPlanDetail | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/finance/debt/saved-plans');
    const body = await res.json().catch(() => ({}));
    if (res.status === 503) {
      setNotReady(body.error ?? 'Run migration 211 first.');
      return;
    }
    if (!res.ok) {
      setError(body.error ?? 'Could not load saved plans.');
      return;
    }
    setPlans(body.plans ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/finance/debt/saved-plans?today=${todayLocal()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ...current }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 503) return setNotReady(body.error ?? 'Run migration 211 first.');
    if (!res.ok) return setError(body.error ?? 'Could not save the plan.');
    setNotice('Plan saved. Progress is tracked from today against the card and loan payments you make.');
    await load();
  };

  const open = async (p: SavedPlan) => {
    onLoad(p);
    setDetail(null);
    const res = await fetch(`/api/finance/debt/saved-plans/${p.id}?today=${todayLocal()}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? 'Could not load the plan.');
    setDetail(body as SavedPlanDetail);
  };

  const remove = async (p: SavedPlan) => {
    if (!window.confirm(`Delete the plan "${p.name}"? Your debts and payments are not affected.`)) return;
    const res = await fetch(`/api/finance/debt/saved-plans/${p.id}`, { method: 'DELETE' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? 'Could not delete the plan.');
    if (detail?.plan.id === p.id) setDetail(null);
    await load();
  };

  if (notReady) {
    return (
      <p role="status" className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
        Saving plans: {notReady}
      </p>
    );
  }

  return (
    <section aria-labelledby={`${id}-saved`} className="border-t border-gray-200 pt-4 space-y-3">
      <h3 id={`${id}-saved`} className="text-sm font-semibold text-gray-800">Saved plans</h3>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1">
          <label htmlFor={`${id}-name`} className="block text-sm font-medium text-gray-700">Plan name</label>
          <input
            id={`${id}-name`}
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-lg border border-gray-300 px-3 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={busy || !name.trim()}
          className="min-h-11 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          Save this plan
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}

      {plans.length > 0 && (
        <ul role="list" className="space-y-2">
          {plans.map((p) => (
            <li key={p.id} className="flex items-center gap-2 border border-gray-200 rounded-lg pl-3">
              <button type="button" onClick={() => open(p)} className="flex-1 min-h-11 text-left text-sm text-sky-700 hover:underline">
                {p.name} · {STRATEGY_LABELS[p.strategy] ?? p.strategy} · {money(Number(p.extra_monthly) || 0)} extra
                <span className="block text-xs text-gray-500">Saved {shortDate(p.created_at.slice(0, 10), today)}</span>
              </button>
              <button
                type="button"
                onClick={() => remove(p)}
                aria-label={`Delete plan ${p.name}`}
                className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {detail?.progress && (
        <div
          role="status"
          className={`rounded-lg border p-3 text-sm ${detail.progress.onTrack ? 'bg-green-50 border-green-200 text-green-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}
        >
          <p className="font-medium">
            {detail.plan.name}: {detail.progress.onTrack ? 'on track' : 'behind plan'} since {shortDate(detail.progress.startDate, today)}
          </p>
          <p>
            Planned so far {money(detail.progress.plannedToDate)}; linked payments made {money(detail.progress.paidToDate)}.
          </p>
          <ul className="mt-1 text-xs space-y-0.5">
            {detail.progress.debts.map((d) => (
              <li key={d.id}>
                {d.name}: planned {money(d.planned)}, paid {money(d.paid)}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs">Only payments linked as card or loan payments (transfers) count.</p>
        </div>
      )}
    </section>
  );
}
