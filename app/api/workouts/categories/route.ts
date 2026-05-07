// app/api/workouts/categories/route.ts
// GET: list workout categories (user's own + global defaults)
// POST: create a user workout category

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('workout_categories')
    .select('*')
    .or(`user_id.eq.${user.id},is_global.eq.true`)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, icon, color } = body;
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  // Get next sort_order
  const { data: existing } = await supabase
    .from('workout_categories')
    .select('sort_order')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextOrder = existing?.[0] ? existing[0].sort_order + 1 : 100;

  const { data, error } = await supabase
    .from('workout_categories')
    .insert({
      user_id: user.id,
      name: name.trim(),
      icon: icon || null,
      color: color || null,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Category already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ category: data }, { status: 201 });
}
