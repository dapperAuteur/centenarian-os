// app/api/travel/fuel/export/route.ts
// GET: export fuel logs as CSV

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
  const vehicleId = params.get('vehicle_id');

  let query = supabase
    .from('fuel_logs')
    .select('*, vehicles(nickname)')
    .order('date', { ascending: true });

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  if (vehicleId) query = query.eq('vehicle_id', vehicleId);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []).map((r) => {
    const v = r.vehicles as { nickname: string } | null;
    return [
      r.date || '',
      v?.nickname || '',
      String(r.odometer_miles ?? ''),
      String(r.gallons ?? ''),
      String(r.total_cost ?? ''),
      String(r.cost_per_gallon ?? ''),
      r.fuel_grade || '',
      r.station || '',
      String(r.mpg_calculated ?? ''),
      r.notes || '',
    ];
  });

  return buildCsvResponse(
    ['Date', 'Vehicle', 'Odometer Miles', 'Gallons', 'Total Cost', 'Cost Per Gallon', 'Fuel Grade', 'Station', 'MPG', 'Notes'],
    rows,
    'centenarianos-fuel-export.csv',
  );
}
