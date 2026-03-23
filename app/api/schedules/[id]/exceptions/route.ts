// app/api/schedules/[id]/exceptions/route.ts
// CRUD for schedule exceptions (day-off, skip, reschedule)
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

/**
 * GET /api/schedules/[id]/exceptions?from=YYYY-MM-DD&to=YYYY-MM-DD
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

  if (!template) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let query = db
    .from('schedule_exceptions')
    .select('*')
    .eq('template_id', id)
    .order('exception_date', { ascending: true });

  if (from) query = query.gte('exception_date', from);
  if (to) query = query.lte('exception_date', to);

  const { data, error } = await query;

  if (error) {
    console.error('[Schedule Exceptions] GET failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/schedules/[id]/exceptions
 * Create exception(s) — supports single or bulk (date range for vacation)
 * Body: { exception_date, exception_type, reason?, notes? }
 *   OR: { date_from, date_to, exception_type, reason?, notes? } for bulk
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const db = getDb();

  // Verify ownership
  const { data: template } = await db
    .from('schedule_templates')
    .select('id, schedule_days, week_interval')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!template) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!body.exception_type) {
    return NextResponse.json({ error: 'exception_type required' }, { status: 400 });
  }

  // Build list of dates to insert
  const dates: string[] = [];

  if (body.date_from && body.date_to) {
    // Bulk mode: generate all scheduled dates in range
    const start = new Date(body.date_from);
    const end = new Date(body.date_to);
    const scheduleDays = new Set(template.schedule_days);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (scheduleDays.has(d.getDay())) {
        dates.push(d.toISOString().split('T')[0]);
      }
    }
  } else if (body.exception_date) {
    dates.push(body.exception_date);
  } else {
    return NextResponse.json({ error: 'exception_date or date_from/date_to required' }, { status: 400 });
  }

  if (dates.length === 0) {
    return NextResponse.json({ error: 'No scheduled dates in range' }, { status: 400 });
  }

  const rows = dates.map(date => ({
    template_id: id,
    exception_date: date,
    exception_type: body.exception_type,
    reason: body.reason || null,
    notes: body.notes || null,
    override_time_start: body.override_time_start || null,
    override_time_end: body.override_time_end || null,
  }));

  // Upsert to handle duplicates gracefully
  const { data, error } = await db
    .from('schedule_exceptions')
    .upsert(rows, { onConflict: 'template_id,exception_date' })
    .select();

  if (error) {
    console.error('[Schedule Exceptions] POST failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

/**
 * DELETE /api/schedules/[id]/exceptions?exception_id=xxx
 * Remove a single exception
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const exceptionId = searchParams.get('exception_id');

  if (!exceptionId) {
    return NextResponse.json({ error: 'exception_id required' }, { status: 400 });
  }

  const db = getDb();

  // Verify ownership
  const { data: template } = await db
    .from('schedule_templates')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!template) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { error } = await db
    .from('schedule_exceptions')
    .delete()
    .eq('id', exceptionId)
    .eq('template_id', id);

  if (error) {
    console.error('[Schedule Exceptions] DELETE failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
