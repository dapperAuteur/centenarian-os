// app/api/travel/maintenance/[id]/duplicate/route.ts

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
    .from('vehicle_maintenance')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: newRecord, error: insertErr } = await db
    .from('vehicle_maintenance')
    .insert({
      user_id: user.id,
      vehicle_id: original.vehicle_id,
      service_type: original.service_type,
      date: new Date().toISOString().split('T')[0],
      odometer_at_service: null,
      cost: original.cost,
      vendor: original.vendor,
      notes: original.notes,
      next_service_miles: original.next_service_miles,
      next_service_date: null,
    })
    .select('id')
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ id: newRecord.id });
}
