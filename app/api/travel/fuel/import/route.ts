// app/api/travel/fuel/import/route.ts
// POST: bulk import fuel logs from parsed CSV rows

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

const VALID_FUEL_GRADES = new Set(['regular', 'mid_grade', 'premium', 'diesel']);

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

    // Resolve vehicle_nickname → vehicle_id
    let vehicleId: string | null = null;
    if (row.vehicle_nickname?.trim()) {
      vehicleId = vehicleMap.get(row.vehicle_nickname.trim().toLowerCase()) ?? null;
    }

    const gallons = row.gallons ? parseFloat(row.gallons) : null;
    const totalCost = row.total_cost ? parseFloat(row.total_cost) : null;
    const odometerMiles = row.odometer_miles ? parseFloat(row.odometer_miles) : null;

    // Auto-calculate cost_per_gallon if not provided
    let costPerGallon = row.cost_per_gallon ? parseFloat(row.cost_per_gallon) : null;
    if (!costPerGallon && totalCost && gallons && gallons > 0) {
      costPerGallon = parseFloat((totalCost / gallons).toFixed(3));
    }

    // Validate fuel_grade
    const fuelGrade = row.fuel_grade?.trim()?.toLowerCase();
    const resolvedGrade = fuelGrade && VALID_FUEL_GRADES.has(fuelGrade) ? fuelGrade : 'regular';

    payloads.push({
      user_id: user.id,
      date: row.date,
      vehicle_id: vehicleId,
      odometer_miles: odometerMiles,
      gallons,
      total_cost: totalCost,
      cost_per_gallon: costPerGallon,
      fuel_grade: resolvedGrade,
      station: row.station?.trim() || null,
      notes: row.notes?.trim() || null,
      source: 'csv_import',
    });
  }

  if (payloads.length === 0) {
    return NextResponse.json({ error: 'No valid rows', details: errors.slice(0, 10) }, { status: 400 });
  }

  const { data, error } = await db
    .from('fuel_logs')
    .insert(payloads)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const imported = data?.length || 0;
  return NextResponse.json({
    imported,
    skipped,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    message: `Imported ${imported} fuel logs. ${skipped > 0 ? `${skipped} skipped.` : ''}`,
  });
}
