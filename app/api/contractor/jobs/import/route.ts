// app/api/contractor/jobs/import/route.ts
// POST: import contractor jobs from CSV rows

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { validateDate, MAX_IMPORT_ROWS } from '@/lib/csv/helpers';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const VALID_STATUSES = ['assigned', 'confirmed', 'in_progress', 'completed', 'invoiced', 'paid', 'cancelled'];
const VALID_RATE_TYPES = ['hourly', 'daily', 'flat'];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows } = await request.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_IMPORT_ROWS} rows` }, { status: 400 });
  }

  const db = getDb();
  const errors: string[] = [];
  const payloads: Record<string, unknown>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // 1-indexed + header

    if (!r.job_number?.trim()) { errors.push(`Row ${rowNum}: job_number required`); continue; }
    if (!r.client_name?.trim()) { errors.push(`Row ${rowNum}: client_name required`); continue; }
    if (r.start_date && !validateDate(r.start_date)) { errors.push(`Row ${rowNum}: invalid start_date`); continue; }
    if (r.end_date && !validateDate(r.end_date)) { errors.push(`Row ${rowNum}: invalid end_date`); continue; }
    if (r.status && !VALID_STATUSES.includes(r.status)) { errors.push(`Row ${rowNum}: invalid status`); continue; }
    if (r.rate_type && !VALID_RATE_TYPES.includes(r.rate_type)) { errors.push(`Row ${rowNum}: invalid rate_type`); continue; }

    payloads.push({
      user_id: user.id,
      job_number: r.job_number.trim(),
      client_name: r.client_name.trim(),
      event_name: r.event_name?.trim() || null,
      location_name: r.location_name?.trim() || null,
      status: r.status || 'assigned',
      start_date: r.start_date || null,
      end_date: r.end_date || null,
      pay_rate: r.pay_rate ? parseFloat(r.pay_rate) : null,
      ot_rate: r.ot_rate ? parseFloat(r.ot_rate) : null,
      dt_rate: r.dt_rate ? parseFloat(r.dt_rate) : null,
      rate_type: r.rate_type || 'hourly',
      union_local: r.union_local?.trim() || null,
      department: r.department?.trim() || null,
      benefits_eligible: r.benefits_eligible === 'true',
      distance_from_home_miles: r.distance_from_home_miles ? parseFloat(r.distance_from_home_miles) : null,
      poc_name: r.poc_name?.trim() || null,
      crew_coordinator_name: r.crew_coordinator_name?.trim() || null,
      notes: r.notes?.trim() || null,
    });

    if (errors.length >= 10) break;
  }

  if (payloads.length === 0) {
    return NextResponse.json({ imported: 0, skipped: rows.length, errors: errors.slice(0, 10) });
  }

  // Insert — skip duplicates (unique constraint on job_number per user)
  let imported = 0;
  const skipped: string[] = [];

  for (const payload of payloads) {
    const { error } = await db.from('contractor_jobs').insert(payload);
    if (error) {
      if (error.code === '23505') {
        skipped.push(`${payload.job_number}: duplicate`);
      } else {
        errors.push(`${payload.job_number}: ${error.message}`);
      }
    } else {
      imported++;
    }
  }

  return NextResponse.json({
    imported,
    skipped: skipped.length,
    errors: [...errors, ...skipped].slice(0, 10),
  });
}
