import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DEFAULT_LIFE_CATEGORIES = [
  { name: 'Health',    icon: 'heart-pulse',    color: '#ef4444', sort_order: 0 },
  { name: 'Finance',   icon: 'dollar-sign',    color: '#22c55e', sort_order: 1 },
  { name: 'Career',    icon: 'briefcase',      color: '#3b82f6', sort_order: 2 },
  { name: 'Home',      icon: 'home',           color: '#f59e0b', sort_order: 3 },
  { name: 'Fitness',   icon: 'dumbbell',       color: '#ec4899', sort_order: 4 },
  { name: 'Travel',    icon: 'map-pin',        color: '#06b6d4', sort_order: 5 },
  { name: 'Learning',  icon: 'graduation-cap', color: '#8b5cf6', sort_order: 6 },
  { name: 'Social',    icon: 'users',          color: '#f97316', sort_order: 7 },
];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: existing, error } = await supabase
    .from('life_categories')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let data = existing;

  // Seed defaults on first access
  if (!data || data.length === 0) {
    const rows = DEFAULT_LIFE_CATEGORIES.map((c) => ({ user_id: user.id, ...c }));
    const { data: seeded, error: seedErr } = await supabase
      .from('life_categories')
      .insert(rows)
      .select();
    if (seedErr) return NextResponse.json({ error: seedErr.message }, { status: 500 });
    data = seeded;
  }

  return NextResponse.json({ categories: data });
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

  const { data: existing } = await supabase
    .from('life_categories')
    .select('sort_order')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextOrder = existing?.[0] ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from('life_categories')
    .insert({
      user_id: user.id,
      name: name.trim(),
      icon: icon || 'tag',
      color: color || '#6b7280',
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
