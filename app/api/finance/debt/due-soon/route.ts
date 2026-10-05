// app/api/finance/debt/due-soon/route.ts
// GET ?today=YYYY-MM-DD: unpaid card/loan payments due today or in the next 3 days, for the
// in-app "Due soon" banner on the finance dashboard and the debt page. Works without migration 211.
//
// -> 200 { today, items: [{ key, accountId, accountName, dueDate, daysUntil, minimum,
//                           statementBalance }] }   (soonest first)
// Rules: lib/finance/debt/due.ts dueSoon().

import { NextRequest, NextResponse } from 'next/server';
import { buildOverview, loadDebtData, requestToday } from '@/lib/finance/debt/server';
import { currentUserId, errorResponse, getServiceDb, unauthorized } from '@/lib/finance/debt/route-helpers';

export async function GET(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    const today = requestToday(request.nextUrl.searchParams.get('today'));
    const data = await loadDebtData(getServiceDb(), userId);
    return NextResponse.json({ today, items: buildOverview(data, today).dueSoon });
  } catch (err) {
    return errorResponse(err, 'api/finance/debt/due-soon');
  }
}
