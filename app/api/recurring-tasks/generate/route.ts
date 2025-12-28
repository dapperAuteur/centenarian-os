/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/recurring-tasks/generate/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/recurring-tasks/generate
 * Generate tasks from recurring patterns for a specific date
 * 
 * Body: { targetDate?: string } (ISO date, defaults to today)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const targetDate = body.targetDate || new Date().toISOString().split('T')[0];

    console.log(`[Recurring Tasks] Generating tasks for ${targetDate}`);

    // Get all active recurring tasks for user
    const { data: recurringTasks, error: fetchError } = await supabase
      .from('recurring_tasks')
      .select('id, activity, pattern, last_generated_date')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (fetchError) {
      console.error('[Recurring Tasks] Fetch error:', fetchError);
      throw fetchError;
    }

    if (!recurringTasks || recurringTasks.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No active recurring tasks found',
        tasksGenerated: 0,
      });
    }

    console.log(`[Recurring Tasks] Found ${recurringTasks.length} active patterns`);

    let tasksGenerated = 0;
    const errors: any[] = [];

    // Generate tasks for each recurring pattern
    for (const task of recurringTasks) {
      try {
        const { error: genError } = await supabase.rpc('generate_recurring_tasks', {
          p_recurring_task_id: task.id,
          p_target_date: targetDate,
        });

        if (genError) {
          console.error(`[Recurring Tasks] Failed to generate task ${task.id}:`, genError);
          errors.push({ taskId: task.id, error: genError.message });
        } else {
          tasksGenerated++;
          console.log(`[Recurring Tasks] Generated task from pattern: ${task.activity}`);
        }
      } catch (err) {
        console.error(`[Recurring Tasks] Unexpected error for task ${task.id}:`, err);
        errors.push({ taskId: task.id, error: String(err) });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Generated ${tasksGenerated} tasks for ${targetDate}`,
      tasksGenerated,
      totalPatterns: recurringTasks.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Recurring Tasks] Generation failed:', error);
    return NextResponse.json({ 
      error: 'Failed to generate tasks',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

/**
 * GET /api/recurring-tasks/generate?date=YYYY-MM-DD
 * Trigger task generation (for cron jobs)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

  // Re-use POST logic
  const mockRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ targetDate }),
  });

  return POST(mockRequest);
}