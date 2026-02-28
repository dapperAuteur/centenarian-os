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

interface ParsedRow {
  name: string;
  date: string;
  duration_min: number | null;
  notes: string | null;
  exercise: {
    name: string;
    sets_completed: number | null;
    reps_completed: number | null;
    weight_lbs: number | null;
    duration_sec: number | null;
    notes: string | null;
  } | null;
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

    let exercise: ParsedRow['exercise'] = null;
    if (exerciseName) {
      exercise = {
        name: exerciseName,
        sets_completed: row.sets_completed ? parseInt(row.sets_completed, 10) : null,
        reps_completed: row.reps_completed ? parseInt(row.reps_completed, 10) : null,
        weight_lbs: row.weight_lbs ? parseFloat(row.weight_lbs) : null,
        duration_sec: row.duration_sec ? parseInt(row.duration_sec, 10) : null,
        notes: row.notes?.trim() || null,
      };
    }

    parsed.push({
      name,
      date: row.date,
      duration_min: durationMin && !isNaN(durationMin) ? durationMin : null,
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
    notes: string | null;
    exercises: NonNullable<ParsedRow['exercise']>[];
  }>();

  for (const p of parsed) {
    const key = groupKey(p.name, p.date);
    const existing = groups.get(key);

    if (existing) {
      // Take the first non-null duration_min
      if (!existing.duration_min && p.duration_min) {
        existing.duration_min = p.duration_min;
      }
      // Take the first non-null notes (at workout level)
      if (!existing.notes && p.notes) {
        existing.notes = p.notes;
      }
      if (p.exercise) {
        existing.exercises.push(p.exercise);
      }
    } else {
      groups.set(key, {
        name: p.name,
        date: p.date,
        duration_min: p.duration_min,
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
        sort_order: i,
        notes: ex.notes,
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
