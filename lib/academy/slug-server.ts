// lib/academy/slug-server.ts
// DB-aware unique-slug helpers for academy courses/lessons. Used by the create
// and update API routes and the backfill script. Pass a Supabase service-role
// client as `db`.

import type { SupabaseClient } from '@supabase/supabase-js';
import { makeUniqueSlug } from '@/lib/blog/slug';

/**
 * Returns a course slug unique within a teacher's courses.
 * `excludeId` lets an existing course keep its own slug during an update.
 */
export async function uniqueCourseSlug(
  db: SupabaseClient,
  teacherId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  return makeUniqueSlug(base, async (candidate) => {
    let query = db
      .from('courses')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('slug', candidate);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query.limit(1);
    return (data?.length ?? 0) > 0;
  });
}

/**
 * Returns a lesson slug unique within a course.
 * `excludeId` lets an existing lesson keep its own slug during an update.
 */
export async function uniqueLessonSlug(
  db: SupabaseClient,
  courseId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  return makeUniqueSlug(base, async (candidate) => {
    let query = db
      .from('lessons')
      .select('id')
      .eq('course_id', courseId)
      .eq('slug', candidate);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query.limit(1);
    return (data?.length ?? 0) > 0;
  });
}
