'use client';

// components/finance/cash/CountCashModal.tsx
// "Count my cash" for one cash account: enter what you actually have (a total,
// or bills and coins in the account's currency), see it next to the recorded
// balance, and save. The difference becomes one adjustment on the account
// ("Unrecorded cash spending" or "Cash found", tag cash-count) so the balance
// matches the count. Below: the account's count history, with Undo on the
// latest count (it deletes that count's adjustment).
//
// Counting needs a connection: the recorded balance is worked out on the
// server at the moment of the count. Before migration 213 the dialog says so
// and nothing can be saved.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Undo2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import CategorySelect, { type BudgetCategory } from '@/components/finance/CategorySelect';
import { todayLocal } from '@/lib/dates/local';
import { formatMoney } from '@/lib/finance/fx/math';
import { CASH_FOUND, UNRECORDED_SPENDING, planAdjustment } from '@/lib/finance/cash/logic';
import { denominationLabel, denominationTotalCents, denominationsFor } from '@/lib/finance/cash/denominations';
import { formatDay, type CashAccountView, type CashCountView } from '@/lib/finance/cash/client';

interface CountCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: CashAccountView | null;
  /** False before migration 213. */
  ready: boolean;
  categories: BudgetCategory[];
  onCategoryCreated: (category: BudgetCategory) => void;
  /** Called after a count is saved or undone, to refresh balances. */
  onChanged: () => void;
}

const input = 'w-full min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900';
const label = 'mb-1 block text-xs font-medium text-gray-700';
const toCents = (value: number) => Math.round(value * 100);

export const MIGRATION_213_TEXT =
  'Run migration 213 first (supabase/migrations/213_cash_counts.sql). Until then counts cannot be saved; nothing has been changed.';

export default function CountCashModal(props: CountCashModalProps) {
  // A fresh form for each account: the key resets every field.
  return props.account ? <CountCashDialog key={props.account.id} {...props} account={props.account} /> : null;
}

function CountCashDialog({
  isOpen,
  onClose,
  account,
  ready,
  categories,
  onCategoryCreated,
  onChanged,
}: CountCashModalProps & { account: CashAccountView }) {
  const denominations = useMemo(() => denominationsFor(account.currency), [account.currency]);
  const [mode, setMode] = useState<'total' | 'pieces'>('total');
  const [total, setTotal] = useState('');
  const [pieces, setPieces] = useState<Record<string, string>>({});
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [counts, setCounts] = useState<CashCountView[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [undoing, setUndoing] = useState(false);

  const currency = account.currency;
  const money = (value: number) => formatMoney(value, currency);

  const loadHistory = useCallback(async () => {
    setHistoryError(null);
    try {
      const res = await fetch(`/api/finance/cash/counts?account_id=${encodeURIComponent(account.id)}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setHistoryError(typeof body?.error === 'string' ? body.error : 'Could not load the count history.');
        return;
      }
      setCounts(Array.isArray(body?.counts) ? body.counts : []);
    } catch {
      setHistoryError('Could not load the count history. Check your connection.');
    }
  }, [account.id]);

  useEffect(() => {
    if (isOpen && ready) void loadHistory();
  }, [isOpen, ready, loadHistory]);

  const piecesCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(pieces)) {
      const n = Number(value);
      if (Number.isInteger(n) && n > 0) out[key] = n;
    }
    return out;
  }, [pieces]);

  const countedCents: number | null =
    mode === 'pieces'
      ? denominationTotalCents(piecesCounts)
      : total.trim() !== '' && Number.isFinite(Number(total.replace(/,/g, '')))
        ? toCents(Number(total.replace(/,/g, '')))
        : null;
  const recordedCents = toCents(account.balance);
  const plan = countedCents !== null && countedCents >= 0 ? planAdjustment(recordedCents, countedCents) : null;

  async function save() {
    setError(null);
    setSaved(null);
    if (countedCents === null || countedCents < 0) {
      setError('Enter the amount you counted, like 84.50.');
      return;
    }
    if (!navigator.onLine) {
      setError('Counting needs a connection, so the count is compared with your latest balance. Reconnect and try again.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/finance/cash/counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: account.id,
          counted_amount: countedCents / 100,
          denominations: mode === 'pieces' ? piecesCounts : undefined,
          category_id: categoryId || null,
          counted_on: date,
          today: todayLocal(),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          body?.code === 'cash_counts_not_migrated'
            ? MIGRATION_213_TEXT
            : typeof body?.error === 'string'
              ? body.error
              : `Couldn't save the count (error ${res.status}).`,
        );
        return;
      }
      const adjustment = body?.adjustment as { type: string; amount: number; description: string } | null;
      setSaved(
        adjustment
          ? `Count saved. ${adjustment.description} of ${money(adjustment.amount)} was recorded, so the balance is now ${money(countedCents / 100)}.`
          : `Count saved. It matches the recorded balance of ${money(countedCents / 100)}, so nothing was adjusted.`,
      );
      setTotal('');
      setPieces({});
      onChanged();
      void loadHistory();
    } catch {
      setError("Couldn't save the count. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function undoLatest(count: CashCountView) {
    setError(null);
    setSaved(null);
    setUndoing(true);
    try {
      const res = await fetch(`/api/finance/cash/counts/${encodeURIComponent(count.id)}`, { method: 'DELETE' });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof body?.error === 'string' ? body.error : `Couldn't undo the count (error ${res.status}).`);
        return;
      }
      setSaved(
        body?.adjustment_deleted
          ? 'Count undone. Its adjustment was deleted, so the balance is back to what it was before.'
          : 'Count undone.',
      );
      setConfirmUndo(false);
      onChanged();
      void loadHistory();
    } catch {
      setError("Couldn't undo the count. Check your connection and try again.");
    } finally {
      setUndoing(false);
    }
  }

  const modeButton = (value: 'total' | 'pieces', text: string, position: string) => (
    <button
      type="button"
      aria-pressed={mode === value}
      onClick={() => setMode(value)}
      className={`min-h-11 flex-1 border px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 ${position} ${
        mode === value ? 'border-sky-700 bg-sky-700 text-white' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
      }`}
    >
      {text}
    </button>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Count my cash: ${account.name}`} size="sm">
      <div className="space-y-4 p-6">
        {!ready && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{MIGRATION_213_TEXT}</span>
          </p>
        )}

        <p className="text-sm text-gray-700">
          Count the cash you actually have. If it differs from the recorded balance, the difference is saved as one
          entry on this account so the balance matches.
        </p>

        <dl className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-sm">
          <div>
            <dt className="text-xs text-gray-600">Recorded balance</dt>
            <dd className="font-semibold tabular-nums text-gray-900">{money(account.balance)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-600">Counted</dt>
            <dd className="font-semibold tabular-nums text-gray-900">{countedCents !== null ? money(countedCents / 100) : '—'}</dd>
          </div>
        </dl>

        {denominations && (
          <div role="group" aria-label="How to count" className="flex">
            {modeButton('total', 'Total', 'rounded-l-lg')}
            {modeButton('pieces', 'Bills and coins', 'rounded-r-lg border-l-0')}
          </div>
        )}

        {mode === 'total' || !denominations ? (
          <div>
            <label htmlFor="count-total" className={label}>
              Cash you have ({currency})
            </label>
            <input
              id="count-total"
              inputMode="decimal"
              autoComplete="off"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className={input}
              placeholder="0.00"
            />
          </div>
        ) : (
          <fieldset>
            <legend className={label}>How many of each ({currency})</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {denominations.map((d) => {
                const key = String(d.cents);
                const fieldId = `count-piece-${key}`;
                return (
                  <div key={key}>
                    <label htmlFor={fieldId} className="block text-xs text-gray-700">
                      {denominationLabel(d.cents)} {d.kind === 'bill' ? 'bills' : 'coins'}
                    </label>
                    <input
                      id={fieldId}
                      inputMode="numeric"
                      autoComplete="off"
                      value={pieces[key] ?? ''}
                      onChange={(e) => setPieces((p) => ({ ...p, [key]: e.target.value.replace(/\D/g, '') }))}
                      className={input}
                      placeholder="0"
                    />
                  </div>
                );
              })}
            </div>
          </fieldset>
        )}

        {plan && (
          <p className="text-sm text-gray-800" aria-live="polite">
            {plan.adjustment
              ? plan.adjustment.type === 'expense'
                ? `${money(plan.adjustment.amountCents / 100)} less than recorded. Saving adds "${UNRECORDED_SPENDING}" of that amount.`
                : `${money(plan.adjustment.amountCents / 100)} more than recorded. Saving adds "${CASH_FOUND}" of that amount.`
              : 'Matches the recorded balance. Saving keeps the count and changes nothing else.'}
          </p>
        )}

        {plan?.adjustment && (
          <CategorySelect
            id="count-category"
            size="touch"
            label={plan.adjustment.type === 'expense' ? 'Category for the unrecorded spending' : 'Category for the cash found'}
            value={categoryId}
            onChange={setCategoryId}
            categories={categories}
            onCategoryCreated={onCategoryCreated}
          />
        )}

        <div>
          <label htmlFor="count-date" className={label}>
            Date of the count
          </label>
          <input id="count-date" type="date" value={date} onChange={(e) => setDate(e.target.value || todayLocal())} className={input} />
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <p role="status" aria-live="polite" className="flex items-start gap-2 text-sm text-green-800">
          {saved && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
          {saved}
        </p>

        <button
          type="button"
          onClick={save}
          disabled={saving || !ready || countedCents === null}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? 'Saving...' : 'Save count'}
        </button>

        {ready && (
          <section aria-labelledby="count-history-heading" className="border-t border-gray-100 pt-4">
            <h3 id="count-history-heading" className="text-sm font-semibold text-gray-900">
              Count history
            </h3>
            {historyError && (
              <p role="alert" className="mt-2 text-sm text-red-800">
                {historyError}
              </p>
            )}
            {counts === null && !historyError && (
              <p role="status" className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading...
              </p>
            )}
            {counts && counts.length === 0 && <p className="mt-2 text-sm text-gray-700">No counts yet.</p>}
            {counts && counts.length > 0 && (
              <ul className="mt-2 divide-y divide-gray-100" aria-label="Counts, newest first">
                {counts.map((count, index) => (
                  <li key={count.id} className="flex flex-col gap-2 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatDay(count.counted_on || count.counted_at)}: counted {money(count.counted_amount)}
                      </p>
                      <p className="text-xs text-gray-700">
                        Recorded {money(count.recorded_balance)} ·{' '}
                        {count.difference === 0
                          ? 'matched'
                          : count.difference < 0
                            ? `${money(-count.difference)} unrecorded spending`
                            : `${money(count.difference)} found`}
                      </p>
                    </div>
                    {index === 0 &&
                      (confirmUndo ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => undoLatest(count)}
                            disabled={undoing}
                            className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-red-700 px-3 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
                          >
                            {undoing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                            Undo and delete its adjustment
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmUndo(false)}
                            className="min-h-11 rounded-lg bg-gray-100 px-3 text-sm font-medium text-gray-800 hover:bg-gray-200"
                          >
                            Keep it
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmUndo(true)}
                          className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-800 hover:bg-gray-50"
                        >
                          <Undo2 className="h-4 w-4" aria-hidden="true" />
                          Undo latest count
                        </button>
                      ))}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}
