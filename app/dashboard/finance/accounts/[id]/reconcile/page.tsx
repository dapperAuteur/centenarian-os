'use client';

// app/dashboard/finance/accounts/[id]/reconcile/page.tsx
// Reconcile one account to a bank or card statement, and set its dated starting balance.
//
//   1. Starting balance: the balance at the end of a day, and that day. Transactions after it
//      count toward the balance; older ones stay in the history. "Use my first imported
//      statement" fills it from the earliest PDF statement saved for the account.
//   2. Statement: the closing date and ending balance (prefilled from the latest imported
//      statement, or the one in ?statement=YYYY-MM-DD, or ?date=&balance=). Compare shows the
//      balance the app works out for that date, the difference, and the period's transactions
//      with Cleared checkboxes.
//   3. Finish: with no difference it is reconciled; otherwise add a labelled adjustment, change
//      the starting balance, or leave it open.
//   4. History: every reconciliation, with Unreconcile.
//
// Cards and loans are shown in statement terms: the amount OWED, as the statement prints it.
// Rules: lib/finance/reconciliation/logic.ts. Data: /api/finance/reconciliations.
// Needs a connection (plain fetch: nothing is queued offline).

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Scale } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { todayLocal } from '@/lib/dates/local';
import { formatMoney } from '@/lib/finance/fx/math';
import {
  formatDay,
  type ReconcileViewResponse,
  type ReconciliationRow,
} from '@/lib/finance/reconciliation/client';

type Choice = '' | 'adjustment' | 'starting_balance' | 'left_open';

const button =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:opacity-50';
const input = 'mt-1 w-full min-h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900';
const card = 'rounded-2xl border border-gray-200 bg-white p-5';

const cents = (n: number) => Math.round(n * 100);

const RESOLUTION_LABEL: Record<string, string> = {
  matched: 'Matched',
  adjustment: 'Adjustment added',
  starting_balance: 'Starting balance changed',
  left_open: 'Left open',
};

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  return (await res.json().catch(() => null)) as Record<string, unknown> | null;
}

export default function ReconcileAccountPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const urlDate = searchParams.get('date') ?? '';
  const urlBalance = searchParams.get('balance') ?? '';
  const urlStatement = searchParams.get('statement') ?? '';

  const [view, setView] = useState<ReconcileViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Statement form
  const [date, setDate] = useState('');
  const [balance, setBalance] = useState('');
  const [statementId, setStatementId] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [choice, setChoice] = useState<Choice>('');
  const [note, setNote] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Starting balance form
  const [startOpen, setStartOpen] = useState(false);
  const [startAmount, setStartAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startSaving, setStartSaving] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Unreconcile dialog
  const [undoTarget, setUndoTarget] = useState<ReconciliationRow | null>(null);
  const [removeAdjustment, setRemoveAdjustment] = useState(false);
  const [undoBusy, setUndoBusy] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);

  const fetchView = useCallback(
    async (params: { date?: string; balance?: string; statement?: string } = {}) => {
      const query = new URLSearchParams({ account_id: id });
      if (params.date) query.set('date', params.date);
      if (params.balance) query.set('balance', params.balance);
      if (params.statement) query.set('statement', params.statement);
      const res = await fetch(`/api/finance/reconciliations?${query}`);
      const body = await readJson(res);
      if (!res.ok || !body) throw new Error(typeof body?.error === 'string' ? body.error : 'Could not load this account.');
      return body as unknown as ReconcileViewResponse;
    },
    [id],
  );

  const applyCheck = useCallback((next: ReconcileViewResponse) => {
    setView(next);
    if (next.check) {
      setTicked(new Set(next.check.transactions.filter((t) => t.cleared).map((t) => t.id)));
      setChoice('');
      setNote(next.check.existing?.note ?? '');
    }
  }, []);

  // First load: the URL's date and balance, else the suggested statement, compared right away.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const first = await fetchView({ statement: urlStatement || undefined, date: urlDate || undefined, balance: urlBalance || undefined });
        if (cancelled) return;
        const startDateValue = urlDate || first.suggested?.statement_date || '';
        const startBalanceValue = urlBalance || (first.suggested ? String(first.suggested.statement_balance) : '');
        setDate(startDateValue);
        setBalance(startBalanceValue);
        setStatementId(!urlDate && first.suggested ? first.suggested.statement_id : null);
        if (!first.check && startDateValue && startBalanceValue) {
          const compared = await fetchView({ date: startDateValue, balance: startBalanceValue, statement: urlStatement || undefined });
          if (!cancelled) applyCheck(compared);
        } else {
          applyCheck(first);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load this account.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchView, applyCheck, urlDate, urlBalance, urlStatement]);

  const compare = async () => {
    if (!date || balance.trim() === '') return;
    setComparing(true);
    setFinishError(null);
    setNotice(null);
    try {
      applyCheck(await fetchView({ date, balance }));
    } catch (err) {
      setFinishError(err instanceof Error ? err.message : 'Could not compare.');
    } finally {
      setComparing(false);
    }
  };

  const pickStatement = (value: string) => {
    const st = view?.statements.find((s) => s.id === value);
    setStatementId(st ? st.id : null);
    if (st) {
      setDate(st.period_end);
      setBalance(st.new_balance === null ? '' : String(Number(st.new_balance)));
    }
  };

  const account = view?.account ?? null;
  const currency = account?.currency ?? 'USD';
  const isDebt = account?.is_debt ?? false;
  const money = (n: number | string | null | undefined) => formatMoney(Number(n ?? 0), currency);
  const check = view?.check ?? null;
  const differenceCents = check?.difference === null || check?.difference === undefined ? null : cents(check.difference);

  // Ticks change what is cleared, not the balance on the date: these follow the checkboxes.
  const tickSummary = useMemo(() => {
    if (!check) return { cleared: 0, total: 0, unclearedCents: 0 };
    let cleared = 0;
    let unclearedCents = 0;
    for (const t of check.transactions) {
      if (ticked.has(t.id)) cleared += 1;
      else unclearedCents += cents(t.effect);
    }
    return { cleared, total: check.transactions.length, unclearedCents };
  }, [check, ticked]);

  const toggle = (txId: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId);
      else next.add(txId);
      return next;
    });

  const finish = async () => {
    if (!check || !account) return;
    setFinishing(true);
    setFinishError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/finance/reconciliations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: account.id,
          statement_date: check.statement_date,
          statement_balance: check.statement_balance,
          cleared_ids: [...ticked],
          difference_choice: differenceCents ? choice || null : null,
          note: note.trim() || null,
          statement_id: statementId,
          today: todayLocal(),
        }),
      });
      const body = await readJson(res);
      if (!res.ok || !body) {
        setFinishError(typeof body?.error === 'string' ? body.error : 'The reconciliation could not be saved.');
        return;
      }
      const rec = body.reconciliation as ReconciliationRow;
      setNotice(
        rec.status === 'reconciled'
          ? `Reconciled through ${formatDay(rec.statement_date)}.` +
              (body.adjustment ? ' A reconciliation adjustment was added.' : '') +
              (body.starting_balance ? ' The starting balance was changed.' : '')
          : `Saved as open with a difference of ${money(rec.difference)}. Nothing was changed.`,
      );
      applyCheck(await fetchView({ date: check.statement_date, balance: String(check.statement_balance) }));
    } catch {
      setFinishError('The reconciliation could not be saved. Check your connection and try again.');
    } finally {
      setFinishing(false);
    }
  };

  const openStart = () => {
    if (!account) return;
    setStartAmount(String(Number(account.opening_balance ?? 0)));
    setStartDate(account.opening_balance_date ?? '');
    setStartError(null);
    setStartOpen(true);
  };

  const saveStart = async () => {
    if (!account) return;
    const amount = Number(startAmount.replace(/[,$\s]/g, ''));
    if (!Number.isFinite(amount)) {
      setStartError('Enter the starting balance, like 1234.56.');
      return;
    }
    setStartSaving(true);
    setStartError(null);
    try {
      const res = await fetch(`/api/finance/accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opening_balance: amount, opening_balance_date: startDate || null }),
      });
      const body = await readJson(res);
      if (!res.ok) {
        setStartError(typeof body?.error === 'string' ? body.error : 'The starting balance could not be saved.');
        return;
      }
      setStartOpen(false);
      setNotice('Starting balance saved.');
      applyCheck(await fetchView(check ? { date: check.statement_date, balance: String(check.statement_balance ?? '') } : {}));
    } catch {
      setStartError('The starting balance could not be saved. Check your connection and try again.');
    } finally {
      setStartSaving(false);
    }
  };

  const confirmUnreconcile = async () => {
    if (!undoTarget) return;
    setUndoBusy(true);
    setUndoError(null);
    try {
      const res = await fetch(`/api/finance/reconciliations/${undoTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unreconcile', remove_adjustment: removeAdjustment }),
      });
      const body = await readJson(res);
      if (!res.ok) {
        setUndoError(typeof body?.error === 'string' ? body.error : 'Could not unreconcile.');
        return;
      }
      setNotice(
        `The statement of ${formatDay(undoTarget.statement_date)} is open again.` +
          (body?.adjustment_deleted ? ' Its adjustment was deleted.' : ''),
      );
      setUndoTarget(null);
      applyCheck(await fetchView(check ? { date: check.statement_date, balance: String(check.statement_balance ?? '') } : {}));
    } catch {
      setUndoError('Could not unreconcile. Check your connection and try again.');
    } finally {
      setUndoBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-fuchsia-600" aria-hidden="true" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (!view || !account) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {loadError ?? 'This account was not found.'}
        </p>
        <Link href="/dashboard/finance/accounts" className="inline-flex min-h-11 items-center text-sm font-medium text-sky-700 underline">
          Back to accounts
        </Link>
      </div>
    );
  }

  const label = [account.institution_name, account.last_four ? `··${account.last_four}` : null].filter(Boolean).join(' ');
  const statementLabel = isDebt ? 'New balance on the statement (what you owe)' : 'Ending balance on the statement';
  const recordsLabel = isDebt ? 'Owed on that date, by your records' : 'Balance on that date, by your records';
  const adjustmentType = differenceCents
    ? isDebt
      ? differenceCents > 0 ? 'a charge (expense)' : 'a credit (income)'
      : differenceCents > 0 ? 'an income' : 'an expense'
    : '';
  const newOpening = differenceCents ? (cents(Number(account.opening_balance ?? 0)) + differenceCents) / 100 : null;
  const canFinish = !!check && view.ready && !check.before_start && check.statement_balance !== null && (differenceCents === 0 || choice !== '');

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/finance/accounts"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-gray-100"
          aria-label="Back to accounts"
        >
          <ArrowLeft className="h-4 w-4 text-gray-600" aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Scale className="h-6 w-6 shrink-0 text-fuchsia-600" aria-hidden="true" />
            <span className="truncate">Reconcile {account.name}</span>
          </h1>
          <p className="text-sm text-gray-600">
            {label ? `${label} · ` : ''}
            {currency}
            {view.reconciled_through ? ` · Reconciled through ${formatDay(view.reconciled_through)}` : ' · Not reconciled yet'}
          </p>
        </div>
      </div>

      {!view.ready && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Run migration 221 first (supabase/migrations/221_account_reconciliation.sql). Until then you can compare, but
          nothing can be saved, and a starting balance date can&apos;t be set.
        </p>
      )}

      {notice && (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}

      {/* 1. Starting balance */}
      <section className={card} aria-labelledby="start-heading">
        <h2 id="start-heading" className="text-base font-semibold text-gray-900">Starting balance</h2>
        <p className="mt-1 text-sm text-gray-700">
          {money(account.opening_balance)}
          {isDebt ? ' owed' : ''}
          {account.opening_balance_date
            ? ` at the end of ${formatDay(account.opening_balance_date)}. Transactions after that day count toward the balance.`
            : '. Every transaction on the account counts toward the balance.'}
        </p>
        {!startOpen ? (
          <button type="button" onClick={openStart} className={`${button} mt-3 bg-gray-100 text-gray-800 hover:bg-gray-200`}>
            Set starting balance
          </button>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-gray-600">
              Use the balance on your first imported statement&apos;s start date: its beginning (previous) balance, dated the
              day before the statement period starts. Older transactions stay in your history but no longer change the
              balance.{isDebt ? ' For a card or loan, enter what you owed.' : ''}
            </p>
            {view.starting_suggestion && (
              <button
                type="button"
                onClick={() => {
                  setStartAmount(String(view.starting_suggestion!.opening_balance));
                  setStartDate(view.starting_suggestion!.opening_balance_date);
                }}
                className={`${button} bg-sky-50 text-sky-800 hover:bg-sky-100`}
              >
                Use my first imported statement ({money(view.starting_suggestion.opening_balance)} at the end of{' '}
                {formatDay(view.starting_suggestion.opening_balance_date)})
              </button>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="start-amount" className="text-xs font-medium text-gray-700">
                  {isDebt ? `Amount owed (${currency})` : `Balance (${currency})`}
                </label>
                <input id="start-amount" inputMode="decimal" value={startAmount} onChange={(e) => setStartAmount(e.target.value)} className={input} />
              </div>
              <div>
                <label htmlFor="start-date" className="text-xs font-medium text-gray-700">As of the end of</label>
                <input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={input} />
                <p className="mt-1 text-xs text-gray-600">Leave empty to count every transaction.</p>
              </div>
            </div>
            {startError && (
              <p role="alert" className="text-sm text-red-700">{startError}</p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={saveStart} disabled={startSaving} className={`${button} bg-sky-700 text-white hover:bg-sky-800`}>
                {startSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Save starting balance
              </button>
              <button type="button" onClick={() => setStartOpen(false)} className={`${button} bg-gray-100 text-gray-800 hover:bg-gray-200`}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 2. The statement */}
      <section className={card} aria-labelledby="statement-heading">
        <h2 id="statement-heading" className="text-base font-semibold text-gray-900">Statement</h2>
        <p className="mt-1 text-sm text-gray-600">
          Enter the closing date and the {isDebt ? 'new balance (what you owe)' : 'ending balance'} printed on the statement.
          {isDebt ? ' A credit balance is a negative number.' : ''}
        </p>
        {view.statements.length > 0 && (
          <div className="mt-3">
            <label htmlFor="statement-pick" className="text-xs font-medium text-gray-700">From an imported statement</label>
            <select id="statement-pick" value={statementId ?? ''} onChange={(e) => pickStatement(e.target.value)} className={input}>
              <option value="">Type it in</option>
              {view.statements
                .filter((s) => s.new_balance !== null)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatDay(s.period_end)}: {money(s.new_balance)}
                  </option>
                ))}
            </select>
          </div>
        )}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="statement-date" className="text-xs font-medium text-gray-700">Closing date</label>
            <input
              id="statement-date"
              type="date"
              value={date}
              max={todayLocal()}
              onChange={(e) => {
                setDate(e.target.value);
                setStatementId(null);
              }}
              className={input}
            />
          </div>
          <div>
            <label htmlFor="statement-balance" className="text-xs font-medium text-gray-700">{statementLabel} ({currency})</label>
            <input
              id="statement-balance"
              inputMode="decimal"
              value={balance}
              onChange={(e) => {
                setBalance(e.target.value);
                setStatementId(null);
              }}
              className={input}
              placeholder="0.00"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={compare}
          disabled={comparing || !date || balance.trim() === ''}
          className={`${button} mt-3 w-full bg-sky-700 text-white hover:bg-sky-800 sm:w-auto`}
        >
          {comparing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Compare
        </button>
      </section>

      {/* 3. The comparison */}
      {check && check.statement_balance !== null && (
        <section className={card} aria-labelledby="compare-heading">
          <h2 id="compare-heading" className="text-base font-semibold text-gray-900">
            Statement of {formatDay(check.statement_date)}
          </h2>
          {check.before_start && (
            <p role="alert" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              That date is before this account&apos;s starting balance date ({formatDay(account.opening_balance_date)}). Pick a
              later statement, or change the starting balance.
            </p>
          )}
          <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-gray-600">{statementLabel}</dt>
              <dd className="text-lg font-semibold text-gray-900">{money(check.statement_balance)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-600">{recordsLabel}</dt>
              <dd className="text-lg font-semibold text-gray-900">{money(check.computed_balance)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-600">Difference</dt>
              <dd className={`text-lg font-semibold ${differenceCents === 0 ? 'text-emerald-700' : 'text-amber-800'}`}>
                {differenceCents === 0 ? 'Matches' : money(check.difference)}
              </dd>
            </div>
          </dl>
          {differenceCents !== 0 && differenceCents !== null && (
            <p className="mt-2 flex items-start gap-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              The statement shows {money(Math.abs(check.difference ?? 0))} {differenceCents > 0 ? 'more' : 'less'}
              {isDebt ? ' owed' : ''} than your records. Look first for a transaction that is missing, entered twice, or has
              the wrong amount or date.
            </p>
          )}

          <h3 className="mt-5 text-sm font-semibold text-gray-900">
            Transactions {check.period.after ? `after ${formatDay(check.period.after)}` : 'from the start'} through{' '}
            {formatDay(check.period.through)}
          </h3>
          <p className="text-xs text-gray-600">
            Tick each one that appears on the statement. Ticked: {tickSummary.cleared} of {tickSummary.total}.
            {tickSummary.unclearedCents !== 0 &&
              ` Not ticked adds up to ${money(tickSummary.unclearedCents / 100)}: if those are missing from the statement, they explain a difference of the same size.`}
          </p>
          {check.transactions.length > 0 && (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => setTicked(new Set(check.transactions.map((t) => t.id)))} className={`${button} bg-gray-100 text-gray-800 hover:bg-gray-200`}>
                Tick all
              </button>
              <button type="button" onClick={() => setTicked(new Set())} className={`${button} bg-gray-100 text-gray-800 hover:bg-gray-200`}>
                Untick all
              </button>
            </div>
          )}
          {check.transactions.length === 0 ? (
            <p className="mt-2 text-sm text-gray-600">No transactions in this period.</p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100" aria-label="Transactions in this statement period">
              {check.transactions.map((t) => {
                const what = isDebt
                  ? t.type === 'expense' ? 'Charge' : 'Payment or credit'
                  : t.type === 'income' ? 'Money in' : 'Money out';
                return (
                  <li key={t.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={ticked.has(t.id)}
                        onChange={() => toggle(t.id)}
                        className="h-5 w-5 shrink-0 rounded border-gray-300 text-sky-700"
                        aria-label={`Cleared: ${t.description || t.vendor || what}, ${formatDay(t.transaction_date)}, ${money(t.amount)}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-gray-900">
                          {t.description || t.vendor || what}
                          {t.is_adjustment && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">Adjustment</span>}
                        </span>
                        <span className="block text-xs text-gray-600">
                          {formatDay(t.transaction_date)} · {what}
                        </span>
                      </span>
                      <span className={`shrink-0 text-sm font-medium ${t.effect < 0 ? 'text-gray-700' : 'text-gray-900'}`}>
                        {t.effect >= 0 ? '+' : '−'}
                        {money(Math.abs(t.effect))}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {differenceCents !== 0 && differenceCents !== null && !check.before_start && (
            <fieldset className="mt-5 space-y-2">
              <legend className="text-sm font-semibold text-gray-900">What should happen to the {money(Math.abs(check.difference ?? 0))} difference?</legend>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3">
                <input type="radio" name="choice" value="adjustment" checked={choice === 'adjustment'} onChange={() => setChoice('adjustment')} className="mt-1 h-4 w-4" />
                <span className="text-sm text-gray-800">
                  <span className="font-medium">Add an adjustment.</span> Records {adjustmentType} of {money(Math.abs(check.difference ?? 0))} named
                  &ldquo;Reconciliation adjustment&rdquo; on {formatDay(check.statement_date)}, tagged reconcile-adjustment, so the books match the
                  statement. Best when you can&apos;t find the cause.
                </span>
              </label>
              <label className={`flex min-h-11 items-start gap-3 rounded-lg border border-gray-200 p-3 ${check.earlier_reconciled ? 'opacity-60' : 'cursor-pointer'}`}>
                <input
                  type="radio"
                  name="choice"
                  value="starting_balance"
                  checked={choice === 'starting_balance'}
                  onChange={() => setChoice('starting_balance')}
                  disabled={check.earlier_reconciled}
                  className="mt-1 h-4 w-4"
                />
                <span className="text-sm text-gray-800">
                  <span className="font-medium">Change the starting balance</span> from {money(account.opening_balance)} to {money(newOpening)}.
                  Best when the starting balance was a guess.
                  {check.earlier_reconciled && ' Not available: an earlier statement is reconciled, and this would put it out of balance.'}
                </span>
              </label>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3">
                <input type="radio" name="choice" value="left_open" checked={choice === 'left_open'} onChange={() => setChoice('left_open')} className="mt-1 h-4 w-4" />
                <span className="text-sm text-gray-800">
                  <span className="font-medium">Leave it open.</span> Nothing changes. The difference is saved so you can come back, fix the
                  transactions, and reconcile again.
                </span>
              </label>
            </fieldset>
          )}

          <div className="mt-4">
            <label htmlFor="reconcile-note" className="text-xs font-medium text-gray-700">Note (optional)</label>
            <input id="reconcile-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={input} />
          </div>

          {finishError && (
            <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{finishError}</p>
          )}

          <button
            type="button"
            onClick={finish}
            disabled={!canFinish || finishing}
            className={`${button} mt-4 w-full bg-fuchsia-600 text-white hover:bg-fuchsia-700 sm:w-auto`}
          >
            {finishing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {differenceCents === 0 ? 'Finish: mark reconciled' : choice === 'left_open' ? 'Save as open' : 'Finish'}
          </button>
        </section>
      )}

      {/* 4. History */}
      <section className={card} aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-base font-semibold text-gray-900">Reconciliations</h2>
        {view.reconciliations.length === 0 ? (
          <p className="mt-1 text-sm text-gray-600">None yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100" aria-label="Past reconciliations">
            {view.reconciliations.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-medium text-gray-900">
                    {formatDay(r.statement_date)}{' '}
                    <span
                      className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${r.status === 'reconciled' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}
                    >
                      {r.status === 'reconciled' ? 'Reconciled' : 'Open'}
                    </span>
                  </p>
                  <p className="text-xs text-gray-600">
                    Statement {money(r.statement_balance)} · Your records {money(r.computed_balance)} · Difference {money(r.difference)}
                    {r.resolution ? ` · ${RESOLUTION_LABEL[r.resolution] ?? r.resolution}` : ''} · {r.cleared_count} ticked
                    {r.note ? ` · ${r.note}` : ''}
                  </p>
                </div>
                {r.status === 'reconciled' && view.ready && (
                  <button
                    type="button"
                    onClick={() => {
                      setUndoTarget(r);
                      setRemoveAdjustment(false);
                      setUndoError(null);
                    }}
                    className={`${button} bg-gray-100 text-gray-800 hover:bg-gray-200`}
                  >
                    Unreconcile<span className="sr-only"> the statement of {formatDay(r.statement_date)}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal isOpen={!!undoTarget} onClose={() => setUndoTarget(null)} title="Unreconcile this statement?" size="sm">
        {undoTarget && (
          <div className="space-y-3 p-6 text-sm text-gray-800">
            <p>
              The statement of {formatDay(undoTarget.statement_date)} becomes open again, so its transactions no longer show the
              reconciled warning. Ticks stay as they are.
              {undoTarget.resolution === 'starting_balance' && ' The starting balance change is not undone: edit it above if needed.'}
            </p>
            {undoTarget.adjustment_transaction_id && (
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input type="checkbox" checked={removeAdjustment} onChange={(e) => setRemoveAdjustment(e.target.checked)} className="h-5 w-5" />
                Also delete its reconciliation adjustment
              </label>
            )}
            {undoError && <p role="alert" className="text-red-700">{undoError}</p>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={confirmUnreconcile} disabled={undoBusy} className={`${button} bg-fuchsia-600 text-white hover:bg-fuchsia-700`}>
                {undoBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Unreconcile
              </button>
              <button type="button" onClick={() => setUndoTarget(null)} className={`${button} bg-gray-100 text-gray-800 hover:bg-gray-200`}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
