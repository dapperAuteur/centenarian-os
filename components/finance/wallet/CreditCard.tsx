// components/finance/wallet/CreditCard.tsx
// The Wallet's "Credit cards and lines of credit" card: used vs limit overall and per account, in
// amber at the rule-of-thumb threshold or over the limit. Loans are a separate section.

import { CreditCard as CardIcon } from 'lucide-react';
import type { CreditSection } from '@/lib/finance/wallet/logic';
import { ActionLink, Attention, UsageMeter, WalletCard, money } from './parts';

export default function CreditCard({ credit, home }: { credit: CreditSection; home: string }) {
  const anyWarn = credit.warn || credit.lines.some((l) => l.warn);
  return (
    <WalletCard
      id="wallet-credit"
      title="Credit cards and lines of credit"
      icon={<CardIcon className="w-5 h-5 text-sky-700" aria-hidden="true" />}
      action={<ActionLink href="/dashboard/finance/debt">Debt payoff</ActionLink>}
    >
      {credit.lines.length === 0 ? (
        <p className="text-sm text-gray-600">No credit cards or lines of credit.</p>
      ) : (
        <>
          {credit.percent !== null ? (
            <>
              <p className="text-sm text-gray-700">
                <span className="text-2xl font-bold text-gray-900">{money(credit.used, home)}</span> of {money(credit.limit_total, home)} used
                <span className={`ml-2 font-semibold ${credit.warn ? 'text-amber-800' : 'text-gray-900'}`}>{credit.percent}%</span>
              </p>
              <UsageMeter percent={credit.percent} warn={credit.warn} label="Credit used across your cards and lines" />
              <p className="text-xs text-gray-600">
                {credit.available >= 0 ? `${money(credit.available, home)} available.` : `${money(-credit.available, home)} over your limits.`}
              </p>
            </>
          ) : credit.no_rate_count > 0 ? (
            <p className="text-sm text-gray-600">
              No exchange rate to {home} yet for {credit.no_rate_count === 1 ? 'the card that has a limit' : 'the cards that have limits'}, so the
              overall % is left out. Each card&apos;s own % is below.{' '}
              <ActionLink href="/dashboard/settings#my-currencies">Update rates</ActionLink>
            </p>
          ) : (
            <p className="text-sm text-gray-600">None of your cards has a limit yet, so there is no % used.</p>
          )}
          {credit.percent !== null && credit.no_rate_count > 0 && (
            <p className="text-xs text-gray-600">
              {credit.no_rate_count === 1 ? '1 card with a limit has' : `${credit.no_rate_count} cards with limits have`} no exchange rate to {home}{' '}
              yet, so {credit.no_rate_count === 1 ? "it isn't" : "they aren't"} in the overall %.{' '}
              <ActionLink href="/dashboard/settings#my-currencies">Update rates</ActionLink>
            </p>
          )}

          <ul role="list" className="divide-y divide-gray-100 text-sm">
            {credit.lines.map((l) => (
              <li key={l.id} className="py-2 space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-gray-900 min-w-0 truncate">
                    {l.name}
                    {l.last_four ? <span className="text-xs font-normal text-gray-600"> ••{l.last_four}</span> : null}
                    {l.kind === 'line_of_credit' && <span className="block text-xs font-normal text-gray-600">Line of credit</span>}
                  </p>
                  <p className="text-right text-gray-900">
                    {money(Math.max(0, l.owed), l.currency)}
                    {l.limit !== null && <span className="text-gray-600"> / {money(l.limit, l.currency)}</span>}
                    {l.percent !== null && <span className={`ml-1 font-semibold ${l.warn ? 'text-amber-800' : ''}`}>{l.percent}%</span>}
                    {l.currency !== home && (
                      <span className="block text-xs text-gray-600">{l.owed_home === null ? `${l.currency}, no rate yet` : `≈ ${money(Math.max(0, l.owed_home), home)}`}</span>
                    )}
                  </p>
                </div>
                {l.percent !== null && <UsageMeter percent={l.percent} warn={l.warn} label={`${l.name}: credit used`} />}
                {l.owed < 0 && <p className="text-xs text-gray-600">{money(-l.owed, l.currency)} credit on the account (overpaid).</p>}
                {l.over_limit && <p className="text-xs text-amber-800">Over the limit.</p>}
                {l.limit_source === 'statement' && <p className="text-xs text-gray-600">Limit from the latest statement.</p>}
              </li>
            ))}
          </ul>

          {credit.no_limit_count > 0 && (
            <p className="text-xs text-gray-600">
              {credit.no_limit_count === 1 ? '1 card has no limit' : `${credit.no_limit_count} cards have no limit`}; its{' '}
              {money(credit.no_limit_owed, home)} owed isn&apos;t in the %.{' '}
              <ActionLink href="/dashboard/finance/accounts">Add the limit</ActionLink>
            </p>
          )}
          {anyWarn && (
            <Attention>
              {credit.lines.some((l) => l.over_limit)
                ? 'A card or line is over its limit.'
                : `Using ${credit.threshold}% or more of a limit is flagged. That is a common rule of thumb, not a rule.`}
            </Attention>
          )}
        </>
      )}
    </WalletCard>
  );
}
