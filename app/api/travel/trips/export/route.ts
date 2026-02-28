// app/api/travel/trips/export/route.ts
// GET: export trips as CSV

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildCsvResponse } from '@/lib/csv/helpers';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const from = params.get('from');
  const to = params.get('to');
  const mode = params.get('mode');
  const tripCategory = params.get('trip_category');

  let query = supabase
    .from('trips')
    .select('*, vehicles(nickname)')
    .order('date', { ascending: true });

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  if (mode) query = query.eq('mode', mode);
  if (tripCategory) query = query.eq('trip_category', tripCategory);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []).map((r) => {
    const v = r.vehicles as { nickname: string } | null;
    return [
      r.date || '',
      r.mode || '',
      r.origin || '',
      r.destination || '',
      String(r.distance_miles ?? ''),
      String(r.duration_min ?? ''),
      r.purpose || '',
      String(r.cost ?? ''),
      r.trip_category || '',
      r.tax_category || '',
      String(r.is_round_trip ?? false),
      String(r.co2_kg ?? ''),
      v?.nickname || '',
      r.notes || '',
    ];
  });

  return buildCsvResponse(
    ['Date', 'Mode', 'Origin', 'Destination', 'Distance Miles', 'Duration Min', 'Purpose', 'Cost', 'Trip Category', 'Tax Category', 'Round Trip', 'CO2 kg', 'Vehicle', 'Notes'],
    rows,
    'centenarianos-trips-export.csv',
  );
}
