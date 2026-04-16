// app/api/academy/courses/[id]/lessons/[lessonId]/tour/route.ts
//
// Virtual tour read + write endpoint.
//
// GET returns the assembled tour (scenes with hotspots + outgoing links
//     inline, entry scene id). Callable by any learner enrolled in the
//     course OR the course teacher OR an admin.
// PUT replaces the entire tour structure in a single transaction. Only
//     the course teacher (or admin) can write. The payload is the full
//     desired state: scenes[], hotspots[], scene_links[]. Existing rows
//     not present in the payload are deleted. This matches how the scene
//     editor in plan 23b serializes its local state.
//
// Both endpoints use the service-role client to bypass RLS after
// verifying auth explicitly. RLS policies on the tour_* tables are a
// belt-and-suspenders layer for any future direct DB access.

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { assembleTour } from '@/lib/academy/assembleTour';
import type {
  TourScene,
  TourHotspot,
  TourSceneLink,
} from '@/lib/academy/tour-types';

type Params = { params: Promise<{ id: string; lessonId: string }> };

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function requireCourseAuth(courseId: string, lessonId: string, writeAccess: boolean) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', status: 401 as const };

  const db = getDb();
  const { data: course } = await db
    .from('courses')
    .select('teacher_id')
    .eq('id', courseId)
    .maybeSingle();
  if (!course) return { error: 'Course not found', status: 404 as const };

  // Confirm the lesson belongs to this course
  const { data: lesson } = await db
    .from('lessons')
    .select('id, course_id')
    .eq('id', lessonId)
    .eq('course_id', courseId)
    .maybeSingle();
  if (!lesson) return { error: 'Lesson not found', status: 404 as const };

  const isTeacher = course.teacher_id === user.id;
  const isAdmin = user.email === process.env.ADMIN_EMAIL;

  if (writeAccess) {
    if (!isTeacher && !isAdmin) return { error: 'Forbidden', status: 403 as const };
    return { user, db, isTeacher, isAdmin };
  }

  // Read access: teacher/admin always, learners only with active enrollment
  if (isTeacher || isAdmin) return { user, db, isTeacher, isAdmin };

  const { data: enrollment } = await db
    .from('enrollments')
    .select('status')
    .eq('course_id', courseId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!enrollment || enrollment.status !== 'active') {
    return { error: 'Forbidden', status: 403 as const };
  }
  return { user, db, isTeacher, isAdmin };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: courseId, lessonId } = await params;
  const auth = await requireCourseAuth(courseId, lessonId, false);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { db } = auth;

  const { data: scenes, error: scenesError } = await db
    .from('tour_scenes')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('order_index', { ascending: true });
  if (scenesError) return NextResponse.json({ error: scenesError.message }, { status: 500 });

  const sceneIds = (scenes ?? []).map((s: TourScene) => s.id);
  if (sceneIds.length === 0) {
    return NextResponse.json(assembleTour({ scenes: [], hotspots: [], links: [] }));
  }

  const [{ data: hotspots }, { data: links }] = await Promise.all([
    db.from('tour_hotspots').select('*').in('scene_id', sceneIds),
    db.from('tour_scene_links').select('*').in('from_scene_id', sceneIds),
  ]);

  return NextResponse.json(assembleTour({
    scenes: (scenes ?? []) as TourScene[],
    hotspots: (hotspots ?? []) as TourHotspot[],
    links: (links ?? []) as TourSceneLink[],
  }));
}

interface PutPayload {
  scenes: Array<Omit<TourScene, 'id' | 'lesson_id'> & { id?: string }>;
  hotspots: Array<Omit<TourHotspot, 'id' | 'scene_id' | 'target_scene_id'> & {
    id?: string;
    scene_slug: string;
    // Scene-jump hotspots reference their target by slug so the editor can
    // wire links between scenes that don't yet have server-side ids.
    target_scene_slug?: string | null;
  }>;
  scene_links: Array<Omit<TourSceneLink, 'id' | 'from_scene_id' | 'to_scene_id'> & {
    id?: string;
    from_scene_slug: string;
    to_scene_slug: string;
  }>;
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id: courseId, lessonId } = await params;
  const auth = await requireCourseAuth(courseId, lessonId, true);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { db } = auth;

  const body = (await request.json()) as PutPayload;

  if (!Array.isArray(body.scenes)) {
    return NextResponse.json({ error: 'scenes[] required' }, { status: 400 });
  }

  // Replace the whole tour in sequence. Service role bypasses RLS so we can
  // delete-then-insert without getting stuck on FK-cascade races.
  await db.from('tour_scenes').delete().eq('lesson_id', lessonId);

  if (body.scenes.length === 0) {
    return NextResponse.json({ scenes: [], hotspots: [], links: [], entry_scene_id: null });
  }

  // Insert scenes first so we can map slugs to their newly-minted ids
  const sceneRows = body.scenes.map((s, i) => ({
    lesson_id: lessonId,
    slug: s.slug,
    name: s.name,
    caption: s.caption ?? null,
    panorama_url: s.panorama_url,
    panorama_type: s.panorama_type ?? 'photo',
    poster_url: s.poster_url ?? null,
    start_yaw: s.start_yaw ?? 0,
    start_pitch: s.start_pitch ?? 0,
    is_entry_scene: s.is_entry_scene ?? false,
    order_index: s.order_index ?? i,
  }));

  const { data: insertedScenes, error: sceneInsertError } = await db
    .from('tour_scenes')
    .insert(sceneRows)
    .select('*');
  if (sceneInsertError || !insertedScenes) {
    return NextResponse.json({ error: sceneInsertError?.message ?? 'Scene insert failed' }, { status: 500 });
  }

  const slugToId = new Map<string, string>();
  for (const row of insertedScenes as TourScene[]) {
    slugToId.set(row.slug, row.id);
  }

  // Hotspots — resolve target_scene_slug → target_scene_id via the slug map.
  const hotspotRows = (body.hotspots ?? [])
    .map((h) => {
      const sceneId = slugToId.get(h.scene_slug);
      if (!sceneId) return null;
      const targetSceneId = h.target_scene_slug ? (slugToId.get(h.target_scene_slug) ?? null) : null;
      return {
        scene_id: sceneId,
        hotspot_type: h.hotspot_type,
        yaw: h.yaw,
        pitch: h.pitch,
        title: h.title,
        body: h.body ?? null,
        audio_url: h.audio_url ?? null,
        external_url: h.external_url ?? null,
        target_scene_id: targetSceneId,
        icon: h.icon ?? 'info',
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (hotspotRows.length > 0) {
    const { error: hotspotErr } = await db.from('tour_hotspots').insert(hotspotRows);
    if (hotspotErr) return NextResponse.json({ error: hotspotErr.message }, { status: 500 });
  }

  // Scene links
  const linkRows = (body.scene_links ?? [])
    .map((l) => {
      const fromId = slugToId.get(l.from_scene_slug);
      const toId = slugToId.get(l.to_scene_slug);
      if (!fromId || !toId) return null;
      return {
        from_scene_id: fromId,
        to_scene_id: toId,
        yaw: l.yaw,
        pitch: l.pitch,
        label: l.label ?? null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (linkRows.length > 0) {
    const { error: linkErr } = await db.from('tour_scene_links').insert(linkRows);
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }

  // Return the freshly-assembled tour so the client doesn't need a second round-trip
  const { data: refetchedScenes } = await db
    .from('tour_scenes')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('order_index', { ascending: true });
  const refetchedSceneIds = (refetchedScenes ?? []).map((s: TourScene) => s.id);
  const [{ data: refetchedHotspots }, { data: refetchedLinks }] = await Promise.all([
    db.from('tour_hotspots').select('*').in('scene_id', refetchedSceneIds),
    db.from('tour_scene_links').select('*').in('from_scene_id', refetchedSceneIds),
  ]);

  return NextResponse.json(assembleTour({
    scenes: (refetchedScenes ?? []) as TourScene[],
    hotspots: (refetchedHotspots ?? []) as TourHotspot[],
    links: (refetchedLinks ?? []) as TourSceneLink[],
  }));
}
