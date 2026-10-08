// app/api/travel/templates/route.ts
// GET: list trip templates (single-leg + multi-stop)
// POST: create a trip template, or log a trip/route from an existing template

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { checkReferences, invalidReferenceMessage, usableReferences } from '@/lib/auth/ownership';
import { templateStopReferences, travelReferences, VEHICLE_EMBED, withVisibleVehicle } from '@/lib/travel/references';
import { normalizeTripPurpose, singleLegRoundTrip, templateStopsToLegs } from '@/lib/travel/template-stops';

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
    .select(`*, ${VEHICLE_EMBED}`)
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
    ...withVisibleVehicle(t, user.id),
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

    // Counted only once the trip or route is saved.
    const countUse = () => db
      .from('trip_templates')
      .update({ use_count: (tmpl.use_count ?? 0) + 1 })
      .eq('id', tmpl.id);

    const tripDate = body.trip_date ?? new Date().toISOString().split('T')[0];

    // Multi-stop template → create a route
    if (tmpl.is_multi_stop) {
      const { data: stops, error: stopsErr } = await db
        .from('trip_template_stops')
        .select('*')
        .eq('template_id', tmpl.id)
        .order('stop_order', { ascending: true });

      if (stopsErr) return NextResponse.json({ error: stopsErr.message }, { status: 500 });

      // Leg i runs from stop i to stop i + 1 with stop i + 1's details; a
      // round-trip template that does not end at its start gets a return leg.
      const legs = templateStopsToLegs(stops ?? [], tmpl);
      if (legs.length === 0) {
        return NextResponse.json({ error: 'Template has no stops' }, { status: 400 });
      }

      // Each stop's vehicle and the template's brand, saved before reference
      // checks existed, are used only when the caller may still reference them.
      const refs = await usableReferences(db, user.id, [
        ...travelReferences({ brand_id: tmpl.brand_id }),
        ...legs.flatMap((leg) => travelReferences({ vehicle_id: leg.vehicle_id }, `legs.${leg.leg_order}.`)),
      ]);
      if (refs.failed) return NextResponse.json({ error: 'Could not verify references' }, { status: 500 });

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
          brand_id: refs.values.brand_id ?? null,
        })
        .select()
        .single();

      if (routeErr) return NextResponse.json({ error: routeErr.message }, { status: 500 });

      // Create legs
      let totalDist = 0, totalDur = 0, totalCost = 0, totalCo2 = 0;
      const trips = [];

      for (const leg of legs) {
        const factor = CO2_PER_MILE[leg.mode] ?? 0;
        const dist = leg.distance_miles;
        const co2 = dist && dist > 0 ? parseFloat((factor * dist).toFixed(3)) : null;

        const { data: trip, error: tripErr } = await db
          .from('trips')
          .insert({
            user_id: user.id,
            date: tripDate,
            mode: leg.mode,
            vehicle_id: refs.values[`legs.${leg.leg_order}.vehicle_id`] ?? null,
            origin: leg.origin,
            destination: leg.destination,
            distance_miles: dist,
            duration_min: leg.duration_min,
            cost: leg.cost,
            co2_kg: co2,
            purpose: leg.purpose,
            tax_category: tmpl.tax_category || 'personal',
            trip_category: tmpl.trip_category || 'travel',
            source: 'manual',
            route_id: route.id,
            leg_order: leg.leg_order,
          })
          .select()
          .single();

        if (tripErr) {
          // A leg that cannot be saved fails the whole log, like Add Trip:
          // no route with legs (and miles) silently missing.
          await db.from('trips').delete().eq('route_id', route.id).eq('user_id', user.id);
          await db.from('trip_routes').delete().eq('id', route.id).eq('user_id', user.id);
          return NextResponse.json({ error: tripErr.message }, { status: 500 });
        }
        trips.push(trip);
        if (dist) totalDist += dist;
        if (leg.duration_min) totalDur += leg.duration_min;
        if (leg.cost) totalCost += leg.cost;
        if (co2) totalCo2 += co2;
      }

      // Update route aggregates
      const totals = {
        total_distance: parseFloat(totalDist.toFixed(2)),
        total_duration: totalDur,
        total_cost: parseFloat(totalCost.toFixed(2)),
        total_co2_kg: parseFloat(totalCo2.toFixed(3)),
      };
      await db.from('trip_routes').update(totals).eq('id', route.id);
      await countUse();

      return NextResponse.json({ route: { ...route, ...totals }, trips, template_id: tmpl.id }, { status: 201 });
    }

    // Single-leg template → create single trip. A vehicle saved before
    // reference checks existed is used only when the caller may reference it.
    const tmplRefs = await usableReferences(db, user.id, travelReferences({ vehicle_id: tmpl.vehicle_id }));
    if (tmplRefs.failed) return NextResponse.json({ error: 'Could not verify references' }, { status: 500 });
    const singleDist = tmpl.distance_miles ? Number(tmpl.distance_miles) : null;
    // A loop (origin is the destination) is the whole trip, so it is never
    // doubled, even when it was saved or edited with Round trip ticked.
    const singleRt = singleLegRoundTrip(tmpl);
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
        vehicle_id: tmplRefs.values.vehicle_id ?? null,
        origin: tmpl.origin,
        destination: tmpl.destination,
        distance_miles: tmpl.distance_miles,
        duration_min: tmpl.duration_min,
        cost: tmpl.cost ?? null,
        co2_kg: singleCo2,
        is_round_trip: singleRt,
        // An old Edit Template value ('fitness', 'business') is mapped onto
        // one trips.purpose accepts instead of failing the insert.
        purpose: normalizeTripPurpose(tmpl.purpose),
        trip_category: tmpl.trip_category,
        tax_category: tmpl.tax_category,
        notes: tmpl.notes,
        source: 'manual',
      })
      .select()
      .single();

    if (tripErr) return NextResponse.json({ error: tripErr.message }, { status: 500 });
    await countUse();
    return NextResponse.json({ trip, template_id: tmpl.id }, { status: 201 });
  }

  // ── Create new template ──
  // Multi-stop stops use the shared convention (lib/travel/template-stops.ts):
  // stop 0 is the start, stop k holds the leg that ends there.
  const {
    name, mode, vehicle_id, origin, destination,
    distance_miles, duration_min, cost, purpose, trip_category, tax_category, notes,
    is_multi_stop, is_round_trip, brand_id, stops,
  } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!is_multi_stop && !mode) {
    return NextResponse.json({ error: 'mode is required for single-leg templates' }, { status: 400 });
  }

  // The template's vehicle and brand, and each stop's contact, saved location
  // and vehicle, must be the caller's own (a vehicle may also be a shared
  // public-transport one).
  const refs = await checkReferences(db, user.id, [...travelReferences(body), ...templateStopReferences(body.stops)]);
  if (refs.failed) return NextResponse.json({ error: 'Could not verify references' }, { status: 500 });
  if (!refs.ok) return NextResponse.json({ error: invalidReferenceMessage(refs.invalid) }, { status: 400 });

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
      cost: cost ? Number(cost) : null,
      purpose: purpose ?? null,
      trip_category: trip_category ?? null,
      tax_category: tax_category ?? null,
      notes: notes ?? null,
      is_multi_stop: is_multi_stop ?? false,
      is_round_trip: is_round_trip === true,
      brand_id: brand_id || null,
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
      vehicle_id: s.vehicle_id || null,
      distance_miles: s.distance_miles ? Number(s.distance_miles) : null,
      duration_min: s.duration_min ? Number(s.duration_min) : null,
      cost: s.cost ? Number(s.cost) : null,
      purpose: s.purpose || null,
      notes: (s.notes as string)?.trim() || null,
    }));
    const { error: stopsErr } = await db.from('trip_template_stops').insert(stopRows);
    if (stopsErr) {
      // A multi-stop template without its stops cannot be logged; don't keep one.
      await db.from('trip_templates').delete().eq('id', data.id).eq('user_id', user.id);
      return NextResponse.json({ error: stopsErr.message }, { status: 500 });
    }
  }

  return NextResponse.json(data, { status: 201 });
}
