// lib/academy/slug.ts
// Slug generation + URL builders for human-readable academy course/lesson URLs:
//   /academy/{teacher-username}/{course-slug}/lesson/{lesson-slug}
//
// Course slugs are unique per teacher; lesson slugs are unique per course.
// Pretty URLs are only built when the full slug context is available — callers
// that only have a UUID fall back to the legacy /academy/{id} route, which
// 308-redirects to the canonical pretty URL.

import { generateSlug, makeUniqueSlug } from '@/lib/blog/slug';

export { generateSlug, makeUniqueSlug };

// Static segments under /academy/{username}/ — a course slug must never collide
// with one of these or it would be shadowed by a real route.
export const RESERVED_COURSE_SLUGS = new Set([
  'lesson',
  'lessons',
  'assignments',
  'teachers',
  'paths',
  'explore',
  'teach',
  'my-courses',
  'offline',
  'verify',
]);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** True when `slug` is a valid, non-reserved course slug. */
export function isValidCourseSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !RESERVED_COURSE_SLUGS.has(slug);
}

/** True when `slug` is a valid lesson slug (lessons have no reserved words). */
export function isValidLessonSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

/**
 * Generates a course slug from a title, avoiding reserved words by suffixing
 * `-course` before the uniqueness check.
 */
export function generateCourseSlug(title: string): string {
  const base = generateSlug(title) || 'course';
  return RESERVED_COURSE_SLUGS.has(base) ? `${base}-course` : base;
}

/** Generates a lesson slug from a title. */
export function generateLessonSlug(title: string): string {
  return generateSlug(title) || 'lesson';
}

type CourseHrefInput = {
  id: string;
  slug?: string | null;
  teacherUsername?: string | null;
};

/** Pretty course URL when slug + teacher username are known; legacy UUID otherwise. */
export function courseHref({ id, slug, teacherUsername }: CourseHrefInput): string {
  if (slug && teacherUsername) return `/academy/${teacherUsername}/${slug}`;
  return `/academy/${id}`;
}

type LessonHrefInput = {
  courseId: string;
  courseSlug?: string | null;
  teacherUsername?: string | null;
  lessonId: string;
  lessonSlug?: string | null;
};

/** Pretty lesson URL when full slug context is known; legacy UUID otherwise. */
export function lessonHref({
  courseId,
  courseSlug,
  teacherUsername,
  lessonId,
  lessonSlug,
}: LessonHrefInput): string {
  if (teacherUsername && courseSlug && lessonSlug) {
    return `/academy/${teacherUsername}/${courseSlug}/lesson/${lessonSlug}`;
  }
  return `/academy/${courseId}/lessons/${lessonId}`;
}
