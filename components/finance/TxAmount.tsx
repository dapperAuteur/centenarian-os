// components/finance/TxAmount.tsx
// A transaction's signed amount. Rows in the home currency look as before ("-$12.50"). Rows in
// another currency show the amount in their own currency and, under it, the home-currency amount
// totals use ("≈ $20.00"), or "no rate yet" when it isn't converted (it is then left out of totals).

import { formatMoney } from '@/lib/finance/fx/math';
import { rowCurrency } from '@/lib/finance/fx/totals';
import type { FxAmountRow } from '@/lib/finance/fx/totals';

interface TxAmountProps {
  tx: FxAmountRow & { type: 'expense' | 'income' };
  homeCurrency: string;
  className?: string;
}

export default function TxAmount({ tx, homeCurrency, className = '' }: TxAmountProps) {
  const currency = rowCurrency(tx, homeCurrency);
  const sign = tx.type === 'income' ? '+' : '-';
  const color = tx.type === 'income' ? 'text-green-600' : 'text-red-600';
  const amount = Math.abs(Number(tx.amount));

  if (currency === homeCurrency) {
    return <span className={`${color} ${className}`}>{sign}{formatMoney(amount, currency)}</span>;
  }

  const home = tx.amount_home === null || tx.amount_home === undefined ? null : Number(tx.amount_home);
  return (
    <span className={`inline-flex flex-col items-end leading-tight ${className}`}>
      <span className={color}>
        {sign}{formatMoney(amount, currency)} <span className="text-xs font-normal text-gray-500">{currency}</span>
      </span>
      <span className="text-xs font-normal text-gray-600">
        {home !== null ? `≈ ${formatMoney(home, homeCurrency)}` : 'no rate yet'}
      </span>
    </span>
  );
}
