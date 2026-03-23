// app/api/schedules/[id]/pay-periods/route.ts
// Pay period management: list, calculate, reconcile
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function authorize() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

interface FinanceRow {
  pay_rate: number;
  rate_type: string;
  hours_per_day: number | null;
  pay_frequency: string;
  payday_anchor: string;
  employment_type: string;
  estimated_tax_rate: number | null;
  estimated_tax_amount: number | null;
  tax_tracking_method: string;
  per_diem_amount: number | null;
  travel_income_amount: number | null;
  deductions: { label: string; amount: number; is_pretax: boolean }[];
  set_aside_percentage: number | null;
  pay_account_id: string | null;
  pay_category_id: string | null;
}

/**
 * Calculate the pay period boundaries given a payday anchor and frequency.
 */
function getPayPeriodDates(payFrequency: string, paydayAnchor: string, referenceDate: string) {
  const ref = new Date(referenceDate);
  const anchor = new Date(paydayAnchor);

  if (payFrequency === 'weekly') {
    const daysSinceAnchor = Math.floor((ref.getTime() - anchor.getTime()) / 86400000);
    const weeksSince = Math.floor(daysSinceAnchor / 7);
    const periodStart = new Date(anchor);
    periodStart.setDate(periodStart.getDate() + weeksSince * 7);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 6);
    return {
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
    };
  }

  if (payFrequency === 'biweekly') {
    const daysSinceAnchor = Math.floor((ref.getTime() - anchor.getTime()) / 86400000);
    const biweeksSince = Math.floor(daysSinceAnchor / 14);
    const periodStart = new Date(anchor);
    periodStart.setDate(periodStart.getDate() + biweeksSince * 14);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 13);
    return {
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
    };
  }

  if (payFrequency === 'semimonthly') {
    const anchorDay = anchor.getDate();
    // Two periods: 1st-15th and 16th-end
    if (ref.getDate() <= 15) {
      return {
        period_start: `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-01`,
        period_end: `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-15`,
      };
    } else {
      const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
      return {
        period_start: `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-16`,
        period_end: `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${lastDay}`,
      };
    }
  }

  // monthly
  const monthStart = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const monthEnd = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
  return { period_start: monthStart, period_end: monthEnd };
}

/**
 * GET /api/schedules/[id]/pay-periods?from=&to=
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const db = getDb();

  // Verify ownership
  const { data: template } = await db
    .from('schedule_templates')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let query = db
    .from('schedule_pay_periods')
    .select('*')
    .eq('template_id', id)
    .order('period_start', { ascending: false });

  if (from) query = query.gte('period_start', from);
  if (to) query = query.lte('period_end', to);

  const { data, error } = await query;

  if (error) {
    console.error('[Pay Periods] GET failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/schedules/[id]/pay-periods
 * Calculate and create next pay period
 * Body: { reference_date?: string } — defaults to today
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const referenceDate = body.reference_date || new Date().toISOString().split('T')[0];

  const db = getDb();

  // Fetch template + finance
  const { data: template } = await db
    .from('schedule_templates')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: finance } = await db
    .from('schedule_template_finance')
    .select('*')
    .eq('template_id', id)
    .maybeSingle();

  if (!finance) {
    return NextResponse.json({ error: 'No finance configuration for this schedule' }, { status: 400 });
  }

  // Calculate period boundaries
  const { period_start, period_end } = getPayPeriodDates(
    finance.pay_frequency,
    finance.payday_anchor,
    referenceDate
  );

  // Check if period already exists
  const { data: existing } = await db
    .from('schedule_pay_periods')
    .select('id')
    .eq('template_id', id)
    .eq('period_start', period_start)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Pay period already exists', period_start }, { status: 409 });
  }

  // Count scheduled days in period
  const scheduleDays = new Set(template.schedule_days);
  let daysScheduled = 0;
  const start = new Date(period_start);
  const end = new Date(period_end);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (scheduleDays.has(d.getDay())) daysScheduled++;
  }

  // Fetch exceptions in period
  const { data: exceptions } = await db
    .from('schedule_exceptions')
    .select('exception_type')
    .eq('template_id', id)
    .gte('exception_date', period_start)
    .lte('exception_date', period_end);

  let daysPaidOff = 0;
  let daysUnpaidOff = 0;
  let daysSkipped = 0;

  if (exceptions) {
    for (const ex of exceptions) {
      if (ex.exception_type === 'paid_off') daysPaidOff++;
      else if (ex.exception_type === 'unpaid_off') daysUnpaidOff++;
      else if (ex.exception_type === 'skip') daysSkipped++;
    }
  }

  const daysWorked = daysScheduled - daysPaidOff - daysUnpaidOff - daysSkipped;
  const payableDays = daysWorked + daysPaidOff;

  // Calculate financials
  const fin = finance as FinanceRow;
  let estimatedGross = 0;
  if (fin.rate_type === 'hourly' && fin.hours_per_day) {
    estimatedGross = payableDays * fin.pay_rate * fin.hours_per_day;
  } else if (fin.rate_type === 'daily') {
    estimatedGross = payableDays * fin.pay_rate;
  } else {
    // flat rate per period
    estimatedGross = fin.pay_rate;
  }

  let estimatedTaxes = 0;
  if (fin.tax_tracking_method === 'percentage' && fin.estimated_tax_rate) {
    estimatedTaxes = estimatedGross * (fin.estimated_tax_rate / 100);
  } else if (fin.tax_tracking_method === 'flat' && fin.estimated_tax_amount) {
    estimatedTaxes = fin.estimated_tax_amount;
  }

  const pretaxDeductions = (fin.deductions || [])
    .filter(d => d.is_pretax)
    .reduce((sum, d) => sum + d.amount, 0);
  const posttaxDeductions = (fin.deductions || [])
    .filter(d => !d.is_pretax)
    .reduce((sum, d) => sum + d.amount, 0);

  const estimatedNet = estimatedGross - estimatedTaxes - pretaxDeductions - posttaxDeductions;
  const perDiemTotal = payableDays * (fin.per_diem_amount || 0);
  const travelIncomeTotal = payableDays * (fin.travel_income_amount || 0);

  const { data: payPeriod, error } = await db
    .from('schedule_pay_periods')
    .insert([{
      template_id: id,
      period_start,
      period_end,
      days_scheduled: daysScheduled,
      days_worked: daysWorked,
      days_paid_off: daysPaidOff,
      days_unpaid_off: daysUnpaidOff,
      estimated_gross: Math.round(estimatedGross * 100) / 100,
      estimated_taxes: Math.round(estimatedTaxes * 100) / 100,
      estimated_net: Math.round(estimatedNet * 100) / 100,
      per_diem_total: Math.round(perDiemTotal * 100) / 100,
      travel_income_total: Math.round(travelIncomeTotal * 100) / 100,
      is_reconciled: false,
    }])
    .select()
    .single();

  if (error) {
    console.error('[Pay Periods] POST failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Create income transaction for the estimated net
  if (estimatedNet > 0) {
    const { data: txn, error: txnError } = await db
      .from('financial_transactions')
      .insert([{
        user_id: user.id,
        amount: Math.round(estimatedNet * 100) / 100,
        type: 'income',
        description: `${template.name} — Pay period ${period_start} to ${period_end}`,
        vendor: template.name,
        transaction_date: period_end,
        category_id: fin.pay_category_id || null,
        account_id: fin.pay_account_id || null,
        source: 'schedule',
        source_module: 'schedule',
      }])
      .select()
      .single();

    if (!txnError && txn) {
      await db
        .from('schedule_pay_periods')
        .update({ transaction_id: txn.id })
        .eq('id', payPeriod.id);
      payPeriod.transaction_id = txn.id;
    }
  }

  return NextResponse.json(payPeriod, { status: 201 });
}

/**
 * PATCH /api/schedules/[id]/pay-periods
 * Reconcile: update actual amounts after paycheck received
 * Body: { pay_period_id, actual_gross, actual_taxes, actual_net, notes? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  if (!body.pay_period_id) {
    return NextResponse.json({ error: 'pay_period_id required' }, { status: 400 });
  }

  const db = getDb();

  // Verify ownership
  const { data: template } = await db
    .from('schedule_templates')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updates: Record<string, unknown> = { is_reconciled: true };
  if (body.actual_gross !== undefined) updates.actual_gross = body.actual_gross;
  if (body.actual_taxes !== undefined) updates.actual_taxes = body.actual_taxes;
  if (body.actual_net !== undefined) updates.actual_net = body.actual_net;
  if (body.notes !== undefined) updates.notes = body.notes;

  const { data: payPeriod, error } = await db
    .from('schedule_pay_periods')
    .update(updates)
    .eq('id', body.pay_period_id)
    .eq('template_id', id)
    .select()
    .single();

  if (error) {
    console.error('[Pay Periods] PATCH failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update linked transaction amount to actual_net if provided
  if (body.actual_net !== undefined && payPeriod.transaction_id) {
    await db
      .from('financial_transactions')
      .update({ amount: body.actual_net })
      .eq('id', payPeriod.transaction_id);
  }

  return NextResponse.json(payPeriod);
}
