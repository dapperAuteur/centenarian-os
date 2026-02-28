// app/api/travel/vehicles/import/route.ts
// POST: bulk import vehicles from parsed CSV rows

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const MAX_VEHICLE_ROWS = 200;

const VALID_TYPES = new Set([
  'car', 'truck', 'suv', 'motorcycle', 'bicycle', 'scooter', 'rv', 'boat', 'other',
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
  if (rows.length > MAX_VEHICLE_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_VEHICLE_ROWS} rows per import` }, { status: 400 });
  }

  const db = getDb();

  // Pre-fetch existing vehicle nicknames for this user to skip duplicates
  const { data: existingVehicles } = await db
    .from('vehicles')
    .select('nickname')
    .eq('user_id', user.id);

  const existingNicknames = new Set(
    (existingVehicles || []).map((v) => v.nickname.toLowerCase()),
  );

  const payloads: Record<string, unknown>[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Validate required: type
    const type = row.type?.trim()?.toLowerCase();
    if (!type || !VALID_TYPES.has(type)) {
      errors.push(`Row ${i + 1}: invalid or missing type`);
      skipped++;
      continue;
    }

    // Validate required: nickname
    const nickname = row.nickname?.trim();
    if (!nickname) {
      errors.push(`Row ${i + 1}: missing nickname`);
      skipped++;
      continue;
    }

    // Skip if nickname already exists for this user
    if (existingNicknames.has(nickname.toLowerCase())) {
      errors.push(`Row ${i + 1}: vehicle "${nickname}" already exists`);
      skipped++;
      continue;
    }

    // Track the nickname so we don't import duplicates within the same batch
    existingNicknames.add(nickname.toLowerCase());

    const year = row.year ? parseInt(row.year, 10) : null;

    payloads.push({
      user_id: user.id,
      type,
      nickname,
      make: row.make?.trim() || null,
      model: row.model?.trim() || null,
      year: year && !isNaN(year) ? year : null,
      color: row.color?.trim() || null,
      ownership_type: row.ownership_type?.trim() || 'owned',
      trip_mode: row.trip_mode?.trim() || null,
    });
  }

  if (payloads.length === 0) {
    return NextResponse.json({ error: 'No valid rows', details: errors.slice(0, 10) }, { status: 400 });
  }

  const { data, error } = await db
    .from('vehicles')
    .insert(payloads)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const imported = data?.length || 0;
  return NextResponse.json({
    imported,
    skipped,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    message: `Imported ${imported} vehicles. ${skipped > 0 ? `${skipped} skipped.` : ''}`,
  });
}
