// app/api/ai/correlations/route.ts
// GET: compute correlations between health/productivity metrics,
//      generate AI insights via Gemini, return data points for scatter plots.

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const json = await res.json() as { candidates: { content: { parts: { text: string }[] } }[] };
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
}

// ── Pearson correlation ──────────────────────────────────

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 5) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : Math.round((num / denom) * 1000) / 1000;
}

// ── Types ────────────────────────────────────────────────

interface DayData {
  date: string;
  sleep_hours: number | null;
  steps: number | null;
  energy_rating: number | null;
  focus_minutes: number;
  pain_intensity: number | null;
  green_meal_ratio: number | null;
  resting_hr: number | null;
}

interface CorrelationPair {
  metric_a: string;
  metric_b: string;
  label_a: string;
  label_b: string;
  coefficient: number;
  sample_size: number;
  points: { x: number; y: number }[];
}

// ── GET ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const days = parseInt(request.nextUrl.searchParams.get('days') || '30', 10);
  const validDays = [7, 30, 90].includes(days) ? days : 30;

  const since = new Date();
  since.setDate(since.getDate() - validDays);
  const sinceStr = since.toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];

  const db = getDb();

  // Fetch all data sources in parallel
  const [healthRes, logsRes, focusRes, mealsRes] = await Promise.all([
    db.from('user_health_metrics')
      .select('logged_date, sleep_hours, steps, resting_hr, activity_min, recovery_score')
      .eq('user_id', user.id)
      .gte('logged_date', sinceStr)
      .lte('logged_date', todayStr),

    db.from('daily_logs')
      .select('date, energy_rating, pain_intensity')
      .eq('user_id', user.id)
      .gte('date', sinceStr)
      .lte('date', todayStr),

    db.from('focus_sessions')
      .select('start_time, duration, net_work_duration')
      .eq('user_id', user.id)
      .gte('start_time', sinceStr + 'T00:00:00')
      .lte('start_time', todayStr + 'T23:59:59')
      .not('end_time', 'is', null),

    db.from('meal_logs')
      .select('date, protocols(ncv_score)')
      .eq('user_id', user.id)
      .gte('date', sinceStr)
      .lte('date', todayStr),
  ]);

  // Build per-day map
  const dayMap = new Map<string, DayData>();

  const getDay = (date: string): DayData => {
    if (!dayMap.has(date)) {
      dayMap.set(date, { date, sleep_hours: null, steps: null, energy_rating: null, focus_minutes: 0, pain_intensity: null, green_meal_ratio: null, resting_hr: null });
    }
    return dayMap.get(date)!;
  };

  for (const h of healthRes.data ?? []) {
    const d = getDay(h.logged_date);
    d.sleep_hours = h.sleep_hours;
    d.steps = h.steps;
    d.resting_hr = h.resting_hr;
  }

  for (const l of logsRes.data ?? []) {
    const d = getDay(l.date);
    d.energy_rating = l.energy_rating;
    d.pain_intensity = l.pain_intensity;
  }

  for (const f of focusRes.data ?? []) {
    const date = f.start_time.split('T')[0];
    const d = getDay(date);
    const mins = (f.net_work_duration || f.duration || 0) / 60;
    d.focus_minutes += mins;
  }

  // Meal NCV ratios per day
  const mealsByDay = new Map<string, { green: number; total: number }>();
  for (const m of mealsRes.data ?? []) {
    if (!mealsByDay.has(m.date)) mealsByDay.set(m.date, { green: 0, total: 0 });
    const md = mealsByDay.get(m.date)!;
    md.total++;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proto = Array.isArray((m as any).protocols) ? (m as any).protocols[0] : (m as any).protocols;
    if (proto?.ncv_score === 'Green') md.green++;
  }
  for (const [date, counts] of mealsByDay) {
    const d = getDay(date);
    d.green_meal_ratio = counts.total > 0 ? Math.round((counts.green / counts.total) * 100) : null;
  }

  const allDays = [...dayMap.values()];

  // Define correlation pairs to check
  const pairDefs: { a: keyof DayData; b: keyof DayData; labelA: string; labelB: string }[] = [
    { a: 'sleep_hours', b: 'energy_rating', labelA: 'Sleep Hours', labelB: 'Energy Rating' },
    { a: 'steps', b: 'energy_rating', labelA: 'Daily Steps', labelB: 'Energy Rating' },
    { a: 'pain_intensity', b: 'focus_minutes', labelA: 'Pain Intensity', labelB: 'Focus Minutes' },
    { a: 'green_meal_ratio', b: 'energy_rating', labelA: 'Green Meal %', labelB: 'Energy Rating' },
    { a: 'sleep_hours', b: 'focus_minutes', labelA: 'Sleep Hours', labelB: 'Focus Minutes' },
    { a: 'resting_hr', b: 'energy_rating', labelA: 'Resting HR', labelB: 'Energy Rating' },
  ];

  const pairs: CorrelationPair[] = [];

  for (const def of pairDefs) {
    const valid = allDays.filter((d) => d[def.a] != null && d[def.b] != null && d[def.a] !== 0 && d[def.b] !== 0);
    if (valid.length < 5) continue;

    const xs = valid.map((d) => Number(d[def.a]));
    const ys = valid.map((d) => Number(d[def.b]));
    const coeff = pearson(xs, ys);

    if (Math.abs(coeff) >= 0.15) {
      pairs.push({
        metric_a: def.a,
        metric_b: def.b,
        label_a: def.labelA,
        label_b: def.labelB,
        coefficient: coeff,
        sample_size: valid.length,
        points: valid.map((d) => ({ x: Number(d[def.a]), y: Number(d[def.b]) })),
      });
    }
  }

  // Sort by absolute coefficient (strongest first)
  pairs.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));

  // Generate AI insights
  let insights: string[] = [];
  if (pairs.length > 0) {
    const summaryForAI = pairs.slice(0, 4).map((p) => (
      `${p.label_a} ↔ ${p.label_b}: r=${p.coefficient} (${p.sample_size} days)`
    )).join('\n');

    const prompt = `You are a longevity data analyst on CentenarianOS.
Given these Pearson correlations from a user's ${validDays}-day health and productivity data:

${summaryForAI}

Write exactly 3 practical insights in plain language. Each insight should:
- Reference specific metrics and their relationship
- Explain what it means for the user's daily habits
- Suggest one actionable change

Return a JSON array of 3 strings. Example: ["On days when you slept 7+ hours, your energy was 23% higher.", ...]`;

    try {
      const raw = await callGemini(prompt);
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) insights = parsed.slice(0, 3);
    } catch {
      insights = ['Not enough data patterns to generate insights yet.'];
    }
  }

  return NextResponse.json({ pairs, insights, days: validDays });
}
