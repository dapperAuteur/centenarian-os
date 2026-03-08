// app/api/contractor/lister/messages/[id]/route.ts
// GET: read a single message
// PATCH: mark as read
// DELETE: delete message

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

  const { data: message } = await db
    .from('lister_messages')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Verify access: sender, recipient, or group member
  const isSender = message.sender_id === user.id;
  const isRecipient = message.recipient_id === user.id;
  let isGroupMember = false;

  if (message.group_id) {
    const { data: membership } = await db
      .from('lister_message_group_members')
      .select('id')
      .eq('group_id', message.group_id)
      .eq('user_id', user.id)
      .maybeSingle();
    isGroupMember = !!membership;
  }

  if (!isSender && !isRecipient && !isGroupMember) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  // Enrich with sender username
  const { data: senderProfile } = await db
    .from('profiles')
    .select('username')
    .eq('id', message.sender_id)
    .maybeSingle();

  return NextResponse.json({
    ...message,
    sender_username: senderProfile?.username ?? 'Unknown',
  });
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const db = getDb();

  const { is_read } = await request.json();

  // Only recipient (or group member) can mark as read
  const { data: message } = await db
    .from('lister_messages')
    .select('recipient_id, group_id')
    .eq('id', id)
    .maybeSingle();

  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isRecipient = message.recipient_id === user.id;
  let isGroupMember = false;
  if (message.group_id) {
    const { data: membership } = await db
      .from('lister_message_group_members')
      .select('id')
      .eq('group_id', message.group_id)
      .eq('user_id', user.id)
      .maybeSingle();
    isGroupMember = !!membership;
  }

  if (!isRecipient && !isGroupMember) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { data, error } = await db
    .from('lister_messages')
    .update({ is_read: is_read ?? true })
    .eq('id', id)
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

  // Only sender can delete
  const { error } = await db
    .from('lister_messages')
    .delete()
    .eq('id', id)
    .eq('sender_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
