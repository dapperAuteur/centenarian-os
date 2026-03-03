// app/api/admin/notifications/route.ts
// Admin-only: list notifications + mark all as read

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function getServiceDb() {
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
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// GET /api/admin/notifications?unread=true&type=new_exercise&limit=50
export async function GET(request: NextRequest) {
  const adminUser = await getAdminUser();
  if (!adminUser || adminUser.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const unreadOnly = sp.get('unread') === 'true';
  const type = sp.get('type');
  const limit = Math.min(parseInt(sp.get('limit') || '100', 10), 200);

  const db = getServiceDb();
  let query = db
    .from('admin_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unreadOnly) query = query.eq('is_read', false).eq('promoted', false);
  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return unread count too (for badge)
  const { count } = await db
    .from('admin_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)
    .eq('promoted', false);

  return NextResponse.json({ notifications: data || [], unread: count ?? 0 });
}

// PATCH /api/admin/notifications — mark all as read
export async function PATCH() {
  const adminUser = await getAdminUser();
  if (!adminUser || adminUser.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServiceDb();
  const { error } = await db
    .from('admin_notifications')
    .update({ is_read: true })
    .eq('is_read', false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
