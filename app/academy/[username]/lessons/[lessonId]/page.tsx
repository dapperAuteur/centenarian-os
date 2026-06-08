// app/academy/[username]/lessons/[lessonId]/page.tsx
// Legacy lesson URL handler: /academy/{course-uuid}/lessons/{lesson-uuid}.
// 308-redirects to the canonical pretty lesson URL when one can be built;
// otherwise renders the lesson player in place (pre-backfill fallback).

import { permanentRedirect } from 'next/navigation';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getPrettyLessonPath } from '@/lib/academy/resolve-server';
import LessonPlayerView from '@/components/academy/LessonPlayerView';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Props = { params: Promise<{ username: string; lessonId: string }> };

export default async function LegacyLessonPage({ params }: Props) {
  // In the legacy URL the first segment is the course UUID.
  const { username: courseId, lessonId } = await params;
  const pretty = await getPrettyLessonPath(getDb(), courseId, lessonId);
  if (pretty) permanentRedirect(pretty);
  return <LessonPlayerView courseId={courseId} lessonId={lessonId} />;
}
