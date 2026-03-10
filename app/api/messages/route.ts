// app/api/messages/route.ts
// User's message inbox — returns messages addressed to them

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get user's subscription status for scope filtering
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single();

  const status = profile?.subscription_status ?? 'free';
  const countOnly = new URL(request.url).searchParams.get('count') === 'true';

  // Query messages visible to this user
  const { data: messages, error } = await supabase
    .from('admin_messages')
    .select(`
      id, subject, body, recipient_scope, created_at,
      message_reads!left(read_at)
    `)
    .or(
      `recipient_scope.eq.all,recipient_scope.eq.${status},and(recipient_scope.eq.user,recipient_user_id.eq.${user.id})`
    )
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter out broadcast messages sent before the user signed up.
  // Direct messages (scope='user') are always visible regardless of timing.
  const userCreatedAt = new Date(user.created_at);
  const visible = (messages ?? []).filter((m) => {
    if (m.recipient_scope === 'user') return true;
    return new Date(m.created_at) >= userCreatedAt;
  });

  const enriched = visible.map((m) => ({
    ...m,
    is_read: Array.isArray(m.message_reads) && m.message_reads.length > 0,
  }));

  if (countOnly) {
    const unread = enriched.filter((m) => !m.is_read).length;
    return NextResponse.json({ unread });
  }

  return NextResponse.json({ messages: enriched });
}
