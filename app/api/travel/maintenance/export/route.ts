// app/api/travel/maintenance/export/route.ts
// GET: export vehicle maintenance records as CSV

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildCsvResponse } from '@/lib/csv/helpers';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const vehicleId = params.get('vehicle_id');

  let query = supabase
    .from('vehicle_maintenance')
    .select('*, vehicles(nickname)')
    .order('date', { ascending: true });

  if (vehicleId) query = query.eq('vehicle_id', vehicleId);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []).map((r) => {
    const v = r.vehicles as { nickname: string } | null;
    return [
      r.date || '',
      v?.nickname || '',
      r.service_type || '',
      String(r.odometer_at_service ?? ''),
      String(r.cost ?? ''),
      r.vendor || '',
      r.next_service_date || '',
      String(r.next_service_miles ?? ''),
      r.notes || '',
    ];
  });

  return buildCsvResponse(
    ['Date', 'Vehicle', 'Service Type', 'Odometer', 'Cost', 'Vendor', 'Next Service Date', 'Next Service Miles', 'Notes'],
    rows,
    'centenarianos-maintenance-export.csv',
  );
}
