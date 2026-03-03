// app/api/health-metrics/import/route.ts
// POST: bulk import health metrics from CSV or JSON payload
// Supports: Garmin, Apple Health, Oura, Whoop, Google Health, InBody, Hume Health, generic CSV

import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const WRITABLE_COLUMNS = new Set([
  'resting_hr', 'steps', 'sleep_hours', 'activity_min',
  'sleep_score', 'hrv_ms', 'spo2_pct', 'active_calories',
  'stress_score', 'recovery_score', 'weight_lbs',
  'body_fat_pct', 'muscle_mass_lbs', 'bmi', 'notes',
]);

interface ImportRow {
  logged_date: string;
  [key: string]: string | number | null | undefined;
}

/**
 * POST /api/health-metrics/import
 * Body: { source: string, rows: ImportRow[] }
 * Each row must have logged_date (YYYY-MM-DD) and any metric columns.
 * Upserts by (user_id, logged_date, source) — existing values are overwritten per source.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { source?: string; rows?: ImportRow[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rows = body.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 });
  }

  if (rows.length > 365) {
    return NextResponse.json({ error: 'Maximum 365 rows per import' }, { status: 400 });
  }

  // Validate and sanitize rows
  const payloads: Record<string, unknown>[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.logged_date || !/^\d{4}-\d{2}-\d{2}$/.test(row.logged_date)) {
      errors.push(`Row ${i + 1}: invalid or missing logged_date`);
      continue;
    }

    const payload: Record<string, unknown> = {
      user_id: user.id,
      logged_date: row.logged_date,
      source: body.source || 'manual',
    };

    let hasMetric = false;
    for (const [k, v] of Object.entries(row)) {
      if (WRITABLE_COLUMNS.has(k) && v !== null && v !== undefined && v !== '') {
        // notes is text, keep as string; everything else is numeric
        if (k === 'notes') {
          payload[k] = String(v);
        } else {
          const num = typeof v === 'string' ? parseFloat(v) : v;
          if (typeof num === 'number' && !isNaN(num)) {
            payload[k] = num;
            hasMetric = true;
          }
        }
      }
    }

    if (!hasMetric) {
      errors.push(`Row ${i + 1}: no valid metric columns`);
      continue;
    }

    payloads.push(payload);
  }

  if (payloads.length === 0) {
    return NextResponse.json({ error: 'No valid rows', details: errors }, { status: 400 });
  }

  // Bulk upsert using service role to bypass RLS
  const db = getDb();
  const { data, error } = await db
    .from('user_health_metrics')
    .upsert(payloads, { onConflict: 'user_id,logged_date,source' })
    .select('logged_date');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    imported: data?.length || 0,
    skipped: rows.length - payloads.length,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    source: body.source || 'manual',
  });
}
