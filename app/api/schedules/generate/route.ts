// app/api/schedules/generate/route.ts
// Generate planner tasks from active schedule templates.
// Supports single date or date range (backfill).
// Sets revenue from schedule_template_finance and generates payday tasks.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function isActiveWeek(
  targetDate: Date,
  startDate: Date | null,
  weekInterval: number,
): boolean {
  if (weekInterval <= 1) return true;
  const anchor = startDate || new Date('2026-01-05');
  const daysDiff = Math.floor((targetDate.getTime() - anchor.getTime()) / 86400000);
  const weeksSince = Math.floor(daysDiff / 7);
  return weeksSince % weekInterval === 0;
}

interface TemplateRow {
  id: string;
  user_id: string;
  name: string;
  template_type: string;
  schedule_days: number[];
  week_interval: number;
  start_date: string | null;
  end_date: string | null;
  time_start: string | null;
  time_end: string | null;
  milestone_id: string | null;
  tag: string | null;
  priority: number;
  last_generated_date: string | null;
}

interface FinanceRow {
  pay_rate: number;
  rate_type: string;
  hours_per_day: number | null;
  pay_frequency: string;
  payday_anchor: string;
}

type Db = ReturnType<typeof getDb>;

/** Calculate daily revenue from finance config */
function calcDailyRevenue(fin: FinanceRow | null): number {
  if (!fin) return 0;
  if (fin.rate_type === 'hourly') return fin.pay_rate * (fin.hours_per_day || 8);
  if (fin.rate_type === 'daily') return fin.pay_rate;
  return 0; // flat rate is per-period, not per-day
}

/** Build a pay description string */
function payDescription(fin: FinanceRow | null, timeStart: string | null, timeEnd: string | null): string | null {
  const parts: string[] = [];
  if (timeStart && timeEnd) parts.push(`${timeStart} – ${timeEnd}`);
  if (fin) {
    if (fin.rate_type === 'hourly') {
      parts.push(`$${fin.pay_rate}/hr × ${fin.hours_per_day || 8}h`);
    } else if (fin.rate_type === 'daily') {
      parts.push(`$${fin.pay_rate}/day`);
    }
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Check if a date is a payday for this finance config */
function isPayday(dateStr: string, fin: FinanceRow): boolean {
  const date = new Date(dateStr + 'T00:00:00');
  const anchor = new Date(fin.payday_anchor + 'T00:00:00');

  if (fin.pay_frequency === 'weekly') {
    const daysDiff = Math.floor((date.getTime() - anchor.getTime()) / 86400000);
    return daysDiff >= 0 && daysDiff % 7 === 0;
  }
  if (fin.pay_frequency === 'biweekly') {
    const daysDiff = Math.floor((date.getTime() - anchor.getTime()) / 86400000);
    return daysDiff >= 0 && daysDiff % 14 === 0;
  }
  if (fin.pay_frequency === 'semimonthly') {
    const day = date.getDate();
    return day === 1 || day === 15;
  }
  if (fin.pay_frequency === 'monthly') {
    return date.getDate() === anchor.getDate();
  }
  return false;
}

/** Generate a work-day task for a single template on a single date. */
async function generateForDate(
  db: Db,
  tmpl: TemplateRow,
  dateStr: string,
  fin: FinanceRow | null,
): Promise<{ created: boolean; error?: string }> {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();

  if (tmpl.start_date && dateStr < tmpl.start_date) return { created: false };
  if (tmpl.end_date && dateStr > tmpl.end_date) return { created: false };
  if (!tmpl.schedule_days.includes(dayOfWeek)) return { created: false };

  const startDate = tmpl.start_date ? new Date(tmpl.start_date + 'T00:00:00') : null;
  if (!isActiveWeek(date, startDate, tmpl.week_interval)) return { created: false };

  // Exception check
  const { data: exception } = await db
    .from('schedule_exceptions')
    .select('id, exception_type')
    .eq('template_id', tmpl.id)
    .eq('exception_date', dateStr)
    .maybeSingle();

  if (exception && (exception.exception_type === 'skip' || exception.exception_type === 'unpaid_off')) {
    return { created: false };
  }

  // Duplicate check
  const { data: existingTask } = await db
    .from('tasks')
    .select('id')
    .eq('source_type', 'schedule')
    .eq('source_id', tmpl.id)
    .eq('date', dateStr)
    .maybeSingle();

  if (existingTask) return { created: false };

  let taskTime = tmpl.time_start || '09:00';
  if (exception && exception.exception_type === 'reschedule') {
    const { data: exDetail } = await db
      .from('schedule_exceptions')
      .select('override_time_start')
      .eq('id', exception.id)
      .single();
    if (exDetail?.override_time_start) taskTime = exDetail.override_time_start;
  }

  const isPaidOff = exception?.exception_type === 'paid_off';
  const taskActivity = isPaidOff ? `${tmpl.name} (Paid Day Off)` : tmpl.name;
  const dailyRevenue = calcDailyRevenue(fin);

  const insertData: Record<string, unknown> = {
    date: dateStr,
    time: taskTime,
    activity: taskActivity,
    description: payDescription(fin, tmpl.time_start, tmpl.time_end),
    tag: tmpl.tag || 'ADMIN',
    priority: tmpl.priority,
    completed: false,
    source_type: 'schedule',
    source_id: tmpl.id,
    revenue: isPaidOff ? dailyRevenue : dailyRevenue, // paid days off still earn
    estimated_cost: 0,
  };

  if (tmpl.milestone_id) insertData.milestone_id = tmpl.milestone_id;

  const { error: taskError } = await db.from('tasks').insert([insertData]);
  if (taskError) return { created: false, error: taskError.message };

  return { created: true };
}

/** Generate a payday task if the date falls on a payday. */
async function generatePaydayTask(
  db: Db,
  tmpl: TemplateRow,
  dateStr: string,
  fin: FinanceRow,
): Promise<boolean> {
  if (!isPayday(dateStr, fin)) return false;

  // Duplicate check
  const { data: existing } = await db
    .from('tasks')
    .select('id')
    .eq('source_type', 'schedule_payday')
    .eq('source_id', tmpl.id)
    .eq('date', dateStr)
    .maybeSingle();

  if (existing) return false;

  const dailyRevenue = calcDailyRevenue(fin);
  // Estimate period days based on frequency
  let periodDays = 10; // fallback
  if (fin.pay_frequency === 'weekly') periodDays = 5;
  else if (fin.pay_frequency === 'biweekly') periodDays = 10;
  else if (fin.pay_frequency === 'semimonthly') periodDays = 11;
  else if (fin.pay_frequency === 'monthly') periodDays = 22;

  const estimatedGross = Math.round(dailyRevenue * periodDays * 100) / 100;

  const insertData: Record<string, unknown> = {
    date: dateStr,
    time: '12:00',
    activity: `Payday — ${tmpl.name}`,
    description: `Expected gross: $${estimatedGross.toFixed(2)} (${periodDays} work days × $${dailyRevenue.toFixed(2)}/day)`,
    tag: 'ADMIN',
    priority: 1,
    completed: false,
    source_type: 'schedule_payday',
    source_id: tmpl.id,
    revenue: estimatedGross,
    estimated_cost: 0,
  };

  if (tmpl.milestone_id) insertData.milestone_id = tmpl.milestone_id;

  const { error } = await db.from('tasks').insert([insertData]);
  return !error;
}

/**
 * POST /api/schedules/generate
 * Body:
 *   { targetDate?: string }                — single date (default: today)
 *   { fromDate: string, toDate: string }   — backfill range
 *   { templateId?: string }                — optional: only generate for one template
 *   { syncRevenue: true }                  — update revenue on existing tasks that have revenue=0
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const db = getDb();

  // Fetch templates
  let templateQuery = db
    .from('schedule_templates')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (body.templateId) {
    templateQuery = templateQuery.eq('id', body.templateId);
  }

  const { data: templates, error: fetchError } = await templateQuery;

  if (fetchError) {
    console.error('[Schedule Generate] Fetch error:', fetchError);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!templates || templates.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No active schedule templates',
      tasksGenerated: 0,
    });
  }

  // Fetch finance data for work templates
  const templateIds = templates.map((t: { id: string }) => t.id);
  const { data: financeRows } = await db
    .from('schedule_template_finance')
    .select('template_id, pay_rate, rate_type, hours_per_day, pay_frequency, payday_anchor')
    .in('template_id', templateIds);

  const financeMap: Record<string, FinanceRow> = {};
  if (financeRows) {
    for (const f of financeRows) {
      financeMap[f.template_id] = f as FinanceRow;
    }
  }

  // ── Sync revenue on existing tasks that were created before revenue was set ──
  if (body.syncRevenue) {
    let synced = 0;
    for (const tmpl of templates as TemplateRow[]) {
      const fin = financeMap[tmpl.id];
      if (!fin) continue;
      const rev = calcDailyRevenue(fin);
      if (rev <= 0) continue;

      const desc = payDescription(fin, tmpl.time_start, tmpl.time_end);

      const { data: updated, error: syncErr } = await db
        .from('tasks')
        .update({
          revenue: Math.round(rev * 100) / 100,
          ...(desc ? { description: desc } : {}),
        })
        .eq('source_type', 'schedule')
        .eq('source_id', tmpl.id)
        .eq('revenue', 0)
        .select('id');

      if (!syncErr && updated) synced += updated.length;
    }
    return NextResponse.json({
      success: true,
      message: `Synced revenue on ${synced} existing tasks`,
      tasksSynced: synced,
    });
  }

  // Build list of dates
  const dates: string[] = [];

  if (body.fromDate && body.toDate) {
    const start = new Date(body.fromDate + 'T00:00:00');
    const end = new Date(body.toDate + 'T00:00:00');
    const maxDays = 366;
    let count = 0;
    for (let d = new Date(start); d <= end && count < maxDays; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
      count++;
    }
  } else {
    dates.push(body.targetDate || new Date().toISOString().split('T')[0]);
  }

  const backfillMode = dates.length > 1;
  let tasksGenerated = 0;
  let paydayTasksGenerated = 0;
  const errors: { templateId: string; date: string; error: string }[] = [];
  let latestDate = '';

  for (const dateStr of dates) {
    for (const tmpl of templates as TemplateRow[]) {
      const fin = financeMap[tmpl.id] || null;

      try {
        // Generate work-day task
        const result = await generateForDate(db, tmpl, dateStr, fin);
        if (result.created) {
          tasksGenerated++;
          if (dateStr > latestDate) latestDate = dateStr;
        }
        if (result.error) {
          errors.push({ templateId: tmpl.id, date: dateStr, error: result.error });
        }

        // Generate payday task (work templates only)
        if (fin && tmpl.template_type === 'work') {
          const paydayCreated = await generatePaydayTask(db, tmpl, dateStr, fin);
          if (paydayCreated) paydayTasksGenerated++;
        }
      } catch (err) {
        errors.push({ templateId: tmpl.id, date: dateStr, error: String(err) });
      }
    }
  }

  // Update last_generated_date
  if (latestDate) {
    for (const tmpl of templates as TemplateRow[]) {
      if (!tmpl.last_generated_date || latestDate > tmpl.last_generated_date) {
        await db
          .from('schedule_templates')
          .update({ last_generated_date: latestDate })
          .eq('id', tmpl.id);
      }
    }
  }

  return NextResponse.json({
    success: true,
    message: backfillMode
      ? `Backfilled ${tasksGenerated} work tasks + ${paydayTasksGenerated} payday tasks from ${dates[0]} to ${dates[dates.length - 1]}`
      : `Generated ${tasksGenerated} tasks for ${dates[0]}`,
    tasksGenerated,
    paydayTasksGenerated,
    totalTemplates: templates.length,
    datesProcessed: dates.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}

/**
 * GET /api/schedules/generate?date=YYYY-MM-DD
 * Cron-friendly endpoint (single date only)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

  const mockRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ targetDate }),
  });

  return POST(mockRequest);
}
