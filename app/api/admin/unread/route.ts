// app/api/admin/unread/route.ts
// Returns unread counts for admin sidebar badges:
// - feedback: user_feedback rows with is_read_by_admin = false
// - messages: message_replies from users (is_admin=false) not yet read

import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function getAdminUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => { try { cookieStore.set({ name, value, ...options }); } catch {} },
        remove: (name: string, options: CookieOptions) => { try { cookieStore.set({ name, value: '', ...options }); } catch {} },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const admin = await getAdminUser();
  if (!admin || admin.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ feedback: 0, messages: 0 });
  }

  const db = getDb();
  const [{ count: feedbackCount }, { count: messagesCount }] = await Promise.all([
    db.from('user_feedback').select('*', { count: 'exact', head: true }).eq('is_read_by_admin', false),
    db.from('message_replies').select('*', { count: 'exact', head: true }).eq('is_admin', false).eq('is_read_by_admin', false),
  ]);

  return NextResponse.json({
    feedback: feedbackCount ?? 0,
    messages: messagesCount ?? 0,
  });
}
