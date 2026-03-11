// app/api/travel/routes/route.ts
// GET: list multi-stop routes
// POST: create a multi-stop route (creates parent + individual trip legs)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createLinkedTransaction } from '@/lib/finance/linked-transaction';
import { CO2_PER_MILE, HUMAN_POWERED } from '@/lib/travel/constants';
import { getRoute } from '@/lib/geo/route';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(params.get('limit') || '50'), 200);
  const offset = parseInt(params.get('offset') || '0');

  const db = getDb();
  const { data, error, count } = await db
    .from('trip_routes')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch leg counts for each route
  const routeIds = (data ?? []).map((r) => r.id);
  const legCounts: Record<string, number> = {};
  if (routeIds.length > 0) {
    const { data: legs } = await db
      .from('trips')
      .select('route_id')
      .in('route_id', routeIds);
    if (legs) {
      for (const leg of legs) {
        legCounts[leg.route_id] = (legCounts[leg.route_id] || 0) + 1;
      }
    }
  }

  const routes = (data ?? []).map((r) => ({
    ...r,
    leg_count: legCounts[r.id] || 0,
  }));

  return NextResponse.json({ routes, total: count || 0 });
}

interface LegInput {
  mode: string;
  origin: string;
  destination: string;
  distance_miles?: number | null;
  duration_min?: number | null;
  cost?: number | null;
  purpose?: string | null;
  vehicle_id?: string | null;
  calories_burned?: number | null;
  tax_category?: string;
  trip_category?: string;
  notes?: string | null;
  finance_category_id?: string | null;
  origin_lat?: number | null;
  origin_lng?: number | null;
  dest_lat?: number | null;
  dest_lng?: number | null;
  date?: string | null; // per-leg date for multi-day trips
  // Booking details
  confirmation_number?: string | null;
  booking_reference?: string | null;
  carrier_name?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  pickup_address?: string | null;
  return_address?: string | null;
  pickup_time?: string | null;
  return_time?: string | null;
  seat_assignment?: string | null;
  terminal?: string | null;
  gate?: string | null;
  booking_url?: string | null;
  accommodation_name?: string | null;
  accommodation_address?: string | null;
  room_type?: string | null;
  loyalty_program?: string | null;
  loyalty_number?: string | null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, date, legs, notes, is_round_trip, save_as_template, trip_status, packing_notes, budget_amount, brand_id, visibility } = body;

  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 });
  if (!Array.isArray(legs) || legs.length < 2) {
    return NextResponse.json({ error: 'At least 2 legs required' }, { status: 400 });
  }

  const db = getDb();

  // 1. Create the route parent
  const resolvedStatus = trip_status || 'completed';

  const { data: route, error: routeErr } = await db
    .from('trip_routes')
    .insert({
      user_id: user.id,
      name: name?.trim() || null,
      date,
      is_round_trip: is_round_trip ?? false,
      notes: notes?.trim() || null,
      trip_status: resolvedStatus,
      packing_notes: packing_notes?.trim() || null,
      budget_amount: budget_amount ? parseFloat(budget_amount) : null,
      brand_id: brand_id || null,
      visibility: visibility || 'private',
    })
    .select()
    .single();

  if (routeErr) return NextResponse.json({ error: routeErr.message }, { status: 500 });

  // 2. Create individual trip legs
  const createdTrips = [];
  let totalDistance = 0;
  let totalDuration = 0;
  let totalCost = 0;
  let totalCo2 = 0;

  for (let i = 0; i < legs.length; i++) {
    const leg: LegInput = legs[i];
    let dist = leg.distance_miles ? Number(leg.distance_miles) : null;
    let dur = leg.duration_min ? Number(leg.duration_min) : null;
    let distanceSource: string = 'manual';
    let routeGeometry: string | null = null;

    // Auto-calculate via OSRM if coordinates provided and no manual distance
    const hasCoords = typeof leg.origin_lat === 'number' && typeof leg.origin_lng === 'number'
      && typeof leg.dest_lat === 'number' && typeof leg.dest_lng === 'number';
    if (hasCoords && !dist) {
      const routeResult = await getRoute(
        { lat: leg.origin_lat!, lng: leg.origin_lng! },
        { lat: leg.dest_lat!, lng: leg.dest_lng! },
      );
      dist = routeResult.distance_miles;
      dur = dur ?? routeResult.duration_min;
      distanceSource = routeResult.source;
      routeGeometry = routeResult.geometry;
    }

    const cost = leg.cost ? Number(leg.cost) : null;
    const factor = CO2_PER_MILE[leg.mode] ?? 0;
    const co2 = dist && dist > 0 ? parseFloat((factor * dist).toFixed(3)) : null;

    const tripCategory = HUMAN_POWERED.has(leg.mode)
      ? (leg.trip_category || 'travel')
      : 'travel';

    const legDate = leg.date || date;

    const { data: trip, error: tripErr } = await db
      .from('trips')
      .insert({
        user_id: user.id,
        mode: leg.mode,
        date: legDate,
        origin: leg.origin || null,
        destination: leg.destination || null,
        distance_miles: dist,
        duration_min: dur,
        distance_source: distanceSource,
        route_geometry: routeGeometry,
        calories_burned: leg.calories_burned ? Number(leg.calories_burned) : null,
        cost,
        co2_kg: co2,
        purpose: leg.purpose || null,
        vehicle_id: leg.vehicle_id || null,
        tax_category: leg.tax_category || 'personal',
        trip_category: tripCategory,
        notes: leg.notes || null,
        source: 'manual',
        route_id: route.id,
        leg_order: i,
        trip_status: resolvedStatus,
        // Booking details
        confirmation_number: leg.confirmation_number || null,
        booking_reference: leg.booking_reference || null,
        carrier_name: leg.carrier_name || null,
        check_in_date: leg.check_in_date || null,
        check_out_date: leg.check_out_date || null,
        pickup_address: leg.pickup_address || null,
        return_address: leg.return_address || null,
        pickup_time: leg.pickup_time || null,
        return_time: leg.return_time || null,
        seat_assignment: leg.seat_assignment || null,
        terminal: leg.terminal || null,
        gate: leg.gate || null,
        booking_url: leg.booking_url || null,
        accommodation_name: leg.accommodation_name || null,
        accommodation_address: leg.accommodation_address || null,
        room_type: leg.room_type || null,
        loyalty_program: leg.loyalty_program || null,
        loyalty_number: leg.loyalty_number || null,
      })
      .select()
      .single();

    if (tripErr) {
      // Cleanup on failure: delete route and any created trips
      await db.from('trips').delete().eq('route_id', route.id);
      await db.from('trip_routes').delete().eq('id', route.id);
      return NextResponse.json({ error: tripErr.message }, { status: 500 });
    }

    // Create linked finance transaction per leg if cost > 0 (skip for planned trips)
    if (cost && cost > 0 && resolvedStatus === 'completed') {
      try {
        const vendor = leg.origin && leg.destination
          ? `${leg.origin} → ${leg.destination}`
          : null;
        const txId = await createLinkedTransaction(db, {
          userId: user.id,
          amount: cost,
          vendor,
          date,
          source_module: 'trip',
          source_module_id: trip.id,
          description: `Route leg: ${leg.mode} – ${leg.origin || '?'} to ${leg.destination || '?'}`,
          category_id: leg.finance_category_id ?? null,
        });
        await db.from('trips').update({ transaction_id: txId }).eq('id', trip.id);
        trip.transaction_id = txId;
      } catch { /* non-fatal */ }
    }

    createdTrips.push(trip);
    if (dist) totalDistance += dist;
    if (dur) totalDuration += dur;
    if (cost) totalCost += cost;
    if (co2) totalCo2 += co2;
  }

  // 3. Compute end_date from latest leg date
  const legDates = createdTrips.map((t) => t.date).filter(Boolean).sort();
  const endDate = legDates.length > 0 ? legDates[legDates.length - 1] : null;

  // 4. Update route aggregates
  await db
    .from('trip_routes')
    .update({
      total_distance: parseFloat(totalDistance.toFixed(2)),
      total_duration: totalDuration,
      total_cost: parseFloat(totalCost.toFixed(2)),
      total_co2_kg: parseFloat(totalCo2.toFixed(3)),
      end_date: endDate !== date ? endDate : null,
    })
    .eq('id', route.id);

  route.total_distance = parseFloat(totalDistance.toFixed(2));
  route.total_duration = totalDuration;
  route.total_cost = parseFloat(totalCost.toFixed(2));
  route.total_co2_kg = parseFloat(totalCo2.toFixed(3));

  // 4. Optionally save as a template
  let templateId = null;
  if (save_as_template && name?.trim()) {
    const { data: tmpl } = await db
      .from('trip_templates')
      .insert({
        user_id: user.id,
        name: name.trim(),
        mode: legs[0].mode,
        is_multi_stop: true,
      })
      .select('id')
      .single();

    if (tmpl) {
      templateId = tmpl.id;
      const stops = legs.map((leg: LegInput, i: number) => ({
        template_id: tmpl.id,
        stop_order: i,
        location_name: i === 0 ? (leg.origin || null) : (leg.destination || null),
        mode: i === 0 ? null : leg.mode,
        distance_miles: leg.distance_miles ? Number(leg.distance_miles) : null,
        duration_min: leg.duration_min ? Number(leg.duration_min) : null,
        cost: leg.cost ? Number(leg.cost) : null,
        purpose: leg.purpose || null,
        notes: leg.notes || null,
      }));
      // Add final destination as a stop
      const lastLeg = legs[legs.length - 1];
      stops.push({
        template_id: tmpl.id,
        stop_order: legs.length,
        location_name: lastLeg.destination || null,
        mode: null,
        distance_miles: null,
        duration_min: null,
        cost: null,
        purpose: null,
        notes: null,
      });
      await db.from('trip_template_stops').insert(stops);

      // Link route to template
      await db.from('trip_routes').update({ template_id: tmpl.id }).eq('id', route.id);
    }
  }

  return NextResponse.json({
    route,
    trips: createdTrips,
    template_id: templateId,
  }, { status: 201 });
}
