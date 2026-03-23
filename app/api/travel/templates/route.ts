// app/api/travel/templates/route.ts
// GET: list trip templates (single-leg + multi-stop)
// POST: create a trip template, or log a trip/route from an existing template

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const CO2_PER_MILE: Record<string, number> = {
  plane: 0.255, car: 0.170, rideshare: 0.170, bus: 0.089,
  train: 0.041, ferry: 0.120, bike: 0, walk: 0, run: 0, other: 0,
};

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
    .from('trip_templates')
    .select('*, vehicles(nickname, type)')
    .eq('user_id', user.id)
    .order('use_count', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // For multi-stop templates, fetch their stops
  const multiStopIds = (data ?? []).filter((t) => t.is_multi_stop).map((t) => t.id);
  const stopsMap: Record<string, unknown[]> = {};
  if (multiStopIds.length > 0) {
    const { data: stops } = await db
      .from('trip_template_stops')
      .select('*')
      .in('template_id', multiStopIds)
      .order('stop_order', { ascending: true });
    if (stops) {
      for (const s of stops) {
        if (!stopsMap[s.template_id]) stopsMap[s.template_id] = [];
        stopsMap[s.template_id].push(s);
      }
    }
  }

  const templates = (data ?? []).map((t) => ({
    ...t,
    stops: t.is_multi_stop ? (stopsMap[t.id] || []) : undefined,
  }));

  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const db = getDb();

  // ── Log from existing template ──
  if (body.create_trip && body.template_id) {
    const { data: tmpl } = await db
      .from('trip_templates')
      .select('*')
      .eq('id', body.template_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tmpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    // Increment use_count
    await db
      .from('trip_templates')
      .update({ use_count: (tmpl.use_count ?? 0) + 1 })
      .eq('id', body.template_id);

    const tripDate = body.trip_date ?? new Date().toISOString().split('T')[0];

    // Multi-stop template → create a route
    if (tmpl.is_multi_stop) {
      const { data: stops } = await db
        .from('trip_template_stops')
        .select('*')
        .eq('template_id', tmpl.id)
        .order('stop_order', { ascending: true });

      if (!stops || stops.length < 2) {
        return NextResponse.json({ error: 'Template has no stops' }, { status: 400 });
      }

      // Create route parent
      const { data: route, error: routeErr } = await db
        .from('trip_routes')
        .insert({
          user_id: user.id,
          name: tmpl.name,
          date: tripDate,
          template_id: tmpl.id,
          is_round_trip: tmpl.is_round_trip ?? false,
          notes: tmpl.notes || null,
          brand_id: tmpl.brand_id || null,
        })
        .select()
        .single();

      if (routeErr) return NextResponse.json({ error: routeErr.message }, { status: 500 });

      // Create legs from consecutive stops
      let totalDist = 0, totalDur = 0, totalCost = 0, totalCo2 = 0;
      const trips = [];

      for (let i = 0; i < stops.length - 1; i++) {
        const from = stops[i];
        const to = stops[i + 1];
        const mode = to.mode || tmpl.mode;
        const dist = to.distance_miles ? Number(to.distance_miles) : null;
        const dur = to.duration_min ? Number(to.duration_min) : null;
        const cost = to.cost ? Number(to.cost) : null;
        const factor = CO2_PER_MILE[mode] ?? 0;
        const co2 = dist && dist > 0 ? parseFloat((factor * dist).toFixed(3)) : null;

        const { data: trip, error: tripErr } = await db
          .from('trips')
          .insert({
            user_id: user.id,
            date: tripDate,
            mode,
            origin: from.location_name,
            destination: to.location_name,
            distance_miles: dist,
            duration_min: dur,
            cost,
            co2_kg: co2,
            purpose: to.purpose || tmpl.purpose,
            tax_category: tmpl.tax_category || 'personal',
            trip_category: tmpl.trip_category || 'travel',
            source: 'manual',
            route_id: route.id,
            leg_order: i,
          })
          .select()
          .single();

        if (tripErr) continue;
        trips.push(trip);
        if (dist) totalDist += dist;
        if (dur) totalDur += dur;
        if (cost) totalCost += cost;
        if (co2) totalCo2 += co2;
      }

      // Update route aggregates
      await db.from('trip_routes').update({
        total_distance: parseFloat(totalDist.toFixed(2)),
        total_duration: totalDur,
        total_cost: parseFloat(totalCost.toFixed(2)),
        total_co2_kg: parseFloat(totalCo2.toFixed(3)),
      }).eq('id', route.id);

      return NextResponse.json({ route, trips, template_id: tmpl.id }, { status: 201 });
    }

    // Single-leg template → create single trip
    const singleDist = tmpl.distance_miles ? Number(tmpl.distance_miles) : null;
    const singleRt = tmpl.is_round_trip === true;
    const singleFactor = CO2_PER_MILE[tmpl.mode] ?? 0;
    const singleEffective = singleRt && singleDist ? singleDist * 2 : singleDist;
    const singleCo2 = singleEffective && singleEffective > 0
      ? parseFloat((singleFactor * singleEffective).toFixed(3))
      : null;

    const { data: trip, error: tripErr } = await db
      .from('trips')
      .insert({
        user_id: user.id,
        date: tripDate,
        mode: tmpl.mode,
        vehicle_id: tmpl.vehicle_id,
        origin: tmpl.origin,
        destination: tmpl.destination,
        distance_miles: tmpl.distance_miles,
        duration_min: tmpl.duration_min,
        cost: tmpl.cost ?? null,
        co2_kg: singleCo2,
        is_round_trip: singleRt,
        purpose: tmpl.purpose,
        trip_category: tmpl.trip_category,
        tax_category: tmpl.tax_category,
        notes: tmpl.notes,
        source: 'manual',
      })
      .select()
      .single();

    if (tripErr) return NextResponse.json({ error: tripErr.message }, { status: 500 });
    return NextResponse.json({ trip, template_id: tmpl.id }, { status: 201 });
  }

  // ── Create new template ──
  const {
    name, mode, vehicle_id, origin, destination,
    distance_miles, duration_min, purpose, trip_category, tax_category, notes,
    is_multi_stop, stops,
  } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!is_multi_stop && !mode) {
    return NextResponse.json({ error: 'mode is required for single-leg templates' }, { status: 400 });
  }

  const { data, error } = await db
    .from('trip_templates')
    .insert({
      user_id: user.id,
      name: name.trim(),
      mode: mode || (is_multi_stop && stops?.length > 0 ? stops[0].mode || 'car' : 'car'),
      vehicle_id: vehicle_id ?? null,
      origin: origin ?? null,
      destination: destination ?? null,
      distance_miles: distance_miles ? Number(distance_miles) : null,
      duration_min: duration_min ? Number(duration_min) : null,
      purpose: purpose ?? null,
      trip_category: trip_category ?? null,
      tax_category: tax_category ?? null,
      notes: notes ?? null,
      is_multi_stop: is_multi_stop ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert stops for multi-stop templates
  if (is_multi_stop && Array.isArray(stops) && stops.length > 0) {
    const stopRows = stops.map((s: Record<string, unknown>, i: number) => ({
      template_id: data.id,
      stop_order: i,
      location_name: (s.location_name as string)?.trim() || null,
      contact_id: s.contact_id || null,
      location_id: s.location_id || null,
      mode: s.mode || null,
      distance_miles: s.distance_miles ? Number(s.distance_miles) : null,
      duration_min: s.duration_min ? Number(s.duration_min) : null,
      cost: s.cost ? Number(s.cost) : null,
      purpose: s.purpose || null,
      notes: (s.notes as string)?.trim() || null,
    }));
    await db.from('trip_template_stops').insert(stopRows);
  }

  return NextResponse.json(data, { status: 201 });
}
