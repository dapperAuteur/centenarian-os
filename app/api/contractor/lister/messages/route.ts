// app/api/contractor/lister/messages/route.ts
// GET: list sent/received messages
// POST: send individual or group message

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
  const folder = searchParams.get('folder') ?? 'inbox'; // 'inbox' or 'sent'

  const db = getDb();

  let query = db
    .from('lister_messages')
    .select('*')
    .order('created_at', { ascending: false });

  if (folder === 'sent') {
    query = query.eq('sender_id', user.id);
  } else {
    // Inbox: direct messages to me + group messages where I'm a member
    // We'll do two queries and merge
    const { data: directMessages } = await query
      .eq('recipient_id', user.id);

    // Get groups I'm a member of
    const { data: myGroups } = await db
      .from('lister_message_group_members')
      .select('group_id')
      .eq('user_id', user.id);

    const groupIds = (myGroups ?? []).map((g) => g.group_id);
    let groupMessages: typeof directMessages = [];
    if (groupIds.length > 0) {
      const { data } = await db
        .from('lister_messages')
        .select('*')
        .in('group_id', groupIds)
        .neq('sender_id', user.id)
        .order('created_at', { ascending: false });
      groupMessages = data ?? [];
    }

    const all = [...(directMessages ?? []), ...(groupMessages ?? [])]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Enrich with sender usernames and group names
    const senderIds = [...new Set(all.map((m) => m.sender_id))];
    const msgGroupIds = [...new Set(all.map((m) => m.group_id).filter(Boolean))];

    const usernameMap: Record<string, string> = {};
    if (senderIds.length > 0) {
      const { data: profiles } = await db.from('profiles').select('id, username').in('id', senderIds);
      for (const p of profiles ?? []) usernameMap[p.id] = p.username ?? 'Anonymous';
    }

    const groupMap: Record<string, string> = {};
    if (msgGroupIds.length > 0) {
      const { data: groups } = await db.from('lister_message_groups').select('id, name').in('id', msgGroupIds);
      for (const g of groups ?? []) groupMap[g.id] = g.name;
    }

    const enriched = all.map((m) => ({
      ...m,
      sender_username: usernameMap[m.sender_id] ?? 'Unknown',
      group_name: m.group_id ? (groupMap[m.group_id] ?? null) : null,
    }));

    return NextResponse.json({ messages: enriched });
  }

  // Sent folder
  const { data: sentMessages, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const recipientIds = [...new Set((sentMessages ?? []).map((m) => m.recipient_id).filter(Boolean))];
  const sentGroupIds = [...new Set((sentMessages ?? []).map((m) => m.group_id).filter(Boolean))];

  const usernameMap: Record<string, string> = {};
  if (recipientIds.length > 0) {
    const { data: profiles } = await db.from('profiles').select('id, username').in('id', recipientIds);
    for (const p of profiles ?? []) usernameMap[p.id] = p.username ?? 'Anonymous';
  }

  const groupMap: Record<string, string> = {};
  if (sentGroupIds.length > 0) {
    const { data: groups } = await db.from('lister_message_groups').select('id, name').in('id', sentGroupIds);
    for (const g of groups ?? []) groupMap[g.id] = g.name;
  }

  const enriched = (sentMessages ?? []).map((m) => ({
    ...m,
    recipient_username: m.recipient_id ? (usernameMap[m.recipient_id] ?? 'Unknown') : null,
    group_name: m.group_id ? (groupMap[m.group_id] ?? null) : null,
  }));

  return NextResponse.json({ messages: enriched });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Verify sender is lister/union_leader
  const { data: profile } = await db
    .from('profiles')
    .select('contractor_role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !['lister', 'union_leader'].includes(profile.contractor_role)) {
    return NextResponse.json({ error: 'Lister role required' }, { status: 403 });
  }

  const body = await request.json();
  const { recipient_id, group_id, subject, body: msgBody } = body;

  if (!msgBody?.trim()) {
    return NextResponse.json({ error: 'Message body required' }, { status: 400 });
  }

  if (!recipient_id && !group_id) {
    return NextResponse.json({ error: 'recipient_id or group_id required' }, { status: 400 });
  }

  if (recipient_id && group_id) {
    return NextResponse.json({ error: 'Provide either recipient_id or group_id, not both' }, { status: 400 });
  }

  // If group message, verify group ownership
  if (group_id) {
    const { data: group } = await db
      .from('lister_message_groups')
      .select('id')
      .eq('id', group_id)
      .eq('lister_id', user.id)
      .maybeSingle();

    if (!group) {
      return NextResponse.json({ error: 'Group not found or not yours' }, { status: 404 });
    }
  }

  const { data, error } = await db
    .from('lister_messages')
    .insert({
      sender_id: user.id,
      recipient_id: recipient_id || null,
      group_id: group_id || null,
      subject: subject?.trim() || null,
      body: msgBody.trim(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
