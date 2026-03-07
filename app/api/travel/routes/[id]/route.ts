// app/api/travel/routes/[id]/route.ts
// GET: single route with all legs
// PATCH: update route metadata
// DELETE: delete route + all child trips

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { deleteLinkedTransaction, createLinkedTransaction } from '@/lib/finance/linked-transaction';
import { CO2_PER_MILE, HUMAN_POWERED } from '@/lib/travel/constants';

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
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const allowed = ['name', 'date', 'notes', 'is_round_trip'];
  const metaUpdates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k)),
  );

  const routeDate = metaUpdates.date || existing.date;

  // Update route metadata
  if (Object.keys(metaUpdates).length > 0) {
    await db.from('trip_routes').update(metaUpdates).eq('id', id);
  }

  // If legs array provided, replace all legs
  const legs = body.legs;
  let newLegs: Record<string, unknown>[] = [];

  if (Array.isArray(legs) && legs.length >= 1) {
    // Delete old legs and their linked transactions
    const { data: oldLegs } = await db
      .from('trips')
      .select('id, transaction_id')
      .eq('route_id', id);

    const txIds = (oldLegs ?? []).map((l) => l.transaction_id).filter(Boolean) as string[];
    for (const txId of txIds) {
      try { await deleteLinkedTransaction(db, txId); } catch { /* non-fatal */ }
    }
    await db.from('trips').delete().eq('route_id', id);

    // Create new legs
    let totalDistance = 0;
    let totalDuration = 0;
    let totalCost = 0;
    let totalCo2 = 0;

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const dist = leg.distance_miles ? Number(leg.distance_miles) : null;
      const dur = leg.duration_min ? Number(leg.duration_min) : null;
      const cost = leg.cost ? Number(leg.cost) : null;
      const factor = CO2_PER_MILE[leg.mode] ?? 0;
      const co2 = dist && dist > 0 ? parseFloat((factor * dist).toFixed(3)) : null;
      const tripCategory = HUMAN_POWERED.has(leg.mode)
        ? (leg.trip_category || 'travel')
        : 'travel';

      const { data: trip, error: tripErr } = await db
        .from('trips')
        .insert({
          user_id: user.id,
          mode: leg.mode,
          date: routeDate,
          origin: leg.origin || null,
          destination: leg.destination || null,
          distance_miles: dist,
          duration_min: dur,
          calories_burned: leg.calories_burned ? Number(leg.calories_burned) : null,
          cost,
          co2_kg: co2,
          purpose: leg.purpose || null,
          vehicle_id: leg.vehicle_id || null,
          tax_category: leg.tax_category || 'personal',
          trip_category: tripCategory,
          notes: leg.notes || null,
          source: 'manual',
          route_id: id,
          leg_order: i,
        })
        .select()
        .single();

      if (tripErr) return NextResponse.json({ error: tripErr.message }, { status: 500 });

      // Create linked finance transaction per leg if cost > 0
      if (cost && cost > 0) {
        try {
          const vendor = leg.origin && leg.destination
            ? `${leg.origin} → ${leg.destination}`
            : null;
          const txId = await createLinkedTransaction(db, {
            userId: user.id,
            amount: cost,
            vendor,
            date: routeDate,
            source_module: 'trip',
            source_module_id: trip.id,
            description: `Route leg: ${leg.mode} – ${leg.origin || '?'} to ${leg.destination || '?'}`,
            category_id: leg.finance_category_id ?? null,
          });
          await db.from('trips').update({ transaction_id: txId }).eq('id', trip.id);
          trip.transaction_id = txId;
        } catch { /* non-fatal */ }
      }

      newLegs.push(trip);
      if (dist) totalDistance += dist;
      if (dur) totalDuration += dur;
      if (cost) totalCost += cost;
      if (co2) totalCo2 += co2;
    }

    // Update route aggregates
    await db
      .from('trip_routes')
      .update({
        total_distance: parseFloat(totalDistance.toFixed(2)),
        total_duration: totalDuration,
        total_cost: parseFloat(totalCost.toFixed(2)),
        total_co2_kg: parseFloat(totalCo2.toFixed(3)),
      })
      .eq('id', id);
  } else {
    // No legs change — just propagate date to existing legs if date changed
    if (metaUpdates.date) {
      await db.from('trips').update({ date: metaUpdates.date }).eq('route_id', id);
    }
  }

  // Fetch updated route
  const { data: route } = await db
    .from('trip_routes')
    .select('*')
    .eq('id', id)
    .single();

  // If we didn't replace legs, fetch current ones
  if (newLegs.length === 0) {
    const { data: currentLegs } = await db
      .from('trips')
      .select('*')
      .eq('route_id', id)
      .order('leg_order', { ascending: true });
    newLegs = currentLegs ?? [];
  }

  return NextResponse.json({ route, legs: newLegs });
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
