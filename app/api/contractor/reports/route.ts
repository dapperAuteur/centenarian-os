// app/api/contractor/reports/route.ts
// GET: contractor earnings reports — by client, 1099 tracking, mileage, benefits YTD

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

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

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10);
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const db = getDb();

  // Parallel queries for all report data
  const [jobsRes, invoicesRes, tripsRes, expensesRes, timeRes] = await Promise.all([
    // All jobs in year
    db.from('contractor_jobs')
      .select('id, job_number, client_name, client_id, status, start_date, end_date, pay_rate, union_local, department, benefits_eligible')
      .eq('user_id', user.id)
      .gte('start_date', startDate)
      .lte('start_date', endDate)
      .order('start_date', { ascending: false }),

    // All invoices linked to jobs in year
    db.from('invoices')
      .select('id, contact_name, total, amount_paid, status, invoice_date, job_id')
      .eq('user_id', user.id)
      .not('job_id', 'is', null)
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate),

    // Mileage from trips linked to jobs
    db.from('trips')
      .select('id, distance_miles, is_round_trip, job_id, trip_date')
      .eq('user_id', user.id)
      .not('job_id', 'is', null)
      .gte('trip_date', startDate)
      .lte('trip_date', endDate),

    // Expenses (financial_transactions with source='job')
    db.from('financial_transactions')
      .select('id, amount, type, job_id, date')
      .eq('user_id', user.id)
      .not('job_id', 'is', null)
      .gte('date', startDate)
      .lte('date', endDate),

    // Time entries for all jobs in year
    db.from('job_time_entries')
      .select('id, job_id, total_hours, st_hours, ot_hours, dt_hours, work_date')
      .eq('user_id', user.id)
      .gte('work_date', startDate)
      .lte('work_date', endDate),
  ]);

  const jobs = jobsRes.data ?? [];
  const invoices = invoicesRes.data ?? [];
  const trips = tripsRes.data ?? [];
  const expenses = expensesRes.data ?? [];
  const timeEntries = timeRes.data ?? [];

  // --- Earnings by client (1099 tracking) ---
  const clientMap = new Map<string, {
    client_name: string;
    client_id: string | null;
    job_count: number;
    total_invoiced: number;
    total_paid: number;
    total_hours: number;
    exceeds_1099: boolean;
  }>();

  for (const job of jobs) {
    const key = job.client_name;
    if (!clientMap.has(key)) {
      clientMap.set(key, {
        client_name: key,
        client_id: job.client_id,
        job_count: 0,
        total_invoiced: 0,
        total_paid: 0,
        total_hours: 0,
        exceeds_1099: false,
      });
    }
    const c = clientMap.get(key)!;
    c.job_count++;
  }

  // Aggregate invoice totals by client (via job)
  const jobClientMap = new Map<string, string>();
  for (const job of jobs) {
    jobClientMap.set(job.id, job.client_name);
  }

  for (const inv of invoices) {
    const clientName = jobClientMap.get(inv.job_id);
    if (!clientName) continue;
    const c = clientMap.get(clientName);
    if (!c) continue;
    c.total_invoiced += Number(inv.total ?? 0);
    c.total_paid += Number(inv.amount_paid ?? 0);
  }

  // Aggregate hours by client
  for (const te of timeEntries) {
    const clientName = jobClientMap.get(te.job_id);
    if (!clientName) continue;
    const c = clientMap.get(clientName);
    if (!c) continue;
    c.total_hours += Number(te.total_hours ?? 0);
  }

  const earningsByClient = Array.from(clientMap.values()).map((c) => ({
    ...c,
    exceeds_1099: c.total_paid >= 600,
  })).sort((a, b) => b.total_paid - a.total_paid);

  // --- Mileage totals ---
  let totalMiles = 0;
  for (const t of trips) {
    const d = Number(t.distance_miles ?? 0);
    totalMiles += t.is_round_trip ? d * 2 : d;
  }

  // --- Expense totals ---
  let totalExpenses = 0;
  let totalIncome = 0;
  for (const e of expenses) {
    const amt = Number(e.amount ?? 0);
    if (e.type === 'expense') totalExpenses += amt;
    else totalIncome += amt;
  }

  // --- Hours totals ---
  let totalHours = 0;
  let totalST = 0;
  let totalOT = 0;
  let totalDT = 0;
  let daysWorked = 0;
  for (const te of timeEntries) {
    totalHours += Number(te.total_hours ?? 0);
    totalST += Number(te.st_hours ?? 0);
    totalOT += Number(te.ot_hours ?? 0);
    totalDT += Number(te.dt_hours ?? 0);
    daysWorked++;
  }

  // --- Benefits-eligible job count ---
  const benefitsJobs = jobs.filter((j) => j.benefits_eligible).length;

  // --- Overall totals ---
  let totalInvoiced = 0;
  let totalPaid = 0;
  let pendingInvoices = 0;
  for (const inv of invoices) {
    totalInvoiced += Number(inv.total ?? 0);
    totalPaid += Number(inv.amount_paid ?? 0);
    if (inv.status !== 'paid' && inv.status !== 'cancelled') pendingInvoices++;
  }

  // --- By union/department ---
  const unionMap = new Map<string, number>();
  const deptMap = new Map<string, number>();
  for (const job of jobs) {
    if (job.union_local) unionMap.set(job.union_local, (unionMap.get(job.union_local) ?? 0) + 1);
    if (job.department) deptMap.set(job.department, (deptMap.get(job.department) ?? 0) + 1);
  }

  // --- Monthly earnings trend ---
  const monthlyEarnings = new Array(12).fill(0);
  for (const inv of invoices) {
    if (!inv.invoice_date) continue;
    const month = new Date(inv.invoice_date + 'T00:00').getMonth();
    monthlyEarnings[month] += Number(inv.amount_paid ?? 0);
  }

  return NextResponse.json({
    year,
    summary: {
      total_jobs: jobs.length,
      total_invoiced: totalInvoiced,
      total_paid: totalPaid,
      pending_invoices: pendingInvoices,
      total_hours: totalHours,
      st_hours: totalST,
      ot_hours: totalOT,
      dt_hours: totalDT,
      days_worked: daysWorked,
      total_miles: totalMiles,
      total_expenses: totalExpenses,
      total_income: totalIncome,
      net_earnings: totalPaid - totalExpenses,
      benefits_eligible_jobs: benefitsJobs,
    },
    earnings_by_client: earningsByClient,
    monthly_earnings: monthlyEarnings,
    by_union: Object.fromEntries(unionMap),
    by_department: Object.fromEntries(deptMap),
  });
}
