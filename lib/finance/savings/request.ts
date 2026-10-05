// lib/finance/savings/request.ts
// Shared bits of the savings routes: the date "today" means, and turning a
// SavingsRuleError into a response.
//
// "Today" is the person's local date when the page sends it (?today= or
// body.today, 'YYYY-MM-DD'); otherwise the server's local date. It only sets
// the date stamped on allocations and the month math, so a wrong value can't
// reach another user's data.

import { NextResponse } from 'next/server';
import { todayLocal } from '@/lib/dates/local';
import { isDateString, SavingsRuleError } from './logic';

export function resolveToday(value: unknown): string {
  return isDateString(value) ? value : todayLocal();
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof SavingsRuleError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  throw err;
}
