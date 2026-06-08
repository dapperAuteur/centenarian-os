// app/academy/[username]/[courseSlug]/layout.tsx
// Share/OG metadata for the human-readable course page. The view itself is a
// client component, so metadata lives here. The OG image route renders the
// course cover image (with a branded-card fallback).

import type { Metadata } from 'next';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { resolveCourseId } from '@/lib/academy/resolve-server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `https://${process.env.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, '')}`
  : 'https://centenarianos.com';

export async function generateMetadata(
  { params }: { params: Promise<{ username: string; courseSlug: string }> },
): Promise<Metadata> {
  const { username, courseSlug } = await params;
  const db = getDb();
  const courseId = await resolveCourseId(db, username, courseSlug);
  if (!courseId) return { title: 'Course · CentenarianOS Academy' };

  const { data: course } = await db
    .from('courses')
    .select('title, description, teacher_id')
    .eq('id', courseId)
    .maybeSingle();
  if (!course) return { title: 'Course · CentenarianOS Academy' };

  let teacherName = 'CentenarianOS';
  if (course.teacher_id) {
    const { data: profile } = await db
      .from('profiles')
      .select('display_name, username')
      .eq('id', course.teacher_id)
      .maybeSingle();
    teacherName = profile?.display_name || profile?.username || teacherName;
  }

  const title = course.title || 'Academy Course';
  const description = course.description || `A course by ${teacherName} on CentenarianOS Academy.`;
  const ogImage = `${SITE_URL}/api/og/course/${courseId}`;
  const canonical = `${SITE_URL}/academy/${username}/${courseSlug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      url: canonical,
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title, images: [ogImage] },
    alternates: { canonical },
  };
}

export default function CourseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
