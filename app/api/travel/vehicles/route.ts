import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach latest odometer reading from fuel_logs for each vehicle
  const vehicleIds = (data || []).map((v) => v.id);
  const latestOdo: Record<string, number> = {};
  if (vehicleIds.length > 0) {
    const { data: odoRows } = await supabase
      .from('fuel_logs')
      .select('vehicle_id, odometer_miles, date')
      .in('vehicle_id', vehicleIds)
      .eq('user_id', user.id)
      .not('odometer_miles', 'is', null)
      .order('date', { ascending: false });
    for (const row of odoRows ?? []) {
      if (row.vehicle_id && !(row.vehicle_id in latestOdo)) {
        latestOdo[row.vehicle_id] = row.odometer_miles;
      }
    }
  }

  const vehicles = (data || []).map((v) => ({
    ...v,
    latest_odometer: latestOdo[v.id] ?? null,
  }));

  return NextResponse.json({ vehicles });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { type, nickname, make, model, year, color } = body;

  if (!type || !nickname) {
    return NextResponse.json({ error: 'type and nickname are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('vehicles')
    .insert({ user_id: user.id, type, nickname, make, model, year, color })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vehicle: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('vehicles')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vehicle: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase
    .from('vehicles')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
