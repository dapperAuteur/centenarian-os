'use client';

// components/finance/debt/PayoffCalculator.tsx
// One debt at a time: "pay $X a month" -> payoff date and interest, or "pay off by a date" ->
// the monthly payment. Balance and APR start from the account and can be changed to try things.
// Math: lib/finance/debt/amortize.ts. Estimates only.

import { useId, useMemo, useState } from 'react';
import { earlyPaymentSavings, paymentByDate, payoffSchedule } from '@/lib/finance/debt/amortize';
import { money, shortDate } from '@/lib/finance/debt/due';
import { addMonthsToDate } from '@/lib/finance/debt/dates';
import type { DebtRow } from './types';

type Mode = 'payment' | 'date';

export default function PayoffCalculator({ debts, today }: { debts: DebtRow[]; today: string }) {
  const [debtId, setDebtId] = useState(debts[0]?.id ?? '');
  const debt = debts.find((d) => d.id === debtId) ?? debts[0];
  if (!debt) return null;
  // Keyed by debt so the inputs start over from the chosen account's numbers.
  return <Calculator key={debt.id} debt={debt} debts={debts} onPick={setDebtId} today={today} />;
}

function Calculator({ debt, debts, onPick, today }: { debt: DebtRow; debts: DebtRow[]; onPick: (id: string) => void; today: string }) {
  const id = useId();
  const [balance, setBalance] = useState(String(Math.max(0, debt.balance)));
  const [apr, setApr] = useState(debt.apr !== null ? String(debt.apr) : '');
  const [mode, setMode] = useState<Mode>('payment');
  const [payment, setPayment] = useState(String(Math.max(debt.minimumPayment, 0)));
  const [byDate, setByDate] = useState(addMonthsToDate(today, 12));

  const b = Number(balance);
  const a = Number(apr) || 0;
  const p = Number(payment);
  const validBalance = Number.isFinite(b) && b > 0;

  const byPayment = useMemo(
    () => (mode === 'payment' && validBalance && p > 0 ? payoffSchedule(b, a, p, today) : null),
    [mode, validBalance, b, a, p, today],
  );
  const byDateResult = useMemo(
    () => (mode === 'date' && validBalance && byDate > today ? paymentByDate(b, a, today, byDate) : null),
    [mode, validBalance, b, a, byDate, today],
  );

  const early = validBalance ? earlyPaymentSavings(Math.min(b, 500), a, 10) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={`${id}-debt`} className="block text-sm font-medium text-gray-700">Debt</label>
          <select
            id={`${id}-debt`}
            value={debt.id}
            onChange={(e) => onPick(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-lg border border-gray-300 px-3 text-sm"
          >
            {debts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-balance`} className="block text-sm font-medium text-gray-700">Balance ($)</label>
          <input
            id={`${id}-balance`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-lg border border-gray-300 px-3 text-sm"
          />
        </div>
        <div>
          <label htmlFor={`${id}-apr`} className="block text-sm font-medium text-gray-700">APR (%)</label>
          <input
            id={`${id}-apr`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={apr}
            onChange={(e) => setApr(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-lg border border-gray-300 px-3 text-sm"
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-gray-700">Work out</legend>
        <div className="mt-1 flex flex-col sm:flex-row gap-2">
          {(
            [
              ['payment', 'When it is paid off, paying a set amount'],
              ['date', 'The payment to be done by a date'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="min-h-11 flex items-center gap-2 px-3 rounded-lg border border-gray-200 text-sm cursor-pointer">
              <input type="radio" name={`${id}-mode`} value={value} checked={mode === value} onChange={() => setMode(value)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {mode === 'payment' ? (
        <div className="max-w-xs">
          <label htmlFor={`${id}-payment`} className="block text-sm font-medium text-gray-700">Pay each month ($)</label>
          <input
            id={`${id}-payment`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-lg border border-gray-300 px-3 text-sm"
          />
        </div>
      ) : (
        <div className="max-w-xs">
          <label htmlFor={`${id}-date`} className="block text-sm font-medium text-gray-700">Paid off by</label>
          <input
            id={`${id}-date`}
            type="date"
            min={today}
            value={byDate}
            onChange={(e) => setByDate(e.target.value)}
            className="mt-1 w-full min-h-11 rounded-lg border border-gray-300 px-3 text-sm"
          />
        </div>
      )}

      <div role="status" className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-800">
        {!validBalance ? (
          'Enter a balance above $0.'
        ) : mode === 'payment' ? (
          !byPayment ? (
            'Enter a monthly payment.'
          ) : byPayment.neverPaysOff ? (
            <span className="text-amber-800">
              {money(p)} a month doesn&apos;t cover the interest ({money(Math.round(b * (a / 1200) * 100) / 100)} the first month), so
              the balance never goes down. Pay more than that.
            </span>
          ) : (
            <>
              Paid off <strong>{shortDate(byPayment.payoffDate!, today)}</strong> after {byPayment.months}{' '}
              {byPayment.months === 1 ? 'payment' : 'payments'}. Total interest about <strong>{money(byPayment.totalInterest)}</strong>;
              total paid {money(byPayment.totalPaid)}.
            </>
          )
        ) : !byDateResult ? (
          'Pick a date after today.'
        ) : byDateResult.payInFull ? (
          <>That is less than a month away: pay the full {money(b)} now.</>
        ) : (
          <>
            Pay about <strong>{money(byDateResult.payment)}</strong> a month for {byDateResult.months} months. Total interest about{' '}
            <strong>{money(byDateResult.totalInterest)}</strong>.
          </>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Estimates: interest is figured as balance × APR ÷ 12 each month, with no new purchases or fees. Your lender&apos;s figures
        will differ a little.
        {early > 0 && <> Paying {money(Math.min(b, 500))} ten days earlier in the cycle saves about {money(early)} (amount × APR ÷ 365 × days early).</>}
      </p>
    </div>
  );
}
