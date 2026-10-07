'use client';

// components/finance/review/TxnLine.tsx
// One transaction on the finance Review page: date, amount (signed: money in
// is "+", money out is "-"), account and description. The whole line opens
// the transaction. Color carries no meaning here: the sign and the words do.

import Link from 'next/link';
import type { TxnView } from '@/lib/finance/review/sections';
import { formatIsoDate } from '@/lib/finance/csv-import/ui-helpers';

export function money(amount: number): string {
  return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function signedMoney(row: Pick<TxnView, 'amount' | 'type'>): string {
  return `${row.type === 'income' ? '+' : '-'}${money(row.amount)}`;
}

export function txnName(row: Pick<TxnView, 'description' | 'vendor'>): string {
  return row.description?.trim() || row.vendor?.trim() || 'No description';
}

export default function TxnLine({ label, row }: { label?: string; row: TxnView }) {
  return (
    <Link
      href={`/dashboard/finance/transactions/${row.id}`}
      className="-mx-2 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-gray-50 sm:flex-nowrap"
    >
      {label && <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</span>}
      <span className="whitespace-nowrap text-gray-700">{formatIsoDate(row.date)}</span>
      <span className="whitespace-nowrap font-semibold text-gray-900">
        {signedMoney(row)}
        <span className="sr-only">{row.type === 'income' ? ' in' : ' out'}</span>
      </span>
      {/* On a phone the account and the description each take their own line. */}
      <span className="basis-full font-medium text-gray-900 sm:basis-auto sm:shrink-0">{row.account_label}</span>
      <span className="basis-full text-gray-700 sm:min-w-0 sm:basis-auto sm:truncate">{txnName(row)}</span>
    </Link>
  );
}
