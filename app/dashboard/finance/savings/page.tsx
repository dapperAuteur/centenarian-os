// app/dashboard/finance/savings/page.tsx
// Savings goals as virtual envelopes: per real account (usually savings) its
// balance, what the goals hold (allocated) and what is left (unallocated,
// amber when the goals hold more than the balance), goal cards, and recent
// deposits into the account still to allocate. Create / edit goals, add,
// take out or move money, split a deposit across goals.
//
// Opening /dashboard/finance/savings?new=1&kind=trip&trip_id=...&name=...&target=...&date=...
// (or &equipment_id=...) opens "New savings goal" prefilled: the "Save for
// this" buttons on a planned trip and an equipment item link here.
//
// Data: GET/POST /api/finance/savings, PATCH/DELETE /api/finance/savings/goals/[id],
// POST /api/finance/savings/allocations. Rules: lib/finance/savings/logic.ts.
'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Check, Info, Loader2, Plus } from 'lucide-react';
import { useTrackPageView } from '@/lib/hooks/useTrackPageView';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { todayLocal } from '@/lib/dates/local';
import { monthLabel } from '@/lib/finance/budgets/months';
import { isGoalKind } from '@/lib/finance/savings/logic';
import type { BudgetMethod, BudgetWindow } from '@/lib/finance/budgets/logic';
import type { AccountView, GoalView, SavingsOverview } from '@/lib/finance/savings/server';
import GoalForm from '@/components/finance/savings/GoalForm';
import type { GoalPrefill } from '@/components/finance/savings/GoalForm';
import GoalCard from '@/components/finance/savings/GoalCard';
import MoneyDialog from '@/components/finance/savings/MoneyDialog';
import type { MoneyAction } from '@/components/finance/savings/MoneyDialog';
import { formatDate, money } from '@/components/finance/savings/format';

export default function SavingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20" role="status">
          <Loader2 className="w-6 h-6 animate-spin text-sky-600" aria-hidden="true" />
          <span className="sr-only">Loading...</span>
        </div>
      }
    >
      <SavingsContent />
    </Suspense>
  );
}

function SavingsContent() {
  useTrackPageView('finance', '/dashboard/finance/savings');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [today] = useState(() => todayLocal());
  const [windowSize, setWindowSize] = useState<BudgetWindow>(6);
  const [method, setMethod] = useState<BudgetMethod>('average');
  const [data, setData] = useState<SavingsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GoalView | null>(null);
  const [prefill, setPrefill] = useState<GoalPrefill | null>(null);
  const [moneyAction, setMoneyAction] = useState<MoneyAction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await offlineFetch(`/api/finance/savings?window=${windowSize}&method=${method}&today=${today}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not load savings goals.');
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load savings goals.');
    } finally {
      setLoading(false);
    }
  }, [windowSize, method, today]);

  useEffect(() => { load(); }, [load]);

  // "Save for this" from a trip or an equipment item: open the form prefilled, once.
  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    const kind = searchParams.get('kind');
    setPrefill({
      name: searchParams.get('name') ?? undefined,
      kind: isGoalKind(kind) ? kind : undefined,
      target_amount: searchParams.get('target') ?? undefined,
      target_date: searchParams.get('date') ?? undefined,
      linked_trip_id: searchParams.get('trip_id') ?? undefined,
      linked_equipment_id: searchParams.get('equipment_id') ?? undefined,
    });
    setEditing(null);
    setFormOpen(true);
    router.replace('/dashboard/finance/savings', { scroll: false });
  }, [searchParams, router]);

  const done = async (message: string) => {
    setFormOpen(false);
    setEditing(null);
    setPrefill(null);
    setMoneyAction(null);
    setNotice(message);
    await load();
  };

  const changeStatus = async (goal: GoalView, status: 'active' | 'paused' | 'done' | 'archived') => {
    if (status === 'archived' && goal.saved > 0 &&
      !window.confirm(`Archive "${goal.name}"? Its ${money(goal.saved)} goes back to unallocated in the same account.`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/finance/savings/goals/${goal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, today }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'The goal could not be changed.');
      const label = { active: 'is active again', paused: 'is paused', done: 'is marked done', archived: 'is archived' }[status];
      await done(result.released > 0 ? `"${goal.name}" ${label}; ${money(result.released)} went back to unallocated.` : `"${goal.name}" ${label}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The goal could not be changed.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (goal: GoalView) => {
    if (!window.confirm(`Delete "${goal.name}" and its history? Its ${money(goal.saved)} goes back to unallocated. This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/finance/savings/goals/${goal.id}`, { method: 'DELETE' });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'The goal could not be deleted.');
      await done(`"${goal.name}" deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The goal could not be deleted.');
    } finally {
      setBusy(false);
    }
  };

  const surplus = data?.surplus ?? null;
  const surplusLabel = useMemo(() => {
    if (!surplus || surplus.per_month.length === 0) return null;
    const first = surplus.per_month[0].month;
    const last = surplus.per_month[surplus.per_month.length - 1].month;
    return first === last ? monthLabel(first) : `${monthLabel(first)} to ${monthLabel(last)}`;
  }, [surplus]);

  const openNew = () => {
    setEditing(null);
    setPrefill(null);
    setFormOpen(true);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/finance" className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-gray-100" aria-label="Back to Finance">
            <ArrowLeft className="w-5 h-5 text-gray-600" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Savings goals</h1>
            <p className="text-sm text-gray-500">Envelopes inside your real accounts: one balance, split across goals.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openNew}
          disabled={!data?.ready}
          className="min-h-11 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> New goal
        </button>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}
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
            <p className="font-medium">Run migration 212 first.</p>
            <p>Savings goals need a database update (supabase/migrations/212_savings_goals.sql). Nothing else changes until it is applied.</p>
          </div>
        </div>
      )}

      {data?.ready && (
        <>
          {/* Monthly surplus */}
          <section className="bg-white border border-gray-200 rounded-2xl p-5" aria-labelledby="surplus-heading">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <h2 id="surplus-heading" className="text-sm font-medium text-gray-500">Monthly surplus (income minus spending)</h2>
                <p className="text-2xl font-bold text-gray-900">
                  {surplus?.amount == null ? 'Not enough history yet' : money(surplus.amount)}
                </p>
                <p className="text-xs text-gray-500">
                  {surplusLabel ? `${method === 'median' ? 'Median' : 'Average'} of ${surplusLabel}. ` : ''}
                  Transfers between your own accounts are left out. Goals take it in priority order.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div>
                  <label htmlFor="surplus-window" className="block text-xs text-gray-500 mb-1">Months</label>
                  <select
                    id="surplus-window"
                    value={windowSize}
                    onChange={(e) => setWindowSize(Number(e.target.value) as BudgetWindow)}
                    className="min-h-11 px-3 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value={3}>Last 3</option>
                    <option value={6}>Last 6</option>
                    <option value={12}>Last 12</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="surplus-method" className="block text-xs text-gray-500 mb-1">Method</label>
                  <select
                    id="surplus-method"
                    value={method}
                    onChange={(e) => setMethod(e.target.value as BudgetMethod)}
                    className="min-h-11 px-3 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="average">Average</option>
                    <option value="median">Median</option>
                  </select>
                </div>
              </div>
            </div>
            {surplus?.amount != null && surplus.amount <= 0 && (
              <p className="mt-3 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">
                Spending has matched or passed income over these months, so no goal fits yet.
              </p>
            )}
          </section>

          {data.accounts.length === 0 && data.unassigned.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center space-y-3">
              <p className="text-gray-700 font-medium">No savings goals yet.</p>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                A goal is an envelope inside a real account. Pick the account the money sits in, set a target and a date,
                and see what you need to put aside each month and whether it fits.
              </p>
              {data.funding_options.length === 0 ? (
                <Link href="/dashboard/finance/accounts" className="inline-flex min-h-11 items-center px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700">
                  Add a savings account first
                </Link>
              ) : (
                <button type="button" onClick={openNew} className="min-h-11 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700">
                  Create your first goal
                </button>
              )}
            </div>
          )}

          {data.accounts.map((account) => (
            <AccountSection
              key={account.id}
              account={account}
              busy={busy}
              onMoney={setMoneyAction}
              onEdit={(g) => { setEditing(g); setPrefill(null); setFormOpen(true); }}
              onStatus={changeStatus}
              onDelete={remove}
            />
          ))}

          {data.unassigned.length > 0 && (
            <section className="space-y-3" aria-labelledby="unassigned-heading">
              <h2 id="unassigned-heading" className="text-lg font-semibold text-gray-900">Goals without an account</h2>
              <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">
                The account these goals drew from was removed. Edit each one and pick the account its money is in now.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.unassigned.map((g) => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    canMove={false}
                    hasUnallocated={false}
                    busy={busy}
                    onAllocate={() => {}}
                    onRelease={() => {}}
                    onMove={() => {}}
                    onEdit={() => { setEditing(g); setPrefill(null); setFormOpen(true); }}
                    onStatus={(s) => changeStatus(g, s)}
                    onDelete={() => remove(g)}
                  />
                ))}
              </div>
            </section>
          )}

          <p className="text-xs text-gray-500 flex gap-1.5">
            <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
            Envelopes never move money between your real accounts. To fill a goal, move money into its account (a transfer on the
            Transactions page or an imported statement), then allocate it here.
          </p>
        </>
      )}

      {data && (
        <GoalForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditing(null); setPrefill(null); }}
          onSaved={done}
          goal={editing}
          prefill={prefill}
          fundingOptions={data.funding_options}
          linkOptions={data.link_options}
          today={today}
        />
      )}
      <MoneyDialog action={moneyAction} onClose={() => setMoneyAction(null)} onDone={done} today={today} />
    </div>
  );
}

function AccountSection({
  account,
  busy,
  onMoney,
  onEdit,
  onStatus,
  onDelete,
}: {
  account: AccountView;
  busy: boolean;
  onMoney: (a: MoneyAction) => void;
  onEdit: (g: GoalView) => void;
  onStatus: (g: GoalView, s: 'active' | 'paused' | 'done' | 'archived') => void;
  onDelete: (g: GoalView) => void;
}) {
  const visible = account.goals.filter((g) => g.status !== 'archived');
  const archived = account.goals.filter((g) => g.status === 'archived');
  const openGoals = visible.filter((g) => g.status === 'active' || g.status === 'paused');
  const allocatedPct = account.balance > 0 ? Math.min(100, (account.allocated / account.balance) * 100) : account.allocated > 0 ? 100 : 0;
  const headingId = `account-${account.id}`;

  const card = (g: GoalView) => (
    <GoalCard
      key={g.id}
      goal={g}
      canMove={openGoals.length > 1}
      hasUnallocated={account.unallocated > 0}
      busy={busy}
      onAllocate={() => onMoney({ kind: 'allocate', goal: g, account })}
      onRelease={() => onMoney({ kind: 'release', goal: g, account })}
      onMove={() => onMoney({ kind: 'move', goal: g, account })}
      onEdit={() => onEdit(g)}
      onStatus={(s) => onStatus(g, s)}
      onDelete={() => onDelete(g)}
    />
  );

  return (
    <section className="space-y-4" aria-labelledby={headingId}>
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
          <h2 id={headingId} className="text-lg font-semibold text-gray-900">{account.label}</h2>
          <span className="text-xs text-gray-500 capitalize">{account.account_type}{account.is_active ? '' : ' (inactive)'}</span>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-gray-500">Balance</dt>
            <dd className="font-semibold text-gray-900">{money(account.balance)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">In goals</dt>
            <dd className="font-semibold text-gray-900">{money(account.allocated)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Unallocated</dt>
            <dd className={`font-semibold ${account.unallocated < 0 ? 'text-amber-900' : 'text-gray-900'}`}>{money(account.unallocated)}</dd>
          </div>
        </dl>
        <div
          className="h-2.5 bg-gray-100 rounded-full overflow-hidden"
          role="img"
          aria-label={`${money(account.allocated)} of ${money(account.balance)} is in goals`}
        >
          <div className={`h-full ${account.over_allocated > 0 ? 'bg-amber-500' : 'bg-sky-500'}`} style={{ width: `${allocatedPct}%` }} />
        </div>
        {account.over_allocated > 0 && (
          <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              Your goals hold {money(account.over_allocated)} more than this account&apos;s balance (money was spent or moved out).
              Take that much out of one or more goals so the envelopes match the real balance.
            </p>
          </div>
        )}
      </div>

      {visible.length > 0 && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{visible.map(card)}</div>}

      {account.deposits.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-900">Recent deposits to allocate</h3>
          <p className="text-xs text-gray-500 mb-3">Money that arrived in this account and isn&apos;t split across goals yet.</p>
          <ul className="divide-y divide-gray-100">
            {account.deposits.map((d) => (
              <li key={d.id} className="py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 truncate">
                    {d.description || 'Deposit'}
                    {d.is_transfer && <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-sky-50 text-sky-700">Transfer</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(d.transaction_date)} · {money(d.amount)}
                    {d.allocated > 0 ? ` · ${money(d.remaining)} left` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || openGoals.length === 0}
                  onClick={() => onMoney({ kind: 'split', deposit: d, account })}
                  className="min-h-11 px-3 rounded-lg border border-sky-200 text-sky-700 text-sm font-medium hover:bg-sky-50 disabled:opacity-50"
                >
                  Allocate {money(d.remaining)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {archived.length > 0 && (
        <details className="bg-white border border-gray-200 rounded-2xl p-4">
          <summary className="min-h-11 flex items-center cursor-pointer text-sm font-medium text-gray-700">
            Archived goals ({archived.length})
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">{archived.map(card)}</div>
        </details>
      )}
    </section>
  );
}
