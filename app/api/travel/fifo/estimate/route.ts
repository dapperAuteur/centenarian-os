import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { estimateFifoCost } from '@/lib/travel/fifo';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { vehicle_id, distance_miles, is_round_trip, trip_date } = await request.json();

  if (!vehicle_id || !distance_miles || !trip_date) {
    return NextResponse.json({ error: 'vehicle_id, distance_miles, and trip_date are required' }, { status: 400 });
  }

  // Check FIFO is enabled
  const { data: settings } = await supabase
    .from('travel_settings')
    .select('fifo_enabled_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!settings?.fifo_enabled_at) {
    return NextResponse.json({ estimate: null });
  }

  // Check vehicle is owned
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('ownership_type')
    .eq('id', vehicle_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!vehicle || vehicle.ownership_type !== 'owned') {
    return NextResponse.json({ estimate: null });
  }

  const effectiveDist = is_round_trip ? distance_miles * 2 : distance_miles;
  const result = await estimateFifoCost(supabase, user.id, vehicle_id, effectiveDist, trip_date);

  return NextResponse.json({ estimate: result });
}
