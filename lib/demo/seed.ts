// lib/demo/seed.ts
// Shared demo data seed functions — used by demo/reset (cron) and admin invite seeding.

import { SupabaseClient } from '@supabase/supabase-js';

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// Deletion order respects FK constraints (children before parents)
export const CLEAR_ORDER = [
  'activity_links',
  'entity_life_categories',
  'workout_log_exercises',
  'workout_logs',
  'workout_feedback',
  'weekly_reviews',
  'daily_logs',
  'exercise_equipment',
  'exercises',
  'exercise_categories',
  'equipment_valuations',
  'equipment',
  'equipment_categories',
  'focus_sessions',
  'tasks',
  'milestones',
  'goals',
  'roadmaps',
  'user_health_metrics',
  'life_categories',
  'trips',
  'vehicle_maintenance',
  'fuel_logs',
  'financial_transactions',
  'user_brands',
  'user_contacts',
  'budget_categories',
  'financial_accounts',
  'vehicles',
];

export async function clearUserData(supabase: SupabaseClient, userId: string): Promise<void> {
  for (const table of CLEAR_ORDER) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    if (error) throw new Error(`Failed to clear ${table}: ${error.message}`);
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
    source: 'manual' as const,
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
      { log_id: logId, name: 'Push-ups', exercise_id: exId('Push-ups'), sets_completed: 3, reps_completed: 15, sort_order: 1, phase: 'working', rpe: 7 },
      { log_id: logId, name: 'Squats', exercise_id: exId('Squats'), sets_completed: 3, reps_completed: 12, weight_lbs: 135, sort_order: 2, phase: 'working', rpe: 8 },
      { log_id: logId, name: 'Plank', exercise_id: exId('Plank'), sets_completed: 3, duration_sec: 45, sort_order: 3, phase: 'cooldown' },
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
    source: 'manual' as const,
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
    { log_id: wLogId('Push Day'), name: 'Bench Press', exercise_id: exId('Bench Press'), sets_completed: 4, reps_completed: 8, weight_lbs: 155, sort_order: 1, phase: 'working', rpe: 8 },
    { log_id: wLogId('Push Day'), name: 'Overhead Press', exercise_id: exId('Overhead Press'), sets_completed: 3, reps_completed: 10, weight_lbs: 95, sort_order: 2, phase: 'working', rpe: 7 },
    { log_id: wLogId('Push Day'), name: 'Push-ups', exercise_id: exId('Push-ups'), sets_completed: 3, reps_completed: 20, sort_order: 3, phase: 'working', rpe: 6, to_failure: true },
    { log_id: wLogId('Push Day'), name: 'Plank', exercise_id: exId('Plank'), sets_completed: 3, duration_sec: 60, sort_order: 4, phase: 'cooldown' },
    // Pull Day (day 2)
    { log_id: wLogId('Pull Day'), name: 'Pull-ups', exercise_id: exId('Pull-ups'), sets_completed: 4, reps_completed: 8, sort_order: 1, phase: 'working', rpe: 8 },
    { log_id: wLogId('Pull Day'), name: 'Barbell Rows', exercise_id: exId('Barbell Rows'), sets_completed: 4, reps_completed: 10, weight_lbs: 135, sort_order: 2, phase: 'working', rpe: 7 },
    { log_id: wLogId('Pull Day'), name: 'Dead Bug', exercise_id: exId('Dead Bug'), sets_completed: 3, reps_completed: 10, sort_order: 3, phase: 'cooldown' },
    // Leg Day (day 4)
    { log_id: wLogId('Leg Day'), name: 'Back Squat', exercise_id: exId('Back Squat'), sets_completed: 4, reps_completed: 8, weight_lbs: 185, sort_order: 1, phase: 'working', rpe: 9 },
    { log_id: wLogId('Leg Day'), name: 'Romanian Deadlift', exercise_id: exId('Romanian Deadlift'), sets_completed: 3, reps_completed: 10, weight_lbs: 155, sort_order: 2, phase: 'working', rpe: 8 },
    { log_id: wLogId('Leg Day'), name: 'Lunges', exercise_id: exId('Lunges'), sets_completed: 3, reps_completed: 12, weight_lbs: 40, sort_order: 3, phase: 'working', rpe: 7, is_unilateral: true },
    { log_id: wLogId('Leg Day'), name: 'Hip 90/90 Stretch', exercise_id: exId('Hip 90/90 Stretch'), sets_completed: 2, duration_sec: 30, sort_order: 4, phase: 'cooldown' },
    // AM Priming (day 6)
    ...(wLogIds('AM Priming')[0] ? [
      { log_id: wLogIds('AM Priming')[0], name: 'Hip 90/90 Stretch', exercise_id: exId('Hip 90/90 Stretch'), sets_completed: 2, duration_sec: 30, sort_order: 1, phase: 'warmup' },
      { log_id: wLogIds('AM Priming')[0], name: 'Dead Bug', exercise_id: exId('Dead Bug'), sets_completed: 2, reps_completed: 8, sort_order: 2, phase: 'working' },
      { log_id: wLogIds('AM Priming')[0], name: 'Plank', exercise_id: exId('Plank'), sets_completed: 2, duration_sec: 45, sort_order: 3, phase: 'working' },
    ] : []),
    // Full Body HIIT (day 8)
    ...(wLogId('Full Body HIIT') ? [
      { log_id: wLogId('Full Body HIIT'), name: 'Push-ups', exercise_id: exId('Push-ups'), sets_completed: 4, reps_completed: 15, sort_order: 1, phase: 'working', rpe: 7, is_circuit: true },
      { log_id: wLogId('Full Body HIIT'), name: 'Back Squat', exercise_id: exId('Back Squat'), sets_completed: 4, reps_completed: 12, weight_lbs: 135, sort_order: 2, phase: 'working', rpe: 7, is_circuit: true },
      { log_id: wLogId('Full Body HIIT'), name: 'Pull-ups', exercise_id: exId('Pull-ups'), sets_completed: 4, reps_completed: 6, sort_order: 3, phase: 'working', rpe: 8, is_circuit: true },
      { log_id: wLogId('Full Body HIIT'), name: 'Treadmill Run', exercise_id: exId('Treadmill Run'), sets_completed: 1, duration_sec: 300, sort_order: 4, phase: 'cooldown' },
    ] : []),
    // Upper Body (day 10)
    ...(wLogIds('Upper Body')[0] ? [
      { log_id: wLogIds('Upper Body')[0], name: 'Bench Press', exercise_id: exId('Bench Press'), sets_completed: 4, reps_completed: 8, weight_lbs: 150, sort_order: 1, phase: 'working', rpe: 7 },
      { log_id: wLogIds('Upper Body')[0], name: 'Barbell Rows', exercise_id: exId('Barbell Rows'), sets_completed: 4, reps_completed: 10, weight_lbs: 130, sort_order: 2, phase: 'working', rpe: 7 },
      { log_id: wLogIds('Upper Body')[0], name: 'Overhead Press', exercise_id: exId('Overhead Press'), sets_completed: 3, reps_completed: 8, weight_lbs: 90, sort_order: 3, phase: 'working', rpe: 8 },
    ] : []),
    // Recovery & Mobility (day 14)
    ...(wLogIds('Recovery & Mobility')[0] ? [
      { log_id: wLogIds('Recovery & Mobility')[0], name: 'Hip 90/90 Stretch', exercise_id: exId('Hip 90/90 Stretch'), sets_completed: 3, duration_sec: 45, sort_order: 1, phase: 'working' },
      { log_id: wLogIds('Recovery & Mobility')[0], name: 'Plank', exercise_id: exId('Plank'), sets_completed: 2, duration_sec: 60, sort_order: 2, phase: 'working' },
      { log_id: wLogIds('Recovery & Mobility')[0], name: 'Dead Bug', exercise_id: exId('Dead Bug'), sets_completed: 3, reps_completed: 10, sort_order: 3, phase: 'working' },
    ] : []),
  ]);
  if (wExErr) throw new Error(`Visitor workout log exercises: ${wExErr.message}`);

  // ── Workout Feedback (for recent workouts) ──
  const feedbackRows = [
    { user_id: userId, workout_log_id: wLogId('Push Day'), activity_category: 'WORKOUT_GYM', activity_duration: '55', mood_before: 3, mood_after: 4, difficulty: 'just-right', feedback: 'Bench press felt solid. Shoulder warm-up really helped today.' },
    { user_id: userId, workout_log_id: wLogId('Pull Day'), activity_category: 'WORKOUT_GYM', activity_duration: '50', mood_before: 4, mood_after: 5, difficulty: 'just-right', feedback: 'Best pull-up session in weeks. Back pump was great.' },
    { user_id: userId, workout_log_id: wLogId('Leg Day'), activity_category: 'WORKOUT_GYM', activity_duration: '60', mood_before: 3, mood_after: 3, difficulty: 'harder', feedback: 'Squats were heavy today. Knee felt tight on the last set.' },
    { user_id: userId, workout_log_id: wLogId('Full Body HIIT'), activity_category: 'WORKOUT_GYM', activity_duration: '30', mood_before: 3, mood_after: 5, difficulty: 'just-right', feedback: 'Circuit format kept the heart rate up. Great conditioning workout.' },
    ...(wLogIds('Recovery & Mobility')[0] ? [
      { user_id: userId, workout_log_id: wLogIds('Recovery & Mobility')[0], activity_category: 'PM' as const, activity_duration: '25', mood_before: 2, mood_after: 4, difficulty: 'easier' as const, feedback: 'Really needed this after a stressful week. Feel much looser now.' },
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
    { user_id: userId, start_time: new Date(Date.now() - DAY_MS - 120 * 60000).toISOString(), end_time: new Date(Date.now() - DAY_MS - 45 * 60000).toISOString(), duration: 75, notes: 'Code review and architecture planning', session_type: 'work' },
    { user_id: userId, start_time: new Date(Date.now() - 2 * DAY_MS - 60 * 60000).toISOString(), end_time: new Date(Date.now() - 2 * DAY_MS - 15 * 60000).toISOString(), duration: 45, notes: 'Blog writing — fuel tracking post', session_type: 'focus' },
    { user_id: userId, start_time: new Date(Date.now() - 3 * DAY_MS - 90 * 60000).toISOString(), end_time: new Date(Date.now() - 3 * DAY_MS - 30 * 60000).toISOString(), duration: 60, notes: 'Financial reconciliation and invoice review', session_type: 'work', hourly_rate: 150, revenue: 150 },
    { user_id: userId, start_time: new Date(Date.now() - 4 * DAY_MS - 50 * 60000).toISOString(), end_time: new Date(Date.now() - 4 * DAY_MS).toISOString(), duration: 50, notes: 'Client presentation prep — TechCorp Q1 review', session_type: 'focus', hourly_rate: 150, revenue: 125 },
    { user_id: userId, start_time: new Date(Date.now() - 7 * DAY_MS - 80 * 60000).toISOString(), end_time: new Date(Date.now() - 7 * DAY_MS - 20 * 60000).toISOString(), duration: 60, notes: 'Market research for consulting pitch', session_type: 'focus', hourly_rate: 150, revenue: 150 },
    { user_id: userId, start_time: new Date(Date.now() - 10 * DAY_MS - 45 * 60000).toISOString(), end_time: new Date(Date.now() - 10 * DAY_MS).toISOString(), duration: 45, notes: 'Quarterly goal review and roadmap update', session_type: 'work' },
    { user_id: userId, start_time: new Date(Date.now() - 14 * DAY_MS - 55 * 60000).toISOString(), end_time: new Date(Date.now() - 14 * DAY_MS - 10 * 60000).toISOString(), duration: 45, notes: 'Blog post outline — longevity habits for desk workers', session_type: 'focus' },
    { user_id: userId, start_time: new Date(Date.now() - 18 * DAY_MS - 90 * 60000).toISOString(), end_time: new Date(Date.now() - 18 * DAY_MS - 30 * 60000).toISOString(), duration: 60, notes: 'StartupXYZ project planning session', session_type: 'work', hourly_rate: 150, revenue: 150 },
    { user_id: userId, start_time: new Date(Date.now() - 22 * DAY_MS - 40 * 60000).toISOString(), end_time: new Date(Date.now() - 22 * DAY_MS).toISOString(), duration: 40, notes: 'Equipment inventory and valuation updates', session_type: 'work' },
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
}
