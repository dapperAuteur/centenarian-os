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

// Must match the trips CHECK constraints: mode and purpose (migration 052),
// trip_category and tax_category (053).
const VALID_MODES = new Set([
  'bike', 'car', 'bus', 'train', 'plane', 'walk', 'run', 'ferry', 'rideshare', 'other',
]);
const VALID_PURPOSES = new Set(['commute', 'leisure', 'work', 'errand', 'exercise', 'other']);
const VALID_TRIP_CATEGORIES = new Set(['travel', 'fitness']);
const VALID_TAX_CATEGORIES = new Set(['personal', 'business', 'medical', 'charitable']);

// Modes the import accepted before it matched the table; store the equivalent
// mode the CHECK constraint allows. ("transit" has no single equivalent — the
// row error asks for bus or train.)
const MODE_ALIASES: Record<string, string> = {
  flight: 'plane',
  boat: 'ferry',
};

// Same factors this import has always used, keyed by the stored mode
// (transit → bus/train, flight → plane, boat → ferry).
const CO2_PER_MILE: Record<string, number> = {
  car: 0.404,
  rideshare: 0.404,
  bus: 0.177,
  train: 0.177,
  plane: 0.255,
  ferry: 0,
  bike: 0,
  walk: 0,
  run: 0,
  other: 0,
};

const listOf = (values: Set<string>) => Array.from(values).join(', ');

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
    const rawMode = row.mode?.toLowerCase()?.trim();
    const mode = rawMode ? (MODE_ALIASES[rawMode] ?? rawMode) : undefined;
    if (!mode || !VALID_MODES.has(mode)) {
      errors.push(`Row ${i + 1}: invalid or missing mode (use ${listOf(VALID_MODES)})`);
      skipped++;
      continue;
    }

    // Optional enums: blank falls back to the column default (or null); a value
    // the table would reject is reported per row instead of failing the batch.
    const purpose = row.purpose?.trim()?.toLowerCase() || null;
    if (purpose && !VALID_PURPOSES.has(purpose)) {
      errors.push(`Row ${i + 1}: invalid purpose (use ${listOf(VALID_PURPOSES)}, or leave blank and describe the trip in notes)`);
      skipped++;
      continue;
    }

    const tripCategory = row.trip_category?.trim()?.toLowerCase() || 'travel';
    if (!VALID_TRIP_CATEGORIES.has(tripCategory)) {
      errors.push(`Row ${i + 1}: invalid trip_category (use ${listOf(VALID_TRIP_CATEGORIES)})`);
      skipped++;
      continue;
    }

    const taxCategory = row.tax_category?.trim()?.toLowerCase() || 'personal';
    if (!VALID_TAX_CATEGORIES.has(taxCategory)) {
      errors.push(`Row ${i + 1}: invalid tax_category (use ${listOf(VALID_TAX_CATEGORIES)})`);
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
    // trips.duration_min is an INT column — a fractional value would fail the whole batch
    const durationRaw = row.duration_min ? parseFloat(row.duration_min) : NaN;
    const durationMin = Number.isFinite(durationRaw) ? Math.round(durationRaw) : null;
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
      purpose,
      cost: cost,
      co2_kg: co2Kg,
      trip_category: tripCategory,
      tax_category: taxCategory,
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
