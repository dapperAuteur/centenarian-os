// app/api/ai/weekly-review/route.ts
// GET: fetch past reviews (archive list or single review)
// POST: generate a weekly review via Gemini AI

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const GEMINI_MODEL = 'gemini-2.5-flash';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GEMINI_API_KEY not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
  });
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const json = await res.json() as { candidates: { content: { parts: { text: string }[] } }[] };
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ── Helpers ──────────────────────────────────────────────

function avg(rows: Record<string, unknown>[], key: string): number | null {
  const vals = rows
    .map((r) => r[key])
    .filter((v): v is number => typeof v === 'number');
  if (!vals.length) return null;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
}

function sum(rows: Record<string, unknown>[], key: string): number {
  return rows.reduce((s, r) => s + (typeof r[key] === 'number' ? (r[key] as number) : 0), 0);
}

function isMonday(dateStr: string): boolean {
  return new Date(dateStr + 'T12:00:00Z').getUTCDay() === 1;
}

function weekEndDate(weekStart: string): string {
  const d = new Date(weekStart + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().split('T')[0];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildWeekSummary(data: { health: any[]; focus: any[]; meals: any[]; tasks: any[]; lessons: any[]; logs: any[]; trips: any[]; fuel: any[] }) {
  const greenMeals = data.meals.filter((m) => {
    const p = Array.isArray(m.protocols) ? m.protocols[0] : m.protocols;
    return p?.ncv_score === 'Green';
  }).length;
  const yellowMeals = data.meals.filter((m) => {
    const p = Array.isArray(m.protocols) ? m.protocols[0] : m.protocols;
    return p?.ncv_score === 'Yellow';
  }).length;
  const redMeals = data.meals.filter((m) => {
    const p = Array.isArray(m.protocols) ? m.protocols[0] : m.protocols;
    return p?.ncv_score === 'Red';
  }).length;

  const courseSet = new Set<string>();
  for (const lp of data.lessons) {
    const lesson = Array.isArray(lp.lessons) ? lp.lessons[0] : lp.lessons;
    const course = lesson?.courses;
    const c = Array.isArray(course) ? course[0] : course;
    if (c?.title) courseSet.add(c.title);
  }

  const completedTasks = data.tasks.filter((t) => t.completed);

  return {
    health: {
      days_logged: data.health.length,
      avg_steps: avg(data.health, 'steps'),
      avg_sleep_hours: avg(data.health, 'sleep_hours'),
      avg_resting_hr: avg(data.health, 'resting_hr'),
      avg_activity_min: avg(data.health, 'activity_min'),
      avg_recovery_score: avg(data.health, 'recovery_score'),
      avg_hrv_ms: avg(data.health, 'hrv_ms'),
    },
    focus: {
      total_sessions: data.focus.length,
      total_minutes: Math.round(sum(data.focus, 'net_work_duration') / 60) || Math.round(sum(data.focus, 'duration') / 60),
      avg_quality: avg(data.focus, 'quality_rating'),
      total_revenue: Math.round(sum(data.focus, 'revenue') * 100) / 100,
    },
    nutrition: {
      total_meals: data.meals.length,
      green_meals: greenMeals,
      yellow_meals: yellowMeals,
      red_meals: redMeals,
      restaurant_meals: data.meals.filter((m) => m.is_restaurant_meal).length,
    },
    tasks: {
      total: data.tasks.length,
      completed: completedTasks.length,
      completion_rate: data.tasks.length > 0
        ? Math.round((completedTasks.length / data.tasks.length) * 100)
        : null,
    },
    learning: {
      lessons_completed: data.lessons.filter((lp) => lp.completed_at).length,
      total_watch_minutes: Math.round(sum(data.lessons, 'watch_seconds') / 60),
      courses_studied: [...courseSet],
    },
    daily_logs: {
      days_logged: data.logs.length,
      avg_energy: avg(data.logs, 'energy_rating'),
      wins: data.logs.filter((d) => d.biggest_win).map((d) => d.biggest_win as string),
      challenges: data.logs.filter((d) => d.biggest_challenge).map((d) => d.biggest_challenge as string),
      avg_pain: avg(data.logs.filter((d) => d.pain_intensity != null), 'pain_intensity'),
      total_spent: sum(data.logs, 'total_spent'),
      total_earned: sum(data.logs, 'total_earned'),
    },
    travel: (() => {
      const bikeMiles = data.trips.filter((t) => t.mode === 'bike').reduce((s: number, t) => s + (Number(t.distance_miles) || 0), 0);
      const bikeCommuteDays = data.trips.filter((t) => t.mode === 'bike' && t.purpose === 'commute').length;
      const bikeCals = data.trips.filter((t) => t.mode === 'bike').reduce((s: number, t) => s + (Number(t.calories_burned) || 0), 0);
      const carMiles = data.trips.filter((t) => t.mode === 'car').reduce((s: number, t) => s + (Number(t.distance_miles) || 0), 0);
      const co2Saved = Math.round(bikeMiles * 0.170 * 10) / 10;
      const fuelSpend = data.fuel.reduce((s: number, f) => s + (Number(f.total_cost) || 0), 0);
      const modeBreakdown: Record<string, number> = {};
      for (const t of data.trips) {
        modeBreakdown[t.mode] = (modeBreakdown[t.mode] || 0) + (Number(t.distance_miles) || 0);
      }
      return {
        total_trips: data.trips.length,
        bike_miles: Math.round(bikeMiles * 10) / 10,
        bike_commute_days: bikeCommuteDays,
        bike_calories_burned: bikeCals,
        car_miles: Math.round(carMiles * 10) / 10,
        co2_saved_kg_by_biking: co2Saved,
        fuel_spend: Math.round(fuelSpend * 100) / 100,
        mode_breakdown: modeBreakdown,
      };
    })(),
  };
}

// ── GET ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const url = request.nextUrl;

  // Archive list (lightweight, no content)
  if (url.searchParams.get('all') === 'true') {
    const { data, error } = await db
      .from('weekly_reviews')
      .select('id, week_start, created_at, updated_at')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  // Single week
  const weekStart = url.searchParams.get('week_start');
  if (weekStart) {
    const { data, error } = await db
      .from('weekly_reviews')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start', weekStart)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Most recent
  const { data, error } = await db
    .from('weekly_reviews')
    .select('*')
    .eq('user_id', user.id)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ── POST ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const weekStart = body.week_start as string | undefined;

  if (!weekStart || !isMonday(weekStart)) {
    return NextResponse.json({ error: 'week_start must be a Monday (YYYY-MM-DD)' }, { status: 400 });
  }

  // Don't allow future weeks
  const today = new Date().toISOString().split('T')[0];
  if (weekStart > today) {
    return NextResponse.json({ error: 'Cannot generate review for a future week' }, { status: 400 });
  }

  const db = getDb();
  const weekEnd = weekEndDate(weekStart);

  // Aggregate data from 8 sources in parallel
  const [healthRes, focusRes, mealsRes, tasksRes, lessonsRes, logsRes, tripsRes, fuelRes] = await Promise.all([
    // 1. Health metrics
    db.from('user_health_metrics')
      .select('logged_date, resting_hr, steps, sleep_hours, activity_min, sleep_score, hrv_ms, recovery_score, stress_score')
      .eq('user_id', user.id)
      .gte('logged_date', weekStart)
      .lte('logged_date', weekEnd)
      .order('logged_date'),

    // 2. Focus sessions
    db.from('focus_sessions')
      .select('start_time, duration, net_work_duration, quality_rating, tags, revenue')
      .eq('user_id', user.id)
      .gte('start_time', weekStart + 'T00:00:00')
      .lte('start_time', weekEnd + 'T23:59:59')
      .not('end_time', 'is', null),

    // 3. Meals + protocol NCV
    db.from('meal_logs')
      .select('date, meal_type, is_restaurant_meal, protocols(ncv_score, total_calories, total_protein)')
      .eq('user_id', user.id)
      .gte('date', weekStart)
      .lte('date', weekEnd),

    // 4. Tasks — use user's auth client so RLS scopes via milestones→goals→roadmaps
    supabase.from('tasks')
      .select('date, completed, priority, activity')
      .gte('date', weekStart)
      .lte('date', weekEnd)
      .eq('status', 'active'),

    // 5. Lesson progress
    db.from('lesson_progress')
      .select('completed_at, watch_seconds, lessons(title, courses(title))')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .gte('completed_at', weekStart + 'T00:00:00')
      .lte('completed_at', weekEnd + 'T23:59:59'),

    // 6. Daily logs
    db.from('daily_logs')
      .select('date, energy_rating, biggest_win, biggest_challenge, pain_intensity, total_spent, total_earned')
      .eq('user_id', user.id)
      .gte('date', weekStart)
      .lte('date', weekEnd)
      .order('date'),

    // 7. Trips
    db.from('trips')
      .select('date, mode, distance_miles, duration_min, calories_burned, co2_kg, purpose')
      .eq('user_id', user.id)
      .gte('date', weekStart)
      .lte('date', weekEnd),

    // 8. Fuel logs
    db.from('fuel_logs')
      .select('date, total_cost, gallons, mpg_display, mpg_calculated')
      .eq('user_id', user.id)
      .gte('date', weekStart)
      .lte('date', weekEnd),
  ]);

  const summary = buildWeekSummary({
    health: healthRes.data ?? [],
    focus: focusRes.data ?? [],
    meals: mealsRes.data ?? [],
    tasks: tasksRes.data ?? [],
    lessons: lessonsRes.data ?? [],
    logs: logsRes.data ?? [],
    trips: tripsRes.data ?? [],
    fuel: fuelRes.data ?? [],
  });

  const prompt = `You are a longevity coach on CentenarianOS, a health and longevity platform.
Based on this week's data (${weekStart} to ${weekEnd}), write an encouraging, personalized weekly review (300–450 words).

Cover these areas:
1. Energy & Recovery — sleep hours, resting heart rate, HRV, recovery scores, energy ratings, pain levels
2. Focus & Productivity — deep work sessions, quality ratings, task completion rate, revenue generated
3. Nutrition Consistency — meal logging frequency, NCV score distribution (Green/Yellow/Red = healthy/moderate/poor), restaurant vs home meals
4. Travel & Movement — miles by mode (bike, car, etc.), bike commute days, calories burned commuting, CO2 saved by biking, fuel costs if any
5. Learning Progress — lessons completed, courses studied, watch time
6. One Recommended Focus for Next Week — based on the weakest area or biggest opportunity

Here is the user's aggregated data for the week:
${JSON.stringify(summary, null, 2)}

Guidelines:
- Be encouraging but honest about areas needing improvement
- Reference specific numbers from the data
- For travel: highlight how bike commuting contributes to fitness and savings; if no trips logged, skip this section
- If a category has no data (null values or zero counts), briefly note it and suggest the user start tracking it
- Keep the tone warm and coach-like, like a supportive mentor
- Use plain text with line breaks between sections — do NOT use markdown headers or formatting
- End with one clear, actionable focus for next week`;

  try {
    const reviewText = await callGemini(prompt);

    if (!reviewText.trim()) {
      return NextResponse.json({ error: 'Failed to generate review — empty response' }, { status: 502 });
    }

    const { data: review, error } = await db
      .from('weekly_reviews')
      .upsert(
        { user_id: user.id, week_start: weekStart, content: reviewText.trim() },
        { onConflict: 'user_id,week_start' },
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(review);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to generate review: ${message}` }, { status: 502 });
  }
}
