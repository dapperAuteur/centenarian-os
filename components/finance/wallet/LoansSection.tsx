'use client';

// components/finance/wallet/LoansSection.tsx
// The Wallet's Loans section, apart from credit cards and lines of credit. Each loan compares its
// starting amount and date with what is owed now, shows the payoff date at its monthly payment (the
// statement's minimum, else the last linked payment; unknown otherwise, with no date), and takes a
// custom monthly payment that shows the new payoff date and the interest saved.
// Math: lib/finance/wallet/logic.ts comparePayoff (lib/finance/debt/amortize.ts). Estimates only.

import { useId, useMemo, useState } from 'react';
import { Landmark } from 'lucide-react';
import { PAYOFF_MAX_YEARS, comparePayoff } from '@/lib/finance/wallet/logic';
import type { LoanView, LoansSection as LoansData, PayoffSummary } from '@/lib/finance/wallet/logic';
import { formatDate } from '@/components/finance/retirement/format';
import { ActionLink, Attention, MoneyWithHome, WalletCard, money } from './parts';

function months(n: number | null): string {
  if (n === null) return '';
  return `${n} ${n === 1 ? 'month' : 'months'}`;
}

/** Why a payment gives no payoff date: it never covers the interest, or it takes over 50 years. */
function noPayoffText(p: PayoffSummary): string | null {
  if (p.never_pays_off) return "Never pays off at this amount: it doesn't cover the monthly interest";
  if (p.over_max) return `Takes more than ${PAYOFF_MAX_YEARS} years at this amount`;
  return null;
}

export default function LoansSection({ loans, home, today }: { loans: LoansData; home: string; today: string }) {
  return (
    <WalletCard
      id="wallet-loans"
      title="Loans"
      icon={<Landmark className="w-5 h-5 text-sky-700" aria-hidden="true" />}
      action={<ActionLink href="/dashboard/finance/debt">Debt payoff</ActionLink>}
    >
      {loans.loans.length === 0 ? (
        <p className="text-sm text-gray-600">No loans. A loan account with a credit limit is shown as a line of credit instead.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-xs text-gray-600">Owed on loans</dt>
              <dd className="text-2xl font-bold text-gray-900">{money(loans.owed, home)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-600">Payments a month</dt>
              <dd className="text-2xl font-bold text-gray-900">{money(loans.minimums, home)}</dd>
              {loans.no_payment_count > 0 && (
                <dd className="text-xs text-gray-600">
                  {loans.no_payment_count === 1 ? '1 loan has' : `${loans.no_payment_count} loans have`} no monthly payment yet
                </dd>
              )}
            </div>
          </dl>
          <ul role="list" className="space-y-3">
            {loans.loans.map((loan) => (
              <LoanRow key={loan.id} loan={loan} home={home} today={today} />
            ))}
          </ul>
          <p className="text-xs text-gray-600">
            Payoff dates are estimates: interest is worked out monthly at the APR shown, with the first payment a month from today.
          </p>
        </>
      )}
    </WalletCard>
  );
}

function LoanRow({ loan, home, today }: { loan: LoanView; home: string; today: string }) {
  const id = useId();
  const [custom, setCustom] = useState(loan.minimum !== null && loan.minimum > 0 ? String(loan.minimum) : '');
  const amount = Number(custom);
  const valid = custom.trim() !== '' && Number.isFinite(amount) && amount > 0;
  const result = useMemo(
    () => (valid && loan.owed > 0 ? comparePayoff(loan.owed, loan.apr, loan.minimum, amount, today) : null),
    [valid, loan.owed, loan.apr, loan.minimum, amount, today],
  );
  const c = loan.currency;
  const startLabel = loan.starting_date_source === 'added' ? 'added' : 'as of';

  return (
    <li className="rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">
            {loan.name}
            {loan.last_four ? <span className="text-xs font-normal text-gray-600"> ••{loan.last_four}</span> : null}
          </h3>
          <p className="text-xs text-gray-600">
            {loan.institution ?? 'Loan'}
            {loan.apr !== null ? ` · ${loan.apr}% APR${loan.apr_source === 'account' ? ' (from the account)' : ''}` : ''}
          </p>
        </div>
        <p className="text-right text-lg font-bold text-gray-900">
          <MoneyWithHome amount={Math.max(0, loan.owed)} currency={c} home={home} homeAmount={loan.owed_home === null ? null : Math.max(0, loan.owed_home)} />
        </p>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-gray-600">Started at</dt>
          <dd className="text-gray-900">
            {money(loan.starting_amount, c)}
            {loan.starting_date && <span className="block text-xs text-gray-600">{startLabel} {formatDate(loan.starting_date)}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-600">Owed now</dt>
          <dd className="text-gray-900">
            {money(Math.max(0, loan.owed), c)}
            <span className="block text-xs text-gray-600">as of {formatDate(loan.as_of)}</span>
            {loan.paid_percent !== null && loan.paid_down > 0 && (
              <span className="block text-xs text-gray-600">
                {money(loan.paid_down, c)} paid down ({loan.paid_percent}%)
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-600">Monthly payment</dt>
          <dd className="text-gray-900">
            {loan.minimum === null || loan.at_minimum === null ? (
              <>
                {loan.owed <= 0 ? 'Paid off' : 'Not known yet'}
                {loan.owed > 0 && (
                  <span className="block text-xs text-gray-600">
                    Import a statement, or record a payment as a transfer to this loan, to see its payoff date. Or try an amount below.
                  </span>
                )}
              </>
            ) : (
              <>
                {money(loan.minimum, c)} a month
                <span className="block text-xs text-gray-600">
                  {loan.minimum_source === 'statement'
                    ? 'Minimum from the latest statement'
                    : `Your last payment${loan.minimum_date ? ` (${formatDate(loan.minimum_date)})` : ''}`}
                </span>
                <span className="block text-xs text-gray-600">
                  {loan.owed <= 0
                    ? 'Paid off'
                    : (noPayoffText(loan.at_minimum) ??
                      `Paid off ${formatDate(loan.at_minimum.payoff_date)} (${months(loan.at_minimum.months)}), about ${money(loan.at_minimum.total_interest, c)} interest`)}
                </span>
              </>
            )}
          </dd>
        </div>
      </dl>

      {loan.apr === null && loan.owed > 0 && (
        <Attention href="/dashboard/finance/accounts" action="Add the APR">
          No APR is set, so these dates count no interest.
        </Attention>
      )}

      {loan.owed > 0 && (
        <div className="rounded-lg bg-gray-50 p-3 space-y-2">
          <label htmlFor={`${id}-pay`} className="block text-sm font-medium text-gray-800">
            Try a monthly payment ({c})
          </label>
          <input
            id={`${id}-pay`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-describedby={`${id}-result`}
            className="w-full sm:w-48 min-h-11 rounded-lg border border-gray-300 px-3 text-sm"
          />
          <div id={`${id}-result`} role="status" className="text-sm text-gray-800">
            {!valid ? (
              <span className="text-gray-600">Enter an amount to see a new payoff date.</span>
            ) : result && result.custom.never_pays_off ? (
              <span className="text-amber-800">{money(amount, c)} a month doesn&apos;t cover the monthly interest, so the loan would never be paid off.</span>
            ) : result && result.custom.over_max ? (
              <span className="text-amber-800">
                At {money(amount, c)} a month it would take more than {PAYOFF_MAX_YEARS} years to pay off.
              </span>
            ) : result ? (
              <>
                At {money(amount, c)} a month: paid off <strong>{formatDate(result.custom.payoff_date)}</strong> ({months(result.custom.months)}), about{' '}
                {money(result.custom.total_interest, c)} interest.
                {result.interest_saved !== null && result.months_saved !== null && result.months_saved !== 0 && (
                  <span className="block">
                    {result.interest_saved >= 0
                      ? `That saves about ${money(result.interest_saved, c)} in interest and finishes ${months(result.months_saved)} sooner than the monthly payment.`
                      : `That costs about ${money(-result.interest_saved, c)} more in interest and finishes ${months(-result.months_saved)} later than the monthly payment.`}
                  </span>
                )}
                {result.minimum?.never_pays_off && <span className="block">The monthly payment alone would never pay it off.</span>}
                {result.minimum?.over_max && (
                  <span className="block">The monthly payment alone would take more than {PAYOFF_MAX_YEARS} years.</span>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </li>
  );
}
