// lib/demo/seed.ts
// Shared demo data seed functions — used by demo/reset (cron) and admin invite seeding.

import { SupabaseClient } from '@supabase/supabase-js';

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// Tables that reference users via a column other than user_id
const ALT_USER_TABLES: Record<string, string> = {
  contractor_job_assignments: 'assigned_by',
  job_replacement_requests: 'requester_id',
};

// Deletion order respects FK constraints (children before parents).
// Only tables with a direct user_id column belong here — cascade children
// (e.g. invoice_items, workout_log_exercises) are auto-deleted with their parent.
export const CLEAR_ORDER = [
  'union_rag_submissions',
  'union_documents',
  'union_dues_payments',
  'union_memberships',
  'city_guide_entries',
  'city_guides',
  'invoices',
  'job_documents',
  'job_time_entries',
  'contractor_rate_cards',
  'contractor_jobs',
  'admin_chats',
  'social_shares',
  'social_likes',
  'media_episode_links',
  'podcast_episodes',
  'media_notes',
  'media_items',
  'media_categories',
  'activity_links',
  'entity_life_categories',
  'workout_logs',
  'workout_templates',
  'workout_feedback',
  'weekly_reviews',
  'daily_logs',
  'exercises',
  'exercise_categories',
  'equipment_media',
  'equipment_valuations',
  'equipment',
  'equipment_categories',
  'focus_sessions',
  'roadmaps',
  'user_health_metrics',
  'life_categories',
  'receipt_line_items',
  'item_prices',
  'scan_images',
  'trip_shares',
  'trip_routes',
  'trips',
  'trip_templates',
  'vehicle_maintenance',
  'fuel_logs',
  'recipe_likes',
  'recipe_saves',
  'recipes',
  'blog_posts',
  'financial_transactions',
  'user_brands',
  'user_contacts',
  'budget_categories',
  'teller_enrollments',
  'financial_accounts',
  'vehicles',
  'usage_events',
  'app_logs',
];

export async function clearUserData(supabase: SupabaseClient, userId: string): Promise<void> {
  // 1. Clear tables with non-standard user columns first
  for (const [table, col] of Object.entries(ALT_USER_TABLES)) {
    const { error } = await supabase.from(table).delete().eq(col, userId);
    if (error && !error.message.includes('Could not find the table')
        && !error.message.includes('does not exist')) {
      throw new Error(`Failed to clear ${table}: ${error.message}`);
    }
  }

  // 2. Clear standard user_id tables
  for (const table of CLEAR_ORDER) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    // Skip tables that don't exist yet (migration not applied)
    if (error && !error.message.includes('Could not find the table')) {
      throw new Error(`Failed to clear ${table}: ${error.message}`);
    }
  }
}

// ─── TUTORIAL ACCOUNT ──────────────────────────────────────────────────────
// Clean, intentional data — good for screen recordings and tutorial videos.

export async function seedTutorial(supabase: SupabaseClient, userId: string): Promise<void> {
  // Accounts
  const { data: accts, error: acctErr } = await supabase
    .from('financial_accounts')
    .insert([
      { user_id: userId, name: 'Primary Checking', account_type: 'checking', opening_balance: 4200.00, is_active: true },
      { user_id: userId, name: 'Visa Rewards', account_type: 'credit_card', opening_balance: 0, credit_limit: 10000, is_active: true },
    ])
    .select('id, name');
  if (acctErr) throw new Error(`Tutorial accounts: ${acctErr.message}`);

  const checkingId = accts?.find(a => a.name === 'Primary Checking')?.id;
  const creditId = accts?.find(a => a.name === 'Visa Rewards')?.id;

  // Budget categories
  const { data: cats, error: catErr } = await supabase
    .from('budget_categories')
    .insert([
      { user_id: userId, name: 'Groceries', color: '#10b981', monthly_budget: 600, sort_order: 1 },
      { user_id: userId, name: 'Gas', color: '#f59e0b', monthly_budget: 200, sort_order: 2 },
      { user_id: userId, name: 'Dining Out', color: '#ef4444', monthly_budget: 300, sort_order: 3 },
      { user_id: userId, name: 'Utilities', color: '#6366f1', monthly_budget: 250, sort_order: 4 },
      { user_id: userId, name: 'Healthcare', color: '#3b82f6', monthly_budget: 150, sort_order: 5 },
    ])
    .select('id, name');
  if (catErr) throw new Error(`Tutorial categories: ${catErr.message}`);

  const catId = (name: string) => cats?.find(c => c.name === name)?.id ?? null;

  // Transactions (~20 over 60 days)
  const { error: txErr } = await supabase.from('financial_transactions').insert([
    { user_id: userId, amount: 124.56, type: 'expense', description: 'Weekly groceries', vendor: 'Trader Joes', transaction_date: daysAgo(3), source: 'manual', category_id: catId('Groceries'), account_id: creditId },
    { user_id: userId, amount: 67.20, type: 'expense', description: 'Fuel fill-up', vendor: 'Costco Gas', transaction_date: daysAgo(5), source: 'manual', category_id: catId('Gas'), account_id: creditId },
    { user_id: userId, amount: 42.80, type: 'expense', description: 'Dinner', vendor: 'The Italian Place', transaction_date: daysAgo(7), source: 'manual', category_id: catId('Dining Out'), account_id: creditId },
    { user_id: userId, amount: 148.00, type: 'expense', description: 'Electric bill', vendor: 'Pacific Gas & Electric', transaction_date: daysAgo(10), source: 'manual', category_id: catId('Utilities'), account_id: checkingId },
    { user_id: userId, amount: 3200.00, type: 'income', description: 'Payroll deposit', vendor: 'Employer Direct Deposit', transaction_date: daysAgo(14), source: 'manual', account_id: checkingId },
    { user_id: userId, amount: 89.99, type: 'expense', description: 'Groceries', vendor: 'Whole Foods', transaction_date: daysAgo(17), source: 'manual', category_id: catId('Groceries'), account_id: creditId },
    { user_id: userId, amount: 60.00, type: 'expense', description: 'Fuel fill-up', vendor: 'Chevron', transaction_date: daysAgo(19), source: 'manual', category_id: catId('Gas'), account_id: creditId },
    { user_id: userId, amount: 35.50, type: 'expense', description: 'Lunch', vendor: 'Sweetgreen', transaction_date: daysAgo(21), source: 'manual', category_id: catId('Dining Out'), account_id: creditId },
    { user_id: userId, amount: 95.00, type: 'expense', description: 'Doctor copay', vendor: 'Dr. Smith Family Medicine', transaction_date: daysAgo(23), source: 'manual', category_id: catId('Healthcare'), account_id: checkingId },
    { user_id: userId, amount: 52.00, type: 'expense', description: 'Internet service', vendor: 'Comcast', transaction_date: daysAgo(28), source: 'manual', category_id: catId('Utilities'), account_id: checkingId },
    { user_id: userId, amount: 3200.00, type: 'income', description: 'Payroll deposit', vendor: 'Employer Direct Deposit', transaction_date: daysAgo(28), source: 'manual', account_id: checkingId },
    { user_id: userId, amount: 112.34, type: 'expense', description: 'Weekly groceries', vendor: 'Trader Joes', transaction_date: daysAgo(31), source: 'manual', category_id: catId('Groceries'), account_id: creditId },
    { user_id: userId, amount: 63.75, type: 'expense', description: 'Fuel fill-up', vendor: 'Costco Gas', transaction_date: daysAgo(34), source: 'manual', category_id: catId('Gas'), account_id: creditId },
    { user_id: userId, amount: 28.00, type: 'expense', description: 'Coffee & pastries', vendor: 'Blue Bottle Coffee', transaction_date: daysAgo(36), source: 'manual', category_id: catId('Dining Out'), account_id: creditId },
    { user_id: userId, amount: 143.00, type: 'expense', description: 'Electric bill', vendor: 'Pacific Gas & Electric', transaction_date: daysAgo(40), source: 'manual', category_id: catId('Utilities'), account_id: checkingId },
    { user_id: userId, amount: 78.20, type: 'expense', description: 'Prescriptions', vendor: 'CVS Pharmacy', transaction_date: daysAgo(43), source: 'manual', category_id: catId('Healthcare'), account_id: creditId },
    { user_id: userId, amount: 3200.00, type: 'income', description: 'Payroll deposit', vendor: 'Employer Direct Deposit', transaction_date: daysAgo(42), source: 'manual', account_id: checkingId },
    { user_id: userId, amount: 99.50, type: 'expense', description: 'Groceries', vendor: 'Safeway', transaction_date: daysAgo(45), source: 'manual', category_id: catId('Groceries'), account_id: creditId },
    { user_id: userId, amount: 58.40, type: 'expense', description: 'Fuel fill-up', vendor: 'Shell', transaction_date: daysAgo(50), source: 'manual', category_id: catId('Gas'), account_id: creditId },
    { user_id: userId, amount: 55.00, type: 'expense', description: 'Internet service', vendor: 'Comcast', transaction_date: daysAgo(55), source: 'manual', category_id: catId('Utilities'), account_id: checkingId },
  ]);
  if (txErr) throw new Error(`Tutorial transactions: ${txErr.message}`);

  // Vehicle
  const { data: veh, error: vehErr } = await supabase
    .from('vehicles')
    .insert([{ user_id: userId, nickname: 'My Camry', type: 'car', make: 'Toyota', model: 'Camry', year: 2022, ownership_type: 'owned', active: true }])
    .select('id');
  if (vehErr) throw new Error(`Tutorial vehicle: ${vehErr.message}`);
  const vehicleId = veh?.[0]?.id;

  if (vehicleId) {
    const { error: fuelErr } = await supabase.from('fuel_logs').insert([
      { user_id: userId, vehicle_id: vehicleId, date: daysAgo(5), odometer_miles: 24850, miles_since_last_fill: 312, gallons: 8.9, total_cost: 30.56, cost_per_gallon: 3.434, mpg_display: 35.1, station: 'Costco Gas', fuel_grade: 'regular', source: 'manual' },
      { user_id: userId, vehicle_id: vehicleId, date: daysAgo(19), odometer_miles: 24538, miles_since_last_fill: 298, gallons: 8.6, total_cost: 29.82, cost_per_gallon: 3.468, mpg_display: 34.7, station: 'Chevron', fuel_grade: 'regular', source: 'manual' },
      { user_id: userId, vehicle_id: vehicleId, date: daysAgo(34), odometer_miles: 24240, miles_since_last_fill: 305, gallons: 8.8, total_cost: 30.41, cost_per_gallon: 3.456, mpg_display: 34.7, station: 'Costco Gas', fuel_grade: 'regular', source: 'manual' },
      { user_id: userId, vehicle_id: vehicleId, date: daysAgo(50), odometer_miles: 23935, miles_since_last_fill: 310, gallons: 8.9, total_cost: 31.20, cost_per_gallon: 3.506, mpg_display: 34.8, station: 'Shell', fuel_grade: 'regular', source: 'manual' },
      { user_id: userId, vehicle_id: vehicleId, date: daysAgo(58), odometer_miles: 23625, miles_since_last_fill: 308, gallons: 8.8, total_cost: 30.98, cost_per_gallon: 3.520, mpg_display: 35.0, station: 'Costco Gas', fuel_grade: 'regular', source: 'manual' },
    ]);
    if (fuelErr) throw new Error(`Tutorial fuel logs: ${fuelErr.message}`);

    const { error: maintErr } = await supabase.from('vehicle_maintenance').insert([
      { user_id: userId, vehicle_id: vehicleId, date: daysAgo(45), service_type: 'oil_change', cost: 89.99, odometer_at_service: 24000, vendor: 'Jiffy Lube', next_service_miles: 27000, notes: 'Synthetic oil' },
      { user_id: userId, vehicle_id: vehicleId, date: daysAgo(90), service_type: 'tire_rotation', cost: 29.99, odometer_at_service: 22500, vendor: 'Discount Tire' },
      { user_id: userId, vehicle_id: vehicleId, date: daysAgo(60), service_type: 'other', cost: 24.99, odometer_at_service: 23500, vendor: 'AutoZone', notes: 'Air filter replacement' },
    ]);
    if (maintErr) throw new Error(`Tutorial maintenance: ${maintErr.message}`);
  }

  const { error: tripErr } = await supabase.from('trips').insert([
    { user_id: userId, vehicle_id: vehicleId, date: daysAgo(1), mode: 'car', origin: 'Home', destination: 'Office', distance_miles: 12.4, duration_min: 22, trip_category: 'travel', tax_category: 'personal', source: 'manual' },
    { user_id: userId, vehicle_id: vehicleId, date: daysAgo(2), mode: 'car', origin: 'Office', destination: 'Home', distance_miles: 12.4, duration_min: 25, trip_category: 'travel', tax_category: 'personal', source: 'manual' },
    { user_id: userId, date: daysAgo(4), mode: 'bike', origin: 'Home', destination: 'Park', distance_miles: 8.2, duration_min: 35, trip_category: 'fitness', tax_category: 'personal', source: 'manual' },
    { user_id: userId, vehicle_id: vehicleId, date: daysAgo(8), mode: 'car', origin: 'Home', destination: 'Grocery Store', distance_miles: 3.1, duration_min: 8, trip_category: 'travel', tax_category: 'personal', source: 'manual' },
    { user_id: userId, vehicle_id: vehicleId, date: daysAgo(14), mode: 'car', origin: 'Home', destination: 'Airport', distance_miles: 28.5, duration_min: 45, trip_category: 'travel', tax_category: 'personal', source: 'manual' },
    { user_id: userId, date: daysAgo(15), mode: 'bike', origin: 'Hotel', destination: 'Conference Center', distance_miles: 2.3, duration_min: 12, trip_category: 'travel', tax_category: 'business', source: 'manual' },
    { user_id: userId, vehicle_id: vehicleId, date: daysAgo(22), mode: 'car', origin: 'Home', destination: 'Doctor', distance_miles: 7.8, duration_min: 18, trip_category: 'travel', tax_category: 'medical', source: 'manual' },
    { user_id: userId, date: daysAgo(30), mode: 'bike', origin: 'Home', destination: 'Farmers Market', distance_miles: 5.5, duration_min: 24, trip_category: 'travel', tax_category: 'personal', source: 'manual' },
  ]);
  if (tripErr) throw new Error(`Tutorial trips: ${tripErr.message}`);

  // Planner: Roadmap → Goal → Milestone → Tasks
  const { data: roadmapData, error: rmErr } = await supabase
    .from('roadmaps')
    .insert([{ user_id: userId, title: '2026 Personal Roadmap', description: 'Annual plan', start_date: daysAgo(90), end_date: daysAgo(-275) }])
    .select('id');
  if (rmErr) throw new Error(`Tutorial roadmap: ${rmErr.message}`);
  const roadmapId = roadmapData?.[0]?.id;

  if (roadmapId) {
    const { data: goalData, error: goalErr } = await supabase
      .from('goals')
      .insert([{ roadmap_id: roadmapId, title: 'Get Healthier', category: 'FITNESS', target_year: 2026, status: 'active' }])
      .select('id');
    if (goalErr) throw new Error(`Tutorial goal: ${goalErr.message}`);
    const goalId = goalData?.[0]?.id;

    if (goalId) {
      const { data: msData, error: msErr } = await supabase
        .from('milestones')
        .insert([{ goal_id: goalId, title: 'Establish workout routine', target_date: daysAgo(-30), status: 'in_progress' }])
        .select('id');
      if (msErr) throw new Error(`Tutorial milestone: ${msErr.message}`);
      const milestoneId = msData?.[0]?.id;

      if (milestoneId) {
        const { error: taskErr } = await supabase.from('tasks').insert([
          { milestone_id: milestoneId, date: daysAgo(0), time: '07:00', activity: 'Morning walk', description: '30 min around the neighborhood', tag: 'health', priority: 2 },
          { milestone_id: milestoneId, date: daysAgo(0), time: '12:00', activity: 'Meal prep', description: 'Prep lunches for the week', tag: 'health', priority: 2 },
          { milestone_id: milestoneId, date: daysAgo(1), time: '06:30', activity: 'Gym session', description: 'Upper body + core', tag: 'health', priority: 1, completed: true, completed_at: new Date(Date.now() - 86400000).toISOString() },
          { milestone_id: milestoneId, date: daysAgo(2), time: '08:00', activity: 'Grocery run', description: 'Whole Foods weekly shop', tag: 'errands', priority: 3, completed: true, completed_at: new Date(Date.now() - 172800000).toISOString() },
          { milestone_id: milestoneId, date: daysAgo(3), time: '07:00', activity: 'Yoga', description: '45 min flow', tag: 'health', priority: 2, completed: true, completed_at: new Date(Date.now() - 259200000).toISOString() },
        ]);
        if (taskErr) throw new Error(`Tutorial tasks: ${taskErr.message}`);
      }
    }
  }

  // Health Metrics (14 days)
  const healthRows = Array.from({ length: 14 }, (_, i) => ({
    user_id: userId,
    logged_date: daysAgo(i),
    resting_hr: 58 + Math.floor(Math.random() * 8),
    steps: 6000 + Math.floor(Math.random() * 6000),
    sleep_hours: +(6.5 + Math.random() * 2).toFixed(1),
    activity_min: 20 + Math.floor(Math.random() * 50),
  }));
  const { error: hmErr } = await supabase.from('user_health_metrics').insert(healthRows);
  if (hmErr) throw new Error(`Tutorial health metrics: ${hmErr.message}`);

  // Exercise Categories + Exercises
  const { data: exCats, error: exCatErr } = await supabase
    .from('exercise_categories')
    .insert([
      { user_id: userId, name: 'Push', sort_order: 1 },
      { user_id: userId, name: 'Pull', sort_order: 2 },
      { user_id: userId, name: 'Legs', sort_order: 3 },
      { user_id: userId, name: 'Core', sort_order: 4 },
      { user_id: userId, name: 'Cardio', sort_order: 5 },
    ])
    .select('id, name');
  if (exCatErr) throw new Error(`Tutorial exercise categories: ${exCatErr.message}`);
  const exCatId = (name: string) => exCats?.find(c => c.name === name)?.id ?? null;

  const { data: exerciseData, error: exErr } = await supabase
    .from('exercises')
    .insert([
      { user_id: userId, name: 'Push-ups', category_id: exCatId('Push'), default_sets: 3, default_reps: 15, primary_muscles: ['chest', 'triceps'] },
      { user_id: userId, name: 'Pull-ups', category_id: exCatId('Pull'), default_sets: 3, default_reps: 8, primary_muscles: ['back', 'biceps'] },
      { user_id: userId, name: 'Squats', category_id: exCatId('Legs'), default_sets: 3, default_reps: 12, primary_muscles: ['quads', 'glutes'] },
      { user_id: userId, name: 'Plank', category_id: exCatId('Core'), default_sets: 3, default_duration_sec: 45, primary_muscles: ['core'] },
      { user_id: userId, name: 'Treadmill Run', category_id: exCatId('Cardio'), default_duration_sec: 1200, primary_muscles: ['legs', 'cardio'] },
    ])
    .select('id, name');
  if (exErr) throw new Error(`Tutorial exercises: ${exErr.message}`);

  // Workout Log
  const { data: logData, error: logErr } = await supabase
    .from('workout_logs')
    .insert([{ user_id: userId, name: 'Morning Strength', date: daysAgo(1), duration_min: 45, overall_feeling: 4, purpose: ['strength', 'health'] }])
    .select('id');
  if (logErr) throw new Error(`Tutorial workout log: ${logErr.message}`);
  const logId = logData?.[0]?.id;

  if (logId && exerciseData) {
    const exId = (name: string) => exerciseData.find(e => e.name === name)?.id ?? null;
    const { error: logExErr } = await supabase.from('workout_log_exercises').insert([
      { log_id: logId, name: 'Push-ups', exercise_id: exId('Push-ups'), sets_completed: 3, reps_completed: 15, sort_order: 1, phase: 'working', rpe: 7, is_circuit: false, to_failure: false, is_unilateral: false },
      { log_id: logId, name: 'Squats', exercise_id: exId('Squats'), sets_completed: 3, reps_completed: 12, weight_lbs: 135, sort_order: 2, phase: 'working', rpe: 8, is_circuit: false, to_failure: false, is_unilateral: false },
      { log_id: logId, name: 'Plank', exercise_id: exId('Plank'), sets_completed: 3, duration_sec: 45, sort_order: 3, phase: 'cooldown', is_circuit: false, to_failure: false, is_unilateral: false },
    ]);
    if (logExErr) throw new Error(`Tutorial workout log exercises: ${logExErr.message}`);
  }

  // Equipment
  const { data: eqCats, error: eqCatErr } = await supabase
    .from('equipment_categories')
    .insert([
      { user_id: userId, name: 'Electronics', sort_order: 1 },
      { user_id: userId, name: 'Fitness', sort_order: 2 },
    ])
    .select('id, name');
  if (eqCatErr) throw new Error(`Tutorial equipment categories: ${eqCatErr.message}`);
  const eqCatIdFn = (name: string) => eqCats?.find(c => c.name === name)?.id ?? null;

  const { error: eqErr } = await supabase.from('equipment').insert([
    { user_id: userId, name: 'MacBook Pro 14"', category_id: eqCatIdFn('Electronics'), brand: 'Apple', purchase_date: daysAgo(180), purchase_price: 1999, current_value: 1600, condition: 'excellent' },
    { user_id: userId, name: 'Resistance Bands Set', category_id: eqCatIdFn('Fitness'), brand: 'TheraBand', purchase_date: daysAgo(60), purchase_price: 35, current_value: 30, condition: 'good' },
  ]);
  if (eqErr) throw new Error(`Tutorial equipment: ${eqErr.message}`);

  // Life Categories
  const { error: lcErr } = await supabase.from('life_categories').insert([
    { user_id: userId, name: 'Health', icon: 'heart', color: '#ef4444', sort_order: 1 },
    { user_id: userId, name: 'Finance', icon: 'dollar-sign', color: '#10b981', sort_order: 2 },
    { user_id: userId, name: 'Career', icon: 'briefcase', color: '#6366f1', sort_order: 3 },
    { user_id: userId, name: 'Relationships', icon: 'users', color: '#f59e0b', sort_order: 4 },
  ]);
  if (lcErr) throw new Error(`Tutorial life categories: ${lcErr.message}`);

  // Focus Sessions (3 sessions)
  const { error: tutFsErr } = await supabase.from('focus_sessions').insert([
    { user_id: userId, start_time: new Date(Date.now() - 86400000 - 60 * 60000).toISOString(), end_time: new Date(Date.now() - 86400000 - 35 * 60000).toISOString(), duration: 25, notes: 'Reviewing monthly budget categories', session_type: 'work' },
    { user_id: userId, start_time: new Date(Date.now() - 172800000 - 90 * 60000).toISOString(), end_time: new Date(Date.now() - 172800000 - 40 * 60000).toISOString(), duration: 50, notes: 'Meal planning and recipe research for the week', session_type: 'focus' },
    { user_id: userId, start_time: new Date(Date.now() - 259200000 - 45 * 60000).toISOString(), end_time: new Date(Date.now() - 259200000 - 15 * 60000).toISOString(), duration: 30, notes: 'Logging health metrics and daily reflection', session_type: 'focus' },
  ]);
  if (tutFsErr) throw new Error(`Tutorial focus sessions: ${tutFsErr.message}`);

  // Daily Logs (7 days)
  const tutorialWins = [
    'Completed gym session — upper body + core',
    'Hit 8,000 steps before lunch',
    'Meal prepped lunches for the whole week',
    'Logged all health metrics for the day',
    'Morning walk — 30 minutes in sunshine',
    'Reviewed budget and stayed under grocery limit',
    'Completed yoga session — 45 min flow',
  ];
  const tutorialChallenges = [
    'Only got 5.5 hours of sleep',
    'Skipped afternoon walk due to rain',
    'Overspent at grocery store',
    null, null, null, null,
  ];
  const tutDailyRows = Array.from({ length: 7 }, (_, i) => ({
    user_id: userId,
    date: daysAgo(i),
    energy_rating: Math.min(5, Math.max(1, 3 + Math.floor(Math.random() * 3) - 1)),
    biggest_win: tutorialWins[i % tutorialWins.length],
    biggest_challenge: tutorialChallenges[i % tutorialChallenges.length],
    total_spent: +(15 + Math.random() * 80).toFixed(2),
    total_earned: i === 3 ? 3200 : 0,
  }));
  const { error: tutDlErr } = await supabase.from('daily_logs').insert(tutDailyRows);
  if (tutDlErr) throw new Error(`Tutorial daily logs: ${tutDlErr.message}`);

  // Weekly Review (1 week)
  const { error: tutWrErr } = await supabase.from('weekly_reviews').insert([{
    user_id: userId,
    week_start: daysAgo(7),
    content: `## Health & Recovery\nResting heart rate averaged 61 bpm this week — consistent. Sleep averaged 7.2 hours with one rough night at 5.5 hours. Completed 3 out of 4 planned workouts including a push session and yoga flow.\n\n## Finance\nTotal spending this week: $412. Groceries accounted for the largest share at $225 between Trader Joes and Whole Foods. Stayed within the monthly gas budget.\n\n## Movement\nLogged 8 trips this week — 4 by car, 1 bike ride to the park (8.2 miles). Daily steps averaged around 8,500.\n\n## Focus for Next Week\nPrioritize sleep consistency — aim for 7+ hours every night. Complete all 4 planned workouts and start tracking active calories.`,
  }]);
  if (tutWrErr) throw new Error(`Tutorial weekly review: ${tutWrErr.message}`);

  // ── Contacts ──
  const { error: contactErr } = await supabase.from('user_contacts').insert([
    { user_id: userId, name: 'Trader Joes', contact_type: 'vendor', notes: 'Weekly grocery store' },
    { user_id: userId, name: 'Dr. Smith Family Medicine', contact_type: 'vendor', notes: 'Primary care physician' },
    { user_id: userId, name: 'Costco Gas', contact_type: 'vendor', notes: 'Regular fuel stop' },
  ]);
  if (contactErr) throw new Error(`Tutorial contacts: ${contactErr.message}`);

  // ── Recipes ──
  const { data: recipeData, error: recipeErr } = await supabase.from('recipes').insert([
    {
      user_id: userId,
      title: 'Overnight Protein Oats',
      slug: 'overnight-protein-oats',
      description: 'High-protein overnight oats with Greek yogurt and berries.',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1. Mix oats, Greek yogurt, milk, and protein powder in a jar.\n2. Add chia seeds and stir.\n3. Refrigerate overnight (or at least 4 hours).\n4. Top with fresh berries and a drizzle of honey before serving.' }] }] },
      visibility: 'public',
      tags: ['breakfast', 'high-protein', 'meal-prep'],
      total_calories: 420,
      total_protein_g: 35,
      total_carbs_g: 48,
      total_fat_g: 10,
      total_fiber_g: 8,
      ncv_score: 'Green',
      servings: 1,
      prep_time_minutes: 10,
      cook_time_minutes: 0,
      published_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      user_id: userId,
      title: 'Simple Green Smoothie',
      slug: 'simple-green-smoothie',
      description: 'Quick nutrient-dense smoothie with spinach, banana, and almond butter.',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1. Add spinach, banana, almond butter, and almond milk to blender.\n2. Blend until smooth.\n3. Add ice if desired.\n4. Pour and serve immediately.' }] }] },
      visibility: 'public',
      tags: ['smoothie', 'green', 'quick'],
      total_calories: 310,
      total_protein_g: 12,
      total_carbs_g: 38,
      total_fat_g: 14,
      total_fiber_g: 6,
      ncv_score: 'Green',
      servings: 1,
      prep_time_minutes: 5,
      cook_time_minutes: 0,
      published_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    },
  ]).select('id, title');
  if (recipeErr) throw new Error(`Tutorial recipes: ${recipeErr.message}`);

  // Recipe ingredients
  const oatsId = recipeData?.find(r => r.title === 'Overnight Protein Oats')?.id;
  const smoothieId = recipeData?.find(r => r.title === 'Simple Green Smoothie')?.id;
  const ingredientRows = [
    ...(oatsId ? [
      { recipe_id: oatsId, name: 'Rolled oats', quantity: 0.5, unit: 'cup', calories: 150, protein_g: 5, carbs_g: 27, fat_g: 3, fiber_g: 4, sort_order: 1 },
      { recipe_id: oatsId, name: 'Greek yogurt (plain, nonfat)', quantity: 0.5, unit: 'cup', calories: 65, protein_g: 12, carbs_g: 5, fat_g: 0, fiber_g: 0, sort_order: 2 },
      { recipe_id: oatsId, name: 'Whole milk', quantity: 0.5, unit: 'cup', calories: 75, protein_g: 4, carbs_g: 6, fat_g: 4, fiber_g: 0, sort_order: 3 },
      { recipe_id: oatsId, name: 'Whey protein powder', quantity: 1, unit: 'scoop', calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1, fiber_g: 0, sort_order: 4 },
      { recipe_id: oatsId, name: 'Chia seeds', quantity: 1, unit: 'tbsp', calories: 60, protein_g: 2, carbs_g: 5, fat_g: 4, fiber_g: 5, sort_order: 5 },
      { recipe_id: oatsId, name: 'Mixed berries', quantity: 0.25, unit: 'cup', calories: 20, protein_g: 0.5, carbs_g: 5, fat_g: 0, fiber_g: 1, sort_order: 6 },
    ] : []),
    ...(smoothieId ? [
      { recipe_id: smoothieId, name: 'Baby spinach', quantity: 2, unit: 'cups', calories: 14, protein_g: 2, carbs_g: 2, fat_g: 0, fiber_g: 1, sort_order: 1 },
      { recipe_id: smoothieId, name: 'Banana (frozen)', quantity: 1, unit: 'medium', calories: 105, protein_g: 1, carbs_g: 27, fat_g: 0, fiber_g: 3, sort_order: 2 },
      { recipe_id: smoothieId, name: 'Almond butter', quantity: 1, unit: 'tbsp', calories: 98, protein_g: 3, carbs_g: 3, fat_g: 9, fiber_g: 2, sort_order: 3 },
      { recipe_id: smoothieId, name: 'Almond milk (unsweetened)', quantity: 1, unit: 'cup', calories: 30, protein_g: 1, carbs_g: 1, fat_g: 2.5, fiber_g: 0, sort_order: 4 },
    ] : []),
  ];
  if (ingredientRows.length > 0) {
    const { error: ingErr } = await supabase.from('recipe_ingredients').insert(ingredientRows);
    if (ingErr) throw new Error(`Tutorial recipe ingredients: ${ingErr.message}`);
  }

  // ── Blog Posts ──
  const { error: blogErr } = await supabase.from('blog_posts').insert([{
    user_id: userId,
    title: 'My First Week Tracking Everything',
    slug: 'first-week-tracking',
    excerpt: 'What I learned from logging meals, workouts, finances, and health metrics for seven days straight.',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'The Experiment' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'I decided to track everything for one week — every meal, workout, transaction, and health metric. Here is what I learned.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Key Insights' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'The biggest surprise was seeing how my sleep quality directly affected my spending. On nights with less than 6 hours of sleep, I spent 40% more on food the next day — mostly on convenience meals and coffee.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'What I Will Keep Doing' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Meal prep on Sundays, logging workouts immediately after finishing, and reviewing my budget categories weekly. These three habits had the highest return on effort.' }] },
      ],
    },
    visibility: 'public',
    tags: ['tracking', 'habits', 'health'],
    published_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  }]);
  if (blogErr) throw new Error(`Tutorial blog: ${blogErr.message}`);

  // ── Media Categories & Items ──
  const { data: mediaCats, error: mediaCatErr } = await supabase
    .from('media_categories')
    .insert([
      { user_id: userId, name: 'Books', icon: '📚', color: '#3b82f6', sort_order: 1 },
      { user_id: userId, name: 'TV & Film', icon: '🎬', color: '#ef4444', sort_order: 2 },
      { user_id: userId, name: 'Podcasts', icon: '🎙️', color: '#8b5cf6', sort_order: 3 },
    ])
    .select('id, name');
  if (mediaCatErr) throw new Error(`Tutorial media categories: ${mediaCatErr.message}`);
  const mediaCatId = (name: string) => mediaCats?.find(c => c.name === name)?.id ?? null;

  const { data: mediaItems, error: mediaErr } = await supabase.from('media_items').insert([
    { user_id: userId, title: 'Outlive: The Science & Art of Longevity', creator: 'Peter Attia', media_type: 'book', status: 'completed', rating: 5, start_date: daysAgo(60), end_date: daysAgo(20), category_id: mediaCatId('Books'), genre: ['health', 'longevity'], tags: ['must-read'], is_favorite: true, visibility: 'public' },
    { user_id: userId, title: 'Lifespan: Why We Age and Why We Don\'t Have To', creator: 'David Sinclair', media_type: 'book', status: 'in_progress', current_progress: 'Chapter 8', total_length: '12 chapters', category_id: mediaCatId('Books'), genre: ['science', 'aging'], is_favorite: false, visibility: 'private' },
    { user_id: userId, title: 'Blue Zones Kitchen', creator: 'Dan Buettner', media_type: 'book', status: 'want_to_consume', category_id: mediaCatId('Books'), genre: ['cooking', 'longevity'], is_favorite: false, visibility: 'private' },
    { user_id: userId, title: 'The Zone of Interest', creator: 'Jonathan Glazer', media_type: 'movie', status: 'completed', rating: 4, category_id: mediaCatId('TV & Film'), genre: ['drama', 'history'], year_released: 2023, is_favorite: false, visibility: 'private' },
    { user_id: userId, title: 'Huberman Lab', creator: 'Andrew Huberman', media_type: 'podcast', status: 'in_progress', category_id: mediaCatId('Podcasts'), genre: ['health', 'neuroscience'], is_favorite: true, visibility: 'public' },
    { user_id: userId, title: 'The Drive', creator: 'Peter Attia', media_type: 'podcast', status: 'in_progress', category_id: mediaCatId('Podcasts'), genre: ['health', 'longevity'], is_favorite: false, visibility: 'private' },
  ]).select('id, title');
  if (mediaErr) throw new Error(`Tutorial media items: ${mediaErr.message}`);

  // ── Media Notes ──
  const outliveId = mediaItems?.find(m => m.title.startsWith('Outlive'))?.id;
  if (outliveId) {
    await supabase.from('media_notes').insert([
      { user_id: userId, media_item_id: outliveId, title: 'Key framework', content: 'Medicine 3.0: shift from reactive to proactive. Focus on the four horsemen — heart disease, cancer, neurodegenerative disease, metabolic dysfunction.', note_type: 'general', content_format: 'markdown' },
      { user_id: userId, media_item_id: outliveId, title: 'Favorite quote', content: '"The objective of Medicine 3.0 is not to patch people up and get them out the door but to prevent the diseases and conditions that would send them to the doctor in the first place."', note_type: 'quote', content_format: 'markdown' },
    ]);
  }

  // ── Cross-Module Activity Links ──
  // Link recipe → blog post, trip → transaction, workout → equipment
  const blogData = await supabase.from('blog_posts').select('id').eq('user_id', userId).limit(1);
  const blogId = blogData?.data?.[0]?.id;
  const tripData = await supabase.from('trips').select('id').eq('user_id', userId).limit(1);
  const tripId = tripData?.data?.[0]?.id;
  const txData = await supabase.from('financial_transactions').select('id').eq('user_id', userId).eq('type', 'expense').limit(1);
  const txId = txData?.data?.[0]?.id;
  const recipeId = recipeData?.[0]?.id;

  const linkRows = [
    recipeId && blogId && { user_id: userId, source_type: 'recipe', source_id: recipeId, target_type: 'blog_post', target_id: blogId },
    tripId && txId && { user_id: userId, source_type: 'trip', source_id: tripId, target_type: 'transaction', target_id: txId },
    outliveId && recipeId && { user_id: userId, source_type: 'media_item', source_id: outliveId, target_type: 'recipe', target_id: recipeId },
  ].filter(Boolean);
  if (linkRows.length > 0) {
    await supabase.from('activity_links').insert(linkRows);
  }
}

// ─── VISITOR ACCOUNT ────────────────────────────────────────────────────────
// Richer data — gives visitors a full picture of the app's capabilities.

export async function seedVisitor(supabase: SupabaseClient, userId: string): Promise<void> {
  // Accounts
  const { data: accts, error: acctErr } = await supabase
    .from('financial_accounts')
    .insert([
      { user_id: userId, name: 'Chase Checking', account_type: 'checking', opening_balance: 8540.22, is_active: true },
      { user_id: userId, name: 'High-Yield Savings', account_type: 'savings', opening_balance: 24000.00, interest_rate: 4.75, is_active: true },
      { user_id: userId, name: 'Chase Sapphire', account_type: 'credit_card', opening_balance: 0, credit_limit: 25000, is_active: true },
      { user_id: userId, name: 'Amex Blue', account_type: 'credit_card', opening_balance: 0, credit_limit: 15000, is_active: true },
    ])
    .select('id, name');
  if (acctErr) throw new Error(`Visitor accounts: ${acctErr.message}`);

  const checkingId = accts?.find(a => a.name === 'Chase Checking')?.id;
  const sapphireId = accts?.find(a => a.name === 'Chase Sapphire')?.id;
  const amexId = accts?.find(a => a.name === 'Amex Blue')?.id;

  // Budget categories
  const { data: cats, error: catErr } = await supabase
    .from('budget_categories')
    .insert([
      { user_id: userId, name: 'Groceries', color: '#10b981', monthly_budget: 800, sort_order: 1 },
      { user_id: userId, name: 'Gas', color: '#f59e0b', monthly_budget: 300, sort_order: 2 },
      { user_id: userId, name: 'Dining Out', color: '#ef4444', monthly_budget: 400, sort_order: 3 },
      { user_id: userId, name: 'Utilities', color: '#6366f1', monthly_budget: 350, sort_order: 4 },
      { user_id: userId, name: 'Healthcare', color: '#3b82f6', monthly_budget: 200, sort_order: 5 },
      { user_id: userId, name: 'Entertainment', color: '#ec4899', monthly_budget: 150, sort_order: 6 },
      { user_id: userId, name: 'Business', color: '#8b5cf6', monthly_budget: 500, sort_order: 7 },
    ])
    .select('id, name');
  if (catErr) throw new Error(`Visitor categories: ${catErr.message}`);

  const catId = (name: string) => cats?.find(c => c.name === name)?.id ?? null;

  // Brand
  const { data: brandData, error: brandErr } = await supabase
    .from('user_brands')
    .insert([{
      user_id: userId,
      name: 'Acme Consulting LLC',
      dba_name: 'Acme Consulting',
      ein: '82-1234567',
      address: '456 Business Ave, San Francisco, CA 94102',
      website: 'https://acmeconsulting.example.com',
      color: '#8b5cf6',
      description: 'Technology consulting firm',
      is_active: true,
    }])
    .select('id');
  if (brandErr) throw new Error(`Visitor brand: ${brandErr.message}`);
  const brandId = brandData?.[0]?.id;

  // Transactions (~50 over 90 days)
  const { error: txErr } = await supabase.from('financial_transactions').insert([
    { user_id: userId, amount: 4800.00, type: 'income', description: 'Consulting invoice — TechCorp', vendor: 'TechCorp Inc.', transaction_date: daysAgo(2), source: 'manual', account_id: checkingId, brand_id: brandId, category_id: catId('Business') },
    { user_id: userId, amount: 156.78, type: 'expense', description: 'Weekly groceries', vendor: 'Whole Foods', transaction_date: daysAgo(3), source: 'manual', category_id: catId('Groceries'), account_id: sapphireId },
    { user_id: userId, amount: 72.40, type: 'expense', description: 'Gas fill-up', vendor: 'Costco Gas', transaction_date: daysAgo(4), source: 'manual', category_id: catId('Gas'), account_id: sapphireId },
    { user_id: userId, amount: 85.00, type: 'expense', description: 'Client dinner', vendor: 'Bix Restaurant', transaction_date: daysAgo(5), source: 'manual', category_id: catId('Dining Out'), account_id: sapphireId, brand_id: brandId },
    { user_id: userId, amount: 5400.00, type: 'income', description: 'Salary — main job', vendor: 'Employer LLC', transaction_date: daysAgo(7), source: 'manual', account_id: checkingId },
    { user_id: userId, amount: 43.20, type: 'expense', description: 'Happy hour', vendor: "The Monk's Kettle", transaction_date: daysAgo(8), source: 'manual', category_id: catId('Dining Out'), account_id: amexId },
    { user_id: userId, amount: 168.00, type: 'expense', description: 'Electric bill', vendor: 'PG&E', transaction_date: daysAgo(10), source: 'manual', category_id: catId('Utilities'), account_id: checkingId },
    { user_id: userId, amount: 62.50, type: 'expense', description: 'Gas fill-up', vendor: 'Shell', transaction_date: daysAgo(11), source: 'manual', category_id: catId('Gas'), account_id: sapphireId },
    { user_id: userId, amount: 95.00, type: 'expense', description: 'Office supplies', vendor: 'Staples', transaction_date: daysAgo(12), source: 'manual', category_id: catId('Business'), account_id: amexId, brand_id: brandId },
    { user_id: userId, amount: 134.20, type: 'expense', description: 'Groceries', vendor: 'Trader Joes', transaction_date: daysAgo(13), source: 'manual', category_id: catId('Groceries'), account_id: sapphireId },
    { user_id: userId, amount: 62.00, type: 'expense', description: 'Internet + Phone', vendor: 'AT&T', transaction_date: daysAgo(15), source: 'manual', category_id: catId('Utilities'), account_id: checkingId },
    { user_id: userId, amount: 55.00, type: 'expense', description: 'Streaming services', vendor: 'Netflix + Spotify', transaction_date: daysAgo(16), source: 'manual', category_id: catId('Entertainment'), account_id: amexId },
    { user_id: userId, amount: 4800.00, type: 'income', description: 'Consulting invoice — StartupXYZ', vendor: 'StartupXYZ', transaction_date: daysAgo(17), source: 'manual', account_id: checkingId, brand_id: brandId, category_id: catId('Business') },
    { user_id: userId, amount: 5400.00, type: 'income', description: 'Salary — main job', vendor: 'Employer LLC', transaction_date: daysAgo(21), source: 'manual', account_id: checkingId },
    { user_id: userId, amount: 130.00, type: 'expense', description: 'Doctor visit + labs', vendor: 'UCSF Medical', transaction_date: daysAgo(22), source: 'manual', category_id: catId('Healthcare'), account_id: checkingId },
    { user_id: userId, amount: 78.60, type: 'expense', description: 'Gas fill-up', vendor: 'Chevron', transaction_date: daysAgo(23), source: 'manual', category_id: catId('Gas'), account_id: sapphireId },
    { user_id: userId, amount: 149.50, type: 'expense', description: 'Groceries', vendor: 'Safeway', transaction_date: daysAgo(24), source: 'manual', category_id: catId('Groceries'), account_id: sapphireId },
    { user_id: userId, amount: 120.00, type: 'expense', description: 'Concert tickets', vendor: 'Ticketmaster', transaction_date: daysAgo(25), source: 'manual', category_id: catId('Entertainment'), account_id: amexId },
    { user_id: userId, amount: 35.00, type: 'expense', description: 'Brunch', vendor: 'Zazie', transaction_date: daysAgo(26), source: 'manual', category_id: catId('Dining Out'), account_id: amexId },
    { user_id: userId, amount: 500.00, type: 'expense', description: 'Transfer to savings', vendor: 'Chase Savings', transaction_date: daysAgo(27), source: 'manual', account_id: checkingId },
    { user_id: userId, amount: 164.00, type: 'expense', description: 'Electric bill', vendor: 'PG&E', transaction_date: daysAgo(30), source: 'manual', category_id: catId('Utilities'), account_id: checkingId },
    { user_id: userId, amount: 5400.00, type: 'income', description: 'Salary — main job', vendor: 'Employer LLC', transaction_date: daysAgo(35), source: 'manual', account_id: checkingId },
    { user_id: userId, amount: 112.00, type: 'expense', description: 'Groceries', vendor: 'Whole Foods', transaction_date: daysAgo(36), source: 'manual', category_id: catId('Groceries'), account_id: sapphireId },
    { user_id: userId, amount: 68.90, type: 'expense', description: 'Gas fill-up', vendor: 'Costco Gas', transaction_date: daysAgo(37), source: 'manual', category_id: catId('Gas'), account_id: sapphireId },
    { user_id: userId, amount: 3600.00, type: 'income', description: 'Consulting invoice — MegaCorp', vendor: 'MegaCorp', transaction_date: daysAgo(38), source: 'manual', account_id: checkingId, brand_id: brandId, category_id: catId('Business') },
    { user_id: userId, amount: 245.00, type: 'expense', description: 'Coworking space', vendor: 'WeWork', transaction_date: daysAgo(40), source: 'manual', category_id: catId('Business'), account_id: amexId, brand_id: brandId },
    { user_id: userId, amount: 95.00, type: 'expense', description: 'Pharmacy', vendor: 'Walgreens', transaction_date: daysAgo(42), source: 'manual', category_id: catId('Healthcare'), account_id: checkingId },
    { user_id: userId, amount: 145.00, type: 'expense', description: 'Groceries', vendor: 'Trader Joes', transaction_date: daysAgo(44), source: 'manual', category_id: catId('Groceries'), account_id: sapphireId },
    { user_id: userId, amount: 28.00, type: 'expense', description: 'Lunch', vendor: 'Tartine Manufactory', transaction_date: daysAgo(45), source: 'manual', category_id: catId('Dining Out'), account_id: amexId },
    { user_id: userId, amount: 5400.00, type: 'income', description: 'Salary — main job', vendor: 'Employer LLC', transaction_date: daysAgo(49), source: 'manual', account_id: checkingId },
    { user_id: userId, amount: 500.00, type: 'expense', description: 'Transfer to savings', vendor: 'Chase Savings', transaction_date: daysAgo(50), source: 'manual', account_id: checkingId },
    { user_id: userId, amount: 75.20, type: 'expense', description: 'Gas fill-up', vendor: 'Shell', transaction_date: daysAgo(52), source: 'manual', category_id: catId('Gas'), account_id: sapphireId },
    { user_id: userId, amount: 158.00, type: 'expense', description: 'Electric bill', vendor: 'PG&E', transaction_date: daysAgo(55), source: 'manual', category_id: catId('Utilities'), account_id: checkingId },
    { user_id: userId, amount: 135.50, type: 'expense', description: 'Groceries', vendor: 'Safeway', transaction_date: daysAgo(57), source: 'manual', category_id: catId('Groceries'), account_id: sapphireId },
    { user_id: userId, amount: 65.00, type: 'expense', description: 'Movie night x4', vendor: 'AMC Theatres', transaction_date: daysAgo(60), source: 'manual', category_id: catId('Entertainment'), account_id: amexId },
    { user_id: userId, amount: 4800.00, type: 'income', description: 'Consulting invoice — DataCo', vendor: 'DataCo', transaction_date: daysAgo(62), source: 'manual', account_id: checkingId, brand_id: brandId, category_id: catId('Business') },
    { user_id: userId, amount: 5400.00, type: 'income', description: 'Salary — main job', vendor: 'Employer LLC', transaction_date: daysAgo(63), source: 'manual', account_id: checkingId },
    { user_id: userId, amount: 89.00, type: 'expense', description: 'Gas fill-up', vendor: 'Costco Gas', transaction_date: daysAgo(65), source: 'manual', category_id: catId('Gas'), account_id: sapphireId },
    { user_id: userId, amount: 172.00, type: 'expense', description: 'Groceries (Costco bulk)', vendor: 'Costco', transaction_date: daysAgo(67), source: 'manual', category_id: catId('Groceries'), account_id: sapphireId },
    { user_id: userId, amount: 180.00, type: 'expense', description: 'Dentist', vendor: 'Downtown Dental', transaction_date: daysAgo(70), source: 'manual', category_id: catId('Healthcare'), account_id: checkingId },
    { user_id: userId, amount: 52.00, type: 'expense', description: 'Dinner with friends', vendor: 'Flour + Water', transaction_date: daysAgo(72), source: 'manual', category_id: catId('Dining Out'), account_id: amexId },
    { user_id: userId, amount: 165.00, type: 'expense', description: 'Electric bill', vendor: 'PG&E', transaction_date: daysAgo(75), source: 'manual', category_id: catId('Utilities'), account_id: checkingId },
    { user_id: userId, amount: 500.00, type: 'expense', description: 'Transfer to savings', vendor: 'Chase Savings', transaction_date: daysAgo(77), source: 'manual', account_id: checkingId },
    { user_id: userId, amount: 5400.00, type: 'income', description: 'Salary — main job', vendor: 'Employer LLC', transaction_date: daysAgo(77), source: 'manual', account_id: checkingId },
    { user_id: userId, amount: 67.80, type: 'expense', description: 'Gas fill-up', vendor: 'Chevron', transaction_date: daysAgo(80), source: 'manual', category_id: catId('Gas'), account_id: sapphireId },
    { user_id: userId, amount: 142.30, type: 'expense', description: 'Groceries', vendor: 'Whole Foods', transaction_date: daysAgo(83), source: 'manual', category_id: catId('Groceries'), account_id: sapphireId },
    { user_id: userId, amount: 85.00, type: 'expense', description: 'Accounting software', vendor: 'QuickBooks', transaction_date: daysAgo(85), source: 'manual', category_id: catId('Business'), account_id: amexId, brand_id: brandId },
    { user_id: userId, amount: 3200.00, type: 'income', description: 'Consulting invoice — BetaCo', vendor: 'BetaCo', transaction_date: daysAgo(87), source: 'manual', account_id: checkingId, brand_id: brandId, category_id: catId('Business') },
    { user_id: userId, amount: 48.50, type: 'expense', description: 'Brunch with family', vendor: 'Foreign Cinema', transaction_date: daysAgo(88), source: 'manual', category_id: catId('Dining Out'), account_id: amexId },
    { user_id: userId, amount: 5400.00, type: 'income', description: 'Salary — main job', vendor: 'Employer LLC', transaction_date: daysAgo(91), source: 'manual', account_id: checkingId },
  ]);
  if (txErr) throw new Error(`Visitor transactions: ${txErr.message}`);

  // Vehicles
  const { data: vehs, error: vehErr } = await supabase
    .from('vehicles')
    .insert([
      { user_id: userId, nickname: 'My CR-V', type: 'car', make: 'Honda', model: 'CR-V', year: 2020, ownership_type: 'owned', active: true },
      { user_id: userId, nickname: 'Trek FX3', type: 'bike', make: 'Trek', model: 'FX 3', year: 2021, ownership_type: 'owned', active: true },
    ])
    .select('id, nickname');
  if (vehErr) throw new Error(`Visitor vehicles: ${vehErr.message}`);

  const crvId = vehs?.find(v => v.nickname === 'My CR-V')?.id;
  const bikeId = vehs?.find(v => v.nickname === 'Trek FX3')?.id;

  if (crvId) {
    const { error: fuelErr } = await supabase.from('fuel_logs').insert([
      { user_id: userId, vehicle_id: crvId, date: daysAgo(4), odometer_miles: 52340, miles_since_last_fill: 285, gallons: 9.8, total_cost: 34.12, cost_per_gallon: 3.482, mpg_display: 29.1, station: 'Costco Gas', fuel_grade: 'regular', source: 'manual' },
      { user_id: userId, vehicle_id: crvId, date: daysAgo(11), odometer_miles: 52055, miles_since_last_fill: 278, gallons: 9.5, total_cost: 33.44, cost_per_gallon: 3.520, mpg_display: 29.3, station: 'Shell', fuel_grade: 'regular', source: 'manual' },
      { user_id: userId, vehicle_id: crvId, date: daysAgo(23), odometer_miles: 51777, miles_since_last_fill: 290, gallons: 9.9, total_cost: 34.76, cost_per_gallon: 3.511, mpg_display: 29.3, station: 'Chevron', fuel_grade: 'regular', source: 'manual' },
      { user_id: userId, vehicle_id: crvId, date: daysAgo(35), odometer_miles: 51487, miles_since_last_fill: 348, gallons: 11.9, total_cost: 43.20, cost_per_gallon: 3.630, mpg_display: 29.2, station: 'Arco', fuel_grade: 'regular', source: 'manual' },
      { user_id: userId, vehicle_id: crvId, date: daysAgo(33), odometer_miles: 51835, miles_since_last_fill: 355, gallons: 12.2, total_cost: 43.68, cost_per_gallon: 3.580, mpg_display: 29.1, station: 'Mobil', fuel_grade: 'regular', source: 'manual' },
      { user_id: userId, vehicle_id: crvId, date: daysAgo(32), odometer_miles: 52190, miles_since_last_fill: 338, gallons: 11.6, total_cost: 41.52, cost_per_gallon: 3.580, mpg_display: 29.1, station: 'BP', fuel_grade: 'regular', source: 'manual' },
      { user_id: userId, vehicle_id: crvId, date: daysAgo(31), odometer_miles: 52528, miles_since_last_fill: 350, gallons: 12.0, total_cost: 42.60, cost_per_gallon: 3.550, mpg_display: 29.2, station: 'Arco', fuel_grade: 'regular', source: 'manual' },
      { user_id: userId, vehicle_id: crvId, date: daysAgo(29), odometer_miles: 52878, miles_since_last_fill: 340, gallons: 11.7, total_cost: 41.60, cost_per_gallon: 3.556, mpg_display: 29.1, station: 'Costco Gas', fuel_grade: 'regular', source: 'manual' },
      { user_id: userId, vehicle_id: crvId, date: daysAgo(52), odometer_miles: 51197, miles_since_last_fill: 295, gallons: 10.1, total_cost: 35.45, cost_per_gallon: 3.510, mpg_display: 29.2, station: 'Shell', fuel_grade: 'regular', source: 'manual' },
      { user_id: userId, vehicle_id: crvId, date: daysAgo(65), odometer_miles: 50902, miles_since_last_fill: 310, gallons: 10.6, total_cost: 38.16, cost_per_gallon: 3.600, mpg_display: 29.2, station: 'Costco Gas', fuel_grade: 'regular', source: 'manual' },
      { user_id: userId, vehicle_id: crvId, date: daysAgo(80), odometer_miles: 50592, miles_since_last_fill: 288, gallons: 9.9, total_cost: 35.64, cost_per_gallon: 3.600, mpg_display: 29.1, station: 'Chevron', fuel_grade: 'regular', source: 'manual' },
      { user_id: userId, vehicle_id: crvId, date: daysAgo(90), odometer_miles: 50304, miles_since_last_fill: 302, gallons: 10.3, total_cost: 37.08, cost_per_gallon: 3.600, mpg_display: 29.3, station: 'Shell', fuel_grade: 'regular', source: 'manual' },
    ]);
    if (fuelErr) throw new Error(`Visitor fuel logs: ${fuelErr.message}`);

    const { error: maintErr } = await supabase.from('vehicle_maintenance').insert([
      { user_id: userId, vehicle_id: crvId, date: daysAgo(60), service_type: 'oil_change', cost: 94.99, odometer_at_service: 50500, vendor: 'Honda Dealership', next_service_miles: 55500, notes: 'Full synthetic 0W-20' },
      { user_id: userId, vehicle_id: crvId, date: daysAgo(30), service_type: 'tire_rotation', cost: 35.00, odometer_at_service: 51500, vendor: 'Costco Tire' },
      { user_id: userId, vehicle_id: crvId, date: daysAgo(45), service_type: 'inspection', cost: 0, odometer_at_service: 51000, vendor: 'Honda Dealership', notes: 'Brakes fine — 50% life remaining' },
      { user_id: userId, vehicle_id: bikeId, date: daysAgo(20), service_type: 'tune_up', cost: 0, vendor: 'REI', notes: 'Adjusted derailleurs, inflated tires' },
      { user_id: userId, vehicle_id: crvId, date: daysAgo(88), service_type: 'oil_change', cost: 89.99, odometer_at_service: 48500, vendor: 'Jiffy Lube', next_service_miles: 51500 },
    ]);
    if (maintErr) throw new Error(`Visitor maintenance: ${maintErr.message}`);
  }

  const { error: tripErr } = await supabase.from('trips').insert([
    { user_id: userId, vehicle_id: crvId, date: daysAgo(1), mode: 'car', origin: 'Home', destination: 'Office', distance_miles: 18.2, duration_min: 32, trip_category: 'travel', tax_category: 'personal', source: 'manual' },
    { user_id: userId, vehicle_id: bikeId, date: daysAgo(2), mode: 'bike', origin: 'Home', destination: 'Embarcadero', distance_miles: 12.5, duration_min: 55, trip_category: 'fitness', tax_category: 'personal', source: 'manual' },
    { user_id: userId, vehicle_id: crvId, date: daysAgo(3), mode: 'car', origin: 'Office', destination: 'Client Site', distance_miles: 8.4, duration_min: 18, trip_category: 'travel', tax_category: 'business', source: 'manual' },
    { user_id: userId, vehicle_id: bikeId, date: daysAgo(5), mode: 'bike', origin: 'Home', destination: 'Golden Gate Park', distance_miles: 15.3, duration_min: 68, trip_category: 'fitness', tax_category: 'personal', source: 'manual' },
    { user_id: userId, vehicle_id: crvId, date: daysAgo(8), mode: 'car', origin: 'Home', destination: 'Grocery Store', distance_miles: 4.2, duration_min: 10, trip_category: 'travel', tax_category: 'personal', source: 'manual' },
    { user_id: userId, vehicle_id: crvId, date: daysAgo(10), mode: 'car', origin: 'Home', destination: 'Airport SFO', distance_miles: 22.8, duration_min: 38, trip_category: 'travel', tax_category: 'business', source: 'manual' },
    { user_id: userId, vehicle_id: bikeId, date: daysAgo(12), mode: 'bike', origin: 'Home', destination: 'Marin Headlands', distance_miles: 24.8, duration_min: 95, trip_category: 'fitness', tax_category: 'personal', source: 'manual' },
    { user_id: userId, vehicle_id: crvId, date: daysAgo(14), mode: 'car', origin: 'Home', destination: 'Doctor', distance_miles: 5.6, duration_min: 14, trip_category: 'travel', tax_category: 'medical', source: 'manual' },
    { user_id: userId, vehicle_id: crvId, date: daysAgo(35), mode: 'car', origin: 'San Francisco, CA', destination: 'Los Angeles, CA', distance_miles: 382.0, duration_min: 380, trip_category: 'travel', tax_category: 'personal', source: 'manual' },
    { user_id: userId, vehicle_id: crvId, date: daysAgo(34), mode: 'car', origin: 'Los Angeles, CA', destination: 'San Diego, CA', distance_miles: 121.0, duration_min: 120, trip_category: 'travel', tax_category: 'personal', source: 'manual' },
    { user_id: userId, vehicle_id: crvId, date: daysAgo(32), mode: 'car', origin: 'San Diego, CA', destination: 'Joshua Tree, CA', distance_miles: 148.0, duration_min: 155, trip_category: 'travel', tax_category: 'personal', source: 'manual' },
    { user_id: userId, vehicle_id: crvId, date: daysAgo(31), mode: 'car', origin: 'Joshua Tree, CA', destination: 'Las Vegas, NV', distance_miles: 272.0, duration_min: 270, trip_category: 'travel', tax_category: 'personal', source: 'manual' },
    { user_id: userId, vehicle_id: crvId, date: daysAgo(29), mode: 'car', origin: 'Las Vegas, NV', destination: 'San Francisco, CA', distance_miles: 570.0, duration_min: 540, trip_category: 'travel', tax_category: 'personal', source: 'manual' },
    { user_id: userId, vehicle_id: crvId, date: daysAgo(22), mode: 'car', origin: 'Home', destination: 'Client Meeting', distance_miles: 12.1, duration_min: 25, trip_category: 'travel', tax_category: 'business', source: 'manual' },
    { user_id: userId, vehicle_id: bikeId, date: daysAgo(19), mode: 'bike', origin: 'Home', destination: 'Ocean Beach', distance_miles: 18.0, duration_min: 78, trip_category: 'fitness', tax_category: 'personal', source: 'manual' },
    { user_id: userId, vehicle_id: crvId, date: daysAgo(45), mode: 'car', origin: 'Home', destination: 'Dentist', distance_miles: 7.2, duration_min: 16, trip_category: 'travel', tax_category: 'medical', source: 'manual' },
    { user_id: userId, vehicle_id: bikeId, date: daysAgo(50), mode: 'bike', origin: 'Home', destination: 'Crissy Field', distance_miles: 10.5, duration_min: 45, trip_category: 'fitness', tax_category: 'personal', source: 'manual' },
    { user_id: userId, vehicle_id: crvId, date: daysAgo(55), mode: 'car', origin: 'Home', destination: 'Warehouse District', distance_miles: 9.8, duration_min: 20, trip_category: 'travel', tax_category: 'business', source: 'manual' },
    { user_id: userId, vehicle_id: bikeId, date: daysAgo(60), mode: 'bike', origin: 'Home', destination: 'Sausalito', distance_miles: 22.4, duration_min: 92, trip_category: 'fitness', tax_category: 'personal', source: 'manual' },
    { user_id: userId, vehicle_id: crvId, date: daysAgo(70), mode: 'car', origin: 'Home', destination: 'Conference Center', distance_miles: 3.5, duration_min: 9, trip_category: 'travel', tax_category: 'business', source: 'manual' },
  ]);
  if (tripErr) throw new Error(`Visitor trips: ${tripErr.message}`);

  const { error: contactErr } = await supabase.from('user_contacts').insert([
    { user_id: userId, name: 'Costco Gas', contact_type: 'vendor', use_count: 8 },
    { user_id: userId, name: 'Whole Foods', contact_type: 'vendor', use_count: 6 },
    { user_id: userId, name: 'Trader Joes', contact_type: 'vendor', use_count: 5 },
    { user_id: userId, name: 'Shell', contact_type: 'vendor', use_count: 4 },
    { user_id: userId, name: 'Chevron', contact_type: 'vendor', use_count: 3 },
    { user_id: userId, name: 'PG&E', contact_type: 'vendor', use_count: 3 },
    { user_id: userId, name: 'TechCorp Inc.', contact_type: 'customer', use_count: 2 },
    { user_id: userId, name: 'Honda Dealership', contact_type: 'vendor', use_count: 2 },
  ]);
  if (contactErr) throw new Error(`Visitor contacts: ${contactErr.message}`);

  // ── Planner: Roadmap → Goals → Milestones → Tasks ──
  const { data: rmData, error: rmErr } = await supabase
    .from('roadmaps')
    .insert([{ user_id: userId, title: '2026 Life Operating System', description: 'Health, finance, and career objectives', start_date: daysAgo(90), end_date: daysAgo(-275) }])
    .select('id');
  if (rmErr) throw new Error(`Visitor roadmap: ${rmErr.message}`);
  const roadmapId = rmData?.[0]?.id;

  if (roadmapId) {
    const { data: goalsData, error: goalErr } = await supabase
      .from('goals')
      .insert([
        { roadmap_id: roadmapId, title: 'Optimize Health & Fitness', category: 'FITNESS', target_year: 2026, status: 'active' },
        { roadmap_id: roadmapId, title: 'Grow Consulting Revenue', category: 'OUTREACH', target_year: 2026, status: 'active' },
        { roadmap_id: roadmapId, title: 'Build Creative Habit', category: 'CREATIVE', target_year: 2026, status: 'active' },
      ])
      .select('id, title');
    if (goalErr) throw new Error(`Visitor goals: ${goalErr.message}`);

    const goalId = (title: string) => goalsData?.find(g => g.title === title)?.id;

    const { data: msData, error: msErr } = await supabase
      .from('milestones')
      .insert([
        { goal_id: goalId('Optimize Health & Fitness'), title: 'Consistent 4x/week workouts', target_date: daysAgo(-60), status: 'in_progress' },
        { goal_id: goalId('Optimize Health & Fitness'), title: 'Complete health baseline labs', target_date: daysAgo(-14), status: 'completed', completed_at: new Date(Date.now() - 604800000).toISOString() },
        { goal_id: goalId('Grow Consulting Revenue'), title: 'Land 3 new clients Q1', target_date: daysAgo(-30), status: 'in_progress', estimated_cost: 500, revenue: 14400 },
        { goal_id: goalId('Build Creative Habit'), title: 'Write 10 blog posts', target_date: daysAgo(-90), status: 'not_started' },
      ])
      .select('id, title');
    if (msErr) throw new Error(`Visitor milestones: ${msErr.message}`);

    const msId = (title: string) => msData?.find(m => m.title === title)?.id;

    const { error: taskErr } = await supabase.from('tasks').insert([
      // Fitness milestone
      { milestone_id: msId('Consistent 4x/week workouts'), date: daysAgo(0), time: '06:30', activity: 'AM Priming routine', description: 'Nomad OS morning protocol', tag: 'health', priority: 1 },
      { milestone_id: msId('Consistent 4x/week workouts'), date: daysAgo(0), time: '17:00', activity: 'PM Recovery stretching', description: '15 min mobility', tag: 'health', priority: 2 },
      { milestone_id: msId('Consistent 4x/week workouts'), date: daysAgo(1), time: '06:30', activity: 'Gym — Push day', description: 'Chest, shoulders, triceps', tag: 'health', priority: 1, completed: true, completed_at: new Date(Date.now() - 86400000).toISOString() },
      { milestone_id: msId('Consistent 4x/week workouts'), date: daysAgo(2), time: '06:30', activity: 'Gym — Pull day', description: 'Back, biceps, forearms', tag: 'health', priority: 1, completed: true, completed_at: new Date(Date.now() - 172800000).toISOString() },
      { milestone_id: msId('Consistent 4x/week workouts'), date: daysAgo(3), time: '07:00', activity: 'Active recovery — bike ride', description: '45 min easy pace', tag: 'health', priority: 3, completed: true, completed_at: new Date(Date.now() - 259200000).toISOString() },
      { milestone_id: msId('Consistent 4x/week workouts'), date: daysAgo(4), time: '06:30', activity: 'Gym — Legs day', description: 'Squats, lunges, calves', tag: 'health', priority: 1, completed: true, completed_at: new Date(Date.now() - 345600000).toISOString() },
      // Business milestone
      { milestone_id: msId('Land 3 new clients Q1'), date: daysAgo(0), time: '10:00', activity: 'Client proposal — DataCo', description: 'Finalize SOW and send', tag: 'work', priority: 1 },
      { milestone_id: msId('Land 3 new clients Q1'), date: daysAgo(0), time: '14:00', activity: 'Follow up with MegaCorp', description: 'Email re: contract renewal', tag: 'work', priority: 2 },
      { milestone_id: msId('Land 3 new clients Q1'), date: daysAgo(1), time: '09:00', activity: 'Networking event prep', description: 'Review attendee list', tag: 'work', priority: 2, completed: true, completed_at: new Date(Date.now() - 86400000).toISOString() },
      { milestone_id: msId('Land 3 new clients Q1'), date: daysAgo(5), time: '11:00', activity: 'Invoice TechCorp', description: 'Send February invoice', tag: 'work', priority: 1, completed: true, completed_at: new Date(Date.now() - 432000000).toISOString() },
      // Creative milestone
      { milestone_id: msId('Write 10 blog posts'), date: daysAgo(0), time: '20:00', activity: 'Write blog draft', description: 'Topic: longevity habits for desk workers', tag: 'creative', priority: 3 },
      { milestone_id: msId('Write 10 blog posts'), date: daysAgo(7), time: '20:00', activity: 'Publish blog post', description: 'Topic: fuel tracking basics', tag: 'creative', priority: 2, completed: true, completed_at: new Date(Date.now() - 604800000).toISOString() },
    ]);
    if (taskErr) throw new Error(`Visitor tasks: ${taskErr.message}`);
  }

  // ── Health Metrics (30 days — enriched with all available fields) ──
  const healthRows = Array.from({ length: 30 }, (_, i) => ({
    user_id: userId,
    logged_date: daysAgo(i),
    resting_hr: 55 + Math.floor(Math.random() * 10),
    steps: 7000 + Math.floor(Math.random() * 7000),
    sleep_hours: +(6 + Math.random() * 2.5).toFixed(1),
    activity_min: 25 + Math.floor(Math.random() * 60),
    hrv_ms: 35 + Math.floor(Math.random() * 30),
    recovery_score: 50 + Math.floor(Math.random() * 50),
    sleep_score: 60 + Math.floor(Math.random() * 35),
    stress_score: 20 + Math.floor(Math.random() * 50),
    active_calories: 200 + Math.floor(Math.random() * 400),
    spo2_pct: +(96 + Math.random() * 3).toFixed(1),
    weight_lbs: +(174 + (Math.random() * 4 - 2)).toFixed(1),
  }));
  const { error: hmErr } = await supabase.from('user_health_metrics').insert(healthRows);
  if (hmErr) throw new Error(`Visitor health metrics: ${hmErr.message}`);

  // ── Exercise Categories + Exercises ──
  const { data: exCats, error: exCatErr } = await supabase
    .from('exercise_categories')
    .insert([
      { user_id: userId, name: 'Push', sort_order: 1 },
      { user_id: userId, name: 'Pull', sort_order: 2 },
      { user_id: userId, name: 'Legs', sort_order: 3 },
      { user_id: userId, name: 'Core', sort_order: 4 },
      { user_id: userId, name: 'Cardio', sort_order: 5 },
      { user_id: userId, name: 'Mobility', sort_order: 6 },
    ])
    .select('id, name');
  if (exCatErr) throw new Error(`Visitor exercise categories: ${exCatErr.message}`);
  const exCatId = (name: string) => exCats?.find(c => c.name === name)?.id ?? null;

  const { data: exercises, error: exErr } = await supabase
    .from('exercises')
    .insert([
      { user_id: userId, name: 'Bench Press', category_id: exCatId('Push'), default_sets: 4, default_reps: 8, default_weight_lbs: 155, primary_muscles: ['chest', 'triceps', 'shoulders'] },
      { user_id: userId, name: 'Push-ups', category_id: exCatId('Push'), default_sets: 3, default_reps: 20, primary_muscles: ['chest', 'triceps'] },
      { user_id: userId, name: 'Overhead Press', category_id: exCatId('Push'), default_sets: 3, default_reps: 10, default_weight_lbs: 95, primary_muscles: ['shoulders', 'triceps'] },
      { user_id: userId, name: 'Pull-ups', category_id: exCatId('Pull'), default_sets: 4, default_reps: 8, primary_muscles: ['back', 'biceps'] },
      { user_id: userId, name: 'Barbell Rows', category_id: exCatId('Pull'), default_sets: 4, default_reps: 10, default_weight_lbs: 135, primary_muscles: ['back', 'biceps'] },
      { user_id: userId, name: 'Back Squat', category_id: exCatId('Legs'), default_sets: 4, default_reps: 8, default_weight_lbs: 185, primary_muscles: ['quads', 'glutes', 'hamstrings'] },
      { user_id: userId, name: 'Romanian Deadlift', category_id: exCatId('Legs'), default_sets: 3, default_reps: 10, default_weight_lbs: 155, primary_muscles: ['hamstrings', 'glutes', 'lower back'] },
      { user_id: userId, name: 'Lunges', category_id: exCatId('Legs'), default_sets: 3, default_reps: 12, default_weight_lbs: 40, primary_muscles: ['quads', 'glutes'] },
      { user_id: userId, name: 'Plank', category_id: exCatId('Core'), default_sets: 3, default_duration_sec: 60, primary_muscles: ['core'] },
      { user_id: userId, name: 'Dead Bug', category_id: exCatId('Core'), default_sets: 3, default_reps: 10, primary_muscles: ['core', 'hip flexors'] },
      { user_id: userId, name: 'Treadmill Run', category_id: exCatId('Cardio'), default_duration_sec: 1800, primary_muscles: ['legs', 'cardio'] },
      { user_id: userId, name: 'Hip 90/90 Stretch', category_id: exCatId('Mobility'), default_sets: 2, default_duration_sec: 30, primary_muscles: ['hips'] },
    ])
    .select('id, name');
  if (exErr) throw new Error(`Visitor exercises: ${exErr.message}`);
  const exId = (name: string) => exercises?.find(e => e.name === name)?.id ?? null;

  // ── Workout Logs (10 workouts over 30 days) ──
  const { data: wLogs, error: wLogErr } = await supabase
    .from('workout_logs')
    .insert([
      { user_id: userId, name: 'Push Day', date: daysAgo(1), duration_min: 55, overall_feeling: 4, purpose: ['strength', 'hypertrophy'], warmup_notes: '5 min treadmill + arm circles' },
      { user_id: userId, name: 'Pull Day', date: daysAgo(2), duration_min: 50, overall_feeling: 5, purpose: ['strength'], warmup_notes: 'Band pull-aparts' },
      { user_id: userId, name: 'Leg Day', date: daysAgo(4), duration_min: 60, overall_feeling: 3, purpose: ['strength', 'mobility'], cooldown_notes: 'Foam rolled quads and hamstrings' },
      { user_id: userId, name: 'AM Priming', date: daysAgo(6), duration_min: 15, overall_feeling: 4, purpose: ['mobility', 'warmup'], warmup_notes: 'Cat-cow, hip flexor stretch' },
      { user_id: userId, name: 'Full Body HIIT', date: daysAgo(8), duration_min: 30, overall_feeling: 4, purpose: ['conditioning', 'endurance'] },
      { user_id: userId, name: 'Upper Body', date: daysAgo(10), duration_min: 50, overall_feeling: 4, purpose: ['strength'], warmup_notes: 'Shoulder circles + band work' },
      { user_id: userId, name: 'Recovery & Mobility', date: daysAgo(14), duration_min: 25, overall_feeling: 5, purpose: ['mobility', 'recovery'], cooldown_notes: 'Full body stretch sequence' },
      { user_id: userId, name: 'Push Day', date: daysAgo(17), duration_min: 55, overall_feeling: 3, purpose: ['strength', 'hypertrophy'], warmup_notes: 'Light bench warm-up sets' },
      { user_id: userId, name: 'Leg Day', date: daysAgo(21), duration_min: 60, overall_feeling: 4, purpose: ['strength'], cooldown_notes: 'Foam rolled IT bands' },
      { user_id: userId, name: 'AM Priming', date: daysAgo(25), duration_min: 15, overall_feeling: 4, purpose: ['mobility', 'warmup'] },
    ])
    .select('id, name');
  if (wLogErr) throw new Error(`Visitor workout logs: ${wLogErr.message}`);
  const wLogId = (name: string) => wLogs?.find(l => l.name === name)?.id;

  // Helper to get first matching log ID (for duplicate names like "Push Day")
  const wLogIds = (name: string) => wLogs?.filter(l => l.name === name).map(l => l.id) ?? [];

  const { error: wExErr } = await supabase.from('workout_log_exercises').insert([
    // Push Day (day 1)
    { log_id: wLogId('Push Day'), name: 'Bench Press', exercise_id: exId('Bench Press'), sets_completed: 4, reps_completed: 8, weight_lbs: 155, sort_order: 1, phase: 'working', rpe: 8, is_circuit: false, to_failure: false, is_unilateral: false },
    { log_id: wLogId('Push Day'), name: 'Overhead Press', exercise_id: exId('Overhead Press'), sets_completed: 3, reps_completed: 10, weight_lbs: 95, sort_order: 2, phase: 'working', rpe: 7, is_circuit: false, to_failure: false, is_unilateral: false },
    { log_id: wLogId('Push Day'), name: 'Push-ups', exercise_id: exId('Push-ups'), sets_completed: 3, reps_completed: 20, sort_order: 3, phase: 'working', rpe: 6, is_circuit: false, to_failure: true, is_unilateral: false },
    { log_id: wLogId('Push Day'), name: 'Plank', exercise_id: exId('Plank'), sets_completed: 3, duration_sec: 60, sort_order: 4, phase: 'cooldown', is_circuit: false, to_failure: false, is_unilateral: false },
    // Pull Day (day 2)
    { log_id: wLogId('Pull Day'), name: 'Pull-ups', exercise_id: exId('Pull-ups'), sets_completed: 4, reps_completed: 8, sort_order: 1, phase: 'working', rpe: 8, is_circuit: false, to_failure: false, is_unilateral: false },
    { log_id: wLogId('Pull Day'), name: 'Barbell Rows', exercise_id: exId('Barbell Rows'), sets_completed: 4, reps_completed: 10, weight_lbs: 135, sort_order: 2, phase: 'working', rpe: 7, is_circuit: false, to_failure: false, is_unilateral: false },
    { log_id: wLogId('Pull Day'), name: 'Dead Bug', exercise_id: exId('Dead Bug'), sets_completed: 3, reps_completed: 10, sort_order: 3, phase: 'cooldown', is_circuit: false, to_failure: false, is_unilateral: false },
    // Leg Day (day 4)
    { log_id: wLogId('Leg Day'), name: 'Back Squat', exercise_id: exId('Back Squat'), sets_completed: 4, reps_completed: 8, weight_lbs: 185, sort_order: 1, phase: 'working', rpe: 9, is_circuit: false, to_failure: false, is_unilateral: false },
    { log_id: wLogId('Leg Day'), name: 'Romanian Deadlift', exercise_id: exId('Romanian Deadlift'), sets_completed: 3, reps_completed: 10, weight_lbs: 155, sort_order: 2, phase: 'working', rpe: 8, is_circuit: false, to_failure: false, is_unilateral: false },
    { log_id: wLogId('Leg Day'), name: 'Lunges', exercise_id: exId('Lunges'), sets_completed: 3, reps_completed: 12, weight_lbs: 40, sort_order: 3, phase: 'working', rpe: 7, is_circuit: false, to_failure: false, is_unilateral: true },
    { log_id: wLogId('Leg Day'), name: 'Hip 90/90 Stretch', exercise_id: exId('Hip 90/90 Stretch'), sets_completed: 2, duration_sec: 30, sort_order: 4, phase: 'cooldown', is_circuit: false, to_failure: false, is_unilateral: false },
    // AM Priming (day 6)
    ...(wLogIds('AM Priming')[0] ? [
      { log_id: wLogIds('AM Priming')[0], name: 'Hip 90/90 Stretch', exercise_id: exId('Hip 90/90 Stretch'), sets_completed: 2, duration_sec: 30, sort_order: 1, phase: 'warmup', is_circuit: false, to_failure: false, is_unilateral: false },
      { log_id: wLogIds('AM Priming')[0], name: 'Dead Bug', exercise_id: exId('Dead Bug'), sets_completed: 2, reps_completed: 8, sort_order: 2, phase: 'working', is_circuit: false, to_failure: false, is_unilateral: false },
      { log_id: wLogIds('AM Priming')[0], name: 'Plank', exercise_id: exId('Plank'), sets_completed: 2, duration_sec: 45, sort_order: 3, phase: 'working', is_circuit: false, to_failure: false, is_unilateral: false },
    ] : []),
    // Full Body HIIT (day 8)
    ...(wLogId('Full Body HIIT') ? [
      { log_id: wLogId('Full Body HIIT'), name: 'Push-ups', exercise_id: exId('Push-ups'), sets_completed: 4, reps_completed: 15, sort_order: 1, phase: 'working', rpe: 7, is_circuit: true, to_failure: false, is_unilateral: false },
      { log_id: wLogId('Full Body HIIT'), name: 'Back Squat', exercise_id: exId('Back Squat'), sets_completed: 4, reps_completed: 12, weight_lbs: 135, sort_order: 2, phase: 'working', rpe: 7, is_circuit: true, to_failure: false, is_unilateral: false },
      { log_id: wLogId('Full Body HIIT'), name: 'Pull-ups', exercise_id: exId('Pull-ups'), sets_completed: 4, reps_completed: 6, sort_order: 3, phase: 'working', rpe: 8, is_circuit: true, to_failure: false, is_unilateral: false },
      { log_id: wLogId('Full Body HIIT'), name: 'Treadmill Run', exercise_id: exId('Treadmill Run'), sets_completed: 1, duration_sec: 300, sort_order: 4, phase: 'cooldown', is_circuit: false, to_failure: false, is_unilateral: false },
    ] : []),
    // Upper Body (day 10)
    ...(wLogIds('Upper Body')[0] ? [
      { log_id: wLogIds('Upper Body')[0], name: 'Bench Press', exercise_id: exId('Bench Press'), sets_completed: 4, reps_completed: 8, weight_lbs: 150, sort_order: 1, phase: 'working', rpe: 7, is_circuit: false, to_failure: false, is_unilateral: false },
      { log_id: wLogIds('Upper Body')[0], name: 'Barbell Rows', exercise_id: exId('Barbell Rows'), sets_completed: 4, reps_completed: 10, weight_lbs: 130, sort_order: 2, phase: 'working', rpe: 7, is_circuit: false, to_failure: false, is_unilateral: false },
      { log_id: wLogIds('Upper Body')[0], name: 'Overhead Press', exercise_id: exId('Overhead Press'), sets_completed: 3, reps_completed: 8, weight_lbs: 90, sort_order: 3, phase: 'working', rpe: 8, is_circuit: false, to_failure: false, is_unilateral: false },
    ] : []),
    // Recovery & Mobility (day 14)
    ...(wLogIds('Recovery & Mobility')[0] ? [
      { log_id: wLogIds('Recovery & Mobility')[0], name: 'Hip 90/90 Stretch', exercise_id: exId('Hip 90/90 Stretch'), sets_completed: 3, duration_sec: 45, sort_order: 1, phase: 'working', is_circuit: false, to_failure: false, is_unilateral: false },
      { log_id: wLogIds('Recovery & Mobility')[0], name: 'Plank', exercise_id: exId('Plank'), sets_completed: 2, duration_sec: 60, sort_order: 2, phase: 'working', is_circuit: false, to_failure: false, is_unilateral: false },
      { log_id: wLogIds('Recovery & Mobility')[0], name: 'Dead Bug', exercise_id: exId('Dead Bug'), sets_completed: 3, reps_completed: 10, sort_order: 3, phase: 'working', is_circuit: false, to_failure: false, is_unilateral: false },
    ] : []),
  ]);
  if (wExErr) throw new Error(`Visitor workout log exercises: ${wExErr.message}`);

  // ── Workout Feedback (for recent workouts) ──
  const feedbackRows = [
    { user_id: userId, workout_log_id: wLogId('Push Day'), activity_category: 'WORKOUT_GYM', activity_duration: '60', mood_before: 3, mood_after: 4, difficulty: 'just-right', feedback: 'Bench press felt solid. Shoulder warm-up really helped today.' },
    { user_id: userId, workout_log_id: wLogId('Pull Day'), activity_category: 'WORKOUT_GYM', activity_duration: '45', mood_before: 4, mood_after: 5, difficulty: 'just-right', feedback: 'Best pull-up session in weeks. Back pump was great.' },
    { user_id: userId, workout_log_id: wLogId('Leg Day'), activity_category: 'WORKOUT_GYM', activity_duration: '60', mood_before: 3, mood_after: 3, difficulty: 'harder', feedback: 'Squats were heavy today. Knee felt tight on the last set.' },
    { user_id: userId, workout_log_id: wLogId('Full Body HIIT'), activity_category: 'WORKOUT_GYM', activity_duration: '30', mood_before: 3, mood_after: 5, difficulty: 'just-right', feedback: 'Circuit format kept the heart rate up. Great conditioning workout.' },
    ...(wLogIds('Recovery & Mobility')[0] ? [
      { user_id: userId, workout_log_id: wLogIds('Recovery & Mobility')[0], activity_category: 'PM' as const, activity_duration: '30', mood_before: 2, mood_after: 4, difficulty: 'easier' as const, feedback: 'Really needed this after a stressful week. Feel much looser now.' },
    ] : []),
  ].filter(r => r.workout_log_id);
  if (feedbackRows.length > 0) {
    const { error: wfErr } = await supabase.from('workout_feedback').insert(feedbackRows);
    if (wfErr) throw new Error(`Visitor workout feedback: ${wfErr.message}`);
  }

  // ── Equipment ──
  const { data: eqCats, error: eqCatErr } = await supabase
    .from('equipment_categories')
    .insert([
      { user_id: userId, name: 'Electronics', sort_order: 1 },
      { user_id: userId, name: 'Fitness', sort_order: 2 },
      { user_id: userId, name: 'Travel', sort_order: 3 },
      { user_id: userId, name: 'Office', sort_order: 4 },
    ])
    .select('id, name');
  if (eqCatErr) throw new Error(`Visitor equipment categories: ${eqCatErr.message}`);
  const eqCatId = (name: string) => eqCats?.find(c => c.name === name)?.id ?? null;

  const { error: eqErr } = await supabase.from('equipment').insert([
    { user_id: userId, name: 'MacBook Pro 16"', category_id: eqCatId('Electronics'), brand: 'Apple', model: 'M3 Max', purchase_date: daysAgo(120), purchase_price: 3499, current_value: 3000, condition: 'excellent' },
    { user_id: userId, name: 'AirPods Pro', category_id: eqCatId('Electronics'), brand: 'Apple', model: '2nd Gen', purchase_date: daysAgo(200), purchase_price: 249, current_value: 180, condition: 'good' },
    { user_id: userId, name: 'Adjustable Dumbbells', category_id: eqCatId('Fitness'), brand: 'Bowflex', model: 'SelectTech 552', purchase_date: daysAgo(365), purchase_price: 349, current_value: 250, condition: 'good' },
    { user_id: userId, name: 'Yoga Mat', category_id: eqCatId('Fitness'), brand: 'Manduka', model: 'PRO', purchase_date: daysAgo(180), purchase_price: 120, current_value: 90, condition: 'excellent' },
    { user_id: userId, name: 'Travel Backpack', category_id: eqCatId('Travel'), brand: 'Peak Design', model: 'Travel 45L', purchase_date: daysAgo(300), purchase_price: 299, current_value: 220, condition: 'good' },
    { user_id: userId, name: 'Standing Desk', category_id: eqCatId('Office'), brand: 'Uplift', model: 'V2 60"', purchase_date: daysAgo(400), purchase_price: 599, current_value: 400, condition: 'excellent' },
  ]);
  if (eqErr) throw new Error(`Visitor equipment: ${eqErr.message}`);

  // ── Life Categories ──
  const { data: lcData, error: lcErr } = await supabase
    .from('life_categories')
    .insert([
      { user_id: userId, name: 'Health', icon: 'heart', color: '#ef4444', sort_order: 1 },
      { user_id: userId, name: 'Finance', icon: 'dollar-sign', color: '#10b981', sort_order: 2 },
      { user_id: userId, name: 'Career', icon: 'briefcase', color: '#6366f1', sort_order: 3 },
      { user_id: userId, name: 'Relationships', icon: 'users', color: '#f59e0b', sort_order: 4 },
      { user_id: userId, name: 'Fitness', icon: 'dumbbell', color: '#ec4899', sort_order: 5 },
      { user_id: userId, name: 'Travel', icon: 'map-pin', color: '#14b8a6', sort_order: 6 },
      { user_id: userId, name: 'Learning', icon: 'book-open', color: '#8b5cf6', sort_order: 7 },
      { user_id: userId, name: 'Creativity', icon: 'palette', color: '#f97316', sort_order: 8 },
    ])
    .select('id, name');
  if (lcErr) throw new Error(`Visitor life categories: ${lcErr.message}`);

  // Tag some existing entities with life categories
  const lcId = (name: string) => lcData?.find(c => c.name === name)?.id;
  if (lcData && wLogs) {
    const tagRows = [
      ...(wLogs.map(l => ({ user_id: userId, life_category_id: lcId('Fitness'), entity_type: 'workout' as const, entity_id: l.id }))),
    ];
    if (tagRows.length > 0 && tagRows.every(r => r.life_category_id)) {
      const { error: tagErr } = await supabase.from('entity_life_categories').insert(tagRows);
      if (tagErr) throw new Error(`Visitor life category tags: ${tagErr.message}`);
    }
  }

  // ── Focus Sessions (10 sessions over 30 days) ──
  const DAY_MS = 86400000;
  const { error: fsErr } = await supabase.from('focus_sessions').insert([
    { user_id: userId, start_time: new Date(Date.now() - 90 * 60000).toISOString(), end_time: new Date(Date.now() - 40 * 60000).toISOString(), duration: 50, notes: 'Deep work on client proposal — DataCo SOW', session_type: 'focus', hourly_rate: 150, revenue: 125 },
    { user_id: userId, start_time: new Date(Date.now() - DAY_MS - 120 * 60000).toISOString(), end_time: new Date(Date.now() - DAY_MS - 45 * 60000).toISOString(), duration: 75, notes: 'Code review and architecture planning', session_type: 'work', hourly_rate: 0, revenue: 0 },
    { user_id: userId, start_time: new Date(Date.now() - 2 * DAY_MS - 60 * 60000).toISOString(), end_time: new Date(Date.now() - 2 * DAY_MS - 15 * 60000).toISOString(), duration: 45, notes: 'Blog writing — fuel tracking post', session_type: 'focus', hourly_rate: 0, revenue: 0 },
    { user_id: userId, start_time: new Date(Date.now() - 3 * DAY_MS - 90 * 60000).toISOString(), end_time: new Date(Date.now() - 3 * DAY_MS - 30 * 60000).toISOString(), duration: 60, notes: 'Financial reconciliation and invoice review', session_type: 'work', hourly_rate: 150, revenue: 150 },
    { user_id: userId, start_time: new Date(Date.now() - 4 * DAY_MS - 50 * 60000).toISOString(), end_time: new Date(Date.now() - 4 * DAY_MS).toISOString(), duration: 50, notes: 'Client presentation prep — TechCorp Q1 review', session_type: 'focus', hourly_rate: 150, revenue: 125 },
    { user_id: userId, start_time: new Date(Date.now() - 7 * DAY_MS - 80 * 60000).toISOString(), end_time: new Date(Date.now() - 7 * DAY_MS - 20 * 60000).toISOString(), duration: 60, notes: 'Market research for consulting pitch', session_type: 'focus', hourly_rate: 150, revenue: 150 },
    { user_id: userId, start_time: new Date(Date.now() - 10 * DAY_MS - 45 * 60000).toISOString(), end_time: new Date(Date.now() - 10 * DAY_MS).toISOString(), duration: 45, notes: 'Quarterly goal review and roadmap update', session_type: 'work', hourly_rate: 0, revenue: 0 },
    { user_id: userId, start_time: new Date(Date.now() - 14 * DAY_MS - 55 * 60000).toISOString(), end_time: new Date(Date.now() - 14 * DAY_MS - 10 * 60000).toISOString(), duration: 45, notes: 'Blog post outline — longevity habits for desk workers', session_type: 'focus', hourly_rate: 0, revenue: 0 },
    { user_id: userId, start_time: new Date(Date.now() - 18 * DAY_MS - 90 * 60000).toISOString(), end_time: new Date(Date.now() - 18 * DAY_MS - 30 * 60000).toISOString(), duration: 60, notes: 'StartupXYZ project planning session', session_type: 'work', hourly_rate: 150, revenue: 150 },
    { user_id: userId, start_time: new Date(Date.now() - 22 * DAY_MS - 40 * 60000).toISOString(), end_time: new Date(Date.now() - 22 * DAY_MS).toISOString(), duration: 40, notes: 'Equipment inventory and valuation updates', session_type: 'work', hourly_rate: 0, revenue: 0 },
  ]);
  if (fsErr) throw new Error(`Visitor focus sessions: ${fsErr.message}`);

  // ── Daily Logs (30 days — cross-module references) ──
  const visitorWins = [
    'Completed push day workout — new PR on bench press',
    'Hit 10K steps before noon on a rest day',
    'Closed $4,800 consulting invoice from TechCorp',
    'Meal prepped for the whole week — saved ~$60 on dining',
    'Morning bike ride to Embarcadero — 12.5 miles',
    'Deep focus session on client proposal — 50 min unbroken',
    'Got 8+ hours of sleep for the first time this week',
    'Completed pull day and felt strongest in weeks',
    'Finished blog post draft on fuel tracking',
    'Negotiated lower internet bill — saved $20/month',
    'Bike ride across Golden Gate Bridge — 15.3 miles',
    'Completed full body HIIT circuit in 30 minutes',
    'Health baseline labs all came back in optimal range',
    'Road trip to Joshua Tree — incredible sunset',
    'Recovery & mobility session — hip flexibility improving',
    'Closed $3,600 invoice from BetaCo',
    'Stayed under budget for groceries this week',
    'AM priming routine felt great — energy lasted all morning',
    'Completed 4 workouts this week on schedule',
    'Focus session: finished quarterly roadmap update',
    'Bike ride to Sausalito — personal best time',
    'Logged all health metrics every day this week',
    'Started new mobility routine with yoga mat',
    'Client proposal accepted — new contract signed',
    'Tracked all fuel stops — MPG trending up',
    'Leg day PR: 185 lb back squat for 4x8',
    'Cooked 3 new recipes from meal plan',
    'Organized all equipment valuations',
    'Morning walk + journaling before 7 AM',
    'Net positive income month — $3.2K ahead of budget',
  ];
  const visitorChallenges = [
    'Poor sleep — only 5.5 hours, stress from deadline',
    'Skipped workout due to lower back tightness',
    'Overspent on dining out this week — $85 over budget',
    null,
    'Client meeting ran 90 min over scheduled time',
    null,
    'Energy crashed hard after lunch — need better snacks',
    null,
    'Traffic made commute 45+ min each way',
    'Knee felt stiff during leg day squats',
    null,
    'Forgot to log fuel stop — had to estimate',
    null,
    'Road trip fuel costs higher than expected',
    null,
    'Procrastinated on tax paperwork',
    null,
    null,
    'Internet outage during focus session',
    null,
    null,
    'Missed PM recovery stretch',
    null,
    null,
    'Weather canceled planned bike ride',
    null,
    null,
    'Equipment app crashed — lost some notes',
    null,
    null,
  ];
  const dailyLogRows = Array.from({ length: 30 }, (_, i) => ({
    user_id: userId,
    date: daysAgo(i),
    energy_rating: Math.min(5, Math.max(1, 3 + Math.floor(Math.random() * 3) - 1)),
    biggest_win: visitorWins[i % visitorWins.length],
    biggest_challenge: visitorChallenges[i % visitorChallenges.length],
    total_spent: +(Math.random() * 150 + 10).toFixed(2),
    total_earned: i % 7 === 0 ? 5400 : i % 14 === 3 ? 4800 : 0,
  }));
  const { error: dlErr } = await supabase.from('daily_logs').insert(dailyLogRows);
  if (dlErr) throw new Error(`Visitor daily logs: ${dlErr.message}`);

  // ── Weekly Reviews (4 weeks — pre-written, cross-module) ──
  const { error: wrErr } = await supabase.from('weekly_reviews').insert([
    {
      user_id: userId,
      week_start: daysAgo(7),
      content: `## Health & Recovery\nResting heart rate averaged 58 bpm — best week in a month. Sleep averaged 7.4 hours with one rough night at 5.5 hours. Completed 3 workouts: Push Day (bench PR at 155 lb), Pull Day, and a Full Body HIIT circuit. Recovery scores were consistently above 70.\n\n## Finance\nTotal income: $10,200 (salary + TechCorp invoice). Total spending: $684 across groceries ($290), gas ($72), dining ($128), and utilities ($168). Net positive for the month. Stayed within all budget categories.\n\n## Movement & Travel\nLogged 5 trips: 3 by car (office commute, grocery store, client site) and 2 bike rides (Embarcadero 12.5 mi, Golden Gate Park 15.3 mi). Bike savings: ~$8 vs driving.\n\n## Focus & Productivity\n4 focus sessions totaling 3.75 hours. Revenue-generating sessions: $400 billable. Finished the DataCo SOW and TechCorp Q1 review presentation.\n\n## Recommended Focus\nPrioritize sleep consistency — the one 5.5 hr night dragged recovery scores down for 2 days. Aim for 7+ hours every night.`,
    },
    {
      user_id: userId,
      week_start: daysAgo(14),
      content: `## Health & Recovery\nMixed week for health. Only completed 2 workouts (Leg Day + Recovery/Mobility) due to lower back tightness. Recovery scores dipped to 55 mid-week. Sleep averaged 6.8 hours — below target. On the positive side, hip flexibility is noticeably improving from the 90/90 stretches.\n\n## Finance\nTotal income: $5,400 (salary only). Spending: $580. Overspent on dining out ($85 over the $400 budget) with the concert night and brunch. Transferred $500 to savings — on track for annual savings goal.\n\n## Movement & Travel\nQuieter travel week — 3 car trips (office, doctor, client meeting) and 1 bike ride (Ocean Beach 18 mi). Doctor visit confirmed: health baseline labs all optimal. No fuel stops needed.\n\n## Focus & Productivity\n2 focus sessions: quarterly goal review and blog outline for the longevity habits post. No billable hours this week — focused on internal planning.\n\n## Recommended Focus\nAddress the back tightness with daily AM priming. Return to 4x/week workout schedule. Tighten dining spending next week.`,
    },
    {
      user_id: userId,
      week_start: daysAgo(21),
      content: `## Health & Recovery\nBest sleep week of the month — averaged 7.8 hours. Recovery scores stayed above 75 every day. Completed 4 workouts: Push Day, Leg Day, Upper Body, and AM Priming. Stress scores were low (avg 32). Weight stable at 174.5 lbs.\n\n## Finance\nStrong income week: $10,200 (salary + $4,800 StartupXYZ invoice). Total spending: $520. Stayed under every budget category. Coworking space was the biggest discretionary expense ($245).\n\n## Movement & Travel\nCompleted the CA road trip: SF → LA → San Diego → Joshua Tree → Las Vegas → SF. Total driving: 1,493 miles across 5 days. Fuel cost: ~$175. Trip category: personal/vacation. Also logged 1 bike ride (Crissy Field 10.5 mi).\n\n## Focus & Productivity\n3 sessions totaling 2.75 hours. Highlights: StartupXYZ project planning ($150 billable) and equipment inventory update. The road trip reset energy levels nicely.\n\n## Recommended Focus\nMaintain this sleep consistency. The road trip was a good mental reset — schedule another active recovery day this coming week.`,
    },
    {
      user_id: userId,
      week_start: daysAgo(28),
      content: `## Health & Recovery\nDecent week — 3 workouts completed (Push Day, AM Priming, and a bike ride). Sleep averaged 7.1 hours. Recovery scores ranged 60-80. Started tracking active calories — averaging 420/day. Added yoga mat to equipment for the new mobility routine.\n\n## Finance\nTotal income: $8,600 (salary + $3,200 BetaCo invoice). Total spending: $610 across all categories. Notable: $85 for QuickBooks accounting software (business expense). Dentist visit: $180.\n\n## Movement & Travel\nModerate travel week: 4 car trips and 1 bike ride (Sausalito 22.4 mi — personal best!). Filed 2 business trips for tax deductions. Fuel economy staying consistent at ~29.2 MPG.\n\n## Focus & Productivity\n2 sessions totaling 1.75 hours. Blog post published on fuel tracking basics. Started financial reconciliation for the month.\n\n## Recommended Focus\nBlock out more focus session time — only 1.75 hours this week is below the 5-hour target. The Sausalito ride shows fitness is improving — consider increasing bike commute frequency.`,
    },
  ]);
  if (wrErr) throw new Error(`Visitor weekly reviews: ${wrErr.message}`);

  // ── Recipes ──
  const { error: recipeErr } = await supabase.from('recipes').insert([
    {
      user_id: userId, title: 'Mediterranean Quinoa Bowl', slug: 'mediterranean-quinoa-bowl',
      description: 'A nutrient-dense bowl packed with protein and healthy fats — perfect for meal prep.',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cook quinoa according to package directions. Top with chickpeas, cucumber, cherry tomatoes, kalamata olives, feta cheese, and a drizzle of olive oil and lemon juice. Season with oregano and salt.' }] }] },
      visibility: 'public', tags: ['meal-prep', 'high-protein', 'mediterranean'],
      total_calories: 485, total_protein_g: 22, total_carbs_g: 58, total_fat_g: 20, total_fiber_g: 9,
      ncv_score: 'Green', servings: 2, prep_time_minutes: 10, cook_time_minutes: 20,
      published_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
    {
      user_id: userId, title: 'Post-Workout Protein Smoothie', slug: 'post-workout-protein-smoothie',
      description: 'Quick recovery shake with banana, protein powder, and almond butter.',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Blend 1 frozen banana, 1 scoop whey protein, 1 tbsp almond butter, 1 cup almond milk, and a handful of spinach until smooth. Add ice if desired.' }] }] },
      visibility: 'public', tags: ['smoothie', 'post-workout', 'quick'],
      total_calories: 340, total_protein_g: 32, total_carbs_g: 38, total_fat_g: 10, total_fiber_g: 5,
      ncv_score: 'Green', servings: 1, prep_time_minutes: 5, cook_time_minutes: 0,
      published_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    },
    {
      user_id: userId, title: 'Sheet Pan Salmon with Roasted Vegetables', slug: 'sheet-pan-salmon-vegetables',
      description: 'Omega-3 rich dinner that requires minimal cleanup — a weeknight staple.',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Place salmon fillets and chopped broccoli, sweet potato, and bell peppers on a sheet pan. Season with olive oil, garlic, lemon, salt, and pepper. Roast at 400°F for 20 minutes.' }] }] },
      visibility: 'public', tags: ['dinner', 'omega-3', 'easy'],
      total_calories: 520, total_protein_g: 38, total_carbs_g: 42, total_fat_g: 18, total_fiber_g: 7,
      ncv_score: 'Green', servings: 2, prep_time_minutes: 10, cook_time_minutes: 20,
      published_at: new Date(Date.now() - 21 * 86400000).toISOString(),
    },
    {
      user_id: userId, title: 'Overnight Oats with Berries', slug: 'overnight-oats-berries',
      description: 'Prep the night before for a grab-and-go breakfast packed with fiber.',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Combine 1/2 cup rolled oats, 1/2 cup Greek yogurt, 1/2 cup milk, 1 tbsp chia seeds, and 1 tsp honey in a jar. Top with mixed berries. Refrigerate overnight.' }] }] },
      visibility: 'public', tags: ['breakfast', 'meal-prep', 'fiber'],
      total_calories: 380, total_protein_g: 18, total_carbs_g: 52, total_fat_g: 12, total_fiber_g: 8,
      ncv_score: 'Green', servings: 1, prep_time_minutes: 5, cook_time_minutes: 0,
      published_at: new Date(Date.now() - 28 * 86400000).toISOString(),
    },
  ]);
  if (recipeErr) throw new Error(`Visitor recipes: ${recipeErr.message}`);

  // ── Blog Posts ──
  const { error: blogErr } = await supabase.from('blog_posts').insert([
    {
      user_id: userId, title: 'Why I Track Everything: My Centenarian OS Journey',
      slug: 'why-i-track-everything',
      excerpt: 'How combining financial, health, and productivity tracking into one system changed my approach to longevity.',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Six months ago I started tracking my resting heart rate, daily spending, workout volume, and sleep in a single dashboard. The correlations were eye-opening. On weeks where I slept 7+ hours consistently, my spending dropped 15% (fewer impulse purchases), my workout performance improved, and my focus sessions were 20% longer. The data tells a clear story: health, wealth, and productivity are deeply connected. CentenarianOS makes these connections visible.' }] }] },
      visibility: 'public', tags: ['longevity', 'tracking', 'personal'],
      published_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    },
    {
      user_id: userId, title: 'Fuel Tracking 101: Know What You Put In Your Body',
      slug: 'fuel-tracking-101',
      excerpt: 'A practical guide to the NCV framework and how nutrition tracking connects to your broader health picture.',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The Nutrition-Calorie-Volume (NCV) framework simplifies meal tracking into three categories: Green (nutrient-dense, go-to meals), Yellow (moderate — fine in rotation), and Red (occasional treats). Instead of counting every calorie, you rate each meal and watch the ratio shift over time. Combined with health metrics like resting heart rate and recovery scores, you can actually see how your food choices affect your body within days, not months.' }] }] },
      visibility: 'public', tags: ['nutrition', 'fuel', 'guide'],
      published_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    },
    {
      user_id: userId, title: 'The Road Trip That Changed My Perspective on Travel Tracking',
      slug: 'road-trip-travel-tracking',
      excerpt: 'SF to Vegas and back — what 1,493 miles of logged data taught me about intentional travel.',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'When I drove from San Francisco to Las Vegas via LA, San Diego, and Joshua Tree, I logged every mile, every fuel stop, and every dollar spent. Total distance: 1,493 miles. Total fuel cost: $175. Average MPG: 29.2. But the real insight came from linking travel data to my other modules. My sleep scores dropped 12% during the trip, my spending spiked by 40%, and my workout streak broke at day 14. The data helped me plan better for my next road trip — scheduling rest days, pre-booking meals, and setting fuel budget alerts.' }] }] },
      visibility: 'public', tags: ['travel', 'road-trip', 'data'],
      published_at: new Date(Date.now() - 35 * 86400000).toISOString(),
    },
  ]);
  if (blogErr) throw new Error(`Visitor blog posts: ${blogErr.message}`);

  // ── Contact Locations (sub-locations for existing contacts) ──
  const { data: contactData } = await supabase
    .from('user_contacts')
    .select('id, name')
    .eq('user_id', userId);
  const contactId = (name: string) => contactData?.find(c => c.name === name)?.id;
  if (contactData) {
    const locRows = [
      contactId('Costco Gas') && { contact_id: contactId('Costco Gas'), label: 'SOMA', address: '450 10th St, San Francisco, CA', is_default: true, sort_order: 1 },
      contactId('Costco Gas') && { contact_id: contactId('Costco Gas'), label: 'South SF', address: '451 S Airport Blvd, South San Francisco, CA', is_default: false, sort_order: 2 },
      contactId('Whole Foods') && { contact_id: contactId('Whole Foods'), label: 'SoMa', address: '399 4th St, San Francisco, CA', is_default: true, sort_order: 1 },
      contactId('Honda Dealership') && { contact_id: contactId('Honda Dealership'), label: 'Serramonte', address: '700 Serramonte Blvd, Colma, CA', is_default: true, sort_order: 1 },
    ].filter(Boolean);
    if (locRows.length > 0) {
      const { error: locErr } = await supabase.from('contact_locations').insert(locRows);
      if (locErr) throw new Error(`Visitor contact locations: ${locErr.message}`);
    }
  }

  // ── Media Categories & Items ──
  const { data: vMediaCats, error: vMediaCatErr } = await supabase
    .from('media_categories')
    .insert([
      { user_id: userId, name: 'Books', icon: '📚', color: '#3b82f6', sort_order: 1 },
      { user_id: userId, name: 'TV & Film', icon: '🎬', color: '#ef4444', sort_order: 2 },
      { user_id: userId, name: 'Music', icon: '🎵', color: '#10b981', sort_order: 3 },
      { user_id: userId, name: 'Podcasts', icon: '🎙️', color: '#8b5cf6', sort_order: 4 },
      { user_id: userId, name: 'Art', icon: '🎨', color: '#f59e0b', sort_order: 5 },
    ])
    .select('id, name');
  if (vMediaCatErr) throw new Error(`Visitor media categories: ${vMediaCatErr.message}`);
  const vMCatId = (name: string) => vMediaCats?.find(c => c.name === name)?.id ?? null;

  const { data: vMediaItems, error: vMediaErr } = await supabase.from('media_items').insert([
    { user_id: userId, title: 'Outlive: The Science & Art of Longevity', creator: 'Peter Attia', media_type: 'book', status: 'completed', rating: 5, start_date: daysAgo(90), end_date: daysAgo(45), category_id: vMCatId('Books'), genre: ['health', 'longevity'], tags: ['must-read'], is_favorite: true, visibility: 'public' },
    { user_id: userId, title: 'Atomic Habits', creator: 'James Clear', media_type: 'book', status: 'completed', rating: 5, start_date: daysAgo(120), end_date: daysAgo(100), category_id: vMCatId('Books'), genre: ['productivity', 'habits'], is_favorite: false, visibility: 'public' },
    { user_id: userId, title: 'The 100-Year Life', creator: 'Lynda Gratton', media_type: 'book', status: 'in_progress', current_progress: 'Part 3', total_length: '4 parts', category_id: vMCatId('Books'), genre: ['longevity', 'economics'], is_favorite: false, visibility: 'private' },
    { user_id: userId, title: 'Blue Zones Kitchen', creator: 'Dan Buettner', media_type: 'book', status: 'want_to_consume', category_id: vMCatId('Books'), genre: ['cooking', 'longevity'], is_favorite: false, visibility: 'private' },
    { user_id: userId, title: 'Born to Run', creator: 'Christopher McDougall', media_type: 'book', status: 'completed', rating: 4, category_id: vMCatId('Books'), genre: ['running', 'adventure'], is_favorite: false, visibility: 'private' },
    { user_id: userId, title: 'Shogun', creator: 'FX / Hulu', media_type: 'tv_show', status: 'completed', rating: 5, category_id: vMCatId('TV & Film'), genre: ['drama', 'historical'], season_number: 1, episode_number: 10, total_seasons: 1, total_episodes: 10, year_released: 2024, is_favorite: true, visibility: 'public' },
    { user_id: userId, title: 'Past Lives', creator: 'Celine Song', media_type: 'movie', status: 'completed', rating: 5, category_id: vMCatId('TV & Film'), genre: ['drama', 'romance'], year_released: 2023, is_favorite: false, visibility: 'public' },
    { user_id: userId, title: 'Huberman Lab', creator: 'Andrew Huberman', media_type: 'podcast', status: 'in_progress', category_id: vMCatId('Podcasts'), genre: ['health', 'neuroscience'], is_favorite: true, visibility: 'public' },
    { user_id: userId, title: 'The Drive', creator: 'Peter Attia', media_type: 'podcast', status: 'in_progress', category_id: vMCatId('Podcasts'), genre: ['health', 'longevity'], is_favorite: false, visibility: 'private' },
    { user_id: userId, title: 'Kind of Blue', creator: 'Miles Davis', media_type: 'album', status: 'completed', rating: 5, category_id: vMCatId('Music'), genre: ['jazz'], year_released: 1959, is_favorite: true, visibility: 'private' },
  ]).select('id, title');
  if (vMediaErr) throw new Error(`Visitor media items: ${vMediaErr.message}`);

  // ── Media Notes ──
  const vOutliveId = vMediaItems?.find(m => m.title.startsWith('Outlive'))?.id;
  const vAtomicId = vMediaItems?.find(m => m.title === 'Atomic Habits')?.id;
  const noteRows = [
    vOutliveId && { user_id: userId, media_item_id: vOutliveId, title: 'Core framework', content: 'Medicine 3.0: proactive health optimization. The four horsemen — heart disease, cancer, neurodegenerative disease, metabolic dysfunction. Exercise is the most potent longevity "drug" we have.', note_type: 'review', content_format: 'markdown' },
    vOutliveId && { user_id: userId, media_item_id: vOutliveId, title: 'Exercise hierarchy', content: 'Zone 2 cardio (3-4x/week, 45min), strength training (3x/week), stability & mobility daily. These form the "centenarian decathlon" training base.', note_type: 'general', content_format: 'markdown' },
    vAtomicId && { user_id: userId, media_item_id: vAtomicId, title: 'Key takeaway', content: '"You do not rise to the level of your goals. You fall to the level of your systems." Applied this directly to my tracking habits in CentenarianOS.', note_type: 'quote', content_format: 'markdown' },
  ].filter(Boolean);
  if (noteRows.length > 0) {
    await supabase.from('media_notes').insert(noteRows);
  }

  // ── Invoices ──
  if (brandId) {
    const { error: invErr } = await supabase.from('invoices').insert([
      {
        user_id: userId, brand_id: brandId, invoice_number: 'INV-2026-001',
        client_name: 'TechCorp Inc.', client_email: 'billing@techcorp.example.com',
        client_address: '123 Tech Blvd, San Jose, CA 95110',
        issue_date: daysAgo(30), due_date: daysAgo(0), status: 'paid', paid_date: daysAgo(5),
        subtotal: 4800, tax_rate: 0, tax_amount: 0, total: 4800, notes: 'March consulting engagement',
        items: [{ description: 'Technology consulting — 40 hours @ $120/hr', quantity: 40, unit_price: 120, amount: 4800 }],
      },
      {
        user_id: userId, brand_id: brandId, invoice_number: 'INV-2026-002',
        client_name: 'StartupXYZ', client_email: 'accounts@startupxyz.example.com',
        client_address: '789 Startup Way, Palo Alto, CA 94301',
        issue_date: daysAgo(7), due_date: daysAgo(-23), status: 'sent',
        subtotal: 3600, tax_rate: 0, tax_amount: 0, total: 3600, notes: 'Architecture review + recommendations',
        items: [
          { description: 'Architecture review — 20 hours @ $120/hr', quantity: 20, unit_price: 120, amount: 2400 },
          { description: 'Written recommendations report', quantity: 1, unit_price: 1200, amount: 1200 },
        ],
      },
    ]);
    if (invErr) throw new Error(`Visitor invoices: ${invErr.message}`);
  }

  // ── Equipment Valuations ──
  const vEqList = await supabase.from('equipment').select('id, name').eq('user_id', userId);
  const laptopEqId = vEqList?.data?.find(e => e.name?.includes('ThinkPad'))?.id;
  const barbellEqId = vEqList?.data?.find(e => e.name?.includes('Barbell'))?.id;
  if (laptopEqId) {
    await supabase.from('equipment_valuations').insert([
      { equipment_id: laptopEqId, user_id: userId, value: 1400, valued_date: daysAgo(90), notes: 'Purchase value' },
      { equipment_id: laptopEqId, user_id: userId, value: 1100, valued_date: daysAgo(30), notes: '1 year depreciation estimate' },
    ]);
  }
  if (barbellEqId) {
    await supabase.from('equipment_valuations').insert([
      { equipment_id: barbellEqId, user_id: userId, value: 280, valued_date: daysAgo(60), notes: 'Purchase value' },
      { equipment_id: barbellEqId, user_id: userId, value: 250, valued_date: daysAgo(0), notes: 'Current market estimate' },
    ]);
  }

  // ── Cross-Module Activity Links ──
  const vBlogData = await supabase.from('blog_posts').select('id, title').eq('user_id', userId);
  const vBlogId = (title: string) => vBlogData?.data?.find(b => b.title.includes(title))?.id;
  const vRecipeData = await supabase.from('recipes').select('id, title').eq('user_id', userId);
  const vRecipeId = (title: string) => vRecipeData?.data?.find(r => r.title.includes(title))?.id;
  const vTripData = await supabase.from('trips').select('id').eq('user_id', userId).limit(3);
  const vTxData = await supabase.from('financial_transactions').select('id').eq('user_id', userId).eq('type', 'expense').limit(3);
  const vWorkoutData = await supabase.from('workout_logs').select('id, name').eq('user_id', userId).limit(2);
  const vEquipData = await supabase.from('equipment').select('id, name').eq('user_id', userId).limit(2);
  const wkId = (name: string) => vWorkoutData?.data?.find(w => w.name?.includes(name))?.id;
  const eqpId = (name: string) => vEquipData?.data?.find(e => e.name?.includes(name))?.id;

  const vLinkRows = [
    // recipe → blog post
    vRecipeId('Salmon') && vBlogId('Fuel Tracking') && { user_id: userId, source_type: 'recipe', source_id: vRecipeId('Salmon'), target_type: 'blog_post', target_id: vBlogId('Fuel Tracking') },
    // trip → transaction
    vTripData?.data?.[0]?.id && vTxData?.data?.[0]?.id && { user_id: userId, source_type: 'trip', source_id: vTripData.data[0].id, target_type: 'transaction', target_id: vTxData.data[0].id },
    // workout → equipment
    wkId('Push') && eqpId('Barbell') && { user_id: userId, source_type: 'workout', source_id: wkId('Push'), target_type: 'equipment', target_id: eqpId('Barbell') },
    // media → recipe (longevity book inspired a recipe)
    vOutliveId && vRecipeId('Salmon') && { user_id: userId, source_type: 'media_item', source_id: vOutliveId, target_type: 'recipe', target_id: vRecipeId('Salmon') },
    // trip → blog post (road trip blog)
    vTripData?.data?.[1]?.id && vBlogId('Road Trip') && { user_id: userId, source_type: 'trip', source_id: vTripData.data[1].id, target_type: 'blog_post', target_id: vBlogId('Road Trip') },
  ].filter(Boolean);
  if (vLinkRows.length > 0) {
    await supabase.from('activity_links').insert(vLinkRows);
  }
}
