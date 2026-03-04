// lib/demo/seed.ts
// Shared demo data seed functions — used by demo/reset (cron) and admin invite seeding.

import { SupabaseClient } from '@supabase/supabase-js';

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// Deletion order respects FK constraints (all use ON DELETE SET NULL or CASCADE)
export const CLEAR_ORDER = [
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
}
