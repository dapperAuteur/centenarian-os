// app/api/planner/import/route.ts
// POST: bulk import planner tasks from parsed CSV rows.
// Supports optional hierarchy columns (roadmap_title, goal_title, milestone_title, ...)
// that let a single CSV create a full Roadmap → Goal → Milestone → Task tree.
// Rows with no hierarchy columns fall back to the legacy "Imported Tasks" milestone.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { MAX_IMPORT_ROWS, validateDate } from '@/lib/csv/helpers';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const VALID_TAGS = new Set(['personal', 'work', 'health', 'finance', 'travel', 'errands', 'fitness']);
const VALID_GOAL_CATEGORIES = new Set(['FITNESS', 'CREATIVE', 'SKILL', 'OUTREACH', 'LIFESTYLE', 'MINDSET', 'FUEL']);

type Db = ReturnType<typeof getDb>;

interface HierarchyCaches {
  roadmapByTitle: Map<string, string>;
  goalByKey: Map<string, string>;
  milestoneByKey: Map<string, string>;
  created: { roadmaps: number; goals: number; milestones: number };
}

function newHierarchyCaches(): HierarchyCaches {
  return {
    roadmapByTitle: new Map(),
    goalByKey: new Map(),
    milestoneByKey: new Map(),
    created: { roadmaps: 0, goals: 0, milestones: 0 },
  };
}

function hasHierarchyColumns(row: Record<string, string | undefined>): boolean {
  return Boolean(row.roadmap_title?.trim() || row.goal_title?.trim() || row.milestone_title?.trim());
}

/**
 * Ensures an "Imported Tasks" milestone exists for the user.
 * Creates the full hierarchy (roadmap → goal → milestone) if needed.
 * This is the legacy fallback for rows without hierarchy columns.
 */
async function resolveImportMilestone(db: Db, userId: string): Promise<string> {
  // 1. Check for existing milestone named "Imported Tasks"
  const { data: existingMilestone } = await db
    .from('milestones')
    .select('id, goal_id')
    .eq('title', 'Imported Tasks')
    .neq('status', 'archived')
    .limit(1)
    .maybeSingle();

  if (existingMilestone) {
    const { data: goal } = await db
      .from('goals')
      .select('id, roadmap_id')
      .eq('id', existingMilestone.goal_id)
      .maybeSingle();

    if (goal) {
      const { data: roadmap } = await db
        .from('roadmaps')
        .select('id')
        .eq('id', goal.roadmap_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (roadmap) return existingMilestone.id;
    }
  }

  let roadmapId: string;
  const { data: existingRoadmap } = await db
    .from('roadmaps')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingRoadmap) {
    roadmapId = existingRoadmap.id;
  } else {
    const { data: newRoadmap, error: rmErr } = await db
      .from('roadmaps')
      .insert({
        user_id: userId,
        title: 'General',
        status: 'active',
      })
      .select('id')
      .single();
    if (rmErr || !newRoadmap) throw new Error('Failed to create roadmap');
    roadmapId = newRoadmap.id;
  }

  let goalId: string;
  const { data: existingGoal } = await db
    .from('goals')
    .select('id')
    .eq('roadmap_id', roadmapId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingGoal) {
    goalId = existingGoal.id;
  } else {
    const { data: newGoal, error: gErr } = await db
      .from('goals')
      .insert({
        roadmap_id: roadmapId,
        title: 'Imported',
        status: 'active',
      })
      .select('id')
      .single();
    if (gErr || !newGoal) throw new Error('Failed to create goal');
    goalId = newGoal.id;
  }

  const { data: newMilestone, error: msErr } = await db
    .from('milestones')
    .insert({
      goal_id: goalId,
      title: 'Imported Tasks',
      status: 'in_progress',
    })
    .select('id')
    .single();
  if (msErr || !newMilestone) throw new Error('Failed to create milestone');

  return newMilestone.id;
}

async function resolveRoadmap(
  db: Db,
  userId: string,
  row: Record<string, string | undefined>,
  caches: HierarchyCaches,
): Promise<string> {
  const title = row.roadmap_title?.trim() || 'General';

  const cached = caches.roadmapByTitle.get(title);
  if (cached) return cached;

  const { data: existing } = await db
    .from('roadmaps')
    .select('id')
    .eq('user_id', userId)
    .eq('title', title)
    .neq('status', 'archived')
    .limit(1)
    .maybeSingle();

  if (existing) {
    caches.roadmapByTitle.set(title, existing.id);
    return existing.id;
  }

  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    title,
    status: 'active',
  };
  if (row.roadmap_description?.trim()) insertPayload.description = row.roadmap_description.trim();
  if (row.roadmap_start_date?.trim() && validateDate(row.roadmap_start_date.trim())) {
    insertPayload.start_date = row.roadmap_start_date.trim();
  }
  if (row.roadmap_end_date?.trim() && validateDate(row.roadmap_end_date.trim())) {
    insertPayload.end_date = row.roadmap_end_date.trim();
  }

  const { data: created, error } = await db
    .from('roadmaps')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error || !created) throw new Error(`Failed to create roadmap "${title}": ${error?.message || 'unknown'}`);

  caches.roadmapByTitle.set(title, created.id);
  caches.created.roadmaps++;
  return created.id;
}

async function resolveGoal(
  db: Db,
  roadmapId: string,
  row: Record<string, string | undefined>,
  caches: HierarchyCaches,
): Promise<string> {
  const title = row.goal_title?.trim();
  if (!title) throw new Error('goal_title required when using hierarchy import');

  const cacheKey = `${roadmapId}::${title}`;
  const cached = caches.goalByKey.get(cacheKey);
  if (cached) return cached;

  const { data: existing } = await db
    .from('goals')
    .select('id')
    .eq('roadmap_id', roadmapId)
    .eq('title', title)
    .neq('status', 'archived')
    .limit(1)
    .maybeSingle();

  if (existing) {
    caches.goalByKey.set(cacheKey, existing.id);
    return existing.id;
  }

  const category = row.goal_category?.trim()?.toUpperCase();
  if (!category || !VALID_GOAL_CATEGORIES.has(category)) {
    throw new Error(
      `goal_category required when creating goal "${title}" (one of: ${Array.from(VALID_GOAL_CATEGORIES).join(', ')})`,
    );
  }

  const targetYearRaw = row.goal_target_year?.trim();
  const targetYear = targetYearRaw ? parseInt(targetYearRaw, 10) : NaN;
  if (!targetYearRaw || isNaN(targetYear)) {
    throw new Error(`goal_target_year required when creating goal "${title}"`);
  }

  const insertPayload: Record<string, unknown> = {
    roadmap_id: roadmapId,
    title,
    category,
    target_year: targetYear,
    status: 'active',
  };
  if (row.goal_description?.trim()) insertPayload.description = row.goal_description.trim();

  const { data: created, error } = await db
    .from('goals')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error || !created) throw new Error(`Failed to create goal "${title}": ${error?.message || 'unknown'}`);

  caches.goalByKey.set(cacheKey, created.id);
  caches.created.goals++;
  return created.id;
}

async function resolveMilestone(
  db: Db,
  goalId: string,
  row: Record<string, string | undefined>,
  caches: HierarchyCaches,
): Promise<string> {
  const title = row.milestone_title?.trim();
  if (!title) throw new Error('milestone_title required when using hierarchy import');

  const cacheKey = `${goalId}::${title}`;
  const cached = caches.milestoneByKey.get(cacheKey);
  if (cached) return cached;

  const { data: existing } = await db
    .from('milestones')
    .select('id')
    .eq('goal_id', goalId)
    .eq('title', title)
    .neq('status', 'archived')
    .limit(1)
    .maybeSingle();

  if (existing) {
    caches.milestoneByKey.set(cacheKey, existing.id);
    return existing.id;
  }

  const targetDate = row.milestone_target_date?.trim();
  if (!targetDate || !validateDate(targetDate)) {
    throw new Error(`milestone_target_date (YYYY-MM-DD) required when creating milestone "${title}"`);
  }

  const insertPayload: Record<string, unknown> = {
    goal_id: goalId,
    title,
    target_date: targetDate,
    status: 'not_started',
  };
  if (row.milestone_description?.trim()) insertPayload.description = row.milestone_description.trim();

  const { data: created, error } = await db
    .from('milestones')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error || !created) throw new Error(`Failed to create milestone "${title}": ${error?.message || 'unknown'}`);

  caches.milestoneByKey.set(cacheKey, created.id);
  caches.created.milestones++;
  return created.id;
}

async function resolveHierarchy(
  db: Db,
  userId: string,
  row: Record<string, string | undefined>,
  caches: HierarchyCaches,
): Promise<string> {
  const roadmapId = await resolveRoadmap(db, userId, row, caches);
  const goalId = await resolveGoal(db, roadmapId, row, caches);
  const milestoneId = await resolveMilestone(db, goalId, row, caches);
  return milestoneId;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const rows = body.rows;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_IMPORT_ROWS} rows per import` }, { status: 400 });
  }

  const db = getDb();
  const caches = newHierarchyCaches();

  // Lazy-init the legacy "Imported Tasks" milestone only if a non-hierarchy row appears.
  let legacyMilestoneId: string | null = null;

  const payloads: Record<string, unknown>[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (!row.date || !validateDate(row.date)) {
      errors.push(`Row ${i + 1}: invalid or missing date`);
      skipped++;
      continue;
    }

    const activity = row.activity?.trim();
    if (!activity) {
      errors.push(`Row ${i + 1}: missing activity`);
      skipped++;
      continue;
    }

    let milestoneId: string;
    try {
      if (hasHierarchyColumns(row)) {
        milestoneId = await resolveHierarchy(db, user.id, row, caches);
      } else {
        if (!legacyMilestoneId) legacyMilestoneId = await resolveImportMilestone(db, user.id);
        milestoneId = legacyMilestoneId;
      }
    } catch (err) {
      errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'hierarchy error'}`);
      skipped++;
      continue;
    }

    const tag = row.tag?.trim()?.toLowerCase();
    const resolvedTag = tag && VALID_TAGS.has(tag) ? tag : 'personal';

    const priority = row.priority ? parseInt(row.priority, 10) : 2;
    const resolvedPriority = [1, 2, 3].includes(priority) ? priority : 2;

    const estimatedCost = row.estimated_cost ? parseFloat(row.estimated_cost) : null;

    payloads.push({
      user_id: user.id,
      milestone_id: milestoneId,
      date: row.date,
      time: row.time?.trim() || null,
      activity,
      description: row.description?.trim() || null,
      tag: resolvedTag,
      priority: resolvedPriority,
      estimated_cost: estimatedCost && !isNaN(estimatedCost) ? estimatedCost : null,
      completed: false,
    });
  }

  if (payloads.length === 0) {
    return NextResponse.json({ error: 'No valid rows', details: errors.slice(0, 10) }, { status: 400 });
  }

  const { data, error } = await db
    .from('tasks')
    .insert(payloads)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const imported = data?.length || 0;
  return NextResponse.json({
    imported,
    skipped,
    roadmaps_created: caches.created.roadmaps,
    goals_created: caches.created.goals,
    milestones_created: caches.created.milestones,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    message: `Imported ${imported} tasks${caches.created.roadmaps + caches.created.goals + caches.created.milestones > 0 ? ` (created ${caches.created.roadmaps} roadmaps, ${caches.created.goals} goals, ${caches.created.milestones} milestones)` : ''}. ${skipped > 0 ? `${skipped} skipped.` : ''}`,
  });
}
