// app/academy/[username]/page.tsx
// Legacy course URL handler: /academy/{course-uuid}.
// A single segment under /academy is only a course when it's a UUID — in that
// case 308-redirect to the canonical pretty URL. Anything else 404s (teacher
// pages live at /academy/teachers/{username}).
//
// Fallback: if the course exists but has no slug yet (pre-backfill), render the
// course view in place so the link still works.

import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getPrettyCoursePath, isUuid } from '@/lib/academy/resolve-server';
import { SITE_URL } from '@/lib/seo/page-metadata';
import CourseDetailView from '@/components/academy/CourseDetailView';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Props = { params: Promise<{ username: string }> };

// Per-course share metadata for the legacy UUID URL (e.g. the editor's "Preview as student"
// link and any old shared links). Social scrapers do not always follow the 308 redirect to
// the pretty URL, so emit the same per-course Open Graph here.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  if (!isUuid(username)) return {};
  const courseId = username;
  const db = getDb();
  const { data: course } = await db
    .from('courses')
    .select('title, description, is_published')
    .eq('id', courseId)
    .maybeSingle();
  if (!course) return {};
  const title = course.title || 'Academy Course';
  const description = course.description || 'A course on CentenarianOS Academy.';
  const ogImage = `${SITE_URL}/api/og/course/${courseId}`;
  const pretty = await getPrettyCoursePath(db, courseId);
  const canonical = `${SITE_URL}${pretty || `/academy/${courseId}`}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: ogImage, width: 1200, height: 630 }], url: canonical, type: 'website' },
    twitter: { card: 'summary_large_image', title, images: [ogImage] },
    alternates: { canonical },
  };
}

export default async function LegacyCoursePage({ params }: Props) {
  const { username } = await params;
  if (!isUuid(username)) notFound();

  const courseId = username;
  const pretty = await getPrettyCoursePath(getDb(), courseId);
  if (pretty) permanentRedirect(pretty);

  // No canonical path available yet (pre-backfill) — render in place.
  return <CourseDetailView courseId={courseId} />;
}
