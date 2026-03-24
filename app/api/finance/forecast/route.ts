// app/api/finance/forecast/route.ts
// GET: rolling income forecast across 30/60/90/180/270/365-day horizons.
// Sources: expected_payments VIEW (jobs+invoices), schedule pay periods, historical income.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getFiscalPeriods, type FiscalConfig } from '@/lib/fiscal';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const HORIZONS = [
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
  { label: '90 days', days: 90 },
  { label: '6 months', days: 180 },
  { label: '9 months', days: 270 },
  { label: '1 year', days: 365 },
];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Simplified pay period projection — generates future pay dates for a schedule
function projectPayDates(
  payFrequency: string,
  paydayAnchor: string,
  maxDate: string,
): { expected_date: string }[] {
  const dates: { expected_date: string }[] = [];
  const anchor = new Date(paydayAnchor + 'T00:00:00');
  const today = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00');
  const max = new Date(maxDate + 'T00:00:00');

  if (payFrequency === 'weekly') {
    const daysSince = Math.floor((today.getTime() - anchor.getTime()) / 86400000);
    const weeksSince = Math.floor(daysSince / 7);
    const d = new Date(anchor);
    d.setDate(d.getDate() + weeksSince * 7);
    while (d <= max) {
      if (d >= today) {
        dates.push({ expected_date: d.toISOString().split('T')[0] });
      }
      d.setDate(d.getDate() + 7);
    }
  } else if (payFrequency === 'biweekly') {
    const daysSince = Math.floor((today.getTime() - anchor.getTime()) / 86400000);
    const biweeksSince = Math.floor(daysSince / 14);
    const d = new Date(anchor);
    d.setDate(d.getDate() + biweeksSince * 14);
    while (d <= max) {
      if (d >= today) {
        dates.push({ expected_date: d.toISOString().split('T')[0] });
      }
      d.setDate(d.getDate() + 14);
    }
  } else if (payFrequency === 'semimonthly') {
    let year = today.getFullYear();
    let month = today.getMonth();
    while (true) {
      const d1 = new Date(year, month, 15);
      const lastDay = new Date(year, month + 1, 0).getDate();
      const d2 = new Date(year, month, lastDay);
      for (const d of [d1, d2]) {
        if (d >= today && d <= max) {
          dates.push({ expected_date: d.toISOString().split('T')[0] });
        }
      }
      month++;
      if (month > 11) { year++; month = 0; }
      if (new Date(year, month, 1) > max) break;
    }
  } else {
    // monthly
    let year = today.getFullYear();
    let month = today.getMonth();
    while (true) {
      const lastDay = new Date(year, month + 1, 0).getDate();
      const d = new Date(year, month, lastDay);
      if (d >= today && d <= max) {
        dates.push({ expected_date: d.toISOString().split('T')[0] });
      }
      month++;
      if (month > 11) { year++; month = 0; }
      if (new Date(year, month, 1) > max) break;
    }
  }

  return dates;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const maxDate = addDays(today, 365);

  // Fetch all data sources in parallel
  const [confirmedRes, schedulesRes, historicalRes, fiscalProfile] = await Promise.all([
    // 1. Confirmed expected payments from VIEW (up to 1 year out)
    (async () => {
      try {
        const { data, error } = await db
          .from('expected_payments')
          .select('*')
          .eq('user_id', user.id)
          .gte('expected_date', today)
          .lte('expected_date', maxDate)
          .order('expected_date');
        if (error) return [];
        return data ?? [];
      } catch {
        return [];
      }
    })(),

    // 2. Active work schedule templates with finance data
    (async () => {
      try {
        const { data: templates } = await db
          .from('schedule_templates')
          .select('id, name, schedule_days, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .eq('template_type', 'work');
        if (!templates?.length) return [];

        const results = [];
        for (const tmpl of templates) {
          const { data: finance } = await db
            .from('schedule_template_finance')
            .select('pay_rate, rate_type, hours_per_day, pay_frequency, payday_anchor')
            .eq('template_id', tmpl.id)
            .maybeSingle();
          if (finance) {
            results.push({ ...tmpl, finance });
          }
        }
        return results;
      } catch {
        return [];
      }
    })(),

    // 3. Historical income (last 12 months)
    (async () => {
      const twelveMonthsAgo = addDays(today, -365);
      const { data, error } = await db
        .from('financial_transactions')
        .select('amount, date')
        .eq('user_id', user.id)
        .eq('type', 'income')
        .gte('date', twelveMonthsAgo)
        .lte('date', today);
      if (error) return [];
      return data ?? [];
    })(),

    // 4. User's fiscal calendar config
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('fiscal_year_start_month, fiscal_year_start_day')
        .eq('id', user.id)
        .maybeSingle();
      return {
        startMonth: data?.fiscal_year_start_month ?? 1,
        startDay: data?.fiscal_year_start_day ?? 1,
      } as FiscalConfig;
    })(),
  ]);

  // Build confirmed payments array
  const confirmed_payments = confirmedRes.map((p: Record<string, unknown>) => ({
    source_type: p.source_type as string,
    source_id: p.source_id as string,
    label: p.label as string,
    reference_number: p.reference_number as string | null,
    expected_date: p.expected_date as string,
    expected_amount: Number(p.expected_amount ?? 0),
    status: p.status as string,
  }));

  // Project future schedule income
  interface ScheduleWithFinance {
    id: string;
    name: string;
    schedule_days: number[];
    finance: {
      pay_rate: number;
      rate_type: string;
      hours_per_day: number | null;
      pay_frequency: string;
      payday_anchor: string;
    };
  }

  const projected_schedule_income = (schedulesRes as ScheduleWithFinance[]).map((tmpl) => {
    const f = tmpl.finance;
    const futureDates = projectPayDates(f.pay_frequency, f.payday_anchor, maxDate);

    // Estimate per-period gross
    let periodsPerYear = 12;
    let daysPerPeriod = 30;
    if (f.pay_frequency === 'weekly') { periodsPerYear = 52; daysPerPeriod = 7; }
    else if (f.pay_frequency === 'biweekly') { periodsPerYear = 26; daysPerPeriod = 14; }
    else if (f.pay_frequency === 'semimonthly') { periodsPerYear = 24; daysPerPeriod = 15; }

    const workDaysPerPeriod = tmpl.schedule_days?.length
      ? Math.round((daysPerPeriod / 7) * tmpl.schedule_days.length)
      : daysPerPeriod;

    let estimatedPerPeriod = 0;
    if (f.rate_type === 'hourly') {
      estimatedPerPeriod = f.pay_rate * (f.hours_per_day ?? 8) * workDaysPerPeriod;
    } else if (f.rate_type === 'daily') {
      estimatedPerPeriod = f.pay_rate * workDaysPerPeriod;
    } else {
      estimatedPerPeriod = f.pay_rate;
    }

    return {
      schedule_id: tmpl.id,
      schedule_name: tmpl.name,
      pay_frequency: f.pay_frequency,
      estimated_per_period: Math.round(estimatedPerPeriod * 100) / 100,
      periods_in_year: periodsPerYear,
      annual_estimate: Math.round(estimatedPerPeriod * periodsPerYear * 100) / 100,
      future_pay_dates: futureDates,
    };
  });

  // Historical monthly average
  const totalHistorical = historicalRes.reduce(
    (sum: number, t: Record<string, unknown>) => sum + Number(t.amount ?? 0), 0
  );
  const historical_monthly_avg = Math.round((totalHistorical / 12) * 100) / 100;

  // Trend: compare last 3 months avg vs prior 3 months
  const threeMonthsAgo = addDays(today, -90);
  const sixMonthsAgo = addDays(today, -180);
  const recentIncome = historicalRes
    .filter((t: Record<string, string>) => (t.date ?? '') >= threeMonthsAgo)
    .reduce((s: number, t: Record<string, unknown>) => s + Number(t.amount ?? 0), 0);
  const priorIncome = historicalRes
    .filter((t: Record<string, string>) => (t.date ?? '') >= sixMonthsAgo && (t.date ?? '') < threeMonthsAgo)
    .reduce((s: number, t: Record<string, unknown>) => s + Number(t.amount ?? 0), 0);

  const trend = recentIncome > priorIncome * 1.1 ? 'up'
    : recentIncome < priorIncome * 0.9 ? 'down'
    : 'stable';

  // Build rolling period summaries
  const periods = HORIZONS.map(({ label, days }) => {
    const cutoff = addDays(today, days);

    // Confirmed from VIEW
    const confirmed = confirmed_payments
      .filter(p => p.expected_date <= cutoff)
      .reduce((s, p) => s + p.expected_amount, 0);

    // Projected from schedules
    const projected = projected_schedule_income.reduce((sum, sched) => {
      const periodsInRange = sched.future_pay_dates
        .filter(d => d.expected_date <= cutoff).length;
      return sum + (periodsInRange * sched.estimated_per_period);
    }, 0);

    return {
      label,
      days,
      confirmed: Math.round(confirmed * 100) / 100,
      projected: Math.round(projected * 100) / 100,
      total: Math.round((confirmed + projected) * 100) / 100,
    };
  });

  // Gap analysis: find 30-day windows with no expected income
  const gaps: { from: string; to: string }[] = [];
  for (let i = 0; i < 365; i += 30) {
    const windowStart = addDays(today, i);
    const windowEnd = addDays(today, i + 29);

    const hasConfirmed = confirmed_payments.some(
      p => p.expected_date >= windowStart && p.expected_date <= windowEnd
    );
    const hasProjected = projected_schedule_income.some(sched =>
      sched.future_pay_dates.some(d => d.expected_date >= windowStart && d.expected_date <= windowEnd)
    );

    if (!hasConfirmed && !hasProjected) {
      gaps.push({ from: windowStart, to: windowEnd });
    }
  }

  // Fiscal periods
  const fiscal_config = fiscalProfile;
  const fiscalPeriodData = getFiscalPeriods(fiscal_config, today);

  function calcPeriodTotals(start: string, end: string) {
    const confirmed = confirmed_payments
      .filter(p => p.expected_date >= start && p.expected_date <= end)
      .reduce((s, p) => s + p.expected_amount, 0);
    const projected = projected_schedule_income.reduce((sum, sched) => {
      const count = sched.future_pay_dates
        .filter(d => d.expected_date >= start && d.expected_date <= end).length;
      return sum + (count * sched.estimated_per_period);
    }, 0);
    return {
      confirmed: Math.round(confirmed * 100) / 100,
      projected: Math.round(projected * 100) / 100,
      total: Math.round((confirmed + projected) * 100) / 100,
    };
  }

  const fiscal_periods = {
    ytd: { ...fiscalPeriodData.ytd, ...calcPeriodTotals(fiscalPeriodData.ytd.start, fiscalPeriodData.ytd.end) },
    full_year: { ...fiscalPeriodData.fullYear, ...calcPeriodTotals(fiscalPeriodData.fullYear.start, fiscalPeriodData.fullYear.end) },
    quarters: fiscalPeriodData.quarters.map(q => ({
      ...q,
      ...calcPeriodTotals(q.start, q.end),
    })),
  };

  return NextResponse.json({
    periods,
    confirmed_payments,
    projected_schedule_income,
    historical_monthly_avg,
    trend,
    gaps,
    fiscal_config,
    fiscal_periods,
  });
}
