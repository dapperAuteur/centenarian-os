// app/api/admin/content/route.ts
// Admin: list all public content and unpublish it

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function getServiceClient() {
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

async function attachUsernames(
  db: ReturnType<typeof getServiceClient>,
  items: Array<{ user_id: string; [key: string]: unknown }>,
) {
  const userIds = [...new Set(items.map((i) => i.user_id).filter(Boolean))];
  if (userIds.length === 0) return items.map((i) => ({ ...i, profiles: null }));

  const { data: profiles } = await db
    .from('profiles')
    .select('id, username')
    .in('id', userIds);

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  return items.map((i) => ({ ...i, profiles: profileMap[i.user_id] ?? null }));
}

export async function GET(request: NextRequest) {
  const adminUser = await getAdminUser();
  if (!adminUser || adminUser.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const type = new URL(request.url).searchParams.get('type') ?? 'recipe';
  const db = getServiceClient();

  if (type === 'blog') {
    const { data, error } = await db
      .from('blog_posts')
      .select('id, title, slug, visibility, view_count, published_at, user_id')
      .order('published_at', { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const items = await attachUsernames(db, data ?? []);
    return NextResponse.json({ items });
  }

  const { data, error } = await db
    .from('recipes')
    .select('id, title, slug, visibility, view_count, like_count, save_count, published_at, user_id')
    .order('published_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const items = await attachUsernames(db, data ?? []);
  return NextResponse.json({ items });
}

export async function PATCH(request: NextRequest) {
  const adminUser = await getAdminUser();
  if (!adminUser || adminUser.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { type, id, visibility } = await request.json();
  if (!type || !id || !visibility) {
    return NextResponse.json({ error: 'type, id, and visibility required' }, { status: 400 });
  }

  const db = getServiceClient();
  const table = type === 'blog' ? 'blog_posts' : 'recipes';
  const { error } = await db.from(table).update({ visibility }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
