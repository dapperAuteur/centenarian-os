// lib/academy/resolve-server.ts
// Server-side resolution between human-readable academy slugs and UUIDs.
// Used by the pretty routes (slug -> id) and the legacy redirect stubs
// (id -> canonical pretty path). Pass a Supabase service-role client.

import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Resolves /academy/{username}/{courseSlug} -> course id (or null if not found). */
export async function resolveCourseId(
  db: SupabaseClient,
  username: string,
  courseSlug: string,
): Promise<string | null> {
  const { data: profile } = await db
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (!profile) return null;

  const { data: course } = await db
    .from('courses')
    .select('id')
    .eq('teacher_id', profile.id)
    .eq('slug', courseSlug)
    .maybeSingle();
  return course?.id ?? null;
}

/** Resolves a lesson slug within a course -> lesson id (or null). */
export async function resolveLessonId(
  db: SupabaseClient,
  courseId: string,
  lessonSlug: string,
): Promise<string | null> {
  const { data: lesson } = await db
    .from('lessons')
    .select('id')
    .eq('course_id', courseId)
    .eq('slug', lessonSlug)
    .maybeSingle();
  return lesson?.id ?? null;
}

/**
 * Canonical pretty path for a course by id, or null when it can't be built
 * (missing teacher username or course slug) — callers then leave the legacy URL.
 */
export async function getPrettyCoursePath(
  db: SupabaseClient,
  courseId: string,
): Promise<string | null> {
  const { data: course } = await db
    .from('courses')
    .select('slug, profiles:teacher_id(username)')
    .eq('id', courseId)
    .maybeSingle();
  if (!course) return null;
  const username = (course as { profiles?: { username?: string | null } | null }).profiles?.username;
  const slug = (course as { slug?: string | null }).slug;
  if (!username || !slug) return null;
  return `/academy/${username}/${slug}`;
}

/** Canonical pretty path for a lesson by ids, or null when it can't be built. */
export async function getPrettyLessonPath(
  db: SupabaseClient,
  courseId: string,
  lessonId: string,
): Promise<string | null> {
  const base = await getPrettyCoursePath(db, courseId);
  if (!base) return null;
  const { data: lesson } = await db
    .from('lessons')
    .select('slug')
    .eq('id', lessonId)
    .eq('course_id', courseId)
    .maybeSingle();
  const lessonSlug = (lesson as { slug?: string | null } | null)?.slug;
  if (!lessonSlug) return null;
  return `${base}/lesson/${lessonSlug}`;
}
