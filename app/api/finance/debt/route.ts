// app/api/finance/debt/route.ts
// GET ?today=YYYY-MM-DD: the debts overview (plans/61 section 2).
//
// -> 200 {
//      today, statementsReady,
//      debts: [{ id, name, type, institution, lastFour, balance, creditLimit, apr, aprSource,
//                aprs, minimumPayment, minimumEstimated, dueDay, latestStatement, promos,
//                interestYtd, nextDue }],
//      totals: { balance, minimums, interestYtd },
//      dueSoon: [{ key, accountId, accountName, dueDate, daysUntil, minimum, statementBalance }],
//      interest: { year, total, accounts, byMonth },
//      reminders: { setting, ready }     // ready = migration 211 applied
//    }
// Every active credit_card and loan account. Rules: lib/finance/debt/overview.ts.

import { NextRequest, NextResponse } from 'next/server';
import { buildOverview, loadDebtData, requestToday } from '@/lib/finance/debt/server';
import { loadReminderSetting } from '@/lib/finance/debt/bill-tasks';
import { currentUserId, errorResponse, getServiceDb, unauthorized } from '@/lib/finance/debt/route-helpers';

export async function GET(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    const db = getServiceDb();
    const today = requestToday(request.nextUrl.searchParams.get('today'));
    const [data, reminders] = await Promise.all([loadDebtData(db, userId), loadReminderSetting(db, userId)]);
    // dueItems is the planner sync's input; the page doesn't need it.
    return NextResponse.json({ ...buildOverview(data, today), dueItems: undefined, reminders });
  } catch (err) {
    return errorResponse(err, 'api/finance/debt');
  }
}
