// app/api/exercises/system/[id]/route.ts
// POST /copy: copies a system exercise into the user's personal exercise library

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

  // Fetch the system exercise
  const { data: sysEx, error: fetchError } = await supabase
    .from('system_exercises')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!sysEx) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Check if user already has this exercise (by exact name, case-insensitive)
  const { data: existing } = await supabase
    .from('exercises')
    .select('id, name')
    .eq('user_id', user.id)
    .ilike('name', sysEx.name)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ item: existing, already_exists: true });
  }

  // Resolve category_id from user's exercise_categories by matching name
  const { data: userCats } = await supabase
    .from('exercise_categories')
    .select('id, name')
    .eq('user_id', user.id);

  const catMatch = (userCats || []).find(
    (c) => c.name.toLowerCase() === sysEx.category.toLowerCase(),
  );
  let categoryId = catMatch?.id || null;

  // Create the category if it doesn't exist yet
  if (!categoryId && sysEx.category) {
    const { data: newCat } = await supabase
      .from('exercise_categories')
      .insert({ user_id: user.id, name: sysEx.category })
      .select('id')
      .single();
    categoryId = newCat?.id || null;
  }

  // Insert into user's exercise library
  const { data: created, error: insertError } = await supabase
    .from('exercises')
    .insert({
      user_id: user.id,
      name: sysEx.name,
      category_id: categoryId,
      instructions: sysEx.instructions || null,
      form_cues: sysEx.form_cues || null,
      primary_muscles: sysEx.primary_muscles || null,
      difficulty: sysEx.difficulty || null,
      equipment_needed: sysEx.equipment_needed || null,
      is_active: true,
      use_count: 0,
    })
    .select('*')
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ item: created, already_exists: false }, { status: 201 });
}
