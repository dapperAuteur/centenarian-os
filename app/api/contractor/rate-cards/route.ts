// app/api/contractor/rate-cards/route.ts
// GET: list rate cards sorted by use_count desc
// POST: create a new rate card

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data, error } = await db
    .from('contractor_rate_cards')
    .select('*')
    .eq('user_id', user.id)
    .order('use_count', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rate_cards: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    name, union_local, department, rate_type,
    st_rate, ot_rate, dt_rate,
    benefits, travel_benefits, notes,
  } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('contractor_rate_cards')
    .insert({
      user_id: user.id,
      name: name.trim(),
      union_local: union_local ?? null,
      department: department ?? null,
      rate_type: rate_type ?? 'hourly',
      st_rate: st_rate ?? null,
      ot_rate: ot_rate ?? null,
      dt_rate: dt_rate ?? null,
      benefits: benefits ?? [],
      travel_benefits: travel_benefits ?? {},
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
