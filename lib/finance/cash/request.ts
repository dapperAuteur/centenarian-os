// lib/finance/cash/request.ts
// Shared bits of the cash routes (app/api/finance/cash/*): the date "today"
// means, the FX fields an adjustment gets on a foreign-currency account, and
// turning a CashRuleError into a response.
//
// "Today" is the person's local date when the page sends it (?today= or
// body.today, 'YYYY-MM-DD'); otherwise the server's local date.

import { NextResponse } from 'next/server';
import { todayLocal } from '@/lib/dates/local';
import { isDateString } from '@/lib/finance/savings/logic';
import { fxFieldsFor, loadHomeCurrency } from '@/lib/finance/fx/server';
import { getServiceDb } from '@/lib/finance/transfers/server';
import { CashRuleError } from './logic';
import type { FxFieldsFor } from './server';

export function resolveToday(value: unknown): string {
  return isDateString(value) ? value : todayLocal();
}

/** currency / fx_rate / amount_home for an amount on `date`, the same as a hand-entered transaction. */
export function fxForUser(userId: string): FxFieldsFor {
  return async (currency, amount, date) => {
    const db = getServiceDb();
    const home = await loadHomeCurrency(db, userId);
    if (currency === home) return {};
    const { fields } = await fxFieldsFor(db, userId, currency, home, amount, date);
    return { ...fields };
  };
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof CashRuleError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  throw err;
}
