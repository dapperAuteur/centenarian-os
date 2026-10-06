// lib/finance/fx/exchange.ts
// "Exchange money": the rows a currency exchange writes. Pure; the route
// (app/api/finance/fx/exchange/route.ts) validates accounts, finds rates and inserts.
//
// An exchange is a transfer between two of the user's accounts in different currencies:
//   - an expense on the source account of `sent` (its currency),
//   - an income on the destination account of `received` (its currency),
//   both with source = 'transfer', one transfer_group_id and transfer_kind = 'transfer', so they
//   never count as spending or income;
//   - the fee, if any, as a separate ordinary expense on the source account (it is real spending).
// The rate actually got (received / sent) is saved as the user's manual rate for that day, so
// later spending from the foreign cash is valued at what the cash really cost.
//
// Home amounts: each row carries amount_home and fx_rate when its currency isn't the home one.
// Both sides of the pair get the SAME home amount (the value moved), taken from the side that is
// already in the home currency when there is one, else from `sourceToHome` (rate of the source
// currency to home on that date).

import { exchangeMath, roundCents } from './math.ts';
import type { ExchangeInput, ExchangeMath } from './math.ts';

export interface ExchangeAccount {
  id: string;
  name: string;
  currency: string;
}

export interface ExchangeRowDraft {
  account_id: string;
  type: 'expense' | 'income';
  amount: number;
  description: string;
  /** null when the row is in the home currency. */
  currency: string | null;
  fx_rate: number | null;
  amount_home: number | null;
  /** true for the two transfer rows, false for the fee. */
  is_transfer_side: boolean;
}

export interface ExchangePlan {
  math: ExchangeMath;
  rows: ExchangeRowDraft[];
  /** The manual rate to save: 1 base = rate quote on the exchange date. */
  manualRate: { base: string; quote: string; rate: number };
}

export function planExchange(input: ExchangeInput & {
  from: ExchangeAccount;
  to: ExchangeAccount;
  home: string;
  /** 1 source currency in home currency on the date; needed only when neither side is home. */
  sourceToHome?: number | null;
  description?: string | null;
}): ExchangePlan {
  const { from, to, home } = input;
  if (from.id === to.id) throw new Error('Pick two different accounts.');
  if (from.currency === to.currency) {
    throw new Error(`Both accounts are in ${from.currency}. Use Transfer for money between accounts in the same currency.`);
  }
  const math = exchangeMath(input);

  // The value moved, in the home currency.
  let movedHome: number | null;
  if (from.currency === home) movedHome = math.sent;
  else if (to.currency === home) movedHome = math.received;
  else if (input.sourceToHome && input.sourceToHome > 0) movedHome = roundCents(math.sent * input.sourceToHome);
  else movedHome = null;

  const side = (account: ExchangeAccount, amount: number) => {
    if (account.currency === home) return { currency: null, fx_rate: null, amount_home: null };
    return {
      currency: account.currency,
      fx_rate: movedHome === null ? null : movedHome / amount,
      amount_home: movedHome,
    };
  };

  const label = input.description?.trim() || `Exchange: ${from.currency} ${math.sent} → ${to.currency} ${math.received}`;
  const rows: ExchangeRowDraft[] = [
    { account_id: from.id, type: 'expense', amount: math.sent, description: label, ...side(from, math.sent), is_transfer_side: true },
    { account_id: to.id, type: 'income', amount: math.received, description: label, ...side(to, math.received), is_transfer_side: true },
  ];

  if (math.fee > 0) {
    const sourceRate = from.currency === home ? null : movedHome === null ? null : movedHome / math.sent;
    rows.push({
      account_id: from.id,
      type: 'expense',
      amount: math.fee,
      description: `Exchange fee (${from.currency} → ${to.currency})`,
      currency: from.currency === home ? null : from.currency,
      fx_rate: sourceRate,
      amount_home: sourceRate === null ? null : roundCents(math.fee * sourceRate),
      is_transfer_side: false,
    });
  }

  return { math, rows, manualRate: { base: from.currency, quote: to.currency, rate: math.rate } };
}
