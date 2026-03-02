// app/api/travel/fuel/[id]/duplicate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: original, error: fetchErr } = await db
    .from('fuel_logs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: newLog, error: insertErr } = await db
    .from('fuel_logs')
    .insert({
      user_id: user.id,
      vehicle_id: original.vehicle_id,
      date: new Date().toISOString().split('T')[0],
      odometer_miles: null,
      miles_since_last_fill: original.miles_since_last_fill,
      miles_this_month: null,
      mpg_display: original.mpg_display,
      gallons: original.gallons,
      total_cost: original.total_cost,
      cost_per_gallon: original.cost_per_gallon,
      fuel_grade: original.fuel_grade,
      station: original.station,
      source: 'manual',
      notes: original.notes,
    })
    .select('id')
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ id: newLog.id });
}
