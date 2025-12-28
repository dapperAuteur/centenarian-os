// app/api/recurring-tasks/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/recurring-tasks
 * List all recurring tasks for current user
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('recurring_tasks')
    .select(`
      *,
      milestone:milestones(
        id,
        title,
        goal:goals(
          id,
          title,
          roadmap:roadmaps(id, title)
        )
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Recurring Tasks API] GET failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/recurring-tasks
 * Create new recurring task
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  // Validate required fields
  if (!body.milestone_id || !body.activity || !body.pattern) {
    return NextResponse.json({ 
      error: 'Missing required fields: milestone_id, activity, pattern' 
    }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('recurring_tasks')
    .insert([{
      user_id: user.id,
      milestone_id: body.milestone_id,
      activity: body.activity,
      description: body.description || null,
      tag: body.tag || 'GENERAL',
      priority: body.priority || 2,
      time: body.time || '09:00',
      pattern: body.pattern,
      is_active: true,
    }])
    .select()
    .single();

  if (error) {
    console.error('[Recurring Tasks API] POST failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

/**
 * PATCH /api/recurring-tasks
 * Update existing recurring task
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, ...updates } = await request.json();

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('recurring_tasks')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('[Recurring Tasks API] PATCH failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/recurring-tasks?id=xxx
 * Delete recurring task
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('recurring_tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[Recurring Tasks API] DELETE failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}