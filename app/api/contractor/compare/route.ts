// app/api/contractor/compare/route.ts
// GET: compare 2-4 jobs side-by-side (totals, rates, hours, expenses, mileage)

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

  const ids = request.nextUrl.searchParams.get('ids')?.split(',').filter(Boolean) ?? [];
  if (ids.length < 2 || ids.length > 4) {
    return NextResponse.json({ error: 'Provide 2-4 job IDs' }, { status: 400 });
  }

  const db = getDb();

  // Fetch jobs
  const { data: jobs, error } = await db
    .from('contractor_jobs')
    .select('*')
    .eq('user_id', user.id)
    .in('id', ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!jobs || jobs.length < 2) {
    return NextResponse.json({ error: 'Jobs not found' }, { status: 404 });
  }

  // Parallel: time entries, invoices, trips, expenses for all jobs
  const [timeRes, invRes, tripRes, expRes] = await Promise.all([
    db.from('job_time_entries')
      .select('job_id, total_hours, st_hours, ot_hours, dt_hours')
      .eq('user_id', user.id)
      .in('job_id', ids),
    db.from('invoices')
      .select('job_id, total, amount_paid, status')
      .eq('user_id', user.id)
      .in('job_id', ids),
    db.from('trips')
      .select('job_id, distance_miles, is_round_trip')
      .eq('user_id', user.id)
      .in('job_id', ids),
    db.from('financial_transactions')
      .select('job_id, amount, type')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .in('job_id', ids),
  ]);

  const timeEntries = timeRes.data ?? [];
  const invoices = invRes.data ?? [];
  const trips = tripRes.data ?? [];
  const expenses = expRes.data ?? [];

  // Build comparison per job
  const comparisons = jobs.map((job) => {
    const jobTime = timeEntries.filter((t) => t.job_id === job.id);
    const jobInv = invoices.filter((i) => i.job_id === job.id);
    const jobTrips = trips.filter((t) => t.job_id === job.id);
    const jobExp = expenses.filter((e) => e.job_id === job.id);

    const totalHours = jobTime.reduce((s, t) => s + Number(t.total_hours ?? 0), 0);
    const stHours = jobTime.reduce((s, t) => s + Number(t.st_hours ?? 0), 0);
    const otHours = jobTime.reduce((s, t) => s + Number(t.ot_hours ?? 0), 0);
    const dtHours = jobTime.reduce((s, t) => s + Number(t.dt_hours ?? 0), 0);
    const totalInvoiced = jobInv.reduce((s, i) => s + Number(i.total ?? 0), 0);
    const totalPaid = jobInv.reduce((s, i) => s + Number(i.amount_paid ?? 0), 0);
    const totalMiles = jobTrips.reduce((s, t) => {
      const d = Number(t.distance_miles ?? 0);
      return s + (t.is_round_trip ? d * 2 : d);
    }, 0);
    const totalExpenses = jobExp.reduce((s, e) => s + Number(e.amount ?? 0), 0);
    const netEarnings = totalPaid - totalExpenses;
    const effectiveRate = totalHours > 0 ? netEarnings / totalHours : 0;

    return {
      id: job.id,
      job_number: job.job_number,
      client_name: job.client_name,
      event_name: job.event_name,
      location_name: job.location_name,
      status: job.status,
      start_date: job.start_date,
      end_date: job.end_date,
      pay_rate: Number(job.pay_rate ?? 0),
      ot_rate: Number(job.ot_rate ?? 0),
      dt_rate: Number(job.dt_rate ?? 0),
      union_local: job.union_local,
      department: job.department,
      benefits_eligible: job.benefits_eligible,
      days_worked: jobTime.length,
      total_hours: totalHours,
      st_hours: stHours,
      ot_hours: otHours,
      dt_hours: dtHours,
      total_invoiced: totalInvoiced,
      total_paid: totalPaid,
      total_miles: totalMiles,
      total_expenses: totalExpenses,
      net_earnings: netEarnings,
      effective_rate: effectiveRate,
    };
  });

  // Sort by net_earnings desc so best job appears first
  comparisons.sort((a, b) => b.net_earnings - a.net_earnings);

  return NextResponse.json({ comparisons });
}
