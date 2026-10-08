'use client';

// app/dashboard/finance/wallet/page.tsx
// The Wallet (plans/66 Part 2, W1): net worth on top, then cash (physical cash only), checking and
// savings, credit cards and lines of credit (used vs limit), loans (starting vs current, payoff at
// the minimum or a custom payment), assets and insurance, retirement vs years left, and one row per
// business. Every amount is in the home currency (Settings → My currencies); amounts with no rate
// are listed and left out. Estimates, not advice.
//
// Data: GET /api/finance/wallet. Rules: lib/finance/wallet/logic.ts, lib/finance/brands/logic.ts.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { useTrackPageView } from '@/lib/hooks/useTrackPageView';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { todayLocal } from '@/lib/dates/local';
import { ActionLink, money, signedMoney } from '@/components/finance/wallet/parts';
import type { WalletResponse } from '@/components/finance/wallet/parts';
import { BankCard, CashCard } from '@/components/finance/wallet/CashCards';
import CreditCard from '@/components/finance/wallet/CreditCard';
import LoansSection from '@/components/finance/wallet/LoansSection';
import { AssetsCard, RetirementCard } from '@/components/finance/wallet/AssetsRetirementCards';
import BrandRows from '@/components/finance/wallet/BrandRows';

const SECTION_LABEL = { cash: 'Cash', bank: 'Checking and savings', credit: 'Credit', loans: 'Loans' } as const;

export default function WalletPage() {
  useTrackPageView('finance', '/dashboard/finance/wallet');
  const [today] = useState(() => todayLocal());
  const [data, setData] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await offlineFetch(`/api/finance/wallet?today=${today}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load the Wallet.');
      setData(json as WalletResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the Wallet.');
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const home = data?.home_currency ?? 'USD';
  const nw = data?.net_worth;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/finance" className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-gray-100" aria-label="Back to Finance">
            <ArrowLeft className="w-5 h-5 text-gray-600" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
            <p className="text-sm text-gray-600">What you have, what you owe, and whether you&apos;re on track. Estimates, not advice.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="min-h-11 px-4 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 text-sm font-medium hover:bg-sky-100 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
        </button>
      </div>

      {error && <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {loading && !data && (
        <div className="flex justify-center py-16" role="status">
          <Loader2 className="w-6 h-6 animate-spin text-sky-600" aria-hidden="true" />
          <span className="sr-only">Loading...</span>
        </div>
      )}

      {data && nw && (
        <>
          <section aria-labelledby="wallet-net-worth-heading" className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1">
              <h2 id="wallet-net-worth-heading" className="text-sm font-semibold text-gray-700">
                Net worth <span className="font-normal text-gray-600">(estimate, in {home})</span>
              </h2>
              <ActionLink href="/dashboard/settings#my-currencies">Home currency: {home}</ActionLink>
            </div>
            <p className="text-3xl font-bold text-gray-900">{signedMoney(nw.total, home)}</p>
            <dl className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-sm">
              <div>
                <dt className="text-xs text-gray-600">Cash</dt>
                <dd className="font-medium text-gray-900">{money(nw.cash, home)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-600">Checking and savings</dt>
                <dd className="font-medium text-gray-900">{money(nw.bank, home)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-600">Retirement</dt>
                <dd className="font-medium text-gray-900">{money(nw.retirement, home)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-600">Policy cash value</dt>
                <dd className="font-medium text-gray-900">{money(nw.policy_cash_value, home)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-600">Assets</dt>
                <dd className="font-medium text-gray-900">{money(nw.assets, home)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-600">Minus debts</dt>
                <dd className="font-medium text-gray-900">{money(-nw.debts, home)}</dd>
              </div>
            </dl>
            <p className="text-xs text-gray-600">
              Cash + checking and savings + retirement + life policy cash value + assets − what you owe on cards, lines of credit and loans.
            </p>
          </section>

          {data.unconverted.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-medium">
                  {data.unconverted.length === 1 ? '1 amount has' : `${data.unconverted.length} amounts have`} no exchange rate to {home} yet, so{' '}
                  {data.unconverted.length === 1 ? 'it is' : 'they are'} left out of the totals:
                </p>
                <ul role="list" className="list-disc pl-5">
                  {data.unconverted.map((u) => (
                    <li key={`${u.section}-${u.id}`}>
                      {u.name} ({SECTION_LABEL[u.section]}): {money(u.amount, u.currency)} {u.currency}
                    </li>
                  ))}
                </ul>
                <ActionLink href="/dashboard/settings#my-currencies">Update rates</ActionLink>
              </div>
            </div>
          )}

          {data.warnings.length > 0 && (
            <div role="alert" className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900 space-y-1">
              {data.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <CashCard cash={data.cash} home={home} />
            <BankCard bank={data.bank} home={home} />
            <CreditCard credit={data.credit} home={home} />
            <RetirementCard retirement={data.retirement} home={home} />
          </div>
          <LoansSection loans={data.loans} home={home} today={data.today} />
          <AssetsCard assets={data.assets} insurance={data.insurance} home={home} />
          <BrandRows brands={data.brands} home={home} />
        </>
      )}
    </div>
  );
}
