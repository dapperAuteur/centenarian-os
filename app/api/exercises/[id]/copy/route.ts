import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  // Fetch the public exercise (service role to bypass RLS)
  const { data: original, error: fetchErr } = await db
    .from('exercises')
    .select('*, exercise_equipment(equipment_id)')
    .eq('id', id)
    .eq('visibility', 'public')
    .eq('is_active', true)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!original) return NextResponse.json({ error: 'Not found or not public' }, { status: 404 });

  // Check if user already has an exercise with this name
  const { data: existingCopy } = await db
    .from('exercises')
    .select('id')
    .eq('user_id', user.id)
    .ilike('name', original.name)
    .maybeSingle();

  const copyName = existingCopy ? `${original.name} (Copy)` : original.name;

  // Create copy in user's library
  const { data: copy, error: insertErr } = await db
    .from('exercises')
    .insert({
      user_id: user.id,
      name: copyName,
      category_id: original.category_id,
      difficulty: original.difficulty ?? null,
      instructions: original.instructions,
      form_cues: original.form_cues,
      video_url: original.video_url,
      media_url: original.media_url,
      media_public_id: null,
      audio_url: original.audio_url,
      audio_public_id: null,
      primary_muscles: original.primary_muscles,
      default_sets: original.default_sets,
      default_reps: original.default_reps,
      default_weight_lbs: original.default_weight_lbs,
      default_duration_sec: original.default_duration_sec,
      default_rest_sec: original.default_rest_sec,
      notes: original.notes,
      use_count: 0,
      visibility: 'private',
      is_bodyweight_default: original.is_bodyweight_default ?? false,
      is_timed_default: original.is_timed_default ?? false,
      per_side_default: original.per_side_default ?? false,
    })
    .select()
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Copy equipment junction
  const eqRows = original.exercise_equipment || [];
  if (eqRows.length > 0) {
    const junctionRows = eqRows.map((eq: { equipment_id: string }) => ({
      exercise_id: copy.id,
      equipment_id: eq.equipment_id,
    }));
    await db.from('exercise_equipment').insert(junctionRows);
  }

  // Increment copy_count on original
  await db
    .from('exercises')
    .update({ copy_count: (original.copy_count ?? 0) + 1 })
    .eq('id', id);

  return NextResponse.json({ exercise: copy }, { status: 201 });
}
