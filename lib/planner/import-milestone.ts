// lib/planner/import-milestone.ts
// Where imported tasks land when the import does not name a milestone of its own: the CSV task
// import's "Imported Tasks" fallback (app/api/planner/import) and the Google Calendar import's
// "Google Calendar: <name>" milestone (app/api/calendar/import).
//
// PLACEMENT, IN ORDER
//   1. The user's own non-archived milestone with that title, in a roadmap they built. Re-imports
//      reuse it.
//   2. A new milestone with that title under the oldest active goal of the user's oldest active
//      roadmap that they built. If that roadmap has no active goal, an "Imported" goal is created
//      in it first.
//   3. The Inbox (lib/planner/inbox.ts), when the user has no active roadmap of their own. Tasks
//      go straight into the Inbox milestone; no titled milestone is created.
//
// System roadmaps (Inbox, Work.WitUS Sync; lib/planner/system-roadmaps.ts) are never used in
// steps 1 and 2. The old code picked the oldest active roadmap, which is often Work.WitUS Sync or
// the Inbox, so imports landed under "Finances" or inside the Inbox goal.
//
// NOT NULL COLUMNS
// goals.category (CHECK goals_category_check), goals.target_year and milestones.target_date have
// no default. The old inserts left them out and failed every time a level had to be created (the
// header of lib/planner/sync-tasks.ts has the production bug that taught this). Every insert here
// sets them. No roadmap is ever created here: step 3 covers users without one.
//
// SCOPING
// Both import routes use the service-role client, so every query filters by userId explicitly.
// The old milestone lookup matched the title across ALL users and took the first row, so for most
// users it found someone else's milestone and made a new one on every import.
//
// FAILURES
// A failed lookup throws rather than falling through to an insert, so a transient error cannot
// leave the user with a duplicate goal or milestone.

import type { SupabaseClient } from '@supabase/supabase-js';
import { toLocalDateString } from '@/lib/dates/local';
import { resolveInboxMilestone } from '@/lib/planner/inbox';
import { systemKindOf } from '@/lib/planner/system-roadmaps';

/** Title of the goal created in a roadmap that has no active goal. */
export const IMPORT_GOAL_TITLE = 'Imported';
/** goals.category has a CHECK constraint; LIFESTYLE is the neutral choice, as for the Inbox. */
const IMPORT_GOAL_CATEGORY = 'LIFESTYLE';

export interface ImportMilestone {
  milestoneId: string;
  /** 'milestone': the titled milestone in one of the user's roadmaps. 'inbox': the Inbox. */
  placement: 'milestone' | 'inbox';
}

type RoadmapRow = { id: string; title?: string | null; status?: string | null; system_kind?: string | null };

interface ExistingMilestoneRow {
  id: string;
  goals: { id: string; status: string | null; roadmaps: RoadmapRow | null } | null;
}

/** A roadmap the person built, not one the app created for itself. */
function isOwnRoadmap(roadmap: RoadmapRow | null | undefined): roadmap is RoadmapRow {
  return !!roadmap && roadmap.status !== 'archived' && systemKindOf(roadmap) === null;
}

/**
 * Placeholder target for a created goal and milestone: a year out, so a container milestone does
 * not look overdue as soon as it is made. Local calendar fields, as in lib/planner/inbox.ts.
 */
function importTargetDate(): { date: string; year: number } {
  const target = new Date();
  target.setFullYear(target.getFullYear() + 1);
  return { date: toLocalDateString(target), year: target.getFullYear() };
}

/**
 * Find or create the milestone that imported tasks without a milestone of their own belong to.
 * Throws when a lookup or insert fails; callers report the message.
 */
export async function resolveImportMilestone(
  db: SupabaseClient,
  userId: string,
  milestoneTitle: string,
): Promise<ImportMilestone> {
  // 1. An existing milestone with this title in one of the user's own roadmaps.
  //    roadmaps(*) rather than a column list so this works whether or not roadmaps.system_kind
  //    (migration 200) exists yet.
  const { data: existing, error: existingErr } = await db
    .from('milestones')
    .select('id, goals!inner(id, status, roadmaps!inner(*))')
    .eq('title', milestoneTitle)
    .neq('status', 'archived')
    .eq('goals.roadmaps.user_id', userId)
    .order('created_at', { ascending: true });
  if (existingErr) throw new Error(`Milestone lookup failed: ${existingErr.message}`);

  const reusable = ((existing ?? []) as unknown as ExistingMilestoneRow[]).find(
    (m) => m.goals && m.goals.status !== 'archived' && isOwnRoadmap(m.goals.roadmaps),
  );
  if (reusable) return { milestoneId: reusable.id, placement: 'milestone' };

  // 2. The user's oldest active roadmap that they built.
  const { data: roadmaps, error: roadmapErr } = await db
    .from('roadmaps')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  if (roadmapErr) throw new Error(`Roadmap lookup failed: ${roadmapErr.message}`);

  const roadmap = ((roadmaps ?? []) as RoadmapRow[]).find(isOwnRoadmap);

  // 3. No roadmap of their own: file the tasks in the Inbox.
  if (!roadmap) {
    const inboxId = await resolveInboxMilestone(db, userId);
    if (!inboxId) throw new Error('Could not find or create your Inbox');
    return { milestoneId: inboxId, placement: 'inbox' };
  }

  const target = importTargetDate();

  const { data: goal, error: goalErr } = await db
    .from('goals')
    .select('id')
    .eq('roadmap_id', roadmap.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (goalErr) throw new Error(`Goal lookup failed: ${goalErr.message}`);

  let goalId = goal?.id as string | undefined;
  if (!goalId) {
    const { data: created, error } = await db
      .from('goals')
      .insert({
        roadmap_id: roadmap.id,
        title: IMPORT_GOAL_TITLE,
        description: null,
        category: IMPORT_GOAL_CATEGORY,
        status: 'active',
        target_year: target.year,
      })
      .select('id')
      .single();
    if (error || !created) throw new Error(`Failed to create goal: ${error?.message ?? 'unknown'}`);
    goalId = created.id as string;
  }

  const { data: milestone, error: msErr } = await db
    .from('milestones')
    .insert({
      goal_id: goalId,
      title: milestoneTitle,
      description: null,
      status: 'in_progress',
      target_date: target.date,
    })
    .select('id')
    .single();
  if (msErr || !milestone) throw new Error(`Failed to create milestone: ${msErr?.message ?? 'unknown'}`);

  return { milestoneId: milestone.id as string, placement: 'milestone' };
}
