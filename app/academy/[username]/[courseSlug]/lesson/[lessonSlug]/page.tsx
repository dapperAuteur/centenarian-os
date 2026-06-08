// app/academy/[username]/[courseSlug]/lesson/[lessonSlug]/page.tsx
// Human-readable lesson player:
//   /academy/{teacher-username}/{course-slug}/lesson/{lesson-slug}
// Resolves the slugs to course + lesson ids, then renders the shared client view.

import { notFound } from 'next/navigation';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { resolveCourseId, resolveLessonId } from '@/lib/academy/resolve-server';
import LessonPlayerView from '@/components/academy/LessonPlayerView';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Props = { params: Promise<{ username: string; courseSlug: string; lessonSlug: string }> };

export default async function LessonPage({ params }: Props) {
  const { username, courseSlug, lessonSlug } = await params;
  const db = getDb();
  const courseId = await resolveCourseId(db, username, courseSlug);
  if (!courseId) notFound();
  const lessonId = await resolveLessonId(db, courseId, lessonSlug);
  if (!lessonId) notFound();
  return <LessonPlayerView courseId={courseId} lessonId={lessonId} />;
}
