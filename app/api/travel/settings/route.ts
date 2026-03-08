import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('travel_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({ settings: data ?? null });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { commute_distance_miles, commute_duration_min, default_vehicle_id } = body;

  const { data, error } = await supabase
    .from('travel_settings')
    .upsert(
      {
        user_id: user.id,
        commute_distance_miles,
        commute_duration_min,
        default_vehicle_id: default_vehicle_id || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const allowed = ['commute_distance_miles', 'commute_duration_min', 'default_vehicle_id', 'home_address', 'home_lat', 'home_lng', 'distance_unit'];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  // Upsert — create if not exists
  const { data: existing } = await supabase
    .from('travel_settings')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  let data;
  let error;

  if (existing) {
    ({ data, error } = await supabase
      .from('travel_settings')
      .update(updates)
      .eq('user_id', user.id)
      .select()
      .single());
  } else {
    ({ data, error } = await supabase
      .from('travel_settings')
      .insert({ user_id: user.id, ...updates })
      .select()
      .single());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
