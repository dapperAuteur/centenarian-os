// app/dashboard/finance/budgets/page.tsx
// Budgets for any month: budget, spent and remaining per category, the
// spending of the last 3/6/12 months, and a suggested budget from that
// history (average or median) that can be accepted one by one or all at once.
// Data: GET/PUT /api/finance/budgets, POST /api/finance/budgets/apply-suggestions.
// The rules behind the numbers: lib/finance/budgets/logic.ts.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, AlertTriangle, Check, Info } from 'lucide-react';
import { useTrackPageView } from '@/lib/hooks/useTrackPageView';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { addMonths, firstDay, lastDay, monthLabel, monthOf } from '@/lib/finance/budgets/months';
import type { BudgetLine, BudgetMethod, BudgetReport, BudgetWindow, SeriesPoint } from '@/lib/finance/budgets/logic';
import { buildCategoryTree, groupByLifeArea } from '@/lib/categories/tree';
import { useCategoryTreeData } from '@/lib/hooks/useCategoryTree';

interface BudgetsResponse extends BudgetReport {
  current_month: string;
  first_month: string | null;
  periods_ready: boolean;
}

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wholeMoney = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function Sparkline({ series, label }: { series: SeriesPoint[]; label: string }) {
  const width = 96;
  const height = 28;
  const max = Math.max(...series.map((p) => p.amount), 0);
  const step = series.length > 1 ? width / (series.length - 1) : 0;
  const points = series
    .map((p, i) => {
      const y = max > 0 ? height - 2 - (p.amount / max) * (height - 4) : height - 2;
      return `${(i * step).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const summary = series.map((p) => `${monthLabel(p.month)} ${wholeMoney(p.amount)}`).join(', ');
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label} spending by month: ${summary}`}
      className="shrink-0 overflow-visible"
    >
      <title>{summary}</title>
      <polyline points={points} fill="none" stroke="#0284c7" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function sourceNote(line: BudgetLine): string {
  const parts: string[] = [];
  if (line.budget_source === 'period') parts.push('Set for this month');
  else if (line.budget_source === 'default' || line.budget_source === 'rollover') parts.push('Default budget');
  if (line.carried > 0) parts.push(`includes ${money(line.carried)} left over from last month`);
  if (line.carried < 0) parts.push(`minus ${money(-line.carried)} overspent last month`);
  return parts.join(', ');
}

export default function BudgetsPage() {
  useTrackPageView('finance', '/dashboard/finance/budgets');
  const [month, setMonth] = useState(() => monthOf(new Date()));
  const [windowSize, setWindowSize] = useState<BudgetWindow>(6);
  const [method, setMethod] = useState<BudgetMethod>('average');
  const [data, setData] = useState<BudgetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [forward, setForward] = useState(false);
  // One category tree (plans/63 E): budgets attach to budget categories, shown under their life area.
  const { data: treeData } = useCategoryTreeData();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await offlineFetch(`/api/finance/budgets?month=${month}&window=${windowSize}&method=${method}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not load budgets.');
      setData(body);
      setDrafts({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load budgets.');
    } finally {
      setLoading(false);
    }
  }, [month, windowSize, method]);

  useEffect(() => { load(); }, [load]);

  const send = async (url: string, httpMethod: 'PUT' | 'POST', body: unknown, busyKey: string, done: string) => {
    setBusy(busyKey);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, { method: httpMethod, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'The budget could not be saved.');
      setNotice(done);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The budget could not be saved.');
    } finally {
      setBusy(null);
    }
  };

  const saveBudget = (line: BudgetLine) => {
    const raw = (drafts[line.id] ?? '').trim();
    const amount = raw === '' ? null : Number(raw);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      setError('A budget must be a number of zero or more.');
      return;
    }
    send(
      '/api/finance/budgets',
      'PUT',
      { month, items: [{ category_id: line.id, amount }], from_this_month_on: forward },
      `save-${line.id}`,
      amount === null
        ? `${line.name}: this month uses the default budget again.`
        : `${line.name}: budget saved${forward ? ' for this month and later months' : ' for this month'}.`,
    );
  };

  const acceptOne = (line: BudgetLine) => {
    if (line.suggestion.amount === null) return;
    send(
      '/api/finance/budgets',
      'PUT',
      { month, items: [{ category_id: line.id, amount: line.suggestion.amount }], from_this_month_on: forward },
      `accept-${line.id}`,
      `${line.name}: suggested budget of ${wholeMoney(line.suggestion.amount)} accepted.`,
    );
  };

  const acceptAll = () =>
    send(
      '/api/finance/budgets/apply-suggestions',
      'POST',
      { month, window: windowSize, method, from_this_month_on: forward },
      'accept-all',
      'Suggested budgets accepted.',
    );

  const toggleRollover = (line: BudgetLine, on: boolean) =>
    send(
      '/api/finance/budgets',
      'PUT',
      { month, items: [{ category_id: line.id, rollover: on }] },
      `roll-${line.id}`,
      on
        ? `${line.name}: what's left this month will carry into next month.`
        : `${line.name}: leftover no longer carries into next month.`,
    );

  const isCurrent = data ? month === data.current_month : month === monthOf(new Date());
  const readOnly = data ? !data.periods_ready : false;
  const methodWord = method === 'median' ? 'median' : 'average';
  const pendingSuggestions = (data?.categories ?? []).filter(
    (c) => c.suggestion.amount !== null && c.suggestion.amount !== c.base_budget,
  ).length;
  // Group by life area once at least one budget category sits under one; otherwise a flat list.
  const lifeGroups = useMemo(() => {
    if (!data || !treeData || data.categories.length === 0) return null;
    const parentById = new Map(treeData.budgetCategories.map((c) => [c.id, c.life_category_id]));
    const tree = buildCategoryTree(treeData.lifeAreas, data.categories, (line) => parentById.get(line.id) ?? null);
    const groups = groupByLifeArea(data.categories, tree);
    return groups.some((group) => group.lifeArea) ? groups : null;
  }, [data, treeData]);

  const renderLine = (line: BudgetLine, nested: boolean) => {
    const LineHeading = nested ? 'h3' : 'h2';
    const pct = line.budget && line.budget > 0 ? Math.min((line.spent / line.budget) * 100, 100) : 0;
    const over = line.remaining !== null && line.remaining < 0;
    const inputId = `budget-${line.id}`;
    const rollId = `rollover-${line.id}`;
    const draft = drafts[line.id] ?? (line.base_budget !== null ? String(line.base_budget) : '');
    const canAccept = line.suggestion.amount !== null && line.suggestion.amount !== line.base_budget;
    return (
      <li key={line.id} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: line.color || '#6366f1' }} aria-hidden="true" />
            <LineHeading className="font-semibold text-gray-900 truncate">{line.name}</LineHeading>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-700">
              {money(line.spent)} spent
              {line.budget !== null && <> of {money(line.budget)}</>}
            </span>
            {line.remaining !== null && (
              <span className={`font-medium ${over ? 'text-red-700' : 'text-emerald-700'}`}>
                {over ? `${money(-line.remaining)} over` : `${money(line.remaining)} left`}
              </span>
            )}
          </div>
        </div>

        {line.budget !== null && (
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden" aria-hidden="true">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: over ? '#dc2626' : line.color || '#0284c7' }} />
          </div>
        )}
        {line.budget !== null && <p className="text-xs text-gray-600">{sourceNote(line)}</p>}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => { e.preventDefault(); saveBudget(line); }}
          >
            <div>
              <label htmlFor={inputId} className="block text-xs font-medium text-gray-600 mb-1">
                Budget for {monthLabel(month)}
              </label>
              <input
                id={inputId}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={draft}
                placeholder="No budget"
                disabled={readOnly}
                onChange={(e) => setDrafts((d) => ({ ...d, [line.id]: e.target.value }))}
                className="min-h-11 w-full sm:w-36 rounded-lg border border-gray-300 px-3 text-sm disabled:bg-gray-50"
              />
            </div>
            <button
              type="submit"
              disabled={readOnly || busy !== null || drafts[line.id] === undefined}
              className="min-h-11 px-4 rounded-lg border border-sky-600 text-sky-700 text-sm font-medium hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy === `save-${line.id}` ? 'Saving...' : 'Save'}
            </button>
          </form>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Sparkline series={line.series} label={line.name} />
            <div className="text-sm">
              {line.suggestion.amount !== null ? (
                <p className="text-gray-700">
                  Suggested <strong>{wholeMoney(line.suggestion.amount)}</strong>
                  <span className="text-gray-600"> ({methodWord} of {line.suggestion.months_used} mo)</span>
                </p>
              ) : (
                <p className="text-gray-600">No history yet for a suggestion</p>
              )}
              {line.variability.varies_a_lot && (
                <p className="flex items-center gap-1 text-amber-800 text-xs">
                  <Info className="w-3 h-3" aria-hidden="true" />
                  Varies a lot month to month; consider the median or a longer window.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => acceptOne(line)}
              disabled={readOnly || busy !== null || !canAccept}
              aria-label={`Accept the suggested budget for ${line.name}`}
              className="min-h-11 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy === `accept-${line.id}` ? 'Saving...' : canAccept ? 'Accept' : 'Accepted'}
            </button>
          </div>
        </div>

        <label htmlFor={rollId} className="flex items-center gap-2 min-h-11 text-sm text-gray-700 w-fit">
          <input
            id={rollId}
            type="checkbox"
            checked={line.rollover}
            disabled={readOnly || busy !== null || line.budget === null}
            onChange={(e) => toggleRollover(line, e.target.checked)}
            className="w-5 h-5 accent-sky-600"
          />
          Carry what&apos;s left (or overspent) into next month
        </label>
      </li>
    );
  };

  const uncategorizedHref =
    `/dashboard/finance/transactions?uncategorized=1&type=expense&from=${firstDay(month)}&to=${lastDay(month)}`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <Link href="/dashboard/finance" className="inline-flex items-center gap-1 min-h-11 text-sm text-sky-700 hover:text-sky-800">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Finance
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
        <p className="text-sm text-gray-600 mt-1">
          Budget, spending and what&apos;s left for each category. Suggestions come from your own spending history.
          Transfers between your accounts never count as spending.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p id="month-label" className="text-xs font-medium text-gray-600 mb-1">Month</p>
          <div className="flex items-center gap-1" role="group" aria-labelledby="month-label">
            <button
              type="button"
              onClick={() => setMonth((m) => addMonths(m, -1))}
              aria-label="Previous month"
              className="min-h-11 min-w-11 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <span className="min-w-32 text-center font-semibold text-gray-900" aria-live="polite">
              {monthLabel(month, 'long')}
            </span>
            <button
              type="button"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              aria-label="Next month"
              className="min-h-11 min-w-11 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
            {!isCurrent && (
              <button
                type="button"
                onClick={() => setMonth(data?.current_month ?? monthOf(new Date()))}
                className="min-h-11 px-3 text-sm text-sky-700 hover:text-sky-800"
              >
                This month
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div>
            <label htmlFor="budget-window" className="block text-xs font-medium text-gray-600 mb-1">
              Suggest from the last
            </label>
            <select
              id="budget-window"
              value={windowSize}
              onChange={(e) => setWindowSize(Number(e.target.value) as BudgetWindow)}
              className="min-h-11 w-full sm:w-auto rounded-lg border border-gray-300 px-3 text-sm bg-white"
            >
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
            </select>
          </div>
          <div>
            <p id="method-label" className="text-xs font-medium text-gray-600 mb-1">Using the</p>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden" role="group" aria-labelledby="method-label">
              {(['average', 'median'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  aria-pressed={method === m}
                  className={`min-h-11 flex-1 px-4 text-sm font-medium transition ${
                    method === m ? 'bg-sky-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {m === 'average' ? 'Average' : 'Median'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {readOnly && (
        <div role="status" className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            Budgets by month aren&apos;t available yet because the database is missing an update (migration 208).
            Each category&apos;s monthly budget is shown, and changes here can&apos;t be saved until the update is applied.
          </p>
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}
      {notice && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" /> {notice}
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-16" role="status">
          <Loader2 className="w-6 h-6 animate-spin text-sky-600" aria-hidden="true" />
          <span className="sr-only">Loading budgets...</span>
        </div>
      ) : data ? (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Budget', value: money(data.totals.budget) },
              { label: 'Spent', value: money(data.totals.spent), sub: data.totals.spent_uncategorized > 0 ? `${money(data.totals.spent_uncategorized)} uncategorized` : undefined },
              { label: 'Remaining', value: money(data.totals.remaining), bad: data.totals.remaining < 0 },
              { label: `Suggested (${methodWord}, ${windowSize} mo)`, value: wholeMoney(data.totals.suggested) },
            ].map((card) => (
              <div key={card.label} className="bg-white border border-gray-200 rounded-2xl p-4">
                <p className="text-xs font-medium text-gray-600">{card.label}</p>
                <p className={`text-lg font-bold ${card.bad ? 'text-red-700' : 'text-gray-900'}`}>{card.value}</p>
                {card.sub && <p className="text-xs text-gray-600">{card.sub}</p>}
              </div>
            ))}
          </div>

          {/* Bulk actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label htmlFor="apply-forward" className="flex items-center gap-2 min-h-11 text-sm text-gray-700">
              <input
                id="apply-forward"
                type="checkbox"
                checked={forward}
                onChange={(e) => setForward(e.target.checked)}
                className="w-5 h-5 accent-sky-600"
              />
              Changes also apply to later months (and become the default)
            </label>
            <button
              type="button"
              onClick={acceptAll}
              disabled={readOnly || busy !== null || pendingSuggestions === 0}
              className="min-h-11 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {busy === 'accept-all' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Accept all suggestions{pendingSuggestions > 0 ? ` (${pendingSuggestions})` : ''}
            </button>
          </div>

          {data.categories.length === 0 && (
            <p className="text-sm text-gray-600 bg-white border border-gray-200 rounded-2xl p-6 text-center">
              No budget categories yet. Add them from the Finance dashboard (Spending by Category → Manage) or on{' '}
              <Link href="/dashboard/categories/organize" className="text-sky-700 underline">Organize categories</Link>.
            </p>
          )}
          {data.categories.length > 0 && (
            <p className="text-sm text-gray-600">
              {lifeGroups
                ? 'Budget categories are shown under their life area. '
                : 'Place your budget categories under life areas to see budgets grouped by area. '}
              <Link href="/dashboard/categories/organize" className="inline-flex items-center min-h-11 text-sky-700 underline">
                Organize categories
              </Link>
            </p>
          )}

          {/* Categories */}
          <ul className="space-y-3">
            {lifeGroups
              ? lifeGroups.map((group) => {
                  const spent = group.items.reduce((sum, line) => sum + line.spent, 0);
                  const budget = group.items.reduce((sum, line) => sum + (line.budget ?? 0), 0);
                  const name = group.lifeArea?.name ?? 'No life area';
                  return (
                    <li key={group.lifeArea?.id ?? 'no-life-area'}>
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between mb-2">
                        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: group.lifeArea?.color || '#9ca3af' }}
                            aria-hidden="true"
                          />
                          {name}
                        </h2>
                        <p className="text-sm text-gray-700">
                          {money(spent)} spent{budget > 0 && <> of {money(budget)}</>}
                        </p>
                      </div>
                      <ul className="space-y-3">{group.items.map((line) => renderLine(line, true))}</ul>
                    </li>
                  );
                })
              : data.categories.map((line) => renderLine(line, false))}

            {/* Uncategorized */}
            <li className="bg-white border border-dashed border-gray-300 rounded-2xl p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Uncategorized</h2>
                  <p className="text-sm text-gray-700">
                    {money(data.uncategorized.spent)} spent in {monthLabel(month)}
                    {data.uncategorized.suggestion.amount !== null && (
                      <span className="text-gray-600"> · usually about {wholeMoney(data.uncategorized.suggestion.amount)} a month</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-600">Counts toward the total, not toward any category&apos;s budget.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Sparkline series={data.uncategorized.series} label="Uncategorized" />
                  <Link
                    href={uncategorizedHref}
                    className="min-h-11 px-4 rounded-lg border border-sky-600 text-sky-700 text-sm font-medium hover:bg-sky-50 flex items-center justify-center"
                  >
                    Categorize these
                  </Link>
                </div>
              </div>
            </li>
          </ul>

          <p className="text-xs text-gray-600">
            Suggestions use the {windowSize} complete months before {monthLabel(month)}; months before your first
            transaction are left out and months with no spending count as $0. Refunds in a category lower its spending.
          </p>
        </>
      ) : null}
    </div>
  );
}
