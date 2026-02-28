// app/api/workouts/logs/export/route.ts
// GET: export workout logs (denormalized with exercises) as CSV

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildCsvResponse } from '@/lib/csv/helpers';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const from = params.get('from');
  const to = params.get('to');

  let query = supabase
    .from('workout_logs')
    .select('*, workout_log_exercises(*)')
    .order('date', { ascending: true });

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows: string[][] = [];

  for (const log of data || []) {
    const exercises = log.workout_log_exercises as Array<{
      name: string | null;
      sets_completed: number | null;
      reps_completed: number | null;
      weight_lbs: number | null;
      duration_sec: number | null;
      notes: string | null;
    }> | null;

    if (exercises && exercises.length > 0) {
      for (const ex of exercises) {
        rows.push([
          log.date || '',
          log.name || '',
          String(log.duration_min ?? ''),
          ex.name || '',
          String(ex.sets_completed ?? ''),
          String(ex.reps_completed ?? ''),
          String(ex.weight_lbs ?? ''),
          String(ex.duration_sec ?? ''),
          ex.notes || '',
        ]);
      }
    } else {
      rows.push([
        log.date || '',
        log.name || '',
        String(log.duration_min ?? ''),
        '',
        '',
        '',
        '',
        '',
        log.notes || '',
      ]);
    }
  }

  return buildCsvResponse(
    ['Date', 'Workout Name', 'Duration Min', 'Exercise', 'Sets', 'Reps', 'Weight lbs', 'Duration Sec', 'Notes'],
    rows,
    'centenarianos-workouts-export.csv',
  );
}
