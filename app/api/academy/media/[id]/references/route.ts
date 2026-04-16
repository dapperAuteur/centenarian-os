// app/api/academy/media/[id]/references/route.ts
//
// List the lessons that reference this media asset's URL. Used by the
// library detail panel to show "3 lessons" with a clickable list, and
// by the delete flow to tell the teacher which lessons to unwire first.

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { MediaAssetReference } from '@/lib/academy/media-types';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  const { data: asset } = await db
    .from('media_assets')
    .select('id, owner_id, secure_url')
    .eq('id', id)
    .maybeSingle();
  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (asset.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Find lessons referencing the asset's secure_url via content_url or
  // video_360_poster_url. Two queries + merge so we can tag each row
  // with the field that matched.
  const [contentRes, posterRes] = await Promise.all([
    db
      .from('lessons')
      .select('id, title, course_id, courses(title)')
      .eq('content_url', asset.secure_url),
    db
      .from('lessons')
      .select('id, title, course_id, courses(title)')
      .eq('video_360_poster_url', asset.secure_url),
  ]);

  const rows = [
    ...(contentRes.data ?? []).map((l) => ({ ...l, field: 'content_url' as const })),
    ...(posterRes.data ?? []).map((l) => ({ ...l, field: 'video_360_poster_url' as const })),
  ];

  const references: MediaAssetReference[] = rows.map((r) => ({
    lesson_id: r.id,
    lesson_title: r.title,
    course_id: r.course_id,
    // Supabase returns the joined table as an array even when the FK is
    // one-to-one, so grab the first element.
    course_title: (Array.isArray(r.courses) ? r.courses[0]?.title : (r.courses as { title?: string } | null)?.title) ?? '',
    field: r.field,
  }));

  return NextResponse.json({ references });
}
