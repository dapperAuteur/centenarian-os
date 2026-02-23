// app/api/academy/messages/route.ts
// GET: unified inbox — all DM conversations for current user across courses.
// Returns conversations grouped by course+partner with latest message and unread count.

import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

interface Conversation {
  course_id: string;
  course_title: string;
  partner_id: string;
  partner_name: string;
  partner_avatar: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Fetch all messages where user is sender or recipient
  const { data: messages, error } = await db
    .from('course_messages')
    .select('id, course_id, sender_id, recipient_id, body, is_read, created_at')
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!messages?.length) return NextResponse.json([]);

  // Group by course_id + partner_id
  const conversationMap = new Map<string, {
    course_id: string;
    partner_id: string;
    last_message: string;
    last_message_at: string;
    unread_count: number;
  }>();

  for (const msg of messages) {
    const partnerId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
    const key = `${msg.course_id}:${partnerId}`;

    if (!conversationMap.has(key)) {
      conversationMap.set(key, {
        course_id: msg.course_id,
        partner_id: partnerId,
        last_message: msg.body,
        last_message_at: msg.created_at,
        unread_count: 0,
      });
    }

    // Count unreads (messages sent TO me that are unread)
    if (msg.recipient_id === user.id && !msg.is_read) {
      const conv = conversationMap.get(key)!;
      conv.unread_count++;
    }
  }

  const conversations = Array.from(conversationMap.values());

  // Fetch course titles and partner profiles
  const courseIds = [...new Set(conversations.map((c) => c.course_id))];
  const partnerIds = [...new Set(conversations.map((c) => c.partner_id))];

  const [{ data: courses }, { data: profiles }] = await Promise.all([
    db.from('courses').select('id, title').in('id', courseIds),
    db.from('profiles').select('id, username, display_name, avatar_url').in('id', partnerIds),
  ]);

  const courseMap = new Map((courses ?? []).map((c) => [c.id, c.title]));
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const result: Conversation[] = conversations
    .map((conv) => {
      const partner = profileMap.get(conv.partner_id);
      return {
        course_id: conv.course_id,
        course_title: courseMap.get(conv.course_id) ?? 'Unknown Course',
        partner_id: conv.partner_id,
        partner_name: partner?.display_name ?? partner?.username ?? 'User',
        partner_avatar: partner?.avatar_url ?? null,
        last_message: conv.last_message,
        last_message_at: conv.last_message_at,
        unread_count: conv.unread_count,
      };
    })
    .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

  return NextResponse.json(result);
}
