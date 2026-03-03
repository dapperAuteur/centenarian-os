import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: original, error: fetchErr } = await supabase
    .from('exercises')
    .select('*, exercise_equipment(equipment_id)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: copy, error: insertErr } = await supabase
    .from('exercises')
    .insert({
      user_id: user.id,
      name: `${original.name} (Copy)`,
      category_id: original.category_id,
      instructions: original.instructions,
      form_cues: original.form_cues,
      video_url: original.video_url,
      media_url: original.media_url,
      media_public_id: null, // Don't share Cloudinary reference
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
    await supabase.from('exercise_equipment').insert(junctionRows);
  }

  return NextResponse.json({ exercise: copy }, { status: 201 });
}
