// app/api/workouts/feedback/route.ts
// POST: submit post-workout feedback
// GET: get user's own feedback history

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const VALID_CATEGORIES = ['AM', 'PM', 'WORKOUT_HOTEL', 'WORKOUT_GYM', 'friction', 'general'] as const;
const VALID_DURATIONS = ['5', '15', '30', '45', '60'] as const;
const VALID_DIFFICULTIES = ['easier', 'just-right', 'harder'] as const;
const VALID_INSTRUCTION_PREFS = ['text-is-fine', 'need-images', 'need-video'] as const;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    workout_log_id,
    activity_category,
    activity_duration,
    friction_scenario_index,
    mood_before,
    mood_after,
    difficulty,
    instruction_preference,
    feedback,
    email,
    protocol_version,
  } = body;

  // Validation
  if (!activity_category || !VALID_CATEGORIES.includes(activity_category)) {
    return NextResponse.json({ error: 'Invalid activity_category' }, { status: 400 });
  }
  if (!mood_before || mood_before < 1 || mood_before > 5) {
    return NextResponse.json({ error: 'mood_before must be 1-5' }, { status: 400 });
  }
  if (!mood_after || mood_after < 1 || mood_after > 5) {
    return NextResponse.json({ error: 'mood_after must be 1-5' }, { status: 400 });
  }
  if (!difficulty || !VALID_DIFFICULTIES.includes(difficulty)) {
    return NextResponse.json({ error: 'Invalid difficulty' }, { status: 400 });
  }
  if (!instruction_preference || !VALID_INSTRUCTION_PREFS.includes(instruction_preference)) {
    return NextResponse.json({ error: 'Invalid instruction_preference' }, { status: 400 });
  }

  // Rate limit: max 10 submissions per user per day
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const { count } = await db
    .from('workout_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('submitted_at', `${today}T00:00:00Z`);

  if ((count ?? 0) >= 10) {
    return NextResponse.json({ error: 'Daily feedback limit reached' }, { status: 429 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? null;
  const userAgent = request.headers.get('user-agent') ?? null;

  const { data, error } = await db
    .from('workout_feedback')
    .insert({
      user_id: user.id,
      workout_log_id: workout_log_id ?? null,
      activity_category,
      activity_duration: activity_duration && VALID_DURATIONS.includes(activity_duration) ? activity_duration : null,
      friction_scenario_index: friction_scenario_index ?? null,
      mood_before: Number(mood_before),
      mood_after: Number(mood_after),
      difficulty,
      instruction_preference,
      feedback: feedback ?? null,
      email: email ?? null,
      protocol_version: protocol_version ?? '1.1',
      ip_address: ip,
      user_agent: userAgent,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, id: data.id });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data, error } = await db
    .from('workout_feedback')
    .select('*')
    .eq('user_id', user.id)
    .order('submitted_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
