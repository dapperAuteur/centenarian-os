'use client';

// components/finance/TransferSection.tsx
// The "Transfer" card on a transaction's page.
//
// A transaction that is one side of a transfer shows the other side (with a
// link) and an Unlink action. Any other transaction gets two ways to say it
// is money moving between the person's own accounts:
//
//   Mark as transfer…        pick the matching transaction on another account
//                            (POST /api/finance/transfers/link)
//   This is a payment to…    pick the account it went to when that account has
//                            no transaction for it; one entry is added there
//                            (POST /api/finance/transfers/pay). Expenses only.

import { useEffect, useState } from 'react';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import TransferBadge, { type TransferPartnerView } from '@/components/finance/TransferBadge';
import {
  accountLabel,
  isTransferKind,
  TRANSFER_KIND_LABEL,
  type TransferKind,
} from '@/lib/finance/transfers/pairing';

interface TransferSectionTransaction {
  id: string;
  amount: number;
  type: 'expense' | 'income';
  source: string;
  account_id: string | null;
  transfer_group_id?: string | null;
  transfer_kind?: string | null;
}

interface TransferSectionProps {
  transaction: TransferSectionTransaction;
  /** The other side, when this transaction is in a transfer and the other side still exists. */
  partner: TransferPartnerView | null;
  /** Called after a link or unlink, so the page can reload. */
  onChanged: () => void;
  /** Called when unlinking removed this very transaction; `goToId` is the one that is left. */
  onRemoved: (goToId: string | null) => void;
}

interface Candidate {
  transaction: {
    id: string;
    date: string;
    amount: number;
    type: 'expense' | 'income';
    description: string | null;
    vendor: string | null;
    account_label: string;
  };
  kind: TransferKind;
  days_apart: number;
  reasons: string[];
}

interface AccountOption {
  id: string;
  name: string;
  account_type: string;
  institution_name: string | null;
  last_four: string | null;
  is_active: boolean;
}

function money(amount: number): string {
  return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function errorFrom(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  return typeof body?.error === 'string' ? body.error : `The server answered ${res.status}. Please try again.`;
}

const OFFLINE = 'Could not reach the server. Check your connection and try again.';

const primaryButton =
  'min-h-11 px-4 rounded-lg bg-sky-700 text-white text-sm font-medium hover:bg-sky-800 disabled:opacity-50 transition flex items-center justify-center gap-1.5';
const secondaryButton =
  'min-h-11 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition flex items-center justify-center gap-1.5';

export default function TransferSection({ transaction, partner, onChanged, onRemoved }: TransferSectionProps) {
  const [dialog, setDialog] = useState<'link' | 'pay' | 'unlink' | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // "Mark as transfer…"
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  // "This is a payment to…"
  const [accounts, setAccounts] = useState<AccountOption[] | null>(null);
  const [toAccountId, setToAccountId] = useState('');

  const grouped = Boolean(transaction.transfer_group_id);
  const kind: TransferKind | null = isTransferKind(transaction.transfer_kind) ? transaction.transfer_kind : null;

  // Which row, if either, is the entry "This is a payment to…" added.
  const counterEntry: 'partner' | 'self' | null =
    partner && partner.source === 'transfer' && transaction.source !== 'transfer'
      ? 'partner'
      : partner && transaction.source === 'transfer' && partner.source !== 'transfer'
        ? 'self'
        : null;

  const closeDialog = () => {
    if (working) return;
    setDialog(null);
    setError(null);
  };

  // Load what the open dialog needs.
  useEffect(() => {
    let cancelled = false;
    if (dialog === 'link') {
      setCandidates(null);
      setCandidatesLoading(true);
      fetch(`/api/finance/transfers/suggestions?transaction_id=${encodeURIComponent(transaction.id)}`)
        .then(async (res) => {
          if (cancelled) return;
          if (!res.ok) {
            setError(await errorFrom(res));
            setCandidates([]);
            return;
          }
          const body = await res.json();
          if (!cancelled) setCandidates(Array.isArray(body?.candidates) ? body.candidates : []);
        })
        .catch(() => {
          if (!cancelled) {
            setError(OFFLINE);
            setCandidates([]);
          }
        })
        .finally(() => { if (!cancelled) setCandidatesLoading(false); });
    }
    if (dialog === 'pay') {
      setAccounts(null);
      setToAccountId('');
      fetch('/api/finance/accounts')
        .then(async (res) => {
          if (cancelled) return;
          if (!res.ok) {
            setError(await errorFrom(res));
            setAccounts([]);
            return;
          }
          const body = await res.json();
          if (!cancelled) setAccounts(Array.isArray(body) ? body : []);
        })
        .catch(() => {
          if (!cancelled) {
            setError(OFFLINE);
            setAccounts([]);
          }
        });
    }
    return () => { cancelled = true; };
  }, [dialog, transaction.id]);

  const handleLink = async (candidate: Candidate) => {
    setWorking(candidate.transaction.id);
    setError(null);
    try {
      const res = await fetch('/api/finance/transfers/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_ids: [transaction.id, candidate.transaction.id], kind: candidate.kind }),
      });
      if (!res.ok) {
        setError(await errorFrom(res));
        return;
      }
      setDialog(null);
      setStatus(`Linked with the transaction on ${candidate.transaction.account_label}. The pair no longer counts as spending or income.`);
      onChanged();
    } catch {
      setError(OFFLINE);
    } finally {
      setWorking(null);
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toAccountId) {
      setError('Choose the account this payment went to.');
      return;
    }
    setWorking('pay');
    setError(null);
    try {
      const res = await fetch('/api/finance/transfers/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: transaction.id, to_account_id: toAccountId }),
      });
      if (!res.ok) {
        setError(await errorFrom(res));
        return;
      }
      const chosen = accounts?.find((account) => account.id === toAccountId);
      setDialog(null);
      setStatus(
        `Recorded as a payment to ${chosen ? accountLabel(chosen) : 'that account'}. An entry for ${money(transaction.amount)} was added there, and this no longer counts as spending.`,
      );
      onChanged();
    } catch {
      setError(OFFLINE);
    } finally {
      setWorking(null);
    }
  };

  const handleUnlink = async (removeCounterEntry: boolean) => {
    if (!transaction.transfer_group_id) return;
    setWorking(removeCounterEntry ? 'unlink-remove' : 'unlink');
    setError(null);
    try {
      const res = await fetch('/api/finance/transfers/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transfer_group_id: transaction.transfer_group_id,
          remove_counter_entry: removeCounterEntry,
        }),
      });
      if (!res.ok) {
        setError(await errorFrom(res));
        return;
      }
      const body = await res.json().catch(() => null);
      const removed: string[] = Array.isArray(body?.removed) ? body.removed : [];
      setDialog(null);
      if (removed.includes(transaction.id)) {
        onRemoved(partner?.id ?? null);
        return;
      }
      setStatus(
        removed.length > 0
          ? 'Unlinked, and the added payment entry was removed.'
          : 'Unlinked. This is an ordinary transaction again.',
      );
      onChanged();
    } catch {
      setError(OFFLINE);
    } finally {
      setWorking(null);
    }
  };

  const payOptions = (accounts ?? []).filter((account) => account.id !== transaction.account_id);
  const payDebts = payOptions.filter((a) => a.account_type === 'credit_card' || a.account_type === 'loan');
  const payOthers = payOptions.filter((a) => a.account_type !== 'credit_card' && a.account_type !== 'loan');
  const bothFromTransferForm = transaction.source === 'transfer' && partner?.source === 'transfer';

  return (
    <section aria-labelledby="transfer-section-heading" className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
      <h3 id="transfer-section-heading" className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
        <ArrowRightLeft className="w-4 h-4 text-sky-600" aria-hidden="true" />
        Transfer
      </h3>

      {grouped ? (
        <>
          <p className="text-sm text-gray-700">
            {kind ? `${TRANSFER_KIND_LABEL[kind]}. ` : ''}
            This is one side of a transfer between your own accounts, so it is not counted as spending or income.
          </p>
          <TransferBadge partner={partner} />
          {partner ? (
            <p className="text-xs text-gray-600">
              Other side: {shortDate(partner.transaction_date)}, {partner.type === 'income' ? '+' : '-'}{money(partner.amount)}
              {partner.description ? `, “${partner.description}”` : ''}.
            </p>
          ) : (
            <p className="text-xs text-gray-600">The other side of this transfer no longer exists.</p>
          )}
          <div>
            <button type="button" onClick={() => { setStatus(null); setDialog('unlink'); }} className={secondaryButton}>
              Unlink
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-700">
            Is this your own money moving between two of your accounts (a transfer, a card payment, a loan
            payment)? Mark it so it stops counting as {transaction.type === 'income' ? 'income' : 'spending'}.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" onClick={() => { setStatus(null); setDialog('link'); }} className={secondaryButton}>
              Mark as transfer…
            </button>
            {transaction.type === 'expense' && (
              <button type="button" onClick={() => { setStatus(null); setDialog('pay'); }} className={secondaryButton}>
                This is a payment to…
              </button>
            )}
          </div>
        </>
      )}

      {status && (
        <p role="status" className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-sm text-sky-900">
          {status}
        </p>
      )}

      {/* Mark as transfer… */}
      <Modal isOpen={dialog === 'link'} onClose={closeDialog} title="Mark as transfer" size="md">
        <div className="p-6 space-y-4 text-sm text-gray-700">
          <p>
            Pick the transaction on another account that is the other side of this one. It has the same amount
            ({money(transaction.amount)}), is within 5 days, and goes the other way. Both transactions stay, so
            balances don&rsquo;t change.
          </p>
          {error && (
            <p role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">{error}</p>
          )}
          {candidatesLoading && (
            <p role="status" className="flex items-center gap-2 text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Looking for matching transactions…
            </p>
          )}
          {candidates && candidates.length === 0 && !candidatesLoading && !error && (
            <p role="status" className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-700">
              {transaction.account_id
                ? 'No transaction on another account has this amount within 5 days.'
                : 'This transaction has no account, so it can’t be matched to another one.'}
              {transaction.type === 'expense' &&
                ' If the money went to an account that has no transaction for it, close this and use “This is a payment to…”.'}
            </p>
          )}
          {candidates && candidates.length > 0 && (
            <ul role="list" className="space-y-3">
              {candidates.map((candidate) => {
                const row = candidate.transaction;
                return (
                  <li key={row.id} className="border border-gray-200 rounded-xl p-3 space-y-2">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <span className="text-gray-600">{shortDate(row.date)}</span>
                      <span className={`font-semibold ${row.type === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                        {row.type === 'income' ? '+' : '-'}{money(row.amount)}
                      </span>
                      <span className="font-medium text-gray-900">{row.account_label}</span>
                    </div>
                    <p className="text-gray-700">{row.description || row.vendor || 'No description'}</p>
                    <p className="text-xs text-gray-600">
                      {TRANSFER_KIND_LABEL[candidate.kind]}. {candidate.reasons.join('. ')}.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleLink(candidate)}
                      disabled={working !== null}
                      aria-label={`Link with the ${money(row.amount)} transaction on ${row.account_label} from ${shortDate(row.date)}`}
                      className={primaryButton}
                    >
                      {working === row.id && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                      Link
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <button type="button" onClick={closeDialog} disabled={working !== null} className={secondaryButton}>
            Cancel
          </button>
        </div>
      </Modal>

      {/* This is a payment to… */}
      <Modal isOpen={dialog === 'pay'} onClose={closeDialog} title="This is a payment to…" size="sm">
        <form onSubmit={handlePay} className="p-6 space-y-4 text-sm text-gray-700">
          <p>
            Use this when the {money(transaction.amount)} went to one of your accounts that has no transaction for
            it, like a loan you don&rsquo;t import statements for. One entry is added on that account for the same
            amount and date: a card or loan balance goes down, a bank balance goes up. This transaction stays as
            it is and stops counting as spending.
          </p>
          {error && (
            <p role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">{error}</p>
          )}
          <div>
            <label htmlFor="pay-to-account" className="block text-xs font-medium text-gray-700 mb-1">
              Account it was paid to
            </label>
            <select
              id="pay-to-account"
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              disabled={accounts === null || working !== null}
              className="w-full min-h-11 px-3 text-sm border border-gray-300 rounded-lg bg-white text-gray-900"
            >
              <option value="">{accounts === null ? 'Loading accounts…' : 'Choose an account…'}</option>
              {payDebts.length > 0 && (
                <optgroup label="Cards and loans">
                  {payDebts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {accountLabel(account)}{account.is_active ? '' : ' (inactive)'}
                    </option>
                  ))}
                </optgroup>
              )}
              {payOthers.length > 0 && (
                <optgroup label="Bank and cash accounts">
                  {payOthers.map((account) => (
                    <option key={account.id} value={account.id}>
                      {accountLabel(account)}{account.is_active ? '' : ' (inactive)'}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="submit" disabled={working !== null || !toAccountId} className={primaryButton}>
              {working === 'pay' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Record payment
            </button>
            <button type="button" onClick={closeDialog} disabled={working !== null} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Unlink */}
      <Modal isOpen={dialog === 'unlink'} onClose={closeDialog} title="Unlink this transfer?" size="sm">
        <div className="p-6 space-y-4 text-sm text-gray-700">
          {counterEntry ? (
            <p>
              The entry on <strong>{counterEntry === 'partner' ? partner?.account_label : 'this account'}</strong> was
              added when this was recorded as a payment. Removing it puts that account&rsquo;s balance back to
              what it was before. Keeping it leaves it there as an ordinary entry.
            </p>
          ) : bothFromTransferForm ? (
            <p>
              Both entries stay on their accounts but are no longer linked to each other. To take the transfer out
              of both accounts, delete it instead.
            </p>
          ) : (
            <p>
              Both transactions stay on their accounts. They will count as spending and income again, and balances
              don&rsquo;t change.
            </p>
          )}
          {error && (
            <p role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">{error}</p>
          )}
          <div className="flex flex-col gap-2">
            {counterEntry && (
              <button
                type="button"
                onClick={() => handleUnlink(true)}
                disabled={working !== null}
                className={primaryButton}
              >
                {working === 'unlink-remove' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                Unlink and remove the added entry
              </button>
            )}
            <button
              type="button"
              onClick={() => handleUnlink(false)}
              disabled={working !== null}
              className={counterEntry ? secondaryButton : primaryButton}
            >
              {working === 'unlink' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {counterEntry ? 'Unlink and keep both' : 'Unlink'}
            </button>
            <button type="button" onClick={closeDialog} disabled={working !== null} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
