// app/api/contractor/lister/groups/[id]/members/route.ts
// POST: add member to group
// DELETE: remove member from group

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

export async function POST(request: NextRequest, ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const db = getDb();

  // Verify group ownership
  const { data: group } = await db
    .from('lister_message_groups')
    .select('id')
    .eq('id', id)
    .eq('lister_id', user.id)
    .maybeSingle();

  if (!group) return NextResponse.json({ error: 'Group not found or not yours' }, { status: 404 });

  const { user_id } = await request.json();
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  // Verify the user exists
  const { data: targetProfile } = await db
    .from('profiles')
    .select('id')
    .eq('id', user_id)
    .maybeSingle();

  if (!targetProfile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { data, error } = await db
    .from('lister_message_group_members')
    .insert({ group_id: id, user_id })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'User already in group' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const db = getDb();

  // Verify group ownership
  const { data: group } = await db
    .from('lister_message_groups')
    .select('id')
    .eq('id', id)
    .eq('lister_id', user.id)
    .maybeSingle();

  if (!group) return NextResponse.json({ error: 'Group not found or not yours' }, { status: 404 });

  const { user_id } = await request.json();
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  const { error } = await db
    .from('lister_message_group_members')
    .delete()
    .eq('group_id', id)
    .eq('user_id', user_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ removed: true });
}
