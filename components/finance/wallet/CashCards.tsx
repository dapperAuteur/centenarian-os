// components/finance/wallet/CashCards.tsx
// The Wallet's Cash card (physical cash only, with how fresh each count is) and its Checking and
// savings card (with what savings goals hold, shown and never subtracted).

import { Banknote, Landmark } from 'lucide-react';
import type { BankSection, CashSection } from '@/lib/finance/wallet/logic';
import { ActionLink, Attention, MoneyWithHome, WalletCard, money } from './parts';

export function CashCard({ cash, home }: { cash: CashSection; home: string }) {
  return (
    <WalletCard id="wallet-cash" title="Cash" icon={<Banknote className="w-5 h-5 text-sky-700" aria-hidden="true" />}>
      <p className="text-2xl font-bold text-gray-900">{money(cash.total, home)}</p>
      <p className="text-xs text-gray-600">Physical cash in your cash accounts. Bank accounts are in the next card.</p>
      {cash.pockets.length === 0 ? (
        <p className="text-sm text-gray-600">
          No cash accounts yet. <ActionLink href="/dashboard/finance/accounts">Add a cash account</ActionLink>
        </p>
      ) : (
        <ul role="list" className="divide-y divide-gray-100 text-sm">
          {cash.pockets.map((p) => (
            <li key={p.id} className="py-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{p.name}</p>
                <p className={`text-xs ${p.needs_count ? 'text-amber-800' : 'text-gray-600'}`}>
                  {p.count_status === 'never'
                    ? 'Never counted'
                    : `Counted ${p.days_since_count === 0 ? 'today' : `${p.days_since_count} ${p.days_since_count === 1 ? 'day' : 'days'} ago`}`}
                </p>
              </div>
              <p className={`text-right font-medium ${p.overdrawn ? 'text-amber-800' : 'text-gray-900'}`}>
                <MoneyWithHome amount={p.balance} currency={p.currency} home={home} homeAmount={p.home} />
                {p.overdrawn && <span className="block text-xs">below zero</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
      {cash.needs_count > 0 && (
        <Attention href="/dashboard/finance#cash-on-hand-heading" action="Count cash">
          {cash.needs_count === 1 ? 'A cash account has' : `${cash.needs_count} cash accounts have`} not been counted in over 30 days.
        </Attention>
      )}
    </WalletCard>
  );
}

export function BankCard({ bank, home }: { bank: BankSection; home: string }) {
  return (
    <WalletCard
      id="wallet-bank"
      title="Checking and savings"
      icon={<Landmark className="w-5 h-5 text-sky-700" aria-hidden="true" />}
      action={<ActionLink href="/dashboard/finance/accounts">Accounts</ActionLink>}
    >
      <p className="text-2xl font-bold text-gray-900">{money(bank.total, home)}</p>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-gray-600">Checking</dt>
          <dd className="font-medium text-gray-900">{money(bank.checking, home)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-600">Savings</dt>
          <dd className="font-medium text-gray-900">{money(bank.savings, home)}</dd>
        </div>
      </dl>
      {bank.accounts.length > 0 && (
        <ul role="list" className="divide-y divide-gray-100 text-sm">
          {bank.accounts.map((a) => (
            <li key={a.id} className="py-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {a.name}
                  {a.last_four ? <span className="text-xs font-normal text-gray-600"> ••{a.last_four}</span> : null}
                </p>
                <p className="text-xs text-gray-600">
                  {a.account_type === 'checking' ? 'Checking' : 'Savings'}
                  {a.set_aside > 0 ? ` · ${money(a.set_aside, a.currency)} in savings goals` : ''}
                </p>
              </div>
              <p className={`text-right font-medium ${a.overdrawn ? 'text-amber-800' : 'text-gray-900'}`}>
                <MoneyWithHome amount={a.balance} currency={a.currency} home={home} homeAmount={a.home} />
                {a.overdrawn && <span className="block text-xs">overdrawn</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
      {bank.set_aside > 0 && (
        <p className="text-xs text-gray-600">
          Set aside in savings goals: {money(bank.set_aside, home)}. It is still in these accounts, so it is not subtracted.{' '}
          <ActionLink href="/dashboard/finance/savings">Savings goals</ActionLink>
        </p>
      )}
    </WalletCard>
  );
}
