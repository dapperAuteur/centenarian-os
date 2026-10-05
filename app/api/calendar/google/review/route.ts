// app/api/calendar/google/review/route.ts
// The calendar events that "need a look" (calendar_sync_items.parse_status = 'flagged'):
// a tag whose data was missing (e.g. #expense with no amount), or a record the sync would not
// change on its own (edited in CentenarianOS, a cancelled event's transaction, a tag removed).
//
// GET   -> { items: [{ id, title, event_status, reason, date, task_id, record_type, record_id,
//            task_href, record_href, updated_at }] }   newest first, at most 100
// PATCH -> body { id } marks one item as looked at: it leaves the list (parse_status becomes
//          'ok' when it has a record, else 'task_only') until the event changes again and the
//          sync finds something new. Nothing else is changed. -> { ok: true }
//
// Cookie auth first, then the service-role client (writes to calendar_sync_items go through
// the service role); every query filters on the caller's user_id.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calendarErrorResponse, getServiceDb, isUuid } from '@/lib/google/route-helpers';
import { throwDbError } from '@/lib/google/connection';

const LIMIT = 100;

/** Where each record type is opened. A meal log has no page of its own; the meal list shows it. */
function recordHref(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  if (type === 'transaction') return `/dashboard/finance/transactions/${id}`;
  if (type === 'workout') return `/dashboard/workouts/${id}`;
  if (type === 'meal') return '/dashboard/fuel/meals';
  return null;
}

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

interface ItemRow {
  id: string;
  title_snapshot: string | null;
  event_status: string | null;
  parse_error: string | null;
  task_id: string | null;
  record_type: string | null;
  record_id: string | null;
  updated_at: string | null;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = getServiceDb();
    const { data, error } = await db
      .from('calendar_sync_items')
      .select('id, title_snapshot, event_status, parse_error, task_id, record_type, record_id, updated_at')
      .eq('user_id', user.id)
      .eq('parse_status', 'flagged')
      .order('updated_at', { ascending: false })
      .limit(LIMIT);
    if (error) throwDbError(error, 'Reading the events that need a look');
    const rows = (data as ItemRow[] | null) ?? [];

    // The task's date, for the planner link. Tasks have no user_id; the ids come from the
    // caller's own rows, and only the date is read back.
    const taskIds = rows.map((r) => r.task_id).filter((id): id is string => Boolean(id));
    const dates = new Map<string, string>();
    if (taskIds.length > 0) {
      const { data: tasks, error: taskError } = await db.from('tasks').select('id, date').in('id', taskIds);
      if (taskError) throwDbError(taskError, 'Reading the tasks');
      for (const t of (tasks as { id: string; date: string | null }[] | null) ?? []) {
        if (t.date) dates.set(t.id, t.date);
      }
    }

    const items = rows.map((r) => {
      const date = r.task_id ? dates.get(r.task_id) ?? null : null;
      return {
        id: r.id,
        title: r.title_snapshot ?? '(No title)',
        event_status: r.event_status,
        reason: r.parse_error,
        date,
        task_id: r.task_id,
        record_type: r.record_type,
        record_id: r.record_id,
        task_href: r.task_id && date ? `/dashboard/planner?view=day&date=${date}` : null,
        record_href: recordHref(r.record_type, r.record_id),
        updated_at: r.updated_at,
      };
    });
    return NextResponse.json({ items });
  } catch (err) {
    return calendarErrorResponse(err, 'GET review');
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let id: unknown = null;
  try {
    id = ((await request.json()) as { id?: unknown } | null)?.id ?? null;
  } catch {
    /* handled below */
  }
  if (!isUuid(id)) return NextResponse.json({ error: 'Send { id } of an item.', code: 'invalid_request' }, { status: 400 });

  try {
    const db = getServiceDb();
    const { data: row, error } = await db
      .from('calendar_sync_items')
      .select('id, record_id, parsed')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throwDbError(error, 'Reading the item');
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const parsed = (row.parsed as Record<string, unknown> | null) ?? {};
    const { error: updateError } = await db
      .from('calendar_sync_items')
      .update({
        parse_status: row.record_id ? 'ok' : 'task_only',
        parse_error: null,
        parsed: { ...parsed, record_review: null, reviewed_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id);
    if (updateError) throwDbError(updateError, 'Saving the item');
    return NextResponse.json({ ok: true });
  } catch (err) {
    return calendarErrorResponse(err, 'PATCH review');
  }
}
