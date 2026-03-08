// app/api/admin/union-submissions/route.ts
// GET: list all union RAG submissions (admin only)

import { NextResponse } from 'next/server';
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
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('union_rag_submissions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get submitter emails/usernames
  const userIds = [...new Set((data ?? []).map((s) => s.user_id))];
  const userMap: Record<string, { email: string; username: string }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, username, email')
      .in('id', userIds);
    for (const p of profiles ?? []) {
      userMap[p.id] = { email: p.email ?? '', username: p.username ?? 'Unknown' };
    }
  }

  return NextResponse.json({
    submissions: (data ?? []).map((s) => ({
      ...s,
      submitter: userMap[s.user_id] ?? { email: '', username: 'Unknown' },
    })),
  });
}
