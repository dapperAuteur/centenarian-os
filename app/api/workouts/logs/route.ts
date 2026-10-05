// app/api/workouts/logs/route.ts
// GET: list workout log history
// POST: log a workout (optionally from template)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createWorkoutLog } from '@/lib/capture/create-record';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 50), 100);
  const offset = Number(request.nextUrl.searchParams.get('offset') ?? 0);

  const { data, error } = await db
    .from('workout_logs')
    .select('*, workout_log_exercises(*)')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // The rules (which template / exercise / equipment ids are kept, use counts) live in
  // lib/capture/create-record.ts, shared with the Google Calendar sync.
  const body = await request.json();
  const result = await createWorkoutLog(getDb(), user.id, body ?? {});
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.value, { status: 201 });
}
