'use client';

// app/dashboard/finance/brands/[id]/page.tsx
// One business (brand): this year's money in, out and net; cash flow by month, quarter or year;
// a profit and loss for any dates with a PDF; open invoices; expected income in the next 90 days;
// and what is tagged to it. Home currency, transfers left out. Built from what can be tagged today
// (transactions, invoices, trips, expected income); accounts and items follow with plans/66 W2.
//
// Data: GET /api/brands/[id]/summary, GET /api/brands/[id]/pl. Rules: lib/finance/brands/logic.ts.

import { use, useCallback, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Loader2, Pencil } from 'lucide-react';
import { useTrackPageView } from '@/lib/hooks/useTrackPageView';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { todayLocal } from '@/lib/dates/local';
import { CASH_FLOW_GRANULARITIES, CASH_FLOW_LABEL, yearStart } from '@/lib/finance/brands/logic';
import type { CashFlowGranularity } from '@/lib/finance/brands/logic';
import type { BrandPage } from '@/lib/finance/brands/server';
import { formatDate } from '@/components/finance/retirement/format';
import { ActionLink, WalletCard, money, signedMoney } from '@/components/finance/wallet/parts';
import { exportPlPdf } from '@/components/finance/brands/plExport';
import type { PlData } from '@/components/finance/brands/plExport';

export default function BusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  useTrackPageView('finance', '/dashboard/finance/brands/[id]');
  const [today] = useState(() => todayLocal());
  const [data, setData] = useState<BrandPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<CashFlowGranularity>('month');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await offlineFetch(`/api/brands/${id}/summary?today=${today}`);
      const json = await res.json();
      if (res.status === 404) throw new Error('This business was not found. It may have been deleted.');
      if (!res.ok) throw new Error(json.error || 'Could not load the business.');
      setData(json as BrandPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the business.');
    } finally {
      setLoading(false);
    }
  }, [id, today]);

  useEffect(() => {
    load();
  }, [load]);

  const home = data?.home_currency ?? 'USD';
  const table = data?.cash_flow[granularity];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard/finance/wallet" className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-gray-100" aria-label="Back to Wallet">
            <ArrowLeft className="w-5 h-5 text-gray-600" aria-hidden="true" />
          </Link>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              {data && <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: data.brand.color ?? '#9ca3af' }} aria-hidden="true" />}
              <span className="truncate">{data?.brand.name ?? 'Business'}</span>
            </h1>
            <p className="text-sm text-gray-600">
              {data?.brand.dba_name ? `DBA "${data.brand.dba_name}" · ` : ''}Cash flow, profit and loss, invoices and expected income, in {home}.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/finance/brands"
          className="min-h-11 px-4 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 text-sm font-medium hover:bg-sky-100 flex items-center justify-center gap-2"
        >
          <Pencil className="w-4 h-4" aria-hidden="true" /> Edit businesses
        </Link>
      </div>

      {error && <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {loading && !data && (
        <div className="flex justify-center py-16" role="status">
          <Loader2 className="w-6 h-6 animate-spin text-sky-600" aria-hidden="true" />
          <span className="sr-only">Loading...</span>
        </div>
      )}

      {data && table && (
        <>
          <section aria-labelledby="biz-year-heading" className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
            <h2 id="biz-year-heading" className="text-sm font-semibold text-gray-700">
              This year <span className="font-normal text-gray-600">(Jan 1 to {formatDate(data.today)})</span>
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <dt className="text-xs text-gray-600">Money in</dt>
                <dd className="text-2xl font-bold text-gray-900">{money(data.this_year.money_in, home)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-600">Money out</dt>
                <dd className="text-2xl font-bold text-gray-900">{money(data.this_year.money_out, home)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-600">Net</dt>
                <dd className="text-2xl font-bold text-gray-900">{signedMoney(data.this_year.net, home)}</dd>
              </div>
            </dl>
            <p className="text-xs text-gray-600">
              Transfers between your own accounts are not money in or out.
              {data.unconverted > 0 &&
                ` ${data.unconverted} transaction${data.unconverted === 1 ? '' : 's'} in another currency with no exchange rate yet ${data.unconverted === 1 ? 'is' : 'are'} left out.`}
            </p>
          </section>

          <section aria-labelledby="biz-cashflow-heading" className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 id="biz-cashflow-heading" className="text-base font-semibold text-gray-900">Cash flow</h2>
              <div role="group" aria-label="Group cash flow by" className="flex gap-1">
                {CASH_FLOW_GRANULARITIES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={granularity === g}
                    onClick={() => setGranularity(g)}
                    className={`min-h-11 px-3 rounded-lg text-sm font-medium border ${
                      granularity === g ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {CASH_FLOW_LABEL[g]}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  {CASH_FLOW_LABEL[granularity]} money in, money out and net for {data.brand.name}, newest first, in {home}
                </caption>
                <thead className="text-xs text-gray-600 border-b border-gray-200">
                  <tr>
                    <th scope="col" className="py-2 pr-3 text-left font-medium">Period</th>
                    <th scope="col" className="py-2 px-2 text-right font-medium">Money in</th>
                    <th scope="col" className="py-2 px-2 text-right font-medium">Money out</th>
                    <th scope="col" className="py-2 pl-2 text-right font-medium">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {table.rows.map((r) => (
                    <tr key={r.key}>
                      <th scope="row" className="py-2 pr-3 text-left font-normal text-gray-800 whitespace-nowrap">{r.label}</th>
                      <td className="py-2 px-2 text-right text-gray-900">{money(r.money_in, home)}</td>
                      <td className="py-2 px-2 text-right text-gray-900">{money(r.money_out, home)}</td>
                      <td className="py-2 pl-2 text-right font-medium text-gray-900">{signedMoney(r.net, home)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-gray-300">
                  <tr>
                    <th scope="row" className="py-2 pr-3 text-left font-semibold text-gray-900">Total</th>
                    <td className="py-2 px-2 text-right font-semibold text-gray-900">{money(table.totals.money_in, home)}</td>
                    <td className="py-2 px-2 text-right font-semibold text-gray-900">{money(table.totals.money_out, home)}</td>
                    <td className="py-2 pl-2 text-right font-semibold text-gray-900">{signedMoney(table.totals.net, home)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-xs text-gray-600">
              {granularity === 'month' ? 'The last 12 months' : granularity === 'quarter' ? 'The last 8 quarters (Q1 is Jan to Mar)' : 'The last 5 years'}, this one
              included.
            </p>
          </section>

          <ProfitAndLoss brandId={data.brand.id} today={data.today} />

          <div className="grid gap-4 md:grid-cols-2">
            <WalletCard id="biz-invoices" title="Open invoices" icon={null} action={<ActionLink href="/dashboard/finance/invoices">Invoices</ActionLink>}>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-gray-600">Owed to you</dt>
                  <dd className="text-xl font-bold text-gray-900">{money(data.invoices.owed_to_you, home)}</dd>
                  <dd className="text-xs text-gray-600">{data.invoices.owed_to_you_count} sent or overdue</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-600">You owe</dt>
                  <dd className="text-xl font-bold text-gray-900">{money(data.invoices.you_owe, home)}</dd>
                  <dd className="text-xs text-gray-600">{data.invoices.you_owe_count} to pay</dd>
                </div>
              </dl>
            </WalletCard>
            <WalletCard id="biz-expected" title="Expected income" icon={null}>
              <p className="text-xl font-bold text-gray-900">{money(data.expected_income.total, home)}</p>
              <p className="text-xs text-gray-600">
                {data.expected_income.count} {data.expected_income.count === 1 ? 'payment' : 'payments'} expected through {formatDate(data.expected_income.until)} (the
                next 90 days).
              </p>
            </WalletCard>
          </div>

          <WalletCard id="biz-tagged" title="Tagged to this business" icon={null}>
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs text-gray-600">Transactions</dt>
                <dd className="font-medium text-gray-900">{data.tagged.transactions ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-600">Invoices</dt>
                <dd className="font-medium text-gray-900">{data.tagged.invoices ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-600">Trips</dt>
                <dd className="font-medium text-gray-900">{data.tagged.trips ?? '—'}</dd>
              </div>
            </dl>
            <p className="text-xs text-gray-600">
              Tag a transaction to this business with its Brand field, or several at once with Find similar on the Transactions page.
              Accounts, equipment, vehicles, insurance policies and retirement accounts can&apos;t be tagged to a business yet; that comes with the
              next database update, and then this page also shows the business&apos;s cash, credit, assets and insurance.
            </p>
          </WalletCard>
        </>
      )}
    </div>
  );
}

function ProfitAndLoss({ brandId, today }: { brandId: string; today: string }) {
  const id = useId();
  const [from, setFrom] = useState(() => yearStart(today));
  const [to, setTo] = useState(today);
  // The range last applied: the P&L loads on open and again on Apply, not on every keystroke.
  const [applied, setApplied] = useState(() => ({ from: yearStart(today), to: today }));
  const [pl, setPl] = useState<PlData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await offlineFetch(`/api/brands/${brandId}/pl?from=${applied.from}&to=${applied.to}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load the profit and loss.');
      setPl(json as PlData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the profit and loss.');
    } finally {
      setLoading(false);
    }
  }, [brandId, applied]);

  useEffect(() => {
    load();
  }, [load]);

  const home = pl?.home_currency ?? 'USD';
  return (
    <section aria-labelledby={`${id}-heading`} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
      <h2 id={`${id}-heading`} className="text-base font-semibold text-gray-900">Profit and loss</h2>
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div>
          <label htmlFor={`${id}-from`} className="block text-xs font-medium text-gray-700">From</label>
          <input id={`${id}-from`} type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 min-h-11 rounded-lg border border-gray-300 px-3 text-sm" />
        </div>
        <div>
          <label htmlFor={`${id}-to`} className="block text-xs font-medium text-gray-700">To</label>
          <input id={`${id}-to`} type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 min-h-11 rounded-lg border border-gray-300 px-3 text-sm" />
        </div>
        <button type="button" onClick={() => setApplied({ from, to })} disabled={loading} className="min-h-11 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50">
          {loading ? 'Loading...' : 'Apply'}
        </button>
        <button
          type="button"
          onClick={() => pl && exportPlPdf(pl, applied.from, applied.to)}
          disabled={!pl || loading}
          className="min-h-11 px-4 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 text-sm font-medium hover:bg-sky-100 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" aria-hidden="true" /> Export PDF
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {pl && (
        <div role="status" className="space-y-1">
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-gray-600">Income</dt>
              <dd className="text-lg font-bold text-gray-900">{money(pl.income, home)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-600">Expenses</dt>
              <dd className="text-lg font-bold text-gray-900">{money(pl.expenses, home)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-600">Net</dt>
              <dd className="text-lg font-bold text-gray-900">{signedMoney(pl.net, home)}</dd>
            </div>
          </dl>
          <p className="text-xs text-gray-600">
            {pl.transactions.length} {pl.transactions.length === 1 ? 'transaction' : 'transactions'}; the PDF lists each one.
            {(pl.unconverted ?? 0) > 0 && ` ${pl.unconverted} in another currency with no rate yet left out of the totals.`}
          </p>
        </div>
      )}
    </section>
  );
}
