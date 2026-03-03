// app/api/exercises/export/route.ts
// GET: export exercise library as CSV

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildCsvResponse } from '@/lib/csv/helpers';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('exercises')
    .select('*, exercise_categories(name)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows: string[][] = (data || []).map((ex) => [
    ex.name || '',
    (ex.exercise_categories as { name: string } | null)?.name || '',
    ex.instructions || '',
    ex.form_cues || '',
    ex.video_url || '',
    (ex.primary_muscles || []).join(';'),
    String(ex.default_sets ?? ''),
    String(ex.default_reps ?? ''),
    String(ex.default_weight_lbs ?? ''),
    String(ex.default_duration_sec ?? ''),
    String(ex.default_rest_sec ?? ''),
    ex.notes || '',
  ]);

  return buildCsvResponse(
    ['Name', 'Category', 'Instructions', 'Form Cues', 'Video URL', 'Primary Muscles', 'Default Sets', 'Default Reps', 'Default Weight lbs', 'Default Duration Sec', 'Default Rest Sec', 'Notes'],
    rows,
    'centenarianos-exercises-export.csv',
  );
}
