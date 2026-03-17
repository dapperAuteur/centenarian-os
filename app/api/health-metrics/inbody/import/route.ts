// app/api/health-metrics/inbody/import/route.ts
// POST: Import raw InBody device CSV rows.
// Stores all 43 columns in inbody_scans, then syncs 4 core fields to
// user_health_metrics (source='inbody') so existing dashboards see the data.

import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// Maps InBody CSV column headers → inbody_scans DB columns
const COLUMN_MAP: Record<string, string> = {
  'Measurement device.':         'device_model',
  'Weight(lb)':                  'weight_lbs',
  'Skeletal Muscle Mass(lb)':    'skeletal_muscle_mass_lbs',
  'Soft Lean Mass(lb)':          'soft_lean_mass_lbs',
  'Body Fat Mass(lb)':           'body_fat_mass_lbs',
  'BMI(kg/m²)':                  'bmi',
  'Percent Body Fat(%)':         'body_fat_pct',
  'Basal Metabolic Rate(kJ)':    'bmr_kj',
  'InBody Score':                'inbody_score',
  'Right Arm Lean Mass(lb)':     'lean_right_arm_lbs',
  'Left Arm Lean Mass(lb)':      'lean_left_arm_lbs',
  'Trunk Lean Mass(lb)':         'lean_trunk_lbs',
  'Right Leg Lean Mass(lb)':     'lean_right_leg_lbs',
  'Left leg Lean Mass(lb)':      'lean_left_leg_lbs',
  'Right Arm Fat Mass(lb)':      'fat_right_arm_lbs',
  'Left Arm Fat Mass(lb)':       'fat_left_arm_lbs',
  'Trunk Fat Mass(lb)':          'fat_trunk_lbs',
  'Right Leg Fat Mass(lb)':      'fat_right_leg_lbs',
  'Left Leg Fat Mass(lb)':       'fat_left_leg_lbs',
  'Right Arm ECW Ratio':         'ecw_right_arm',
  'Left Arm ECW Ratio':          'ecw_left_arm',
  'Trunk ECW Ratio':             'ecw_trunk',
  'Right Leg ECW Ratio':         'ecw_right_leg',
  'Left Leg ECW Ratio':          'ecw_left_leg',
  'Waist Hip Ratio':             'waist_hip_ratio',
  'Waist Circumference(inch)':   'waist_circumference_in',
  'Visceral Fat Area(cm²)':      'visceral_fat_area_cm2',
  'Visceral Fat Level(Level)':   'visceral_fat_level',
  'Total Body Water(L)':         'total_body_water_l',
  'Intracellular Water(L)':      'intracellular_water_l',
  'Extracellular Water(L)':      'extracellular_water_l',
  'ECW Ratio':                   'ecw_ratio',
  'Upper-Lower':                 'upper_lower_ratio',
  'Upper':                       'upper_segment_score',
  'Lower':                       'lower_segment_score',
  'Leg Muscle Level(Level)':     'leg_muscle_level',
  'Leg Lean Mass(lb)':           'leg_lean_mass_lbs',
  'Protein(lb)':                 'protein_lbs',
  'Mineral(lb)':                 'mineral_lbs',
  'Bone Mineral Content(lb)':    'bone_mineral_content_lbs',
  'Body Cell Mass(lb)':          'body_cell_mass_lbs',
  'SMI(kg/m²)':                  'skeletal_muscle_index',
  'Whole Body Phase Angle(°)':   'phase_angle_deg',
};

// Integer columns
const INT_COLUMNS = new Set(['inbody_score', 'visceral_fat_level', 'leg_muscle_level']);

// Text columns (not numeric)
const TEXT_COLUMNS = new Set(['device_model']);

function parseInBodyTimestamp(raw: string): { measured_at: string; logged_date: string } | null {
  // YYYYMMDDHHmmss (14 chars)
  if (/^\d{14}$/.test(raw)) {
    const y = raw.slice(0, 4), mo = raw.slice(4, 6), d = raw.slice(6, 8);
    const h = raw.slice(8, 10), mi = raw.slice(10, 12), s = raw.slice(12, 14);
    const measured_at = `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
    const logged_date = `${y}-${mo}-${d}`;
    return { measured_at, logged_date };
  }
  // Already YYYY-MM-DD from client normalization
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { measured_at: `${raw}T00:00:00Z`, logged_date: raw };
  }
  return null;
}

/**
 * POST /api/health-metrics/inbody/import
 * Body: { rows: Array<Record<string, string>> }
 * Each row uses InBody CSV column headers as keys (as exported by the device).
 * The 'date' key holds the YYYYMMDDHHmmss timestamp.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { rows?: Record<string, string>[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rows = body.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 });
  }

  if (rows.length > 1000) {
    return NextResponse.json({ error: 'Maximum 1000 rows per import' }, { status: 400 });
  }

  const scanPayloads: Record<string, unknown>[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawDate = row['date'];
    if (!rawDate) {
      errors.push(`Row ${i + 1}: missing date`);
      continue;
    }

    const parsed = parseInBodyTimestamp(rawDate);
    if (!parsed) {
      errors.push(`Row ${i + 1}: unrecognized date format "${rawDate}"`);
      continue;
    }

    const payload: Record<string, unknown> = {
      user_id: user.id,
      measured_at: parsed.measured_at,
      logged_date: parsed.logged_date,
    };

    let hasMetric = false;
    for (const [csvCol, dbCol] of Object.entries(COLUMN_MAP)) {
      const raw = row[csvCol];
      if (raw === undefined || raw === '' || raw === '-') continue;

      if (TEXT_COLUMNS.has(dbCol)) {
        payload[dbCol] = raw;
        hasMetric = true;
      } else if (INT_COLUMNS.has(dbCol)) {
        const n = parseInt(raw, 10);
        if (!isNaN(n)) { payload[dbCol] = n; hasMetric = true; }
      } else {
        const n = parseFloat(raw);
        if (!isNaN(n)) { payload[dbCol] = n; hasMetric = true; }
      }
    }

    if (!hasMetric) {
      errors.push(`Row ${i + 1}: no valid metric values`);
      continue;
    }

    scanPayloads.push(payload);
  }

  if (scanPayloads.length === 0) {
    return NextResponse.json({ error: 'No valid rows', details: errors }, { status: 400 });
  }

  const db = getDb();

  // 1. Upsert into inbody_scans
  const { data: scanData, error: scanError } = await db
    .from('inbody_scans')
    .upsert(scanPayloads, { onConflict: 'user_id,measured_at' })
    .select('logged_date, weight_lbs, body_fat_pct, skeletal_muscle_mass_lbs, bmi, measured_at');

  if (scanError) {
    return NextResponse.json({ error: scanError.message }, { status: 500 });
  }

  // 2. Sync core fields to user_health_metrics (source='inbody').
  //    For days with multiple scans, use the latest measured_at.
  const latestByDate = new Map<string, typeof scanData[0]>();
  for (const scan of (scanData ?? [])) {
    const existing = latestByDate.get(scan.logged_date);
    if (!existing || scan.measured_at > existing.measured_at) {
      latestByDate.set(scan.logged_date, scan);
    }
  }

  const metricPayloads = Array.from(latestByDate.values())
    .filter((s) => s.weight_lbs || s.body_fat_pct || s.skeletal_muscle_mass_lbs || s.bmi)
    .map((s) => ({
      user_id: user.id,
      logged_date: s.logged_date,
      source: 'inbody',
      ...(s.weight_lbs != null && { weight_lbs: s.weight_lbs }),
      ...(s.body_fat_pct != null && { body_fat_pct: s.body_fat_pct }),
      ...(s.skeletal_muscle_mass_lbs != null && { muscle_mass_lbs: s.skeletal_muscle_mass_lbs }),
      ...(s.bmi != null && { bmi: s.bmi }),
    }));

  let updatedHealthMetrics = 0;
  if (metricPayloads.length > 0) {
    const { data: hmData } = await db
      .from('user_health_metrics')
      .upsert(metricPayloads, { onConflict: 'user_id,logged_date,source' })
      .select('logged_date');
    updatedHealthMetrics = hmData?.length ?? 0;
  }

  return NextResponse.json({
    imported: scanData?.length ?? 0,
    updated_health_metrics: updatedHealthMetrics,
    skipped: rows.length - scanPayloads.length,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
  });
}
