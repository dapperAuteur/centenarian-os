// app/api/finance/retirement/route.ts
// GET ?today=YYYY-MM-DD&window=3|6|12 (default 12): the Retirement page's data. Investment accounts
// with their latest balance (and the home-currency value), contributions and employer match per
// year, the planner settings (with defaults filled in and listed), average monthly spending over
// the window, permanent-policy cash value, and the projection (lib/finance/retirement/logic.ts).
// Before migration 215: { ready: false, ... }.

import { NextRequest, NextResponse } from 'next/server';
import { loadRetirementOverview } from '@/lib/finance/retirement/server';
import { errorResponse, resolveToday, sessionUser, unauthorized } from '@/lib/finance/retirement/request';

export async function GET(request: NextRequest) {
  const { db, userId } = await sessionUser();
  if (!userId) return unauthorized();
  const params = request.nextUrl.searchParams;
  const w = Number(params.get('window'));
  const window = w === 3 || w === 6 ? w : 12;
  try {
    return NextResponse.json(await loadRetirementOverview(db, userId, resolveToday(params.get('today')), window));
  } catch (err) {
    return errorResponse(err, 'api/finance/retirement');
  }
}
