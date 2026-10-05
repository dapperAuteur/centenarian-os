// lib/academy/access.ts
// Who may see a course, read a lesson, or message someone in a course?
//
// WHY THIS EXISTS
// Academy routes read with the service-role client, which bypasses RLS, and
// each route used to decide access on its own. Some forgot a step: the course
// detail returned every lesson's text and quiz answers to anyone, progress and
// discussion routes did not check the lesson belonged to the course in the URL,
// and course messages went to any user id. This file is the one place the
// rules live.
//
// THE RULES (from migrations 039, 040, 187 and the existing routes)
//   - Staff: the course's teacher (courses.teacher_id) or the admin
//     (ADMIN_EMAIL). Staff see everything, drafts included.
//   - Visible course: is_published, and visibility 'public', 'members' with a
//     signed-in viewer, or 'scheduled' once published_at has passed.
//   - Readable lesson: staff; otherwise the course is visible, the lesson and
//     its module are published, and the viewer is actively enrolled, or the
//     lesson is a free preview, or the course is free.
//   - Lesson content (content_url, text_content, quiz_content) is never part
//     of the course outline for non-staff. Enrolled viewers keep content_url
//     (the offline cache uses it); text and quizzes come from the lesson route,
//     which applies the rule above.
//   - Course messages run between the teacher and the course's students only.
//
// Pure apart from the injected database client, and free of '@/' imports, so
// node --test can load it (tests/unit/academy-access.test.ts).

/** The course columns these rules read. */
export interface CourseAccessRow {
  id?: string;
  teacher_id: string | null;
  is_published: boolean | null;
  visibility?: string | null;
  published_at?: string | null;
  price?: number | string | null;
  price_type?: string | null;
}

/** The signed-in user, or null for an anonymous visitor. */
export type CourseViewer = { id: string; email?: string | null } | null;

export const COURSE_ACCESS_SELECT = 'id, teacher_id, is_published, visibility, published_at, price, price_type';

/** The admin, as every academy route identifies them. An unset ADMIN_EMAIL matches nobody. */
export function isAdminEmail(email: string | null | undefined, adminEmail: string | null | undefined): boolean {
  return !!email && !!adminEmail && email === adminEmail;
}

/** The course's teacher or the admin. */
export function isCourseStaff(
  course: CourseAccessRow | null | undefined,
  viewer: CourseViewer,
  adminEmail: string | null | undefined,
): boolean {
  if (!course || !viewer) return false;
  return (!!course.teacher_id && course.teacher_id === viewer.id) || isAdminEmail(viewer.email, adminEmail);
}

function scheduledAndDue(course: CourseAccessRow, now: Date): boolean {
  if (!course.published_at) return false;
  const at = Date.parse(course.published_at);
  return Number.isFinite(at) && at <= now.getTime();
}

/** May this viewer see the course at all? Staff always can. */
export function isCourseVisible(
  course: CourseAccessRow | null | undefined,
  viewer: CourseViewer,
  adminEmail: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!course) return false;
  if (isCourseStaff(course, viewer, adminEmail)) return true;
  if (!course.is_published) return false;
  const visibility = course.visibility ?? 'public';
  if (visibility === 'public') return true;
  if (visibility === 'members') return !!viewer;
  if (visibility === 'scheduled') return scheduledAndDue(course, now);
  return false;
}

/**
 * May an anonymous page (an OG image, page metadata) name this course? Same as
 * isCourseVisible for a signed-in non-staff viewer: published, and not
 * scheduled for later. Members-only courses are listed by title.
 */
export function isCourseListed(course: CourseAccessRow | null | undefined, now: Date = new Date()): boolean {
  return isCourseVisible(course, { id: '' }, null, now);
}

/** A free course: anyone who can see it can read its lessons. */
export function isFreeCourse(course: CourseAccessRow | null | undefined): boolean {
  if (!course) return false;
  return course.price_type === 'free' || Number(course.price) === 0;
}

export interface LessonAccessRow {
  is_free_preview?: boolean | null;
  is_published?: boolean | null;
}

export interface LessonReadInput {
  course: CourseAccessRow | null | undefined;
  lesson: LessonAccessRow | null | undefined;
  /** course_modules.is_published for the lesson's module; null/undefined when it has none. */
  modulePublished?: boolean | null;
  viewer: CourseViewer;
  /** The viewer holds an active enrollment in the course. */
  enrolled: boolean;
  adminEmail: string | null | undefined;
  now?: Date;
}

/** May this viewer read the lesson's content? */
export function canReadLesson(input: LessonReadInput): boolean {
  const { course, lesson, viewer, adminEmail } = input;
  if (!course || !lesson) return false;
  if (isCourseStaff(course, viewer, adminEmail)) return true;
  if (!isCourseVisible(course, viewer, adminEmail, input.now)) return false;
  if (lesson.is_published === false || input.modulePublished === false) return false;
  return input.enrolled || lesson.is_free_preview === true || isFreeCourse(course);
}

/** Lesson fields that are content, not outline. */
export const LESSON_CONTENT_FIELDS = ['content_url', 'text_content', 'quiz_content'] as const;

export type OutlineLevel = 'staff' | 'enrolled' | 'visitor';

/**
 * A lesson as the course outline should show it. Staff get it whole; enrolled
 * viewers keep content_url (for the offline cache) but not text or quizzes;
 * everyone else gets titles, types and durations only.
 */
export function lessonOutline<T extends Record<string, unknown>>(lesson: T, level: OutlineLevel): T {
  if (level === 'staff') return lesson;
  const out: Record<string, unknown> = { ...lesson };
  for (const field of LESSON_CONTENT_FIELDS) {
    if (level === 'enrolled' && field === 'content_url') continue;
    delete out[field];
  }
  return out as T;
}

export interface MessageRuleInput {
  course: Pick<CourseAccessRow, 'teacher_id'> | null | undefined;
  senderId: string;
  recipientId: string;
  /** The sender holds an active enrollment in the course. */
  senderEnrolled: boolean;
  /** The recipient has ever enrolled in the course (active or not). */
  recipientEnrolled: boolean;
}

/**
 * Course messages run between the teacher and the course's students:
 * the teacher may write to anyone enrolled (now or before), an active student
 * may write to the teacher. Nobody writes to themselves.
 */
export function canSendCourseMessage(input: MessageRuleInput): boolean {
  const { course, senderId, recipientId } = input;
  if (!course?.teacher_id || !senderId || !recipientId || senderId === recipientId) return false;
  if (senderId === course.teacher_id) return input.recipientEnrolled;
  return input.senderEnrolled && recipientId === course.teacher_id;
}

// ─── Database access ─────────────────────────────────────────────────────────

/** The part of a Supabase client this file uses (service-role or a test fake). */
export interface AcademyDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a well-formed UUID string. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Does the user hold an enrollment in the course? `activeOnly` (the default)
 * counts only status 'active'. Uses limit(1), not maybeSingle(): a user can
 * have several enrollment rows per course (one per attempt, migration 044),
 * and maybeSingle() errors on more than one.
 */
export async function hasEnrollment(
  db: AcademyDb,
  userId: string | null | undefined,
  courseId: string,
  activeOnly = true,
): Promise<boolean> {
  if (!userId || !isUuid(userId) || !isUuid(courseId)) return false;
  let query = db.from('enrollments').select('status').eq('user_id', userId).eq('course_id', courseId);
  if (activeOnly) query = query.eq('status', 'active');
  const { data, error } = await query.limit(1);
  return !error && Array.isArray(data) && data.length > 0;
}

export interface CourseAccess {
  /** The course row, or null when it does not exist. */
  course: CourseAccessRow | null;
  isStaff: boolean;
  /** isCourseVisible() for this viewer. */
  visible: boolean;
  /** Active enrollment. false for staff and anonymous viewers. */
  enrolled: boolean;
  isFree: boolean;
}

/** Everything a route needs to decide access to one course. */
export async function getCourseAccess(
  db: AcademyDb,
  courseId: string,
  viewer: CourseViewer,
  adminEmail: string | null | undefined = process.env.ADMIN_EMAIL,
  now: Date = new Date(),
): Promise<CourseAccess> {
  const none: CourseAccess = { course: null, isStaff: false, visible: false, enrolled: false, isFree: false };
  if (!isUuid(courseId)) return none;
  const { data: course } = await db.from('courses').select(COURSE_ACCESS_SELECT).eq('id', courseId).maybeSingle();
  if (!course) return none;
  const isStaff = isCourseStaff(course, viewer, adminEmail);
  const enrolled = !isStaff && !!viewer ? await hasEnrollment(db, viewer.id, courseId) : false;
  return {
    course,
    isStaff,
    visible: isCourseVisible(course, viewer, adminEmail, now),
    enrolled,
    isFree: isFreeCourse(course),
  };
}

/**
 * The lesson, only when it belongs to the course in the URL. A route that takes
 * both a course id and a lesson id must call this before using the lesson id,
 * or the course check proves nothing about the lesson.
 */
export async function lessonInCourse<T = Record<string, unknown>>(
  db: AcademyDb,
  courseId: string,
  lessonId: string,
  select = 'id, course_id, module_id, is_free_preview, is_published',
): Promise<T | null> {
  if (!isUuid(courseId) || !isUuid(lessonId)) return null;
  const { data } = await db.from('lessons').select(select).eq('id', lessonId).eq('course_id', courseId).maybeSingle();
  return (data as T) ?? null;
}

/** course_modules.is_published for a module, or null when there is no module. */
export async function modulePublished(db: AcademyDb, moduleId: unknown): Promise<boolean | null> {
  if (!isUuid(moduleId)) return null;
  const { data } = await db.from('course_modules').select('is_published').eq('id', moduleId).maybeSingle();
  return data ? data.is_published !== false : null;
}
