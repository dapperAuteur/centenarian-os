// app/api/contractor/lister/groups/route.ts
// GET: list message groups (owned by lister)
// POST: create a new group

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  const { data: groups, error } = await db
    .from('lister_message_groups')
    .select('*')
    .eq('lister_id', user.id)
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get member counts for each group
  const groupIds = (groups ?? []).map((g) => g.id);
  const memberCounts: Record<string, number> = {};

  if (groupIds.length > 0) {
    for (const gid of groupIds) {
      const { count } = await db
        .from('lister_message_group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', gid);
      memberCounts[gid] = count ?? 0;
    }
  }

  const enriched = (groups ?? []).map((g) => ({
    ...g,
    member_count: memberCounts[g.id] ?? 0,
  }));

  return NextResponse.json({ groups: enriched });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Verify lister role
  const { data: profile } = await db
    .from('profiles')
    .select('contractor_role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !['lister', 'union_leader'].includes(profile.contractor_role)) {
    return NextResponse.json({ error: 'Lister role required' }, { status: 403 });
  }

  const body = await request.json();
  const { name, description } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Group name required' }, { status: 400 });
  }

  const { data, error } = await db
    .from('lister_message_groups')
    .insert({
      lister_id: user.id,
      name: name.trim(),
      description: description?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
