// app/api/travel/trips/export/route.ts
// GET: export trips as CSV with all available fields

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildCsvResponse } from '@/lib/csv/helpers';

const SORTABLE_COLUMNS = new Set([
  'date', 'end_date', 'mode', 'origin', 'destination', 'distance_miles',
  'duration_min', 'purpose', 'cost', 'trip_category', 'tax_category',
  'co2_kg', 'trip_status', 'carrier_name', 'accommodation_name',
  'calories_burned', 'budget_amount', 'created_at',
]);

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const from = params.get('from');
  const to = params.get('to');
  const mode = params.get('mode');
  const tripCategory = params.get('trip_category');
  const taxCategory = params.get('tax_category');
  const tripStatus = params.get('trip_status');
  const search = params.get('search');
  const sortCol = params.get('sort') || 'date';
  const sortDir = params.get('sort_dir') || 'asc';

  const orderCol = SORTABLE_COLUMNS.has(sortCol) ? sortCol : 'date';

  let query = supabase
    .from('trips')
    .select('*, vehicles(nickname)')
    .order(orderCol, { ascending: sortDir === 'asc' });

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  if (mode) query = query.eq('mode', mode);
  if (tripCategory) query = query.eq('trip_category', tripCategory);
  if (taxCategory) query = query.eq('tax_category', taxCategory);
  if (tripStatus) query = query.eq('trip_status', tripStatus);
  if (search) query = query.or(`origin.ilike.%${search}%,destination.ilike.%${search}%,carrier_name.ilike.%${search}%,accommodation_name.ilike.%${search}%`);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const headers = [
    'Date', 'End Date', 'Mode', 'Origin', 'Destination',
    'Distance Miles', 'Duration Min', 'Purpose', 'Cost', 'Budget',
    'Trip Category', 'Tax Category', 'Trip Status', 'Round Trip',
    'CO2 kg', 'Calories', 'Vehicle',
    'Departed At', 'Arrived At',
    'Confirmation #', 'Booking Reference', 'Carrier', 'Seat', 'Terminal', 'Gate', 'Booking URL',
    'Accommodation', 'Accommodation Address', 'Room Type', 'Check-in', 'Check-out',
    'Pickup Address', 'Pickup Time', 'Return Address', 'Return Time',
    'Loyalty Program', 'Loyalty Number',
    'Notes',
  ];

  const rows = (data || []).map((r) => {
    const v = r.vehicles as { nickname: string } | null;
    return [
      r.date || '',
      r.end_date || '',
      r.mode || '',
      r.origin || '',
      r.destination || '',
      String(r.distance_miles ?? ''),
      String(r.duration_min ?? ''),
      r.purpose || '',
      String(r.cost ?? ''),
      String(r.budget_amount ?? ''),
      r.trip_category || '',
      r.tax_category || '',
      r.trip_status || '',
      String(r.is_round_trip ?? false),
      String(r.co2_kg ?? ''),
      String(r.calories_burned ?? ''),
      v?.nickname || '',
      r.departed_at || '',
      r.arrived_at || '',
      r.confirmation_number || '',
      r.booking_reference || '',
      r.carrier_name || '',
      r.seat_assignment || '',
      r.terminal || '',
      r.gate || '',
      r.booking_url || '',
      r.accommodation_name || '',
      r.accommodation_address || '',
      r.room_type || '',
      r.check_in_date || '',
      r.check_out_date || '',
      r.pickup_address || '',
      r.pickup_time || '',
      r.return_address || '',
      r.return_time || '',
      r.loyalty_program || '',
      r.loyalty_number || '',
      r.notes || '',
    ];
  });

  return buildCsvResponse(headers, rows, 'centenarianos-trips-export.csv');
}
