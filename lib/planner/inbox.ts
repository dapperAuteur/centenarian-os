// lib/planner/inbox.ts
// The per-user Inbox: "Inbox > Inbox > Inbox" (roadmap > goal > milestone), where a task lands
// when it is captured without picking a goal.
//
// WHY IT EXISTS
// tasks.milestone_id is NOT NULL and task RLS derives ownership through
// milestone > goal > roadmap > user, so a task cannot exist outside the hierarchy. Rather than
// change the shared `tasks` table (a coordinated change with contractor-os, deferred), the app
// builds a real hierarchy for the Inbox the first time a task needs it. A new user can save a task
// by typing a title only, and ownership still flows through the chain, so RLS is untouched.
//
// NOT NULL COLUMNS
// roadmaps.start_date/end_date, goals.target_year and milestones.target_date are NOT NULL with no
// default. Leaving any of them out fails the insert silently from the caller's point of view (see
// the header of lib/planner/sync-tasks.ts for the production bug that taught this). All four are
// set below, and goals.category must satisfy goals_category_check (LIFESTYLE).
//
// FINDING IT
// The roadmap is found by roadmaps.system_kind = 'inbox' (migration 199), falling back to the
// title "Inbox" before that migration is applied. Goal and milestone are found by title under it.
// Archived levels are skipped, so an archived Inbox goal or milestone is replaced, not reused.

import type { SupabaseClient } from '@supabase/supabase-js';
import { toLocalDateString } from '@/lib/dates/local';
import { findSystemRoadmapId, insertSystemRoadmap, SYSTEM_ROADMAP_TITLES } from '@/lib/planner/system-roadmaps';

export const INBOX_GOAL_TITLE = 'Inbox';
export const INBOX_MILESTONE_TITLE = 'Inbox';
/** goals.category has a CHECK constraint; LIFESTYLE is the neutral choice for uncategorized tasks. */
const INBOX_GOAL_CATEGORY = 'LIFESTYLE';
/** The Inbox is permanent, so its dates are placeholders far enough out never to look overdue. */
const INBOX_SPAN_YEARS = 10;

/**
 * Placeholder dates for the NOT NULL columns. Formatted from local calendar fields
 * (lib/dates/local), which on the server is the server's time zone.
 */
function inboxDates(): { today: string; end: string; endYear: number } {
  const now = new Date();
  const end = new Date(now);
  end.setFullYear(end.getFullYear() + INBOX_SPAN_YEARS);
  return { today: toLocalDateString(now), end: toLocalDateString(end), endYear: end.getFullYear() };
}

/**
 * Find or create the user's Inbox milestone and return its id, or null if it could not be built.
 *
 * Pass the RLS server client (lib/supabase/server) for request-scoped use: every insert is the
 * user's own row, so RLS allows it. A service-role client also works because every query filters
 * by userId explicitly.
 */
export async function resolveInboxMilestone(db: SupabaseClient, userId: string): Promise<string | null> {
  const { today, end, endYear } = inboxDates();

  // 1. Roadmap
  const found = await findSystemRoadmapId(db, userId, 'inbox', { activeOnly: true });
  let roadmapId = found.id;
  if (!roadmapId) {
    roadmapId = await insertSystemRoadmap(
      db,
      userId,
      'inbox',
      { startDate: today, endDate: end },
      {
        skipKind: found.columnMissing,
        description: 'Created automatically. Tasks saved without a goal land here; move them to a goal when you plan.',
      },
    );
    if (!roadmapId) return null;
  }

  // 2. Goal
  const { data: goal } = await db
    .from('goals')
    .select('id')
    .eq('roadmap_id', roadmapId)
    .eq('title', INBOX_GOAL_TITLE)
    .neq('status', 'archived')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  let goalId = goal?.id as string | undefined;
  if (!goalId) {
    const { data: created, error } = await db
      .from('goals')
      .insert({
        roadmap_id: roadmapId,
        title: INBOX_GOAL_TITLE,
        description: null,
        category: INBOX_GOAL_CATEGORY,
        status: 'active',
        target_year: endYear,
      })
      .select('id')
      .single();
    if (error || !created) {
      console.error('[inbox] goal insert failed:', error?.message);
      return null;
    }
    goalId = created.id as string;
  }

  // 3. Milestone
  const { data: milestone } = await db
    .from('milestones')
    .select('id')
    .eq('goal_id', goalId)
    .eq('title', INBOX_MILESTONE_TITLE)
    .neq('status', 'archived')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (milestone?.id) return milestone.id as string;

  const { data: createdMs, error: msErr } = await db
    .from('milestones')
    .insert({
      goal_id: goalId,
      title: INBOX_MILESTONE_TITLE,
      description: null,
      status: 'in_progress',
      target_date: end,
    })
    .select('id')
    .single();
  if (msErr || !createdMs) {
    console.error('[inbox] milestone insert failed:', msErr?.message);
    return null;
  }
  return createdMs.id as string;
}

/** The roadmap title the Inbox is created with, re-exported for UI copy. */
export const INBOX_ROADMAP_TITLE = SYSTEM_ROADMAP_TITLES.inbox;
