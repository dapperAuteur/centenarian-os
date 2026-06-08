// app/academy/[username]/[courseSlug]/page.tsx
// Human-readable course detail: /academy/{teacher-username}/{course-slug}.
// Resolves the slug pair to a course id, then renders the shared client view.

import { notFound } from 'next/navigation';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { resolveCourseId } from '@/lib/academy/resolve-server';
import CourseDetailView from '@/components/academy/CourseDetailView';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Props = { params: Promise<{ username: string; courseSlug: string }> };

export default async function CoursePage({ params }: Props) {
  const { username, courseSlug } = await params;
  const courseId = await resolveCourseId(getDb(), username, courseSlug);
  if (!courseId) notFound();
  return <CourseDetailView courseId={courseId} />;
}
