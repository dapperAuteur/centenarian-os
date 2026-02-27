// lib/gemini/data-fetchers.ts
// Data fetcher layer for Gem AI Mode.
// Each fetcher queries one data module and returns a plain-text summary
// suitable for injection into a Gemini system instruction.

import { SupabaseClient } from '@supabase/supabase-js';

export type DataSourceKey =
  | 'health'
  | 'finance'
  | 'travel'
  | 'workouts'
  | 'recipes'
  | 'planner'
  | 'academy'
  | 'daily_logs'
  | 'focus'
  | 'meals'
  | 'correlations';

export interface FetcherOptions {
  days?: number; // default 30
}

type DataFetcherFn = (
  db: SupabaseClient,
  userId: string,
  opts: Required<FetcherOptions>,
) => Promise<string>;

const DATA_FETCHERS: Record<DataSourceKey, DataFetcherFn> = {
  health: fetchHealthData,
  finance: fetchFinanceData,
  travel: fetchTravelData,
  workouts: fetchWorkoutData,
  recipes: fetchRecipeData,
  planner: fetchPlannerData,
  academy: fetchAcademyData,
  daily_logs: fetchDailyLogData,
  focus: fetchFocusData,
  meals: fetchMealData,
  correlations: fetchCorrelationData,
};

// ── Main orchestrator ───────────────────────────────────────────────

export async function fetchDataContext(
  db: SupabaseClient,
  userId: string,
  sources: DataSourceKey[],
  opts?: FetcherOptions,
): Promise<string> {
  const resolved: Required<FetcherOptions> = { days: opts?.days ?? 30 };

  const results = await Promise.all(
    sources.map(async (key) => {
      const fetcher = DATA_FETCHERS[key];
      if (!fetcher) return '';
      try {
        return await fetcher(db, userId, resolved);
      } catch (err) {
        console.error(`Data fetcher error [${key}]:`, err);
        return `[${key.toUpperCase()} DATA]: Error loading data.`;
      }
    }),
  );

  return results.filter(Boolean).join('\n\n');
}

// ── Helpers ─────────────────────────────────────────────────────────

function dateRange(days: number): { since: string; today: string } {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - days);
  return {
    since: since.toISOString().split('T')[0],
    today: now.toISOString().split('T')[0],
  };
}

function avg(rows: Record<string, unknown>[], key: string): number | null {
  const vals = rows
    .map((r) => r[key])
    .filter((v): v is number => typeof v === 'number');
  if (!vals.length) return null;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
}

function sum(rows: Record<string, unknown>[], key: string): number {
  return rows.reduce(
    (s, r) => s + (typeof r[key] === 'number' ? (r[key] as number) : 0),
    0,
  );
}

function fmt(n: number | null, decimals = 1): string {
  if (n === null) return 'N/A';
  return n.toFixed(decimals);
}

// ── Individual fetchers ─────────────────────────────────────────────

async function fetchHealthData(
  db: SupabaseClient,
  userId: string,
  opts: Required<FetcherOptions>,
): Promise<string> {
  const { since, today } = dateRange(opts.days);

  const { data: rows } = await db
    .from('user_health_metrics')
    .select(
      'logged_date, resting_hr, steps, sleep_hours, activity_min, hrv_ms, recovery_score, stress_score, weight_lbs, body_fat_pct, muscle_mass_lbs, spo2_pct',
    )
    .eq('user_id', userId)
    .gte('logged_date', since)
    .lte('logged_date', today)
    .order('logged_date', { ascending: false });

  const r = rows ?? [];
  if (!r.length) return `[HEALTH DATA - Last ${opts.days} days]\nNo health metrics logged.`;

  const lines = [
    `[HEALTH DATA - Last ${opts.days} days]`,
    `Days logged: ${r.length}`,
    `Avg RHR: ${fmt(avg(r, 'resting_hr'))} bpm | Avg HRV: ${fmt(avg(r, 'hrv_ms'))} ms`,
    `Avg steps: ${fmt(avg(r, 'steps'), 0)} | Avg activity: ${fmt(avg(r, 'activity_min'), 0)} min`,
    `Avg sleep: ${fmt(avg(r, 'sleep_hours'))} hrs`,
    `Avg recovery: ${fmt(avg(r, 'recovery_score'))} | Avg stress: ${fmt(avg(r, 'stress_score'))}`,
  ];

  const latestWeight = r.find((row) => row.weight_lbs != null);
  if (latestWeight) {
    lines.push(
      `Latest weight: ${latestWeight.weight_lbs} lbs | Body fat: ${latestWeight.body_fat_pct ?? 'N/A'}% | Muscle: ${latestWeight.muscle_mass_lbs ?? 'N/A'} lbs`,
    );
  }

  // Last 5 entries for trend visibility
  lines.push('Recent entries:');
  for (const row of r.slice(0, 5)) {
    const parts = [`  ${row.logged_date}:`];
    if (row.steps != null) parts.push(`steps=${row.steps}`);
    if (row.sleep_hours != null) parts.push(`sleep=${row.sleep_hours}h`);
    if (row.resting_hr != null) parts.push(`rhr=${row.resting_hr}`);
    if (row.hrv_ms != null) parts.push(`hrv=${row.hrv_ms}`);
    lines.push(parts.join(' '));
  }

  return lines.join('\n');
}

async function fetchFinanceData(
  db: SupabaseClient,
  userId: string,
  opts: Required<FetcherOptions>,
): Promise<string> {
  const { since, today } = dateRange(opts.days);

  const [txRes, acctRes, catRes] = await Promise.all([
    db
      .from('financial_transactions')
      .select('amount, type, transaction_date, category_id, vendor, notes')
      .eq('user_id', userId)
      .gte('transaction_date', since)
      .lte('transaction_date', today)
      .order('transaction_date', { ascending: false })
      .limit(200),
    db
      .from('financial_accounts')
      .select('name, account_type, opening_balance, is_active')
      .eq('user_id', userId)
      .eq('is_active', true),
    db
      .from('budget_categories')
      .select('id, name, monthly_budget')
      .eq('user_id', userId),
  ]);

  const txs = txRes.data ?? [];
  const accounts = acctRes.data ?? [];
  const categories = catRes.data ?? [];
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  let totalExpenses = 0;
  let totalIncome = 0;
  const byCat: Record<string, number> = {};

  for (const tx of txs) {
    const amt = parseFloat(tx.amount);
    if (tx.type === 'expense') {
      totalExpenses += amt;
      const catName = catMap.get(tx.category_id) || 'Uncategorized';
      byCat[catName] = (byCat[catName] || 0) + amt;
    } else {
      totalIncome += amt;
    }
  }

  const lines = [
    `[FINANCE DATA - Last ${opts.days} days]`,
    `Transactions: ${txs.length}`,
    `Total income: $${totalIncome.toFixed(2)} | Total expenses: $${totalExpenses.toFixed(2)} | Net: $${(totalIncome - totalExpenses).toFixed(2)}`,
  ];

  // Top spending categories
  const sortedCats = Object.entries(byCat)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);
  if (sortedCats.length) {
    lines.push('Top spending categories:');
    for (const [name, amt] of sortedCats) {
      const budget = categories.find((c) => c.name === name)?.monthly_budget;
      const budgetStr = budget ? ` (budget: $${parseFloat(budget).toFixed(0)})` : '';
      lines.push(`  ${name}: $${amt.toFixed(2)}${budgetStr}`);
    }
  }

  if (accounts.length) {
    lines.push(`Active accounts: ${accounts.map((a) => `${a.name} (${a.account_type})`).join(', ')}`);
  }

  return lines.join('\n');
}

async function fetchTravelData(
  db: SupabaseClient,
  userId: string,
  opts: Required<FetcherOptions>,
): Promise<string> {
  const { since, today } = dateRange(opts.days);

  const [tripRes, fuelRes, vehicleRes] = await Promise.all([
    db
      .from('trips')
      .select('date, mode, distance_miles, duration_min, purpose, trip_category, tax_category, calories_burned')
      .eq('user_id', userId)
      .gte('date', since)
      .lte('date', today)
      .order('date', { ascending: false }),
    db
      .from('fuel_logs')
      .select('date, total_cost, gallons, mpg_display, mpg_calculated')
      .eq('user_id', userId)
      .gte('date', since)
      .lte('date', today),
    db
      .from('vehicles')
      .select('name, year, make, model, active, ownership_type')
      .eq('user_id', userId)
      .eq('active', true),
  ]);

  const trips = tripRes.data ?? [];
  const fuel = fuelRes.data ?? [];
  const vehicles = vehicleRes.data ?? [];

  if (!trips.length && !fuel.length) {
    return `[TRAVEL DATA - Last ${opts.days} days]\nNo travel data logged.`;
  }

  const modeBreakdown: Record<string, { miles: number; count: number }> = {};
  let totalCals = 0;

  for (const t of trips) {
    const mode = t.mode || 'unknown';
    if (!modeBreakdown[mode]) modeBreakdown[mode] = { miles: 0, count: 0 };
    modeBreakdown[mode].miles += Number(t.distance_miles) || 0;
    modeBreakdown[mode].count++;
    totalCals += Number(t.calories_burned) || 0;
  }

  const fuelSpend = fuel.reduce((s, f) => s + (Number(f.total_cost) || 0), 0);
  const avgMpg = avg(fuel as Record<string, unknown>[], 'mpg_calculated');

  const lines = [
    `[TRAVEL DATA - Last ${opts.days} days]`,
    `Total trips: ${trips.length} | Fuel logs: ${fuel.length}`,
  ];

  for (const [mode, data] of Object.entries(modeBreakdown)) {
    lines.push(`  ${mode}: ${data.count} trips, ${data.miles.toFixed(1)} miles`);
  }

  if (totalCals > 0) lines.push(`Calories burned (active transport): ${totalCals}`);
  if (fuelSpend > 0) lines.push(`Fuel spend: $${fuelSpend.toFixed(2)} | Avg MPG: ${fmt(avgMpg)}`);
  if (vehicles.length) {
    lines.push(`Vehicles: ${vehicles.map((v) => `${v.year} ${v.make} ${v.model} (${v.ownership_type})`).join(', ')}`);
  }

  // Tax category breakdown
  const taxCats: Record<string, number> = {};
  for (const t of trips) {
    if (t.tax_category) {
      taxCats[t.tax_category] = (taxCats[t.tax_category] || 0) + (Number(t.distance_miles) || 0);
    }
  }
  if (Object.keys(taxCats).length) {
    lines.push('Mileage by tax category:');
    for (const [cat, miles] of Object.entries(taxCats)) {
      lines.push(`  ${cat}: ${miles.toFixed(1)} miles`);
    }
  }

  return lines.join('\n');
}

async function fetchWorkoutData(
  db: SupabaseClient,
  userId: string,
  opts: Required<FetcherOptions>,
): Promise<string> {
  const { since, today } = dateRange(opts.days);

  const [logRes, templateRes] = await Promise.all([
    db
      .from('workout_logs')
      .select('id, name, date, duration_min, notes, workout_log_exercises(name, sets_completed, reps_completed, weight_lbs)')
      .eq('user_id', userId)
      .gte('date', since)
      .lte('date', today)
      .order('date', { ascending: false })
      .limit(20),
    db
      .from('workout_templates')
      .select('name, category, estimated_duration_min, use_count, workout_template_exercises(name, sets, reps, weight_lbs)')
      .eq('user_id', userId)
      .order('use_count', { ascending: false })
      .limit(10),
  ]);

  const logs = logRes.data ?? [];
  const templates = templateRes.data ?? [];

  if (!logs.length && !templates.length) {
    return `[WORKOUT DATA - Last ${opts.days} days]\nNo workout data.`;
  }

  const lines = [`[WORKOUT DATA - Last ${opts.days} days]`];

  if (logs.length) {
    lines.push(`Sessions logged: ${logs.length}`);
    for (const log of logs.slice(0, 5)) {
      const exercises = (log.workout_log_exercises as { name: string; sets_completed: number; reps_completed: number; weight_lbs: number }[]) ?? [];
      const exSummary = exercises
        .map((e) => {
          const parts = [e.name];
          if (e.sets_completed && e.reps_completed) parts.push(`${e.sets_completed}x${e.reps_completed}`);
          if (e.weight_lbs) parts.push(`@${e.weight_lbs}lb`);
          return parts.join(' ');
        })
        .join(', ');
      lines.push(`  ${log.date} - ${log.name}${log.duration_min ? ` (${log.duration_min}min)` : ''}: ${exSummary || 'no exercises logged'}`);
    }
  }

  if (templates.length) {
    lines.push(`Saved templates: ${templates.length}`);
    for (const t of templates.slice(0, 5)) {
      lines.push(`  ${t.name} (${t.category || 'general'}) - used ${t.use_count}x`);
    }
  }

  return lines.join('\n');
}

async function fetchRecipeData(
  db: SupabaseClient,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _opts: Required<FetcherOptions>,
): Promise<string> {
  const { data: recipes } = await db
    .from('recipes')
    .select('title, description, tags, servings, prep_time_minutes, cook_time_minutes, visibility')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  const r = recipes ?? [];
  if (!r.length) return '[RECIPE DATA]\nNo recipes saved.';

  const lines = [
    `[RECIPE DATA]`,
    `Total recipes (showing last 20): ${r.length}`,
  ];

  for (const recipe of r) {
    const tags = Array.isArray(recipe.tags) ? (recipe.tags as string[]).join(', ') : '';
    lines.push(`  ${recipe.title}${tags ? ` [${tags}]` : ''} - ${recipe.servings || '?'} servings, ${recipe.visibility}`);
  }

  return lines.join('\n');
}

async function fetchPlannerData(
  db: SupabaseClient,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _opts: Required<FetcherOptions>,
): Promise<string> {
  const [goalRes, taskRes] = await Promise.all([
    db
      .from('goals')
      .select('title, status, target_date, milestones(title, status)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(10),
    db
      .from('tasks')
      .select('title, date, completed, priority, activity')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(30),
  ]);

  const goals = goalRes.data ?? [];
  const tasks = taskRes.data ?? [];

  const lines = ['[PLANNER DATA]'];

  if (goals.length) {
    lines.push(`Active goals: ${goals.length}`);
    for (const g of goals) {
      const milestones = (g.milestones as { title: string; status: string }[]) ?? [];
      const completedMs = milestones.filter((m) => m.status === 'completed').length;
      lines.push(`  ${g.title} - ${completedMs}/${milestones.length} milestones done${g.target_date ? `, target: ${g.target_date}` : ''}`);
    }
  } else {
    lines.push('No active goals.');
  }

  if (tasks.length) {
    const completed = tasks.filter((t) => t.completed).length;
    lines.push(`Recent tasks (7d): ${tasks.length} total, ${completed} completed (${tasks.length ? Math.round((completed / tasks.length) * 100) : 0}%)`);
  }

  return lines.join('\n');
}

async function fetchAcademyData(
  db: SupabaseClient,
  userId: string,
  opts: Required<FetcherOptions>,
): Promise<string> {
  const { since } = dateRange(opts.days);

  const [enrollRes, progressRes] = await Promise.all([
    db
      .from('enrollments')
      .select('courses(title, category)')
      .eq('user_id', userId)
      .limit(20),
    db
      .from('lesson_progress')
      .select('completed_at, watch_seconds, lessons(title, courses(title))')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .gte('completed_at', since + 'T00:00:00')
      .order('completed_at', { ascending: false })
      .limit(20),
  ]);

  const enrollments = enrollRes.data ?? [];
  const progress = progressRes.data ?? [];

  if (!enrollments.length && !progress.length) {
    return `[ACADEMY DATA - Last ${opts.days} days]\nNo academy activity.`;
  }

  const lines = [`[ACADEMY DATA - Last ${opts.days} days]`];

  if (enrollments.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const courseNames = enrollments.map((e) => (e.courses as any)?.title).filter(Boolean);
    lines.push(`Enrolled courses: ${courseNames.join(', ')}`);
  }

  if (progress.length) {
    const totalMinutes = Math.round(
      progress.reduce((s, p) => s + (Number(p.watch_seconds) || 0), 0) / 60,
    );
    lines.push(`Lessons completed: ${progress.length} | Watch time: ${totalMinutes} min`);
  }

  return lines.join('\n');
}

async function fetchDailyLogData(
  db: SupabaseClient,
  userId: string,
  opts: Required<FetcherOptions>,
): Promise<string> {
  const { since, today } = dateRange(opts.days);

  const { data: logs } = await db
    .from('daily_logs')
    .select('date, energy_rating, biggest_win, biggest_challenge, pain_intensity, total_spent, total_earned')
    .eq('user_id', userId)
    .gte('date', since)
    .lte('date', today)
    .order('date', { ascending: false });

  const r = logs ?? [];
  if (!r.length) return `[DAILY LOG DATA - Last ${opts.days} days]\nNo daily logs.`;

  const avgEnergy = avg(r as Record<string, unknown>[], 'energy_rating');
  const avgPain = avg(
    r.filter((d) => d.pain_intensity != null) as Record<string, unknown>[],
    'pain_intensity',
  );
  const totalSpent = sum(r as Record<string, unknown>[], 'total_spent');
  const totalEarned = sum(r as Record<string, unknown>[], 'total_earned');
  const wins = r.filter((d) => d.biggest_win).map((d) => d.biggest_win as string);
  const challenges = r.filter((d) => d.biggest_challenge).map((d) => d.biggest_challenge as string);

  const lines = [
    `[DAILY LOG DATA - Last ${opts.days} days]`,
    `Days logged: ${r.length}`,
    `Avg energy: ${fmt(avgEnergy)}/10 | Avg pain: ${fmt(avgPain)}/10`,
    `Total spent: $${totalSpent.toFixed(2)} | Total earned: $${totalEarned.toFixed(2)}`,
  ];

  if (wins.length) lines.push(`Recent wins: ${wins.slice(0, 3).join('; ')}`);
  if (challenges.length) lines.push(`Recent challenges: ${challenges.slice(0, 3).join('; ')}`);

  return lines.join('\n');
}

async function fetchFocusData(
  db: SupabaseClient,
  userId: string,
  opts: Required<FetcherOptions>,
): Promise<string> {
  const { since, today } = dateRange(opts.days);

  const { data: sessions } = await db
    .from('focus_sessions')
    .select('start_time, duration, net_work_duration, quality_rating, tags, revenue')
    .eq('user_id', userId)
    .gte('start_time', since + 'T00:00:00')
    .lte('start_time', today + 'T23:59:59')
    .not('end_time', 'is', null);

  const r = sessions ?? [];
  if (!r.length) return `[FOCUS DATA - Last ${opts.days} days]\nNo focus sessions.`;

  const totalMinutes = Math.round(
    r.reduce((s, f) => s + ((f.net_work_duration || f.duration || 0) / 60), 0),
  );
  const totalRevenue = r.reduce((s, f) => s + (Number(f.revenue) || 0), 0);
  const avgQuality = avg(r as Record<string, unknown>[], 'quality_rating');

  // Tag breakdown
  const tagCounts: Record<string, number> = {};
  for (const s of r) {
    const tags = Array.isArray(s.tags) ? (s.tags as string[]) : [];
    for (const tag of tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  const lines = [
    `[FOCUS DATA - Last ${opts.days} days]`,
    `Sessions: ${r.length} | Total: ${totalMinutes} min | Avg quality: ${fmt(avgQuality)}/5`,
    `Revenue: $${totalRevenue.toFixed(2)}`,
  ];

  if (Object.keys(tagCounts).length) {
    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tag, count]) => `${tag}(${count})`)
      .join(', ');
    lines.push(`Top tags: ${topTags}`);
  }

  return lines.join('\n');
}

async function fetchMealData(
  db: SupabaseClient,
  userId: string,
  opts: Required<FetcherOptions>,
): Promise<string> {
  const { since, today } = dateRange(opts.days);

  const { data: meals } = await db
    .from('meal_logs')
    .select('date, meal_type, is_restaurant_meal, protocols(ncv_score)')
    .eq('user_id', userId)
    .gte('date', since)
    .lte('date', today);

  const r = meals ?? [];
  if (!r.length) return `[MEAL DATA - Last ${opts.days} days]\nNo meals logged.`;

  let green = 0;
  let yellow = 0;
  let red = 0;
  let restaurant = 0;

  for (const m of r) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proto = Array.isArray((m as any).protocols) ? (m as any).protocols[0] : (m as any).protocols;
    if (proto?.ncv_score === 'Green') green++;
    else if (proto?.ncv_score === 'Yellow') yellow++;
    else if (proto?.ncv_score === 'Red') red++;
    if (m.is_restaurant_meal) restaurant++;
  }

  return [
    `[MEAL DATA - Last ${opts.days} days]`,
    `Total meals: ${r.length}`,
    `NCV breakdown: Green=${green}, Yellow=${yellow}, Red=${red}`,
    `Restaurant meals: ${restaurant}`,
    `Green meal rate: ${r.length ? Math.round((green / r.length) * 100) : 0}%`,
  ].join('\n');
}

async function fetchCorrelationData(
  db: SupabaseClient,
  userId: string,
  opts: Required<FetcherOptions>,
): Promise<string> {
  const { since, today } = dateRange(opts.days);

  const [healthRes, logsRes, focusRes, mealsRes] = await Promise.all([
    db
      .from('user_health_metrics')
      .select('logged_date, sleep_hours, steps, resting_hr')
      .eq('user_id', userId)
      .gte('logged_date', since)
      .lte('logged_date', today),
    db
      .from('daily_logs')
      .select('date, energy_rating, pain_intensity')
      .eq('user_id', userId)
      .gte('date', since)
      .lte('date', today),
    db
      .from('focus_sessions')
      .select('start_time, duration, net_work_duration')
      .eq('user_id', userId)
      .gte('start_time', since + 'T00:00:00')
      .lte('start_time', today + 'T23:59:59')
      .not('end_time', 'is', null),
    db
      .from('meal_logs')
      .select('date, protocols(ncv_score)')
      .eq('user_id', userId)
      .gte('date', since)
      .lte('date', today),
  ]);

  // Build per-day map
  interface DayData {
    sleep_hours: number | null;
    steps: number | null;
    energy_rating: number | null;
    focus_minutes: number;
    pain_intensity: number | null;
    green_meal_ratio: number | null;
    resting_hr: number | null;
  }

  const dayMap = new Map<string, DayData>();
  const getDay = (date: string): DayData => {
    if (!dayMap.has(date)) {
      dayMap.set(date, {
        sleep_hours: null,
        steps: null,
        energy_rating: null,
        focus_minutes: 0,
        pain_intensity: null,
        green_meal_ratio: null,
        resting_hr: null,
      });
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
    d.focus_minutes += (f.net_work_duration || f.duration || 0) / 60;
  }

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
    getDay(date).green_meal_ratio =
      counts.total > 0 ? Math.round((counts.green / counts.total) * 100) : null;
  }

  const allDays = [...dayMap.values()];

  // Pearson correlation
  function pearson(xs: number[], ys: number[]): number {
    const n = xs.length;
    if (n < 5) return 0;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0,
      dx2 = 0,
      dy2 = 0;
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

  const pairDefs: { a: keyof DayData; b: keyof DayData; labelA: string; labelB: string }[] = [
    { a: 'sleep_hours', b: 'energy_rating', labelA: 'Sleep Hours', labelB: 'Energy Rating' },
    { a: 'steps', b: 'energy_rating', labelA: 'Daily Steps', labelB: 'Energy Rating' },
    { a: 'pain_intensity', b: 'focus_minutes', labelA: 'Pain Intensity', labelB: 'Focus Minutes' },
    { a: 'green_meal_ratio', b: 'energy_rating', labelA: 'Green Meal %', labelB: 'Energy Rating' },
    { a: 'sleep_hours', b: 'focus_minutes', labelA: 'Sleep Hours', labelB: 'Focus Minutes' },
    { a: 'resting_hr', b: 'energy_rating', labelA: 'Resting HR', labelB: 'Energy Rating' },
  ];

  const results: string[] = [];
  for (const def of pairDefs) {
    const valid = allDays.filter(
      (d) => d[def.a] != null && d[def.b] != null && d[def.a] !== 0 && d[def.b] !== 0,
    );
    if (valid.length < 5) continue;
    const xs = valid.map((d) => Number(d[def.a]));
    const ys = valid.map((d) => Number(d[def.b]));
    const coeff = pearson(xs, ys);
    if (Math.abs(coeff) >= 0.15) {
      results.push(`  ${def.labelA} <-> ${def.labelB}: r=${coeff} (${valid.length} days)`);
    }
  }

  if (!results.length) {
    return `[CORRELATION DATA - Last ${opts.days} days]\nNot enough data for meaningful correlations.`;
  }

  return [
    `[CORRELATION DATA - Last ${opts.days} days]`,
    `Significant correlations (|r| >= 0.15):`,
    ...results,
  ].join('\n');
}
