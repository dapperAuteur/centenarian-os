'use client';

// components/finance/debt/InterestPaid.tsx
// Interest paid on cards and loans for a year: total, per account, per month. Exact where a
// statement says so, otherwise from interest transactions (lib/finance/debt/interest.ts).

import { useEffect, useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { money } from '@/lib/finance/debt/due';
import type { InterestResponse } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SOURCE_LABEL: Record<string, string> = {
  statement: 'from statements',
  transactions: 'from interest entries',
  mixed: 'statements and entries',
};

export default function InterestPaid({ initial }: { initial: InterestResponse }) {
  const id = useId();
  const [year, setYear] = useState(initial.year);
  const [data, setData] = useState<InterestResponse>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const thisYear = initial.year;

  useEffect(() => {
    if (year === initial.year) {
      setData(initial);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/finance/debt/interest?year=${year}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) setError(body.error ?? 'Could not load interest paid.');
        else setData(body as InterestResponse);
      })
      .catch(() => !cancelled && setError('Could not load interest paid.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [year, initial]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <p className="text-sm text-gray-500">Interest paid in {data.year}</p>
          <p className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            {money(data.total)}
            {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" aria-label="Loading..." />}
          </p>
        </div>
        <div>
          <label htmlFor={`${id}-year`} className="block text-sm font-medium text-gray-700">Year</label>
          <select
            id={`${id}-year`}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="mt-1 min-h-11 rounded-lg border border-gray-300 px-3 text-sm"
          >
            {Array.from({ length: 6 }, (_, i) => thisYear - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {data.accounts.length === 0 ? (
        <p className="text-sm text-gray-600">
          No interest recorded for {data.year}. It comes from imported statements (exact) or transactions marked as interest.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Interest paid by account and month, {data.year}</caption>
            <thead>
              <tr className="text-gray-600">
                <th scope="col" className="text-left py-1.5 pr-3 font-medium">Account</th>
                {MONTHS.map((m) => (
                  <th key={m} scope="col" className="text-right py-1.5 px-1.5 font-medium">{m}</th>
                ))}
                <th scope="col" className="text-right py-1.5 pl-3 font-medium">Year</th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((a) => {
                const byMonth = new Map(a.months.map((m) => [m.month, m]));
                return (
                  <tr key={a.accountId} className="border-t border-gray-100">
                    <th scope="row" className="text-left py-1.5 pr-3 font-normal text-gray-800 whitespace-nowrap">{a.name ?? 'Account'}</th>
                    {MONTHS.map((_, i) => {
                      const cell = byMonth.get(`${data.year}-${String(i + 1).padStart(2, '0')}`);
                      return (
                        <td
                          key={i}
                          className="text-right py-1.5 px-1.5 text-gray-900 whitespace-nowrap"
                          title={cell ? SOURCE_LABEL[cell.source] : undefined}
                        >
                          {cell ? money(cell.amount) : '—'}
                        </td>
                      );
                    })}
                    <td className="text-right py-1.5 pl-3 font-semibold text-gray-900">{money(a.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500">
        Exact where an imported statement shows the interest charged (counted in the month the statement closed); otherwise
        the sum of transactions marked as interest.
      </p>
    </div>
  );
}
