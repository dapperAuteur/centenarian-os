// app/api/travel/trips/import/route.ts
// POST: bulk import trips from parsed CSV rows

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { MAX_IMPORT_ROWS, validateDate } from '@/lib/csv/helpers';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const VALID_MODES = new Set(['car', 'bike', 'walk', 'transit', 'flight', 'boat']);

const CO2_PER_MILE: Record<string, number> = {
  car: 0.404,
  transit: 0.177,
  flight: 0.255,
  bike: 0,
  walk: 0,
  boat: 0,
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const rows = body.rows;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_IMPORT_ROWS} rows per import` }, { status: 400 });
  }

  const db = getDb();

  // Pre-fetch user vehicles for nickname resolution
  const { data: vehicles } = await db
    .from('vehicles')
    .select('id, nickname')
    .eq('user_id', user.id);

  const vehicleMap = new Map<string, string>();
  for (const v of vehicles || []) {
    vehicleMap.set(v.nickname.toLowerCase(), v.id);
  }

  const payloads: Record<string, unknown>[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Validate required: date
    if (!row.date || !validateDate(row.date)) {
      errors.push(`Row ${i + 1}: invalid or missing date`);
      skipped++;
      continue;
    }

    // Validate required: mode
    const mode = row.mode?.toLowerCase()?.trim();
    if (!mode || !VALID_MODES.has(mode)) {
      errors.push(`Row ${i + 1}: invalid or missing mode (must be car, bike, walk, transit, flight, boat)`);
      skipped++;
      continue;
    }

    // Resolve vehicle_nickname → vehicle_id
    let vehicleId: string | null = null;
    if (row.vehicle_nickname?.trim()) {
      vehicleId = vehicleMap.get(row.vehicle_nickname.trim().toLowerCase()) ?? null;
    }

    const distanceMiles = row.distance_miles ? parseFloat(row.distance_miles) : null;
    const isRoundTrip = row.is_round_trip === 'true' || row.is_round_trip === '1';
    const durationMin = row.duration_min ? parseFloat(row.duration_min) : null;
    const cost = row.cost ? parseFloat(row.cost) : null;

    // Auto-calculate CO2
    let co2Kg: number | null = null;
    if (distanceMiles && distanceMiles > 0) {
      const factor = CO2_PER_MILE[mode] ?? 0;
      const effectiveDist = isRoundTrip ? distanceMiles * 2 : distanceMiles;
      co2Kg = parseFloat((factor * effectiveDist).toFixed(3));
    }

    payloads.push({
      user_id: user.id,
      date: row.date,
      mode,
      origin: row.origin?.trim() || null,
      destination: row.destination?.trim() || null,
      distance_miles: distanceMiles,
      duration_min: durationMin,
      purpose: row.purpose?.trim() || null,
      cost: cost,
      co2_kg: co2Kg,
      trip_category: row.trip_category?.trim() || 'travel',
      tax_category: row.tax_category?.trim() || 'personal',
      is_round_trip: isRoundTrip,
      vehicle_id: vehicleId,
      notes: row.notes?.trim() || null,
      source: 'csv_import',
    });
  }

  if (payloads.length === 0) {
    return NextResponse.json({ error: 'No valid rows', details: errors.slice(0, 10) }, { status: 400 });
  }

  const { data, error } = await db
    .from('trips')
    .insert(payloads)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const imported = data?.length || 0;
  return NextResponse.json({
    imported,
    skipped,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    message: `Imported ${imported} trips. ${skipped > 0 ? `${skipped} skipped.` : ''}`,
  });
}
