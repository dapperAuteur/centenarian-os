// app/api/finance/debt/due-tasks/route.ts
// POST ?today=YYYY-MM-DD: bring the signed-in user's card/loan due-date planner tasks up to date
// (Inbox > Inbox > Bills). The debt page calls this when it opens; the daily cron
// (/api/cron/bill-due-tasks) does the same for everyone. Never sends email.
//
// -> 200 { ready: true, created, updated, completed, archived, errors, emailed: 0 }
// -> 503 { error, code: 'migration_required' } until migration 211 is applied.
// Rules: lib/finance/debt/bill-tasks.ts and due.ts.

import { NextRequest, NextResponse } from 'next/server';
import { syncBillDueTasks } from '@/lib/finance/debt/bill-tasks';
import { DEBT_NOT_READY, requestToday } from '@/lib/finance/debt/server';
import { currentUserId, errorResponse, getServiceDb, unauthorized } from '@/lib/finance/debt/route-helpers';

export async function POST(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    const today = requestToday(request.nextUrl.searchParams.get('today'));
    const result = await syncBillDueTasks(getServiceDb(), userId, today);
    if (!result.ready) return NextResponse.json(DEBT_NOT_READY, { status: 503 });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, 'api/finance/debt/due-tasks');
  }
}
