import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DEFAULT_CATEGORIES = [
  { name: 'Push', sort_order: 0 },
  { name: 'Pull', sort_order: 1 },
  { name: 'Legs', sort_order: 2 },
  { name: 'Core', sort_order: 3 },
  { name: 'Cardio', sort_order: 4 },
  { name: 'Flexibility', sort_order: 5 },
  { name: 'Olympic', sort_order: 6 },
  { name: 'Plyometric', sort_order: 7 },
  { name: 'Balance', sort_order: 8 },
  { name: 'Other', sort_order: 9 },
];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: existing, error } = await supabase
    .from('exercise_categories')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let data = existing;

  if (!data || data.length === 0) {
    const rows = DEFAULT_CATEGORIES.map((c) => ({ user_id: user.id, ...c }));
    const { data: seeded, error: seedErr } = await supabase
      .from('exercise_categories')
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
    .from('exercise_categories')
    .select('sort_order')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextOrder = existing?.[0] ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from('exercise_categories')
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
