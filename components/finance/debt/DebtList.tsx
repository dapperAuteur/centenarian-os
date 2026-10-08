'use client';

// components/finance/debt/DebtList.tsx
// Every card and loan: balance, APR, minimum, next due date, credit limit and % used (the account's
// limit, else the latest statement's), promo deadlines (amber when close), interest paid this year.

import { AlertTriangle, CheckCircle2, CreditCard, Landmark } from 'lucide-react';
import { money, shortDate } from '@/lib/finance/debt/due';
import type { DebtRow } from './types';

export default function DebtList({ debts, today }: { debts: DebtRow[]; today: string }) {
  if (!debts.length) {
    return (
      <p className="text-sm text-gray-600 bg-white border border-gray-200 rounded-xl p-4">
        No credit card or loan accounts yet. Add one under Finance → Accounts (type Credit card or Loan), then import a
        statement to bring in its APR, minimum payment, due date and promotional balances.
      </p>
    );
  }

  return (
    <ul role="list" className="grid gap-3 md:grid-cols-2">
      {debts.map((d) => {
        const Icon = d.type === 'loan' ? Landmark : CreditCard;
        return (
          <li key={d.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="w-5 h-5 text-fuchsia-600 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{d.name}</h3>
                  <p className="text-xs text-gray-500">
                    {d.type === 'loan' ? 'Loan' : 'Credit card'}
                    {d.lastFour ? ` · ending ${d.lastFour}` : ''}
                    {d.institution ? ` · ${d.institution}` : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{money(Math.max(0, d.balance))}</p>
                <p className="text-xs text-gray-500">owed</p>
              </div>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div>
                <dt className="text-xs text-gray-500">APR</dt>
                <dd className="font-medium text-gray-900">
                  {d.apr !== null ? `${d.apr}%` : <span className="text-amber-700">Not set</span>}
                  {d.aprSource === 'account' && <span className="block text-xs text-gray-500">from account</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Minimum</dt>
                <dd className="font-medium text-gray-900">
                  {money(d.minimumPayment)}
                  {d.minimumEstimated && <span className="block text-xs text-gray-500">estimate</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Next due</dt>
                <dd className="font-medium text-gray-900">
                  {d.nextDue ? (
                    <>
                      {shortDate(d.nextDue.date, today)}
                      {d.nextDue.paid && (
                        <span className="flex items-center gap-1 text-xs text-green-700">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Paid
                        </span>
                      )}
                    </>
                  ) : d.dueDay ? (
                    `Day ${d.dueDay}`
                  ) : (
                    <span className="text-gray-500">Not set</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Interest this year</dt>
                <dd className="font-medium text-gray-900">{money(d.interestYtd)}</dd>
              </div>
            </dl>

            {d.creditLimit !== null && (
              <p className="text-xs text-gray-600">
                Credit limit {money(d.creditLimit)}
                {d.creditLimit > 0 && <> · {Math.round((Math.max(0, d.balance) / d.creditLimit) * 100)}% used</>}
                {d.creditLimitSource === 'statement' && <> · from the latest statement (add it to the account to keep it)</>}
              </p>
            )}

            {d.latestStatement && (
              <p className="text-xs text-gray-500">
                Latest statement closed {shortDate(d.latestStatement.periodEnd, today)}
                {d.latestStatement.newBalance !== null && <> · balance {money(d.latestStatement.newBalance)}</>}
                {d.type === 'credit_card' && d.latestStatement.newBalance !== null && d.latestStatement.newBalance > 0 && (
                  <> · pay it in full by the due date to avoid interest on purchases</>
                )}
              </p>
            )}

            {d.promos.length > 0 && (
              <ul role="list" className="space-y-2">
                {d.promos.map((p) => {
                  const warn = p.expired || p.needsAttention;
                  return (
                    <li
                      key={p.id}
                      className={`rounded-lg border p-3 text-sm ${warn ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-gray-50 border-gray-200 text-gray-800'}`}
                    >
                      <p className="font-medium flex items-center gap-1.5">
                        {warn && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />}
                        {p.description}: {money(p.balance)}
                      </p>
                      {p.expired ? (
                        <p className="text-xs mt-1">
                          Promotion ended {shortDate(p.expiresOn, today)}. If a balance was left, deferred interest may have been
                          charged; check your next statement.
                        </p>
                      ) : (
                        <p className="text-xs mt-1">
                          Pay off by {shortDate(p.expiresOn, today)} ({p.daysLeft} days): about {money(p.requiredMonthly)} a month
                          for {p.paymentsLeft} {p.paymentsLeft === 1 ? 'payment' : 'payments'}.
                          {p.backInterest !== null && (
                            <>
                              {' '}Miss it and {p.backInterestEstimated ? 'an estimated ' : ''}
                              {money(p.backInterest)} of deferred interest is charged at once.
                            </>
                          )}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
