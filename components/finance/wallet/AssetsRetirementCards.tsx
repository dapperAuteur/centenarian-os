// components/finance/wallet/AssetsRetirementCards.tsx
// The Wallet's "Assets and insurance" card (your value and the depreciated book value side by side,
// items with no value, coverage per group) and its Retirement card (funds vs years left, on track
// or short). Estimates, not advice.

import Link from 'next/link';
import { CheckCircle2, Package, PiggyBank } from 'lucide-react';
import { POLICY_GROUP_LABEL, POLICY_GROUPS } from '@/lib/finance/insurance/logic';
import type { AssetsSection, InsuranceLine, RetirementSection } from '@/lib/finance/wallet/logic';
import { ActionLink, Attention, WalletCard, money } from './parts';

const SOURCE_LABEL = { your_value: 'resale value', book_value: 'book value', purchase_price: 'purchase price' } as const;

export function AssetsCard({ assets, insurance, home }: { assets: AssetsSection; insurance: InsuranceLine; home: string }) {
  const groups = POLICY_GROUPS.filter((g) => insurance.counts[g] > 0);
  return (
    <WalletCard
      id="wallet-assets"
      title="Assets and insurance"
      icon={<Package className="w-5 h-5 text-sky-700" aria-hidden="true" />}
      action={<ActionLink href="/dashboard/equipment">Equipment</ActionLink>}
    >
      <p className="text-sm text-gray-700">
        <span className="text-2xl font-bold text-gray-900">{money(assets.total, home)}</span>{' '}
        ({assets.count} {assets.count === 1 ? 'item' : 'items'})
      </p>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-gray-600">Resale value (yours)</dt>
          <dd className="font-medium text-gray-900">{money(assets.your_value_total, home)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-600">Book value (after depreciation)</dt>
          <dd className="font-medium text-gray-900">
            {assets.depreciation_ready ? money(assets.book_value_total, home) : 'Run migration 214'}
            {assets.depreciation_ready && (
              <span className="block text-xs font-normal text-gray-600">
                {assets.book_value_items} of {assets.count} items set up
              </span>
            )}
          </dd>
        </div>
      </dl>
      {assets.top.length > 0 && (
        <ul role="list" className="divide-y divide-gray-100 text-sm">
          {assets.top.map((i) => (
            <li key={`${i.kind}-${i.id}`} className="py-1.5 flex items-center justify-between gap-3">
              <Link href={i.href} className="min-h-11 flex items-center text-sky-700 hover:underline truncate">
                {i.name}
              </Link>
              <span className="text-right text-gray-900">
                {money(i.value, home)}
                {i.value_source && <span className="block text-xs text-gray-600">{SOURCE_LABEL[i.value_source]}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {assets.no_value_count > 0 && (
        <Attention>
          {assets.no_value_count === 1 ? '1 item has' : `${assets.no_value_count} items have`} no value yet:{' '}
          {assets.no_value.map((i, n) => (
            <span key={`${i.kind}-${i.id}`}>
              {n > 0 ? ', ' : ''}
              <Link href={i.href} className="text-sky-700 underline underline-offset-2">
                {i.name}
              </Link>
            </span>
          ))}
          {assets.no_value_count > assets.no_value.length ? ` and ${assets.no_value_count - assets.no_value.length} more` : ''}.
          {' '}Vehicles take a value from depreciation settings for now.
        </Attention>
      )}
      <p className="text-xs text-gray-600">
        Equipment and vehicles have no currency of their own, so they count in {home}. The total uses the resale value you entered (a valuation
        on the item), else the book value, else the purchase price. An item you never revalued has no resale value yet.
      </p>
      <div className="border-t border-gray-100 pt-3 space-y-1 text-sm">
        <p className="text-xs font-medium text-gray-700">Insurance in force</p>
        {!insurance.ready ? (
          <p className="text-xs text-gray-600">Insurance needs migration 215.</p>
        ) : groups.length === 0 ? (
          <p className="text-xs text-gray-600">
            No policies yet. <ActionLink href="/dashboard/finance/insurance">Add a policy</ActionLink>
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-2">
            {groups.map((g) => (
              <div key={g}>
                <dt className="text-xs text-gray-600">{POLICY_GROUP_LABEL[g]} coverage</dt>
                <dd className="font-medium text-gray-900">{money(insurance.coverage[g], home)}</dd>
              </div>
            ))}
          </dl>
        )}
        {insurance.other_currency > 0 && (
          <p className="text-xs text-gray-600">
            {insurance.other_currency} {insurance.other_currency === 1 ? 'policy' : 'policies'} in another currency not included.
          </p>
        )}
        <p className="text-xs text-gray-600">Comparing coverage with what your items are worth comes with the next update.</p>
      </div>
    </WalletCard>
  );
}

export function RetirementCard({ retirement, home }: { retirement: RetirementSection | null; home: string }) {
  return (
    <WalletCard
      id="wallet-retirement"
      title="Retirement"
      icon={<PiggyBank className="w-5 h-5 text-sky-700" aria-hidden="true" />}
      action={<ActionLink href="/dashboard/finance/retirement">Planner</ActionLink>}
    >
      {!retirement ? (
        <p className="text-sm text-gray-600">Retirement could not be loaded.</p>
      ) : !retirement.ready ? (
        <p className="text-sm text-gray-600">Retirement accounts need migration 215.</p>
      ) : (
        <>
          <p className="text-sm text-gray-700">
            <span className="text-2xl font-bold text-gray-900">{money(retirement.funds, home)}</span> saved
            <span className="block text-xs text-gray-600">
              {retirement.accounts} {retirement.accounts === 1 ? 'account' : 'accounts'}
              {retirement.unconverted > 0 ? `; ${retirement.unconverted} with no exchange rate left out` : ''}
            </span>
          </p>
          {retirement.age_missing ? (
            <p className="text-sm text-gray-700">
              Add your age in the planner to see the years left. <ActionLink href="/dashboard/finance/retirement">Planner settings</ActionLink>
            </p>
          ) : (
            <p className="text-sm text-gray-700">
              {retirement.years_left === 0
                ? `At or past your retirement age (${retirement.retirement_age}).`
                : `${retirement.years_left} ${retirement.years_left === 1 ? 'year' : 'years'} to retirement (at ${retirement.retirement_age}${retirement.age_assumed ? ', assumed' : ''}).`}
            </p>
          )}
          {retirement.on_track === true && (
            <p className="flex items-center gap-2 text-sm font-medium text-green-800">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> On track for your target.
            </p>
          )}
          {retirement.on_track === false && retirement.gap !== null && (
            <Attention>
              Short by {money(retirement.gap, home)}
              {retirement.extra_monthly !== null && retirement.extra_monthly > 0 ? `; about ${money(retirement.extra_monthly, home)} more a month` : ''}.
            </Attention>
          )}
          {retirement.policy_cash_value > 0 && (
            <p className="text-xs text-gray-600">Life policy cash value {money(retirement.policy_cash_value, home)} is counted in net worth.</p>
          )}
          <p className="text-xs text-gray-600">Estimate, not advice. Figures match the Retirement page.</p>
        </>
      )}
    </WalletCard>
  );
}
