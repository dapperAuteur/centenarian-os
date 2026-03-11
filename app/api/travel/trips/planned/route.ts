import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/travel/trips/planned?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns planned/in_progress trips that overlap the given date range.
 * A trip overlaps if: trip.date <= to AND (trip.end_date ?? trip.date) >= from
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const from = params.get('from');
  const to = params.get('to');

  let query = supabase
    .from('trips')
    .select('id, mode, date, end_date, origin, destination, purpose, cost, notes, trip_status, packing_notes, is_round_trip, vehicles(id, nickname, type)')
    .eq('user_id', user.id)
    .in('trip_status', ['planned', 'in_progress'])
    .order('date', { ascending: true });

  if (from) query = query.or(`end_date.gte.${from},and(end_date.is.null,date.gte.${from})`);
  if (to) query = query.lte('date', to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ trips: data || [] });
}
