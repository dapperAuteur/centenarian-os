// app/api/travel/maintenance/import/route.ts
// POST: bulk import vehicle maintenance records from parsed CSV rows

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

const VALID_SERVICE_TYPES = new Set([
  'oil_change', 'tire_rotation', 'tire_replacement', 'brake_service',
  'battery', 'transmission', 'coolant', 'filter', 'inspection',
  'alignment', 'detailing', 'other',
]);

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

    // Validate required: service_type
    const serviceType = row.service_type?.trim()?.toLowerCase();
    if (!serviceType || !VALID_SERVICE_TYPES.has(serviceType)) {
      errors.push(`Row ${i + 1}: invalid or missing service_type`);
      skipped++;
      continue;
    }

    // Resolve vehicle_nickname → vehicle_id
    let vehicleId: string | null = null;
    if (row.vehicle_nickname?.trim()) {
      vehicleId = vehicleMap.get(row.vehicle_nickname.trim().toLowerCase()) ?? null;
    }

    const cost = row.cost ? parseFloat(row.cost) : null;
    const odometerAtService = row.odometer_at_service ? parseFloat(row.odometer_at_service) : null;
    const nextServiceMiles = row.next_service_miles ? parseFloat(row.next_service_miles) : null;

    // Validate optional next_service_date
    let nextServiceDate: string | null = null;
    if (row.next_service_date?.trim()) {
      nextServiceDate = validateDate(row.next_service_date.trim()) ? row.next_service_date.trim() : null;
    }

    payloads.push({
      user_id: user.id,
      date: row.date,
      service_type: serviceType,
      vehicle_id: vehicleId,
      odometer_at_service: odometerAtService,
      cost,
      vendor: row.vendor?.trim() || null,
      next_service_date: nextServiceDate,
      next_service_miles: nextServiceMiles,
      notes: row.notes?.trim() || null,
    });
  }

  if (payloads.length === 0) {
    return NextResponse.json({ error: 'No valid rows', details: errors.slice(0, 10) }, { status: 400 });
  }

  const { data, error } = await db
    .from('vehicle_maintenance')
    .insert(payloads)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const imported = data?.length || 0;
  return NextResponse.json({
    imported,
    skipped,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    message: `Imported ${imported} maintenance records. ${skipped > 0 ? `${skipped} skipped.` : ''}`,
  });
}
