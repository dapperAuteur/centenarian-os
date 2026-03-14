// app/api/media/platforms/route.ts
// GET: list saved platforms sorted by use_count DESC
// POST: upsert platform (increment use_count if exists)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('media_platforms')
    .select('id, name, use_count')
    .eq('user_id', user.id)
    .order('use_count', { ascending: false })
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const trimmed = name.trim();

  // Try to find existing
  const { data: existing } = await supabase
    .from('media_platforms')
    .select('id, name, use_count')
    .eq('user_id', user.id)
    .ilike('name', trimmed)
    .maybeSingle();

  if (existing) {
    // Increment use_count
    const { data, error } = await supabase
      .from('media_platforms')
      .update({ use_count: existing.use_count + 1 })
      .eq('id', existing.id)
      .select('id, name, use_count')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Create new
  const { data, error } = await supabase
    .from('media_platforms')
    .insert({ user_id: user.id, name: trimmed })
    .select('id, name, use_count')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
