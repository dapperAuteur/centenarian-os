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
  const purposeStr = (p: unknown) => Array.isArray(p) ? (p as string[]).join(';') : '';

  for (const log of data || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exercises = log.workout_log_exercises as any[] | null;

    if (exercises && exercises.length > 0) {
      for (const ex of exercises) {
        rows.push([
          log.date || '',
          log.name || '',
          String(log.duration_min ?? ''),
          purposeStr(log.purpose),
          String(log.overall_feeling ?? ''),
          ex.name || '',
          String(ex.sets_completed ?? ''),
          String(ex.reps_completed ?? ''),
          String(ex.weight_lbs ?? ''),
          String(ex.duration_sec ?? ''),
          String(ex.rest_sec ?? ''),
          String(ex.rpe ?? ''),
          ex.tempo || '',
          String(ex.percent_of_max ?? ''),
          String(ex.distance_miles ?? ''),
          String(ex.hold_sec ?? ''),
          ex.phase || '',
          ex.side || '',
          String(ex.feeling ?? ''),
          ex.is_circuit ? 'true' : '',
          ex.is_negative ? 'true' : '',
          ex.is_isometric ? 'true' : '',
          ex.to_failure ? 'true' : '',
          ex.is_superset ? 'true' : '',
          String(ex.superset_group ?? ''),
          ex.is_balance ? 'true' : '',
          ex.is_unilateral ? 'true' : '',
          ex.notes || '',
        ]);
      }
    } else {
      rows.push([
        log.date || '',
        log.name || '',
        String(log.duration_min ?? ''),
        purposeStr(log.purpose),
        String(log.overall_feeling ?? ''),
        '', '', '', '', '', '', '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', '',
        log.notes || '',
      ]);
    }
  }

  return buildCsvResponse(
    [
      'Date', 'Workout Name', 'Duration Min', 'Purpose', 'Overall Feeling',
      'Exercise', 'Sets', 'Reps', 'Weight lbs', 'Duration Sec', 'Rest Sec',
      'RPE', 'Tempo', 'Percent of Max', 'Distance Miles', 'Hold Sec',
      'Phase', 'Side', 'Feeling',
      'Circuit', 'Negative', 'Isometric', 'To Failure', 'Superset', 'Superset Group',
      'Balance', 'Unilateral', 'Notes',
    ],
    rows,
    'centenarianos-workouts-export.csv',
  );
}
