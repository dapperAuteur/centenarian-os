// app/api/contractor/lister/groups/[id]/route.ts
// GET: group detail with members
// PATCH: update group
// DELETE: delete group

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const db = getDb();

  const { data: group } = await db
    .from('lister_message_groups')
    .select('*')
    .eq('id', id)
    .eq('lister_id', user.id)
    .maybeSingle();

  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Get members with usernames
  const { data: members } = await db
    .from('lister_message_group_members')
    .select('id, user_id, added_at')
    .eq('group_id', id)
    .order('added_at', { ascending: true });

  const memberUserIds = (members ?? []).map((m) => m.user_id);
  const usernameMap: Record<string, string> = {};
  if (memberUserIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, username')
      .in('id', memberUserIds);
    for (const p of profiles ?? []) usernameMap[p.id] = p.username ?? 'Anonymous';
  }

  const enrichedMembers = (members ?? []).map((m) => ({
    ...m,
    username: usernameMap[m.user_id] ?? 'Unknown',
  }));

  return NextResponse.json({ ...group, members: enrichedMembers });
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const db = getDb();

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await db
    .from('lister_message_groups')
    .update(updates)
    .eq('id', id)
    .eq('lister_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const db = getDb();

  const { error } = await db
    .from('lister_message_groups')
    .delete()
    .eq('id', id)
    .eq('lister_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
