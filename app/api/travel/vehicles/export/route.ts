// app/api/travel/vehicles/export/route.ts
// GET: export vehicles as CSV

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildCsvResponse } from '@/lib/csv/helpers';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const includeRetired = params.get('include_retired');

  let query = supabase
    .from('vehicles')
    .select('*')
    .order('nickname', { ascending: true });

  if (includeRetired !== 'true') query = query.eq('active', true);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []).map((r) => [
    r.type || '',
    r.nickname || '',
    r.make || '',
    r.model || '',
    String(r.year ?? ''),
    r.color || '',
    r.ownership_type || '',
    r.trip_mode || '',
    String(r.active ?? false),
  ]);

  return buildCsvResponse(
    ['Type', 'Nickname', 'Make', 'Model', 'Year', 'Color', 'Ownership Type', 'Trip Mode', 'Active'],
    rows,
    'centenarianos-vehicles-export.csv',
  );
}
