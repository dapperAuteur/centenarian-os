// app/api/schedules/generate/route.ts
// Generate planner tasks from active schedule templates for a target date
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * Check if a target date falls on an active week for the given template.
 */
function isActiveWeek(
  targetDate: Date,
  startDate: Date | null,
  weekInterval: number,
): boolean {
  if (weekInterval <= 1) return true;
  const anchor = startDate || new Date('2026-01-05'); // fallback Monday anchor
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

/**
 * POST /api/schedules/generate
 * Body: { targetDate?: string } — ISO date, defaults to today
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const targetDateStr = body.targetDate || new Date().toISOString().split('T')[0];
  const targetDate = new Date(targetDateStr + 'T00:00:00');
  const dayOfWeek = targetDate.getDay(); // 0=Sun

  const db = getDb();

  // Fetch all active templates for user
  const { data: templates, error: fetchError } = await db
    .from('schedule_templates')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true);

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

  let tasksGenerated = 0;
  const errors: { templateId: string; error: string }[] = [];

  for (const tmpl of templates as TemplateRow[]) {
    try {
      // Check if already generated for this date
      if (tmpl.last_generated_date && tmpl.last_generated_date >= targetDateStr) {
        continue;
      }

      // Check date bounds
      if (tmpl.start_date && targetDateStr < tmpl.start_date) continue;
      if (tmpl.end_date && targetDateStr > tmpl.end_date) continue;

      // Check if day of week is scheduled
      if (!tmpl.schedule_days.includes(dayOfWeek)) continue;

      // Check week interval
      const startDate = tmpl.start_date ? new Date(tmpl.start_date + 'T00:00:00') : null;
      if (!isActiveWeek(targetDate, startDate, tmpl.week_interval)) continue;

      // Check for exception on this date
      const { data: exception } = await db
        .from('schedule_exceptions')
        .select('id, exception_type')
        .eq('template_id', tmpl.id)
        .eq('exception_date', targetDateStr)
        .maybeSingle();

      if (exception && (exception.exception_type === 'skip' || exception.exception_type === 'unpaid_off')) {
        // Don't generate task for skipped/unpaid days
        continue;
      }

      // Determine task details
      let taskTime = tmpl.time_start || '09:00';
      if (exception && exception.exception_type === 'reschedule') {
        // Use override time if provided
        const { data: exDetail } = await db
          .from('schedule_exceptions')
          .select('override_time_start')
          .eq('id', exception.id)
          .single();
        if (exDetail?.override_time_start) taskTime = exDetail.override_time_start;
      }

      // Check if task already exists for this schedule+date (prevent duplicates)
      const { data: existingTask } = await db
        .from('tasks')
        .select('id')
        .eq('source_type', 'schedule')
        .eq('source_id', tmpl.id)
        .eq('date', targetDateStr)
        .maybeSingle();

      if (existingTask) continue;

      // Create the planner task
      const taskActivity = exception?.exception_type === 'paid_off'
        ? `${tmpl.name} (Paid Day Off)`
        : tmpl.name;

      const insertData: Record<string, unknown> = {
        date: targetDateStr,
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
        console.error(`[Schedule Generate] Task insert failed for ${tmpl.id}:`, taskError);
        errors.push({ templateId: tmpl.id, error: taskError.message });
        continue;
      }

      tasksGenerated++;

      // Update last_generated_date
      await db
        .from('schedule_templates')
        .update({ last_generated_date: targetDateStr })
        .eq('id', tmpl.id);

    } catch (err) {
      console.error(`[Schedule Generate] Unexpected error for ${tmpl.id}:`, err);
      errors.push({ templateId: tmpl.id, error: String(err) });
    }
  }

  return NextResponse.json({
    success: true,
    message: `Generated ${tasksGenerated} tasks for ${targetDateStr}`,
    tasksGenerated,
    totalTemplates: templates.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}

/**
 * GET /api/schedules/generate?date=YYYY-MM-DD
 * Cron-friendly endpoint
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
