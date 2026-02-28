// app/api/planner/import/route.ts
// POST: bulk import planner tasks from parsed CSV rows
// Automatically resolves or creates "Imported Tasks" milestone under user's roadmap hierarchy.

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

/**
 * Ensures an "Imported Tasks" milestone exists for the user.
 * Creates the full hierarchy (roadmap → goal → milestone) if needed.
 */
async function resolveImportMilestone(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<string> {
  // 1. Check for existing milestone named "Imported Tasks"
  const { data: existingMilestone } = await db
    .from('milestones')
    .select('id, goal_id')
    .eq('title', 'Imported Tasks')
    .neq('status', 'archived')
    .limit(1)
    .maybeSingle();

  if (existingMilestone) {
    // Verify the goal belongs to a roadmap owned by this user
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

  // 2. Find or create a roadmap
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

  // 3. Find or create a goal under the roadmap
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

  // 4. Create the "Imported Tasks" milestone
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

  // Resolve or create the "Imported Tasks" milestone
  let milestoneId: string;
  try {
    milestoneId = await resolveImportMilestone(db, user.id);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to resolve import milestone: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 500 },
    );
  }

  const payloads: Record<string, unknown>[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Validate required: date
    if (!row.date || !validateDate(row.date)) {
      errors.push(`Row ${i + 1}: invalid or missing date`);
      skipped++;
      continue;
    }

    // Validate required: activity
    const activity = row.activity?.trim();
    if (!activity) {
      errors.push(`Row ${i + 1}: missing activity`);
      skipped++;
      continue;
    }

    // Validate tag
    const tag = row.tag?.trim()?.toLowerCase();
    const resolvedTag = tag && VALID_TAGS.has(tag) ? tag : 'personal';

    // Validate priority (1-3)
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
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    message: `Imported ${imported} tasks. ${skipped > 0 ? `${skipped} skipped.` : ''}`,
  });
}
