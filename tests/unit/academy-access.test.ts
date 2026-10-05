// tests/unit/academy-access.test.ts
// Run: npm run test:unit
//
// Who may see a course, read a lesson, or send a course message
// (lib/academy/access.ts). The database is a small fake.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canReadLesson,
  canSendCourseMessage,
  getCourseAccess,
  hasEnrollment,
  isCourseListed,
  isCourseStaff,
  isCourseVisible,
  isFreeCourse,
  lessonInCourse,
  lessonOutline,
  type AcademyDb,
  type CourseAccessRow,
} from '../../lib/academy/access.ts';

const TEACHER = '11111111-1111-4111-8111-111111111111';
const STUDENT = '22222222-2222-4222-8222-222222222222';
const STRANGER = '33333333-3333-4333-8333-333333333333';
const COURSE = 'cccccccc-cccc-4ccc-8ccc-000000000001';
const OTHER_COURSE = 'cccccccc-cccc-4ccc-8ccc-000000000002';
const LESSON = 'dddddddd-dddd-4ddd-8ddd-000000000001';
const ADMIN = 'admin@example.com';
const NOW = new Date('2026-10-05T12:00:00Z');

const teacher = { id: TEACHER, email: 't@example.com' };
const student = { id: STUDENT, email: 's@example.com' };
const admin = { id: STRANGER, email: ADMIN };

const course = (over: Partial<CourseAccessRow> = {}): CourseAccessRow => ({
  id: COURSE,
  teacher_id: TEACHER,
  is_published: true,
  visibility: 'public',
  published_at: null,
  price: 49,
  price_type: 'one_time',
  ...over,
});

// ─── Staff and visibility ────────────────────────────────────────────────────

test('staff: the teacher and the admin, nobody else; an unset ADMIN_EMAIL matches nobody', () => {
  assert.equal(isCourseStaff(course(), teacher, ADMIN), true);
  assert.equal(isCourseStaff(course(), admin, ADMIN), true);
  assert.equal(isCourseStaff(course(), student, ADMIN), false);
  assert.equal(isCourseStaff(course(), null, ADMIN), false);
  assert.equal(isCourseStaff(course(), { id: STRANGER, email: '' }, ''), false);
  assert.equal(isCourseStaff(course(), { id: STRANGER, email: undefined }, undefined), false);
  assert.equal(isCourseStaff(course({ teacher_id: null }), { id: '' }, ADMIN), false);
});

test('visibility: drafts only for staff; members need a sign-in; scheduled once due', () => {
  assert.equal(isCourseVisible(course({ is_published: false }), student, ADMIN, NOW), false);
  assert.equal(isCourseVisible(course({ is_published: false }), null, ADMIN, NOW), false);
  assert.equal(isCourseVisible(course({ is_published: false }), teacher, ADMIN, NOW), true);
  assert.equal(isCourseVisible(course({ is_published: false }), admin, ADMIN, NOW), true);

  assert.equal(isCourseVisible(course(), null, ADMIN, NOW), true);
  assert.equal(isCourseVisible(course({ visibility: null }), null, ADMIN, NOW), true);
  assert.equal(isCourseVisible(course({ visibility: 'members' }), null, ADMIN, NOW), false);
  assert.equal(isCourseVisible(course({ visibility: 'members' }), student, ADMIN, NOW), true);
  assert.equal(isCourseVisible(course({ visibility: 'scheduled', published_at: '2026-10-01T00:00:00Z' }), null, ADMIN, NOW), true);
  assert.equal(isCourseVisible(course({ visibility: 'scheduled', published_at: '2026-11-01T00:00:00Z' }), student, ADMIN, NOW), false);
  assert.equal(isCourseVisible(course({ visibility: 'scheduled', published_at: null }), student, ADMIN, NOW), false);
  assert.equal(isCourseVisible(course({ visibility: 'something-new' }), student, ADMIN, NOW), false);
  assert.equal(isCourseVisible(null, teacher, ADMIN, NOW), false);
});

test('listed (OG image, page metadata): published and due, members included, drafts never', () => {
  assert.equal(isCourseListed(course(), NOW), true);
  assert.equal(isCourseListed(course({ visibility: 'members' }), NOW), true);
  assert.equal(isCourseListed(course({ is_published: false }), NOW), false);
  assert.equal(isCourseListed(course({ visibility: 'scheduled', published_at: '2026-11-01T00:00:00Z' }), NOW), false);
  assert.equal(isCourseListed(null, NOW), false);
});

test('free course: price_type free or a zero price', () => {
  assert.equal(isFreeCourse(course({ price_type: 'free', price: 10 })), true);
  assert.equal(isFreeCourse(course({ price: 0 })), true);
  assert.equal(isFreeCourse(course({ price: '0' })), true);
  assert.equal(isFreeCourse(course({ price: 10 })), false);
  assert.equal(isFreeCourse(null), false);
});

// ─── Lessons ─────────────────────────────────────────────────────────────────

const read = (over: Partial<Parameters<typeof canReadLesson>[0]> = {}) =>
  canReadLesson({
    course: course(),
    lesson: { is_free_preview: false, is_published: true },
    modulePublished: true,
    viewer: student,
    enrolled: false,
    adminEmail: ADMIN,
    now: NOW,
    ...over,
  });

test('lesson: enrolled, free preview or free course; nobody else', () => {
  assert.equal(read(), false);
  assert.equal(read({ enrolled: true }), true);
  assert.equal(read({ lesson: { is_free_preview: true } }), true);
  assert.equal(read({ course: course({ price_type: 'free' }) }), true);
  assert.equal(read({ viewer: null, lesson: { is_free_preview: true } }), true);
  assert.equal(read({ viewer: null }), false);
});

test('lesson: drafts (course, module or lesson) are closed to everyone but staff', () => {
  assert.equal(read({ enrolled: true, course: course({ is_published: false }) }), false);
  assert.equal(read({ enrolled: true, lesson: { is_published: false } }), false);
  assert.equal(read({ enrolled: true, modulePublished: false }), false);
  assert.equal(read({ viewer: null, course: course({ price_type: 'free', visibility: 'members' }) }), false);
  assert.equal(read({ viewer: teacher, course: course({ is_published: false }), lesson: { is_published: false } }), true);
  assert.equal(read({ viewer: admin, modulePublished: false }), true);
  assert.equal(read({ lesson: null, viewer: teacher }), false);
});

test('outline: staff whole, enrolled keep content_url only, visitors no content', () => {
  const lesson = { id: LESSON, title: 'T', content_url: 'u', text_content: 'secret', quiz_content: { answers: 1 }, duration_seconds: 5 };
  assert.deepEqual(lessonOutline(lesson, 'staff'), lesson);
  assert.deepEqual(lessonOutline(lesson, 'enrolled'), { id: LESSON, title: 'T', content_url: 'u', duration_seconds: 5 });
  assert.deepEqual(lessonOutline(lesson, 'visitor'), { id: LESSON, title: 'T', duration_seconds: 5 });
  assert.equal(lesson.text_content, 'secret', 'the input is not changed');
});

// ─── Messages ────────────────────────────────────────────────────────────────

test('messages: teacher to an enrolled student, active student to the teacher, nothing else', () => {
  const c = course();
  const msg = (over: Partial<Parameters<typeof canSendCourseMessage>[0]>) =>
    canSendCourseMessage({ course: c, senderId: STUDENT, recipientId: TEACHER, senderEnrolled: true, recipientEnrolled: false, ...over });
  assert.equal(msg({}), true);
  assert.equal(msg({ senderEnrolled: false }), false);
  assert.equal(msg({ recipientId: STRANGER }), false, 'a student cannot write to an arbitrary user');
  assert.equal(msg({ senderId: TEACHER, recipientId: STUDENT, recipientEnrolled: true }), true);
  assert.equal(msg({ senderId: TEACHER, recipientId: STRANGER, recipientEnrolled: false }), false);
  assert.equal(msg({ senderId: TEACHER, recipientId: TEACHER, recipientEnrolled: true }), false);
  assert.equal(msg({ course: { teacher_id: null } }), false);
});

// ─── Database helpers ────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function fakeDb(store: Record<string, Row[]>, opts: { failTables?: string[] } = {}) {
  const db: AcademyDb = {
    from(table: string) {
      const filters: [string, unknown][] = [];
      let max = Infinity;
      const rows = () => (store[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v));
      const failed = () => opts.failTables?.includes(table);
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
        limit: (n: number) => { max = n; return q; },
        maybeSingle: async () => {
          if (failed()) return { data: null, error: { message: 'boom' } };
          const r = rows();
          return r.length > 1 ? { data: null, error: { message: 'multiple rows' } } : { data: r[0] ?? null, error: null };
        },
        then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
          Promise.resolve(failed() ? { data: null, error: { message: 'boom' } } : { data: rows().slice(0, max), error: null }).then(ok, bad),
      };
      return q;
    },
  };
  return db;
}

test('hasEnrollment: active only by default, several attempt rows are fine, bad ids never queried', async () => {
  const db = fakeDb({
    enrollments: [
      { user_id: STUDENT, course_id: COURSE, status: 'cancelled' },
      { user_id: STUDENT, course_id: COURSE, status: 'active' },
      { user_id: STRANGER, course_id: COURSE, status: 'cancelled' },
    ],
  });
  assert.equal(await hasEnrollment(db, STUDENT, COURSE), true);
  assert.equal(await hasEnrollment(db, STRANGER, COURSE), false);
  assert.equal(await hasEnrollment(db, STRANGER, COURSE, false), true);
  assert.equal(await hasEnrollment(db, STUDENT, OTHER_COURSE), false);
  assert.equal(await hasEnrollment(db, null, COURSE), false);
  assert.equal(await hasEnrollment(db, "x' or 1=1", COURSE), false);
  assert.equal(await hasEnrollment(fakeDb({}, { failTables: ['enrollments'] }), STUDENT, COURSE), false);
});

test('lessonInCourse: only a lesson of the course in the URL', async () => {
  const db = fakeDb({ lessons: [{ id: LESSON, course_id: COURSE, is_published: true }] });
  assert.deepEqual(await lessonInCourse(db, COURSE, LESSON), { id: LESSON, course_id: COURSE, is_published: true });
  assert.equal(await lessonInCourse(db, OTHER_COURSE, LESSON), null);
  assert.equal(await lessonInCourse(db, COURSE, 'not-a-uuid'), null);
});

test('getCourseAccess: staff, visibility, enrollment and price in one call', async () => {
  const db = fakeDb({
    courses: [course({ is_published: false })],
    enrollments: [{ user_id: STUDENT, course_id: COURSE, status: 'active' }],
  });
  const asTeacher = await getCourseAccess(db, COURSE, teacher, ADMIN, NOW);
  assert.equal(asTeacher.isStaff, true);
  assert.equal(asTeacher.visible, true);
  const asStudent = await getCourseAccess(db, COURSE, student, ADMIN, NOW);
  assert.deepEqual([asStudent.isStaff, asStudent.visible, asStudent.enrolled, asStudent.isFree], [false, false, true, false]);
  const missing = await getCourseAccess(db, OTHER_COURSE, student, ADMIN, NOW);
  assert.equal(missing.course, null);
  const malformed = await getCourseAccess(db, 'slug-not-id', student, ADMIN, NOW);
  assert.equal(malformed.course, null);
});
