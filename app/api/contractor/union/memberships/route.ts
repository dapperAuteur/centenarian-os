// app/api/contractor/union/memberships/route.ts
// GET: list user's union memberships
// POST: create a new membership

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
    .from('union_memberships')
    .select('*')
    .eq('user_id', user.id)
    .order('union_name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memberships: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    union_name, local_number, member_id, status, join_date, expiration_date,
    dues_amount, dues_frequency, next_dues_date, auto_pay,
    initiation_fee, initiation_paid, notes,
  } = body;

  if (!union_name?.trim() || !local_number?.trim()) {
    return NextResponse.json({ error: 'union_name and local_number required' }, { status: 400 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('union_memberships')
    .insert({
      user_id: user.id,
      union_name: union_name.trim(),
      local_number: local_number.trim(),
      member_id: member_id?.trim() || null,
      status: status || 'active',
      join_date: join_date || null,
      expiration_date: expiration_date || null,
      dues_amount: dues_amount != null ? parseFloat(dues_amount) : null,
      dues_frequency: dues_frequency || 'quarterly',
      next_dues_date: next_dues_date || null,
      auto_pay: auto_pay ?? false,
      initiation_fee: initiation_fee != null ? parseFloat(initiation_fee) : null,
      initiation_paid: initiation_paid ?? false,
      notes: notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Membership for this union/local already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ membership: data }, { status: 201 });
}
