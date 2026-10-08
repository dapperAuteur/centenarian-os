// components/finance/wallet/BrandRows.tsx
// The Wallet's Businesses section: one row per business (brand) with this year's money in, out and
// net, open invoices and expected income, each opening its business page.

import Link from 'next/link';
import { Briefcase, ChevronRight } from 'lucide-react';
import type { BrandSummaries } from '@/lib/finance/brands/server';
import { ActionLink, WalletCard, money, signedMoney } from './parts';

export default function BrandRows({ brands, home }: { brands: BrandSummaries | null; home: string }) {
  return (
    <WalletCard
      id="wallet-businesses"
      title="Businesses"
      icon={<Briefcase className="w-5 h-5 text-sky-700" aria-hidden="true" />}
      action={<ActionLink href="/dashboard/finance/brands">Manage</ActionLink>}
    >
      {!brands ? (
        <p className="text-sm text-gray-600">Businesses could not be loaded.</p>
      ) : brands.brands.length === 0 ? (
        <p className="text-sm text-gray-600">
          No businesses yet. Add one on the Brands page, then tag transactions, invoices and trips to it.
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-700">
            All businesses, net this year: <span className="font-semibold text-gray-900">{signedMoney(brands.totals.net, home)}</span>
          </p>
          <ul role="list" className="space-y-2">
            {brands.brands.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/dashboard/finance/brands/${b.id}`}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 min-h-11 hover:border-sky-300 hover:bg-sky-50"
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: b.color ?? '#9ca3af' }} aria-hidden="true" />
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-gray-900 truncate">
                      {b.name}
                      {!b.is_active && <span className="ml-2 text-xs font-normal text-gray-600">inactive</span>}
                    </span>
                    <span className="block text-xs text-gray-600">
                      This year: in {money(b.this_year.money_in, home)} · out {money(b.this_year.money_out, home)} · net{' '}
                      {signedMoney(b.this_year.net, home)}
                    </span>
                    {(b.invoices.owed_to_you > 0 || b.invoices.you_owe > 0 || b.expected_income > 0) && (
                      <span className="block text-xs text-gray-600">
                        {b.invoices.owed_to_you > 0 ? `Owed to you ${money(b.invoices.owed_to_you, home)}` : ''}
                        {b.invoices.owed_to_you > 0 && (b.invoices.you_owe > 0 || b.expected_income > 0) ? ' · ' : ''}
                        {b.invoices.you_owe > 0 ? `You owe ${money(b.invoices.you_owe, home)}` : ''}
                        {b.invoices.you_owe > 0 && b.expected_income > 0 ? ' · ' : ''}
                        {b.expected_income > 0 ? `Expected next 90 days ${money(b.expected_income, home)}` : ''}
                      </span>
                    )}
                  </span>
                  <span className="sr-only">Open {b.name}</span>
                  <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          {brands.totals.unconverted > 0 && (
            <p className="text-xs text-gray-600">
              {brands.totals.unconverted} business {brands.totals.unconverted === 1 ? 'transaction' : 'transactions'} in another currency with no
              rate yet {brands.totals.unconverted === 1 ? 'is' : 'are'} left out.
            </p>
          )}
          <p className="text-xs text-gray-600">
            Only transactions, invoices and trips can be tagged to a business today. Accounts, equipment, vehicles, policies and retirement
            accounts can&apos;t be tagged yet, so they all count under the cards above.
          </p>
        </>
      )}
    </WalletCard>
  );
}
