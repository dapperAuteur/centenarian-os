// app/api/admin/users/route.ts
// Returns all users for admin panel

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  const user = await getAdminUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServiceClient();

  // Get all profiles
  const { data: profiles, error } = await db
    .from('profiles')
    .select('id, username, display_name, subscription_status, shirt_promo_code, stripe_customer_id, subscription_expires_at, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get auth user emails + email_confirmed_at via admin API
  const { data: authUsers } = await db.auth.admin.listUsers({ perPage: 1000 });

  const authMap = new Map(
    authUsers?.users?.map((u) => [u.id, { email: u.email ?? null, email_confirmed_at: u.email_confirmed_at ?? null }]) ?? [],
  );

  const users = (profiles ?? []).map((p) => {
    const auth = authMap.get(p.id);
    return {
      ...p,
      email: auth?.email ?? null,
      email_confirmed_at: auth?.email_confirmed_at ?? null,
    };
  });

  return NextResponse.json({ users });
}
