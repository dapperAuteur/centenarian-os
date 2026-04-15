import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { id } = await params;

  // Try owner query first (if authenticated)
  if (user) {
    const { data, error } = await supabase
      .from('exercises')
      .select('*, exercise_categories(id, name, icon, color), exercise_equipment(id, equipment_id, equipment(id, name))')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      // Count activity links for owner
      const { count: linkCount } = await supabase
        .from('activity_links')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .or(
          `and(source_type.eq.exercise,source_id.eq.${id}),and(target_type.eq.exercise,target_id.eq.${id})`,
        );

      // Check if user liked this exercise
      const { data: likeRow } = await supabase
        .from('exercise_likes')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('exercise_id', id)
        .maybeSingle();

      return NextResponse.json({
        exercise: data,
        link_count: linkCount || 0,
        is_owner: true,
        liked: !!likeRow,
      });
    }

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Fall through: try public exercise (RLS allows SELECT on visibility='public')
  const { data: publicEx, error: pubErr } = await supabase
    .from('exercises')
    .select('*, exercise_categories(id, name, icon, color)')
    .eq('id', id)
    .eq('visibility', 'public')
    .eq('is_active', true)
    .maybeSingle();

  if (pubErr) return NextResponse.json({ error: pubErr.message }, { status: 500 });
  if (!publicEx) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Check like status if authenticated
  let liked = false;
  if (user) {
    const { data: likeRow } = await supabase
      .from('exercise_likes')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('exercise_id', id)
      .maybeSingle();
    liked = !!likeRow;
  }

  return NextResponse.json({
    exercise: publicEx,
    link_count: 0,
    is_owner: false,
    liked,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  if (body.retire) body.is_active = false;
  if (body.reactivate) body.is_active = true;

  const allowed = [
    'name', 'category_id', 'difficulty', 'instructions', 'form_cues', 'video_url',
    'media_url', 'media_public_id', 'audio_url', 'audio_public_id',
    'primary_muscles', 'default_sets', 'default_reps', 'default_weight_lbs',
    'default_duration_sec', 'default_rest_sec', 'notes', 'is_active',
    'equipment_needed', 'is_bodyweight_default', 'is_timed_default', 'per_side_default',
    'visibility',
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (updates.name && typeof updates.name === 'string') {
    updates.name = updates.name.trim();
  }

  if (Object.keys(updates).length === 0 && !body.equipment_ids) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  let data = null;
  if (Object.keys(updates).length > 0) {
    const result = await supabase
      .from('exercises')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*, exercise_categories(id, name, icon, color)')
      .single();
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    data = result.data;
  }

  // Replace equipment junction if provided
  if (Array.isArray(body.equipment_ids)) {
    await supabase.from('exercise_equipment').delete().eq('exercise_id', id);
    if (body.equipment_ids.length > 0) {
      const junctionRows = body.equipment_ids.map((eqId: string) => ({
        exercise_id: id,
        equipment_id: eqId,
      }));
      await supabase.from('exercise_equipment').insert(junctionRows);
    }
  }

  if (!data) {
    const result = await supabase
      .from('exercises')
      .select('*, exercise_categories(id, name, icon, color)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    data = result.data;
  }

  return NextResponse.json({ exercise: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Check if referenced in templates or logs
  const [{ count: templateRefCount }, { count: logRefCount }, { count: linkCount }] = await Promise.all([
    supabase
      .from('workout_template_exercises')
      .select('id', { count: 'exact', head: true })
      .eq('exercise_id', id),
    supabase
      .from('workout_log_exercises')
      .select('id', { count: 'exact', head: true })
      .eq('exercise_id', id),
    supabase
      .from('activity_links')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .or(
        `and(source_type.eq.exercise,source_id.eq.${id}),and(target_type.eq.exercise,target_id.eq.${id})`,
      ),
  ]);

  const hasLinkedData = (templateRefCount ?? 0) > 0 || (logRefCount ?? 0) > 0 || (linkCount ?? 0) > 0;

  if (hasLinkedData) {
    const { error } = await supabase
      .from('exercises')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, soft_deleted: true });
  }

  // Hard delete — clean up Cloudinary assets
  const { data: item } = await supabase
    .from('exercises')
    .select('media_public_id, audio_public_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  const publicIds = [item?.media_public_id, item?.audio_public_id].filter(Boolean) as string[];
  for (const pid of publicIds) {
    try {
      await deleteCloudinaryAsset(pid);
    } catch {
      // Non-fatal
    }
  }

  const { error } = await supabase
    .from('exercises')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, soft_deleted: false });
}

async function deleteCloudinaryAsset(publicId: string) {
  const { createHash } = await import('crypto');
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;
  const timestamp = Math.round(Date.now() / 1000);
  const paramString = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHash('sha1').update(paramString + apiSecret).digest('hex');
  const form = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: apiKey,
    signature,
  });
  await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
    { method: 'POST', body: form },
  );
}
