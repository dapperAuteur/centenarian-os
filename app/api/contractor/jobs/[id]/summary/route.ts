// app/api/contractor/jobs/[id]/summary/route.ts
// GET: computed summary for a job — hours, earnings, expenses, mileage, benefits

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const db = getDb();

  // Verify ownership
  const { data: job } = await db
    .from('contractor_jobs')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  // Fetch all related data in parallel
  const [timeRes, invoiceRes, tripRes, expenseRes] = await Promise.all([
    db.from('job_time_entries')
      .select('total_hours, st_hours, ot_hours, dt_hours')
      .eq('job_id', id),
    db.from('invoices')
      .select('total, amount_paid, status, invoice_items(amount, item_type)')
      .eq('job_id', id),
    db.from('trips')
      .select('distance_miles, cost, is_round_trip')
      .eq('job_id', id),
    db.from('financial_transactions')
      .select('amount, type')
      .eq('job_id', id),
  ]);

  // Time totals
  const entries = timeRes.data ?? [];
  const totalHours = entries.reduce((s, e) => s + (Number(e.total_hours) || 0), 0);
  const totalST = entries.reduce((s, e) => s + (Number(e.st_hours) || 0), 0);
  const totalOT = entries.reduce((s, e) => s + (Number(e.ot_hours) || 0), 0);
  const totalDT = entries.reduce((s, e) => s + (Number(e.dt_hours) || 0), 0);
  const daysWorked = entries.length;

  // Invoice totals
  const invoices = invoiceRes.data ?? [];
  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalPaid = invoices.reduce((s, i) => s + Number(i.amount_paid), 0);
  const pendingInvoices = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').length;

  // Benefits total (from invoice items with item_type = 'benefit')
  let totalBenefits = 0;
  for (const inv of invoices) {
    const items = (inv as unknown as { invoice_items: { amount: number; item_type: string }[] }).invoice_items ?? [];
    for (const item of items) {
      if (item.item_type === 'benefit') {
        totalBenefits += Number(item.amount);
      }
    }
  }

  // Trip/mileage totals
  const trips = tripRes.data ?? [];
  const totalMiles = trips.reduce((s, t) => {
    const miles = Number(t.distance_miles) || 0;
    return s + (t.is_round_trip ? miles * 2 : miles);
  }, 0);
  const totalTripCost = trips.reduce((s, t) => s + (Number(t.cost) || 0), 0);

  // Expense totals (from financial_transactions linked to this job)
  const transactions = expenseRes.data ?? [];
  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0);

  return NextResponse.json({
    days_worked: daysWorked,
    total_hours: Math.round(totalHours * 100) / 100,
    st_hours: Math.round(totalST * 100) / 100,
    ot_hours: Math.round(totalOT * 100) / 100,
    dt_hours: Math.round(totalDT * 100) / 100,
    total_invoiced: Math.round(totalInvoiced * 100) / 100,
    total_paid: Math.round(totalPaid * 100) / 100,
    pending_invoices: pendingInvoices,
    total_benefits: Math.round(totalBenefits * 100) / 100,
    total_miles: Math.round(totalMiles * 100) / 100,
    total_trip_cost: Math.round(totalTripCost * 100) / 100,
    total_expenses: Math.round(totalExpenses * 100) / 100,
    total_income: Math.round(totalIncome * 100) / 100,
    net_earnings: Math.round((totalInvoiced - totalExpenses) * 100) / 100,
  });
}
