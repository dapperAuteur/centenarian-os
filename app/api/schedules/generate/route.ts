// app/api/schedules/generate/route.ts
// Generate planner tasks from active schedule templates.
// Supports single date or date range (backfill).
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

type Db = ReturnType<typeof getDb>;

/** Generate task for a single template on a single date. Returns true if created. */
async function generateForDate(
  db: Db,
  tmpl: TemplateRow,
  dateStr: string,
): Promise<{ created: boolean; error?: string }> {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();

  // Date bounds
  if (tmpl.start_date && dateStr < tmpl.start_date) return { created: false };
  if (tmpl.end_date && dateStr > tmpl.end_date) return { created: false };

  // Day of week
  if (!tmpl.schedule_days.includes(dayOfWeek)) return { created: false };

  // Week interval
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

  // Task details
  let taskTime = tmpl.time_start || '09:00';
  if (exception && exception.exception_type === 'reschedule') {
    const { data: exDetail } = await db
      .from('schedule_exceptions')
      .select('override_time_start')
      .eq('id', exception.id)
      .single();
    if (exDetail?.override_time_start) taskTime = exDetail.override_time_start;
  }

  const taskActivity = exception?.exception_type === 'paid_off'
    ? `${tmpl.name} (Paid Day Off)`
    : tmpl.name;

  const insertData: Record<string, unknown> = {
    date: dateStr,
    time: taskTime,
    activity: taskActivity,
    description: tmpl.time_start && tmpl.time_end
      ? `${tmpl.time_start} - ${tmpl.time_end}`
      : null,
    tag: tmpl.tag || 'ADMIN',
    priority: tmpl.priority,
    completed: false,
    source_type: 'schedule',
    source_id: tmpl.id,
  };

  if (tmpl.milestone_id) {
    insertData.milestone_id = tmpl.milestone_id;
  }

  const { error: taskError } = await db
    .from('tasks')
    .insert([insertData]);

  if (taskError) {
    return { created: false, error: taskError.message };
  }

  return { created: true };
}

/**
 * POST /api/schedules/generate
 * Body:
 *   { targetDate?: string }                — single date (default: today)
 *   { fromDate: string, toDate: string }   — backfill range
 *   { templateId?: string }                — optional: only generate for one template
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

  // Build list of dates to generate
  const dates: string[] = [];

  if (body.fromDate && body.toDate) {
    // Backfill mode: generate for entire date range
    const start = new Date(body.fromDate + 'T00:00:00');
    const end = new Date(body.toDate + 'T00:00:00');
    const maxDays = 366; // safety cap: ~1 year
    let count = 0;
    for (let d = new Date(start); d <= end && count < maxDays; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
      count++;
    }
  } else {
    // Single date mode
    dates.push(body.targetDate || new Date().toISOString().split('T')[0]);
  }

  const backfillMode = dates.length > 1;
  let tasksGenerated = 0;
  const errors: { templateId: string; date: string; error: string }[] = [];
  let latestDate = '';

  for (const dateStr of dates) {
    for (const tmpl of templates as TemplateRow[]) {
      try {
        const result = await generateForDate(db, tmpl, dateStr);
        if (result.created) {
          tasksGenerated++;
          if (dateStr > latestDate) latestDate = dateStr;
        }
        if (result.error) {
          errors.push({ templateId: tmpl.id, date: dateStr, error: result.error });
        }
      } catch (err) {
        errors.push({ templateId: tmpl.id, date: dateStr, error: String(err) });
      }
    }
  }

  // Update last_generated_date to the latest date we processed
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
      ? `Backfilled ${tasksGenerated} tasks from ${dates[0]} to ${dates[dates.length - 1]}`
      : `Generated ${tasksGenerated} tasks for ${dates[0]}`,
    tasksGenerated,
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
