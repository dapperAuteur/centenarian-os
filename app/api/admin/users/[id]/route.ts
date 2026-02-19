// app/api/admin/users/[id]/route.ts
// Admin: get user detail, update subscription/promo code, retry Shopify promo

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createShopifyPromoCode } from '@/lib/shopify/createPromoCode';

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

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const adminUser = await getAdminUser();
  if (!adminUser || adminUser.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = getServiceClient();

  const [profileRes, authUserRes, focusRes, recipesRes, blogRes] = await Promise.all([
    db.from('profiles').select('*').eq('id', id).single(),
    db.auth.admin.getUserById(id),
    db.from('focus_sessions').select('id', { count: 'exact' }).eq('user_id', id),
    db.from('recipes').select('id', { count: 'exact' }).eq('user_id', id),
    db.from('blog_posts').select('id', { count: 'exact' }).eq('user_id', id),
  ]);

  return NextResponse.json({
    profile: profileRes.data,
    email: authUserRes.data.user?.email ?? null,
    stats: {
      focusSessions: focusRes.count ?? 0,
      recipes: recipesRes.count ?? 0,
      blogPosts: blogRes.count ?? 0,
    },
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const adminUser = await getAdminUser();
  if (!adminUser || adminUser.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const allowed = ['shirt_promo_code', 'subscription_status'];
  const updates: Record<string, string> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const db = getServiceClient();
  const { error } = await db.from('profiles').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest, { params }: Params) {
  const adminUser = await getAdminUser();
  if (!adminUser || adminUser.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  if (!url.pathname.endsWith('/retry-promo')) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 404 });
  }

  let code: string;
  try {
    code = await createShopifyPromoCode();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Shopify API failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const db = getServiceClient();
  const { error } = await db.from('profiles').update({ shirt_promo_code: code }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ code });
}
