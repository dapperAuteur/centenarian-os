// app/api/finance/debt/interest/route.ts
// GET ?year=YYYY (default: this year): interest paid on cards and loans, per account and month.
//
// -> 200 { year, total, statementsReady,
//          accounts: [{ accountId, name, type, total, months: [{ month, amount, source }] }],
//          byMonth: [{ month, amount }] (Jan..Dec) }
// source: 'statement' (exact, account_statements.interest_charged), 'transactions'
// (source='interest' rows), or 'mixed'. Rules: lib/finance/debt/interest.ts.
// -> 400 when year isn't a 4-digit year between 2000 and 2100.

import { NextRequest, NextResponse } from 'next/server';
import { interestPaidFor, loadDebtData, serverToday } from '@/lib/finance/debt/server';
import { currentUserId, errorResponse, getServiceDb, unauthorized } from '@/lib/finance/debt/route-helpers';

export async function GET(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const raw = request.nextUrl.searchParams.get('year');
  const year = raw ? Number(raw) : Number(serverToday().slice(0, 4));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'year must be a year like 2026.' }, { status: 400 });
  }

  try {
    const data = await loadDebtData(getServiceDb(), userId);
    const report = interestPaidFor(data, year);
    const names = new Map(data.accounts.map((a) => [a.id, a]));
    return NextResponse.json({
      year: report.year,
      total: report.total,
      statementsReady: data.statementsReady,
      accounts: report.accounts.map((a) => ({
        ...a,
        name: names.get(a.accountId)?.name ?? 'Account',
        type: names.get(a.accountId)?.account_type ?? null,
      })),
      byMonth: report.byMonth,
    });
  } catch (err) {
    return errorResponse(err, 'api/finance/debt/interest');
  }
}
