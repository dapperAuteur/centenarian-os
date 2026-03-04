import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getServiceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const includeRetired = sp.get('include_retired') === 'true';
  const categoryId = sp.get('category_id');
  const search = sp.get('search');
  const sort = sp.get('sort') || 'name';
  const dir = sp.get('dir') || 'asc';

  let query = supabase
    .from('exercises')
    .select('*, exercise_categories(id, name, icon, color), exercise_equipment(id, equipment_id, equipment(id, name))')
    .eq('user_id', user.id);

  if (!includeRetired) query = query.eq('is_active', true);
  if (categoryId) query = query.eq('category_id', categoryId);
  if (search) query = query.ilike('name', `%${search}%`);

  const validSorts = ['name', 'use_count', 'created_at', 'updated_at'];
  const sortCol = validSorts.includes(sort) ? sort : 'name';
  query = query.order(sortCol, { ascending: dir !== 'desc' });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ exercises: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, category_id, instructions, form_cues, video_url,
    media_url, media_public_id, audio_url, audio_public_id,
    primary_muscles, default_sets, default_reps, default_weight_lbs,
    default_duration_sec, default_rest_sec, notes, equipment_ids,
    equipment_needed, is_bodyweight_default, is_timed_default, per_side_default } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('exercises')
    .insert({
      user_id: user.id,
      name: name.trim(),
      category_id: category_id || null,
      instructions: instructions || null,
      form_cues: form_cues || null,
      video_url: video_url || null,
      media_url: media_url || null,
      media_public_id: media_public_id || null,
      audio_url: audio_url || null,
      audio_public_id: audio_public_id || null,
      primary_muscles: primary_muscles || null,
      default_sets: default_sets ?? null,
      default_reps: default_reps ?? null,
      default_weight_lbs: default_weight_lbs ?? null,
      default_duration_sec: default_duration_sec ?? null,
      default_rest_sec: default_rest_sec ?? 60,
      notes: notes || null,
      equipment_needed: equipment_needed || null,
      is_bodyweight_default: is_bodyweight_default ?? false,
      is_timed_default: is_timed_default ?? false,
      per_side_default: per_side_default ?? false,
    })
    .select('*, exercise_categories(id, name, icon, color)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Admin: auto-promote to system_exercises. Others: notify admin.
  try {
    const serviceDb = getServiceDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const catName: string | null = (data as any).exercise_categories?.name ?? null;

    if (user.email === process.env.ADMIN_EMAIL) {
      // Don't duplicate if system already has this exercise by name
      const { data: existing } = await serviceDb
        .from('system_exercises')
        .select('id')
        .ilike('name', data.name)
        .maybeSingle();
      if (!existing) {
        await serviceDb.from('system_exercises').insert({
          name: data.name,
          category: catName || 'Other',
          instructions: data.instructions || null,
          form_cues: data.form_cues || null,
          primary_muscles: data.primary_muscles || null,
          difficulty: 'intermediate',
          equipment_needed: data.equipment_needed || 'none',
          is_active: true,
        });
      }
    } else {
      await serviceDb.from('admin_notifications').insert({
        type: 'new_exercise',
        user_id: user.id,
        user_email: user.email,
        entity_name: data.name,
        entity_id: data.id,
        entity_meta: {
          category: catName,
          primary_muscles: data.primary_muscles || null,
          equipment_needed: data.equipment_needed || null,
        },
      });
    }
  } catch {
    // Non-fatal — don't block the response
  }

  // Insert equipment junction rows
  if (Array.isArray(equipment_ids) && equipment_ids.length > 0) {
    const junctionRows = equipment_ids.map((eqId: string) => ({
      exercise_id: data.id,
      equipment_id: eqId,
    }));
    await supabase.from('exercise_equipment').insert(junctionRows);
  }

  return NextResponse.json({ exercise: data }, { status: 201 });
}
