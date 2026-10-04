'use client';

// components/finance/PossibleTransfersPanel.tsx
// The "Possible transfers" review panel on the Transactions page.
//
// Lists what GET /api/finance/transfers/suggestions found: pairs of
// transactions that look like the two sides of a transfer between the
// person's own accounts (high confidence first), and payments to a card or
// loan whose other side has no transaction. Nothing is linked until the
// person says so:
//
//   Link               -> POST /api/finance/transfers/link
//   Record payment     -> POST /api/finance/transfers/pay
//   Not a transfer     -> remembered in this browser (localStorage), nothing sent
//   Link all high-confidence -> Link, once per high-confidence pair
//
// The panel shows nothing at all when there is nothing to review, and when
// the database doesn't have the transfer columns yet.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, Check, Loader2, RefreshCw } from 'lucide-react';
import { TRANSFER_KIND_LABEL, type TransferKind } from '@/lib/finance/transfers/pairing';
import { normalizeMerchant } from '@/lib/finance/transaction-matching';

interface RowView {
  id: string;
  date: string;
  amount: number;
  type: 'expense' | 'income';
  description: string | null;
  vendor: string | null;
  account_id: string | null;
  account_label: string;
}

interface PairView {
  from: RowView;
  to: RowView;
  kind: TransferKind;
  confidence: 'high' | 'low';
  days_apart: number;
  reasons: string[];
}

interface OneSidedView {
  transaction: RowView;
  kind: 'card_payment' | 'loan_payment';
  to_account_id: string | null;
  to_account_label: string | null;
  reasons: string[];
}

interface AccountView {
  id: string;
  label: string;
  account_type: string;
  is_active: boolean;
}

interface Suggestions {
  pairs: PairView[];
  one_sided: OneSidedView[];
  accounts: AccountView[];
  truncated: boolean;
}

interface PossibleTransfersPanelProps {
  /** The Transactions page's date filter, when one is set (YYYY-MM-DD). */
  from?: string;
  to?: string;
  /** Change this to make the panel check again (after the page deleted a transaction, say). */
  refreshKey?: number;
  /** Called after something was linked, so the page can reload its list. */
  onChanged: () => void;
}

const DISMISSED_KEY = 'centos:finance:transfer-suggestions-dismissed:v1';
/** Oldest dismissals are dropped past this, so the stored list can't grow forever. */
const MAX_DISMISSED = 2000;
const PAGE = 20;

const pairKey = (pair: PairView): string => `pair:${pair.from.id}:${pair.to.id}`;
const oneSidedKey = (item: OneSidedView): string => `one:${item.transaction.id}`;

/** localStorage can be unavailable (private mode, blocked storage): never let that break the page. */
function readDismissed(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : [];
  } catch {
    return [];
  }
}

function writeDismissed(keys: string[]): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(keys.slice(-MAX_DISMISSED)));
  } catch {
    /* The dismissal still holds until the page is reloaded. */
  }
}

function money(amount: number): string {
  return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

const primaryButton =
  'min-h-11 px-4 rounded-lg bg-sky-700 text-white text-sm font-medium hover:bg-sky-800 disabled:opacity-50 transition flex items-center justify-center gap-1.5';
const secondaryButton =
  'min-h-11 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition flex items-center justify-center gap-1.5';

/** One transaction of a suggestion. The whole line opens that transaction. */
function RowLine({ label, row }: { label: string; row: RowView }) {
  const income = row.type === 'income';
  return (
    <Link
      href={`/dashboard/finance/transactions/${row.id}`}
      className="min-h-11 flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-0.5 px-2 py-1.5 -mx-2 rounded-lg hover:bg-gray-50 transition text-sm"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 w-10 shrink-0">{label}</span>
      <span className="text-gray-600 whitespace-nowrap">{shortDate(row.date)}</span>
      <span className={`font-semibold whitespace-nowrap ${income ? 'text-green-700' : 'text-red-700'}`}>
        {income ? '+' : '-'}{money(row.amount)}
      </span>
      {/* On a phone the account and the description each take their own line. */}
      <span className="font-medium text-gray-900 basis-full sm:basis-auto sm:shrink-0">{row.account_label}</span>
      <span className="text-gray-600 basis-full sm:basis-auto sm:truncate sm:min-w-0">
        {row.description || row.vendor || 'No description'}
      </span>
    </Link>
  );
}

export default function PossibleTransfersPanel({ from, to, refreshKey = 0, onChanged }: PossibleTransfersPanelProps) {
  const [data, setData] = useState<Suggestions | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** False when the database has no transfer columns yet: the panel stays hidden. */
  const [available, setAvailable] = useState(true);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  /** Suggestions already handled in this session, so they leave the list without a reload. */
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shownPairs, setShownPairs] = useState(PAGE);
  const [shownOneSided, setShownOneSided] = useState(PAGE);
  /** The destination picked per one-sided transaction. */
  const [destinations, setDestinations] = useState<Record<string, string>>({});
  /** The last destination picked for a description, offered again for rows that read the same. */
  const [remembered, setRemembered] = useState<Record<string, string>>({});

  useEffect(() => { setDismissed(readDismissed()); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const query = params.toString();
      const res = await fetch(`/api/finance/transfers/suggestions${query ? `?${query}` : ''}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (body?.code === 'transfers_not_migrated') {
          setAvailable(false);
          setData(null);
          return;
        }
        setLoadError(typeof body?.error === 'string' ? body.error : 'Could not check for transfers.');
        return;
      }
      setAvailable(true);
      setData({
        pairs: Array.isArray(body?.pairs) ? body.pairs : [],
        one_sided: Array.isArray(body?.one_sided) ? body.one_sided : [],
        accounts: Array.isArray(body?.accounts) ? body.accounts : [],
        truncated: Boolean(body?.truncated),
      });
      setDone(new Set());
    } catch {
      // Offline, the Transactions page shows cached data; a suggestion list
      // can't be acted on without a connection, so the panel just stays away.
      if (typeof navigator !== 'undefined' && !navigator.onLine) setAvailable(false);
      else setLoadError('Could not check for transfers. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const dismissedSet = useMemo(() => new Set(dismissed), [dismissed]);
  const pairs = useMemo(
    () => (data?.pairs ?? []).filter((pair) => !dismissedSet.has(pairKey(pair)) && !done.has(pairKey(pair))),
    [data, dismissedSet, done],
  );
  const oneSided = useMemo(
    () => (data?.one_sided ?? []).filter((item) => !dismissedSet.has(oneSidedKey(item)) && !done.has(oneSidedKey(item))),
    [data, dismissedSet, done],
  );
  const highPairs = useMemo(() => pairs.filter((pair) => pair.confidence === 'high'), [pairs]);
  const hiddenByDismissal = useMemo(() => {
    if (!data) return 0;
    return (
      data.pairs.filter((pair) => dismissedSet.has(pairKey(pair))).length +
      data.one_sided.filter((item) => dismissedSet.has(oneSidedKey(item))).length
    );
  }, [data, dismissedSet]);

  const markDone = (key: string) => setDone((prev) => new Set(prev).add(key));

  const dismiss = (key: string) => {
    const next = [...dismissed.filter((k) => k !== key), key];
    setDismissed(next);
    writeDismissed(next);
    setStatus('Marked as not a transfer. It won’t be suggested again in this browser.');
    setError(null);
  };

  const restoreDismissed = () => {
    setDismissed([]);
    writeDismissed([]);
    setStatus('Dismissed suggestions are back in the list.');
  };

  /** Sends one link request. Returns an error message, or null when it worked. */
  const linkPair = async (pair: PairView): Promise<string | null> => {
    try {
      const res = await fetch('/api/finance/transfers/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_ids: [pair.from.id, pair.to.id], kind: pair.kind }),
      });
      if (res.ok) return null;
      const body = await res.json().catch(() => null);
      return typeof body?.error === 'string' ? body.error : `The server answered ${res.status}.`;
    } catch {
      return 'Could not reach the server. Check your connection and try again.';
    }
  };

  const handleLink = async (pair: PairView) => {
    const key = pairKey(pair);
    setBusyKey(key);
    setStatus(null);
    setError(null);
    const failure = await linkPair(pair);
    setBusyKey(null);
    if (failure) {
      setError(`Couldn't link the ${money(pair.from.amount)} transfer: ${failure}`);
      return;
    }
    markDone(key);
    setStatus(
      `Linked ${money(pair.from.amount)} from ${pair.from.account_label} to ${pair.to.account_label}. It no longer counts as spending or income.`,
    );
    onChanged();
  };

  const handleLinkAllHigh = async () => {
    const batch = highPairs;
    if (batch.length === 0) return;
    setBusyKey('bulk');
    setStatus(null);
    setError(null);
    let linked = 0;
    const failures: string[] = [];
    for (let i = 0; i < batch.length; i++) {
      setBulkProgress(`Linking ${i + 1} of ${batch.length}…`);
      const failure = await linkPair(batch[i]);
      if (failure) {
        failures.push(`${money(batch[i].from.amount)} on ${shortDate(batch[i].from.date)}: ${failure}`);
      } else {
        linked += 1;
        markDone(pairKey(batch[i]));
      }
    }
    setBulkProgress(null);
    setBusyKey(null);
    if (linked > 0) {
      setStatus(`Linked ${plural(linked, 'transfer', 'transfers')}. They no longer count as spending or income.`);
      onChanged();
    }
    if (failures.length > 0) {
      setError(
        `${plural(failures.length, 'pair was', 'pairs were')} not linked. ${failures.slice(0, 3).join(' ')}${failures.length > 3 ? ' …' : ''}`,
      );
    }
    // Linking changes which rows are free, so ask for a fresh list.
    await load();
  };

  const descriptionKey = (row: RowView): string => normalizeMerchant(row.description || row.vendor);

  const destinationFor = (item: OneSidedView): string =>
    destinations[item.transaction.id] ??
    item.to_account_id ??
    remembered[descriptionKey(item.transaction)] ??
    '';

  const handlePay = async (item: OneSidedView) => {
    const key = oneSidedKey(item);
    const toAccountId = destinationFor(item);
    if (!toAccountId) {
      setError('Choose the account this payment went to first.');
      return;
    }
    setBusyKey(key);
    setStatus(null);
    setError(null);
    try {
      const res = await fetch('/api/finance/transfers/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: item.transaction.id, to_account_id: toAccountId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          `Couldn't record the ${money(item.transaction.amount)} payment: ${typeof body?.error === 'string' ? body.error : `the server answered ${res.status}.`}`,
        );
        return;
      }
      const label = data?.accounts.find((account) => account.id === toAccountId)?.label ?? 'that account';
      markDone(key);
      const descKey = descriptionKey(item.transaction);
      if (descKey) setRemembered((prev) => ({ ...prev, [descKey]: toAccountId }));
      setStatus(
        `Recorded a ${money(item.transaction.amount)} payment to ${label}. An entry was added on that account, and the payment no longer counts as spending.`,
      );
      onChanged();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusyKey(null);
    }
  };

  if (!available) return null;
  if (!data) {
    // Still loading the first time: stay out of the way. A failed check is
    // said out loud, with a way to try again.
    if (!loadError) return null;
    return (
      <section aria-labelledby="possible-transfers-heading" className="bg-white border border-sky-200 rounded-xl p-4 space-y-3">
        <h2 id="possible-transfers-heading" className="text-sm font-semibold text-gray-900">Possible transfers</h2>
        <p role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{loadError}</p>
        <button type="button" onClick={load} disabled={loading} className={secondaryButton}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Check again
        </button>
      </section>
    );
  }
  const nothingToReview = pairs.length === 0 && oneSided.length === 0;
  if (nothingToReview && hiddenByDismissal === 0 && !status && !error && !loadError) return null;

  const summaryParts: string[] = [];
  if (pairs.length > 0) {
    summaryParts.push(
      `${plural(pairs.length, 'pair looks', 'pairs look')} like money moving between your own accounts` +
        (highPairs.length > 0 ? ` (${highPairs.length.toLocaleString()} high confidence)` : ''),
    );
  }
  if (oneSided.length > 0) {
    summaryParts.push(`${plural(oneSided.length, 'payment has', 'payments have')} no matching transaction on the other account`);
  }
  const summary = summaryParts.length > 0 ? `${summaryParts.join('; ')}.` : 'Nothing new to review.';
  const busy = busyKey !== null;

  return (
    <section
      aria-labelledby="possible-transfers-heading"
      className="bg-white border border-sky-200 rounded-xl"
    >
      <div className="flex items-center gap-3 p-4 flex-wrap">
        <ArrowRightLeft className="w-5 h-5 text-sky-600 shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h2 id="possible-transfers-heading" className="text-sm font-semibold text-gray-900">
            Possible transfers
          </h2>
          <p className="text-xs text-gray-600">{summary}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls="possible-transfers-body"
          className={secondaryButton}
        >
          {open ? 'Hide' : 'Review'}
        </button>
      </div>

      {open && (
        <div id="possible-transfers-body" className="border-t border-sky-100 p-4 space-y-4">
          <p className="text-xs text-gray-600">
            A transfer, a card payment or a loan payment is your own money changing accounts, not spending or
            income. Linking keeps both transactions where they are, so account balances don&rsquo;t change; the
            pair just stops counting in your spending and income totals. You can unlink from either
            transaction&rsquo;s page.
          </p>

          {loadError && (
            <p role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {loadError}
            </p>
          )}
          {error && (
            <p role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </p>
          )}
          {(bulkProgress || status) && (
            <p role="status" className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-sm text-sky-900 flex items-start gap-2">
              {bulkProgress
                ? <Loader2 className="w-4 h-4 mt-0.5 shrink-0 animate-spin" aria-hidden="true" />
                : <Check className="w-4 h-4 mt-0.5 shrink-0 text-sky-600" aria-hidden="true" />}
              <span>{bulkProgress ?? status}</span>
            </p>
          )}
          {data?.truncated && (
            <p role="status" className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Only your newest 5,000 transactions were checked. Set a date range in the filters above to check
              older ones.
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            {highPairs.length > 0 && (
              <button type="button" onClick={handleLinkAllHigh} disabled={busy} className={primaryButton}>
                {busyKey === 'bulk' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                Link all {highPairs.length.toLocaleString()} high-confidence
              </button>
            )}
            <button type="button" onClick={load} disabled={busy || loading} className={secondaryButton}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Check again
            </button>
            {hiddenByDismissal > 0 && (
              <button type="button" onClick={restoreDismissed} disabled={busy} className={secondaryButton}>
                Show {hiddenByDismissal.toLocaleString()} dismissed
              </button>
            )}
          </div>

          {pairs.length > 0 && (
            <ul role="list" className="space-y-3">
              {pairs.slice(0, shownPairs).map((pair) => {
                const key = pairKey(pair);
                const high = pair.confidence === 'high';
                return (
                  <li key={key} className="border border-gray-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap text-xs font-medium">
                      <span className={`px-2 py-0.5 rounded-full ${high ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                        {high ? 'High confidence' : 'Check this one'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        {TRANSFER_KIND_LABEL[pair.kind]}
                      </span>
                    </div>
                    <div>
                      <RowLine label="From" row={pair.from} />
                      <RowLine label="To" row={pair.to} />
                    </div>
                    <p className="text-xs text-gray-600">{pair.reasons.join('. ')}.</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => handleLink(pair)}
                        disabled={busy}
                        aria-label={`Link ${money(pair.from.amount)} from ${pair.from.account_label} to ${pair.to.account_label} as a transfer`}
                        className={primaryButton}
                      >
                        {busyKey === key && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                        Link
                      </button>
                      <button
                        type="button"
                        onClick={() => dismiss(key)}
                        disabled={busy}
                        aria-label={`Not a transfer: ${money(pair.from.amount)} from ${pair.from.account_label} to ${pair.to.account_label}`}
                        className={secondaryButton}
                      >
                        Not a transfer
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {pairs.length > shownPairs && (
            <button type="button" onClick={() => setShownPairs((n) => n + PAGE)} className={secondaryButton}>
              Show {Math.min(PAGE, pairs.length - shownPairs)} more of {pairs.length.toLocaleString()}
            </button>
          )}

          {oneSided.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Payments with no matching transaction</h3>
                <p className="text-xs text-gray-600">
                  These read like a card or loan payment, but the account they went to has no transaction for
                  them. Choose the account, and one entry is added there for the same amount and date so its
                  balance goes down by the payment.
                </p>
              </div>
              <ul role="list" className="space-y-3">
                {oneSided.slice(0, shownOneSided).map((item) => {
                  const key = oneSidedKey(item);
                  const selectId = `pay-to-${item.transaction.id}`;
                  const options = (data?.accounts ?? []).filter((account) => account.id !== item.transaction.account_id);
                  const debts = options.filter((a) => a.account_type === 'credit_card' || a.account_type === 'loan');
                  const others = options.filter((a) => a.account_type !== 'credit_card' && a.account_type !== 'loan');
                  const chosen = destinationFor(item);
                  return (
                    <li key={key} className="border border-gray-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap text-xs font-medium">
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {TRANSFER_KIND_LABEL[item.kind]}
                        </span>
                      </div>
                      <RowLine label="From" row={item.transaction} />
                      <p className="text-xs text-gray-600">{item.reasons.join('. ')}.</p>
                      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                        <div className="flex-1 min-w-0">
                          <label htmlFor={selectId} className="block text-xs font-medium text-gray-700 mb-1">
                            Paid to
                          </label>
                          <select
                            id={selectId}
                            value={chosen}
                            onChange={(e) => setDestinations((prev) => ({ ...prev, [item.transaction.id]: e.target.value }))}
                            disabled={busy}
                            className="w-full min-h-11 px-3 text-sm border border-gray-300 rounded-lg bg-white text-gray-900"
                          >
                            <option value="">Choose an account…</option>
                            {debts.length > 0 && (
                              <optgroup label="Cards and loans">
                                {debts.map((account) => (
                                  <option key={account.id} value={account.id}>
                                    {account.label}{account.is_active ? '' : ' (inactive)'}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {others.length > 0 && (
                              <optgroup label="Bank and cash accounts">
                                {others.map((account) => (
                                  <option key={account.id} value={account.id}>
                                    {account.label}{account.is_active ? '' : ' (inactive)'}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePay(item)}
                          disabled={busy || !chosen}
                          aria-label={`Record the ${money(item.transaction.amount)} payment from ${shortDate(item.transaction.date)}`}
                          className={primaryButton}
                        >
                          {busyKey === key && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                          Record payment
                        </button>
                        <button
                          type="button"
                          onClick={() => dismiss(key)}
                          disabled={busy}
                          aria-label={`Not a transfer: the ${money(item.transaction.amount)} payment from ${shortDate(item.transaction.date)}`}
                          className={secondaryButton}
                        >
                          Not a transfer
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {oneSided.length > shownOneSided && (
                <button type="button" onClick={() => setShownOneSided((n) => n + PAGE)} className={secondaryButton}>
                  Show {Math.min(PAGE, oneSided.length - shownOneSided)} more of {oneSided.length.toLocaleString()}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
