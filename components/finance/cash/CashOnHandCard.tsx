'use client';

// components/finance/cash/CashOnHandCard.tsx
// Cash on hand, on the Finance dashboard: each active cash account with its
// balance in its own currency (and about how much that is in the home
// currency when it is foreign), when it was last counted (amber after 30
// days, or never), and Count / Paid cash / Withdraw. Under the list, the
// "Paid cash" quick form.
//
// With no cash account the card is replaced by a small "Track cash on hand"
// button that creates a cash account named Wallet in the home currency.
//
// Data: GET /api/finance/cash through offlineFetch, so the last loaded list
// still shows offline and Paid cash can be queued.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Banknote, Calculator, Loader2, Plus, Wallet } from 'lucide-react';
import type { BudgetCategory } from '@/components/finance/CategorySelect';
import TransferModal from '@/components/finance/TransferModal';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { todayLocal } from '@/lib/dates/local';
import { formatMoney } from '@/lib/finance/fx/math';
import { accountLabel } from '@/lib/finance/transfers/pairing';
import { defaultCashAccount } from '@/lib/finance/cash/logic';
import {
  formatDay,
  rememberedCashAccount,
  type CashAccountView,
  type CashOverviewResponse,
} from '@/lib/finance/cash/client';
import CountCashModal from './CountCashModal';
import PaidCashForm from './PaidCashForm';

interface TransferAccount {
  id: string;
  name: string;
  account_type: string;
  institution_name?: string | null;
  last_four: string | null;
  balance: number;
  is_active: boolean;
  currency?: string;
}

interface CashOnHandCardProps {
  categories: BudgetCategory[];
  onCategoryCreated: (category: BudgetCategory) => void;
  /** Every account, for Withdraw (a transfer into the cash account). */
  accounts: TransferAccount[];
  /** Called after anything changes a balance, so the rest of the dashboard reloads. */
  onChanged: () => void;
}

const smallButton =
  'flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700';

export default function CashOnHandCard({ categories, onCategoryCreated, accounts, onChanged }: CashOnHandCardProps) {
  const [data, setData] = useState<CashOverviewResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [countTarget, setCountTarget] = useState<CashAccountView | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<string | null>(null);
  const [paidAccountId, setPaidAccountId] = useState<string>('');
  const amountRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await offlineFetch(`/api/finance/cash?today=${todayLocal()}`);
      const body = await res.json().catch(() => null);
      if (res.ok && body && Array.isArray(body.accounts)) setData(body as CashOverviewResponse);
    } catch {
      /* keep whatever was shown */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    void load();
    onChanged();
  }, [load, onChanged]);

  async function createWallet() {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/finance/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Wallet', account_type: 'cash', opening_balance: 0 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setCreateError(typeof body?.error === 'string' ? body.error : `Couldn't create the Wallet account (error ${res.status}).`);
        return;
      }
      refresh();
    } catch {
      setCreateError("Couldn't create the Wallet account. Check your connection and try again.");
    } finally {
      setCreating(false);
    }
  }

  if (!loaded || !data) return null;

  const cashAccounts = data.accounts;
  if (cashAccounts.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={createWallet}
          disabled={creating}
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-sky-700 underline underline-offset-2 hover:text-sky-900 disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          Track cash on hand
        </button>
        <p className="text-xs text-gray-600">Adds a cash account named Wallet, in your home currency. Rename it any time.</p>
        {createError && (
          <p role="alert" className="text-sm text-red-800">
            {createError}
          </p>
        )}
      </div>
    );
  }

  const selectedPaid =
    cashAccounts.find((a) => a.id === paidAccountId) ??
    defaultCashAccount(cashAccounts, { remembered: rememberedCashAccount(), lastUsed: data.last_used_account_id });

  function paidCashFor(account: CashAccountView) {
    setPaidAccountId(account.id);
    amountRef.current?.focus();
    amountRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  return (
    <section aria-labelledby="cash-on-hand-heading" className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="cash-on-hand-heading" className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Wallet className="h-4 w-4 text-fuchsia-600" aria-hidden="true" />
          Cash on hand
        </h2>
      </div>

      <ul className="divide-y divide-gray-100" aria-label="Cash accounts">
        {cashAccounts.map((account) => {
          const foreign = account.currency !== account.home_currency;
          const attention = account.count_status !== 'fresh';
          return (
            <li key={account.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">{accountLabel(account)}</p>
                <p className={`text-lg font-bold tabular-nums ${account.balance < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                  {formatMoney(account.balance, account.currency)}
                  {foreign && <span className="ml-1 text-xs font-medium text-gray-600">{account.currency}</span>}
                </p>
                {foreign && (
                  <p className="text-xs text-gray-700">
                    {account.balance_home != null
                      ? `≈ ${formatMoney(account.balance_home, account.home_currency)}`
                      : 'No exchange rate yet'}
                  </p>
                )}
                <p className={`mt-0.5 flex items-center gap-1 text-xs ${attention ? 'font-medium text-amber-800' : 'text-gray-700'}`}>
                  {attention && <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                  {account.last_count
                    ? `Last counted ${formatDay(account.last_count.counted_on || account.last_count.counted_at)}${
                        account.count_status === 'stale' ? ': time to count again' : ''
                      }`
                    : 'Never counted'}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:flex sm:shrink-0">
                <button
                  type="button"
                  onClick={() => setCountTarget(account)}
                  className={`${smallButton} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50`}
                >
                  <Calculator className="h-4 w-4" aria-hidden="true" />
                  Count
                  <span className="sr-only"> the cash in {account.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => paidCashFor(account)}
                  className={`${smallButton} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50`}
                >
                  <Banknote className="h-4 w-4" aria-hidden="true" />
                  Paid cash
                  <span className="sr-only"> from {account.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawTarget(account.id)}
                  className={`${smallButton} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50`}
                >
                  <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
                  Withdraw
                  <span className="sr-only"> into {account.name}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 border-t border-gray-100 pt-4">
        <PaidCashForm
          accounts={cashAccounts}
          accountId={selectedPaid?.id ?? ''}
          onAccountChange={setPaidAccountId}
          categories={categories}
          onCategoryCreated={onCategoryCreated}
          onSaved={refresh}
          amountRef={amountRef}
          idPrefix="dash-paid-cash"
        />
      </div>

      <CountCashModal
        isOpen={countTarget !== null}
        onClose={() => setCountTarget(null)}
        account={countTarget ? (cashAccounts.find((a) => a.id === countTarget.id) ?? countTarget) : null}
        ready={data.ready}
        categories={categories}
        onCategoryCreated={onCategoryCreated}
        onChanged={refresh}
      />

      <TransferModal
        key={withdrawTarget ?? 'none'}
        isOpen={withdrawTarget !== null}
        onClose={() => setWithdrawTarget(null)}
        accounts={accounts}
        defaultToId={withdrawTarget ?? undefined}
        onSuccess={refresh}
      />
    </section>
  );
}
