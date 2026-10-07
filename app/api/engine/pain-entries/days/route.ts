// app/api/engine/pain-entries/days/route.ts
// GET: the daily pain summary for the history chart: each day's daily_logs.pain_intensity
//      (the highest entry that day), oldest first, at most 400 days. ?from=&to=YYYY-MM-DD.
//      Works the same before and after migration 222.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listDayPoints } from '@/lib/pain/server';
import { errorResponse, readFilters } from '@/lib/pain/request';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { from, to } = readFilters(request.nextUrl.searchParams);
    const days = await listDayPoints(supabase, user.id, { from, to });
    return NextResponse.json({ days });
  } catch (err) {
    return errorResponse(err);
  }
}
