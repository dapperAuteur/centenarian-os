// app/api/contractor/cities/route.ts
// GET: list user's city guides (+ shared)
// POST: create a new city guide

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const includeShared = searchParams.get('shared') === 'true';

  const db = getDb();

  // Own guides
  const { data: own, error: ownErr } = await db
    .from('city_guides')
    .select('*, city_guide_entries(count)')
    .eq('user_id', user.id)
    .order('city_name', { ascending: true });

  if (ownErr) return NextResponse.json({ error: ownErr.message }, { status: 500 });

  let shared: typeof own = [];
  if (includeShared) {
    const { data: s } = await db
      .from('city_guides')
      .select('*, city_guide_entries(count)')
      .eq('is_shared', true)
      .neq('user_id', user.id)
      .order('city_name', { ascending: true });
    shared = s ?? [];
  }

  // Get usernames for shared guides
  const sharedUserIds = [...new Set(shared.map((g) => g.user_id))];
  const usernameMap: Record<string, string> = {};
  if (sharedUserIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, username')
      .in('id', sharedUserIds);
    for (const p of profiles ?? []) {
      usernameMap[p.id] = p.username ?? 'Anonymous';
    }
  }

  const format = (g: Record<string, unknown>) => ({
    ...g,
    entry_count: Array.isArray(g.city_guide_entries)
      ? (g.city_guide_entries[0] as { count: number })?.count ?? 0
      : 0,
    city_guide_entries: undefined,
    author: usernameMap[g.user_id as string] ?? null,
  });

  return NextResponse.json({
    guides: (own ?? []).map(format),
    shared: shared.map(format),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { city_name, state, region, is_shared, notes } = body;

  if (!city_name?.trim()) {
    return NextResponse.json({ error: 'city_name is required' }, { status: 400 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('city_guides')
    .insert({
      user_id: user.id,
      city_name: city_name.trim(),
      state: state?.trim() || null,
      region: region?.trim() || null,
      is_shared: is_shared ?? false,
      notes: notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Guide for this city already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
