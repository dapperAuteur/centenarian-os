// app/api/tasks/route.ts
// POST: create one planner task. Used by the planner's Create Task form through offlineFetch, so
// an offline create is queued in IndexedDB and replayed here when the device reconnects.
//
// - milestone_id is optional. Without it the task goes to the user's Inbox milestone, which is
//   created on first use (lib/planner/inbox.ts). That is what lets a task be saved with a title
//   only, and what lets an offline create that never saw the milestone list resolve on replay.
// - id is optional and client-generated. Sending the same id again returns the existing row with
//   200 instead of inserting a duplicate, so a replayed or retried create is idempotent.
// - A supplied milestone must belong to the caller and not be archived. If it doesn't (for
//   example it was deleted while a create sat in the offline queue), the task goes to the Inbox
//   instead of being rejected: a 4xx on replay would be retried and then dropped, losing the task.
//   The response says so with `milestone_fallback: 'inbox'`.
//
// Uses the RLS server client: every read and insert runs as the signed-in user, and task RLS
// (milestone > goal > roadmap > user) still decides ownership.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveInboxMilestone } from '@/lib/planner/inbox';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const MAX_ACTIVITY = 500;
const MAX_DESCRIPTION = 5000;
const MAX_TAG = 40;
const DEFAULT_TAG = 'LIFESTYLE';

type Body = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // ── Validate ───────────────────────────────────────────────────────
  const activity = str(body.activity);
  if (!activity) {
    return NextResponse.json({ error: 'activity is required' }, { status: 400 });
  }
  if (activity.length > MAX_ACTIVITY) {
    return NextResponse.json({ error: `activity must be ${MAX_ACTIVITY} characters or fewer` }, { status: 400 });
  }

  const date = str(body.date);
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }

  const time = str(body.time) || '09:00';
  if (!TIME_RE.test(time)) {
    return NextResponse.json({ error: 'time must be HH:MM' }, { status: 400 });
  }

  const description = str(body.description).slice(0, MAX_DESCRIPTION) || null;
  // Tag vocabularies are not unified yet; accept the form's value as-is, bounded.
  const tag = (str(body.tag) || DEFAULT_TAG).slice(0, MAX_TAG);
  const priority = body.priority === 1 || body.priority === 2 || body.priority === 3 ? body.priority : 2;

  const id = str(body.id);
  if (id && !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'id must be a UUID' }, { status: 400 });
  }
  const requestedMilestone = str(body.milestone_id);
  if (requestedMilestone && !UUID_RE.test(requestedMilestone)) {
    return NextResponse.json({ error: 'milestone_id must be a UUID' }, { status: 400 });
  }

  // ── Idempotent replay ──────────────────────────────────────────────
  if (id) {
    const { data: existing } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
    if (existing) {
      return NextResponse.json({ task: existing, replayed: true }, { status: 200 });
    }
  }

  // ── Milestone: the caller's own, or the Inbox ──────────────────────
  let milestoneId: string | null = null;
  let milestoneFallback: 'inbox' | null = null;
  if (requestedMilestone) {
    const { data: owned, error: msErr } = await supabase
      .from('milestones')
      .select('id, status, goals!inner(id, roadmaps!inner(id, user_id))')
      .eq('id', requestedMilestone)
      .eq('goals.roadmaps.user_id', user.id)
      .maybeSingle();
    if (msErr) {
      console.error('[Tasks API] milestone check failed:', msErr.message);
      return NextResponse.json({ error: 'Could not check the milestone' }, { status: 500 });
    }
    if (owned && owned.status !== 'archived') {
      milestoneId = owned.id as string;
    } else {
      milestoneFallback = 'inbox';
    }
  }
  if (!milestoneId) {
    milestoneId = await resolveInboxMilestone(supabase, user.id);
    if (!milestoneId) {
      return NextResponse.json({ error: 'Could not create your Inbox. Please try again.' }, { status: 500 });
    }
  }

  // ── Insert ─────────────────────────────────────────────────────────
  const row = {
    ...(id ? { id } : {}),
    milestone_id: milestoneId,
    date,
    time,
    activity,
    description,
    tag,
    priority,
    completed: false,
  };

  const { data: task, error } = await supabase.from('tasks').insert(row).select('*').single();

  if (error) {
    // Unique violation on a client id: a concurrent replay won the race. Return its row if it is
    // ours; if RLS hides it, the id belongs to someone else.
    if (error.code === '23505' && id) {
      const { data: existing } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
      if (existing) {
        return NextResponse.json({ task: existing, replayed: true }, { status: 200 });
      }
      return NextResponse.json({ error: 'A task with that id already exists' }, { status: 409 });
    }
    console.error('[Tasks API] POST failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { task, ...(milestoneFallback ? { milestone_fallback: milestoneFallback } : {}) },
    { status: 201 },
  );
}
