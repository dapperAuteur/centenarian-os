// app/api/travel/routes/[id]/route.ts
// GET: single route with all legs
// PATCH: update route metadata
// DELETE: delete route + all child trips

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { deleteLinkedTransaction } from '@/lib/finance/linked-transaction';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: route } = await db
    .from('trip_routes')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!route) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: legs } = await db
    .from('trips')
    .select('*, vehicles(id, nickname, type)')
    .eq('route_id', id)
    .order('leg_order', { ascending: true });

  return NextResponse.json({ route, legs: legs ?? [] });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: existing } = await db
    .from('trip_routes')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const allowed = ['name', 'date', 'notes', 'is_round_trip'];
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k)),
  );

  // If date changes, propagate to all legs
  if (updates.date) {
    await db
      .from('trips')
      .update({ date: updates.date })
      .eq('route_id', id);
  }

  const { data, error } = await db
    .from('trip_routes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ route: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: existing } = await db
    .from('trip_routes')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Get all legs with linked transactions
  const { data: legs } = await db
    .from('trips')
    .select('id, transaction_id')
    .eq('route_id', id);

  // Delete linked transactions
  const txIds = (legs ?? [])
    .map((l) => l.transaction_id)
    .filter(Boolean) as string[];

  for (const txId of txIds) {
    try {
      await deleteLinkedTransaction(db, txId);
    } catch { /* non-fatal */ }
  }

  // Delete all legs
  await db.from('trips').delete().eq('route_id', id);

  // Delete the route
  const { error } = await db.from('trip_routes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted_trips: (legs ?? []).length, deleted_transactions: txIds.length });
}
