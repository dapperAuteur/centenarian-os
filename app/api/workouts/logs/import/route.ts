// app/api/workouts/logs/import/route.ts
// POST: bulk import workout logs from parsed CSV rows
// Groups rows by (name + date) → one workout_log per group, with exercises as child rows.

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

interface ParsedExercise {
  name: string;
  sets_completed: number | null;
  reps_completed: number | null;
  weight_lbs: number | null;
  duration_sec: number | null;
  rest_sec: number | null;
  rpe: number | null;
  tempo: string | null;
  percent_of_max: number | null;
  distance_miles: number | null;
  hold_sec: number | null;
  phase: string | null;
  side: string | null;
  feeling: number | null;
  is_circuit: boolean;
  is_negative: boolean;
  is_isometric: boolean;
  to_failure: boolean;
  is_superset: boolean;
  superset_group: number | null;
  is_balance: boolean;
  is_unilateral: boolean;
  notes: string | null;
}

interface ParsedRow {
  name: string;
  date: string;
  duration_min: number | null;
  purpose: string[];
  overall_feeling: number | null;
  notes: string | null;
  exercise: ParsedExercise | null;
}

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

  // Parse and validate rows
  const parsed: ParsedRow[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Validate required: name
    const name = row.name?.trim();
    if (!name) {
      errors.push(`Row ${i + 1}: missing name`);
      skipped++;
      continue;
    }

    // Validate required: date
    if (!row.date || !validateDate(row.date)) {
      errors.push(`Row ${i + 1}: invalid or missing date`);
      skipped++;
      continue;
    }

    const durationMin = row.duration_min ? parseFloat(row.duration_min) : null;
    const exerciseName = row.exercise_name?.trim();
    const parseBool = (v: string | undefined) => v === 'true' || v === '1' || v === 'yes';
    const parseNum = (v: string | undefined) => v ? parseFloat(v) : null;
    const parseInt10 = (v: string | undefined) => v ? parseInt(v, 10) : null;

    let exercise: ParsedExercise | null = null;
    if (exerciseName) {
      exercise = {
        name: exerciseName,
        sets_completed: parseInt10(row.sets_completed),
        reps_completed: parseInt10(row.reps_completed),
        weight_lbs: parseNum(row.weight_lbs),
        duration_sec: parseInt10(row.duration_sec),
        rest_sec: parseInt10(row.rest_sec),
        rpe: parseInt10(row.rpe),
        tempo: row.tempo?.trim() || null,
        percent_of_max: parseNum(row.percent_of_max),
        distance_miles: parseNum(row.distance_miles),
        hold_sec: parseInt10(row.hold_sec),
        phase: row.phase?.trim() || null,
        side: row.side?.trim() || null,
        feeling: parseInt10(row.feeling),
        is_circuit: parseBool(row.is_circuit),
        is_negative: parseBool(row.is_negative),
        is_isometric: parseBool(row.is_isometric),
        to_failure: parseBool(row.to_failure),
        is_superset: parseBool(row.is_superset),
        superset_group: parseInt10(row.superset_group),
        is_balance: parseBool(row.is_balance),
        is_unilateral: parseBool(row.is_unilateral),
        notes: row.notes?.trim() || null,
      };
    }

    const purpose = row.purpose ? row.purpose.split(';').map((s: string) => s.trim()).filter(Boolean) : [];
    const overallFeeling = parseInt10(row.overall_feeling);

    parsed.push({
      name,
      date: row.date,
      duration_min: durationMin && !isNaN(durationMin) ? durationMin : null,
      purpose,
      overall_feeling: overallFeeling && !isNaN(overallFeeling) ? overallFeeling : null,
      notes: !exerciseName ? (row.notes?.trim() || null) : null,
      exercise,
    });
  }

  if (parsed.length === 0) {
    return NextResponse.json({ error: 'No valid rows', details: errors.slice(0, 10) }, { status: 400 });
  }

  // Group rows by (name + date) → one workout_log per group
  const groupKey = (name: string, date: string) => `${name.toLowerCase()}::${date}`;
  const groups = new Map<string, {
    name: string;
    date: string;
    duration_min: number | null;
    purpose: string[];
    overall_feeling: number | null;
    notes: string | null;
    exercises: ParsedExercise[];
  }>();

  for (const p of parsed) {
    const key = groupKey(p.name, p.date);
    const existing = groups.get(key);

    if (existing) {
      if (!existing.duration_min && p.duration_min) existing.duration_min = p.duration_min;
      if (!existing.notes && p.notes) existing.notes = p.notes;
      if (p.purpose.length > 0 && existing.purpose.length === 0) existing.purpose = p.purpose;
      if (!existing.overall_feeling && p.overall_feeling) existing.overall_feeling = p.overall_feeling;
      if (p.exercise) existing.exercises.push(p.exercise);
    } else {
      groups.set(key, {
        name: p.name,
        date: p.date,
        duration_min: p.duration_min,
        purpose: p.purpose,
        overall_feeling: p.overall_feeling,
        notes: p.notes,
        exercises: p.exercise ? [p.exercise] : [],
      });
    }
  }

  // Insert workout_logs and their exercises
  let imported = 0;

  for (const group of groups.values()) {
    const { data: log, error: logErr } = await db
      .from('workout_logs')
      .insert({
        user_id: user.id,
        name: group.name,
        date: group.date,
        duration_min: group.duration_min,
        notes: group.notes,
        purpose: group.purpose.length > 0 ? group.purpose : [],
        overall_feeling: group.overall_feeling,
      })
      .select('id')
      .single();

    if (logErr || !log) {
      errors.push(`Failed to insert workout "${group.name}" on ${group.date}: ${logErr?.message}`);
      continue;
    }

    // Insert exercises
    if (group.exercises.length > 0) {
      const exerciseRows = group.exercises.map((ex, i) => ({
        log_id: log.id,
        name: ex.name,
        sets_completed: ex.sets_completed,
        reps_completed: ex.reps_completed,
        weight_lbs: ex.weight_lbs,
        duration_sec: ex.duration_sec,
        rest_sec: ex.rest_sec ?? 60,
        sort_order: i,
        notes: ex.notes,
        rpe: ex.rpe,
        tempo: ex.tempo,
        percent_of_max: ex.percent_of_max,
        distance_miles: ex.distance_miles,
        hold_sec: ex.hold_sec,
        phase: ex.phase,
        side: ex.side,
        feeling: ex.feeling,
        is_circuit: ex.is_circuit,
        is_negative: ex.is_negative,
        is_isometric: ex.is_isometric,
        to_failure: ex.to_failure,
        is_superset: ex.is_superset,
        superset_group: ex.superset_group,
        is_balance: ex.is_balance,
        is_unilateral: ex.is_unilateral,
      }));

      const { error: exErr } = await db
        .from('workout_log_exercises')
        .insert(exerciseRows);

      if (exErr) {
        errors.push(`Exercises for "${group.name}" on ${group.date}: ${exErr.message}`);
      }
    }

    imported++;
  }

  return NextResponse.json({
    imported,
    skipped,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    message: `Imported ${imported} workout logs from ${parsed.length} rows. ${skipped > 0 ? `${skipped} skipped.` : ''}`,
  });
}
