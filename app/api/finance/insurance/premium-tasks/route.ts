// app/api/finance/insurance/premium-tasks/route.ts
// POST ?today=YYYY-MM-DD: for each active policy with "Add premium due dates to the planner" on,
// make sure its next premium due date is a task under Inbox > Inbox > Bills, and mark it done once
// a matching payment covers it. The Insurance page calls this when it opens. Idempotent.
//
// -> 200 { ready: true, created, completed, errors }
// -> 503 until migration 215 is applied.
// Rules: lib/finance/insurance/server.ts (syncPremiumTasks).

import { NextRequest, NextResponse } from 'next/server';
import { syncPremiumTasks } from '@/lib/finance/insurance/server';
import { RETIREMENT_NOT_READY } from '@/lib/finance/retirement/server';
import { getServiceDb } from '@/lib/finance/debt/route-helpers';
import { errorResponse, resolveToday, sessionUser, unauthorized } from '@/lib/finance/retirement/request';

export async function POST(request: NextRequest) {
  const { userId } = await sessionUser();
  if (!userId) return unauthorized();
  try {
    const result = await syncPremiumTasks(getServiceDb(), userId, resolveToday(request.nextUrl.searchParams.get('today')));
    if (!result.ready) return NextResponse.json(RETIREMENT_NOT_READY, { status: 503 });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, 'api/finance/insurance/premium-tasks');
  }
}
