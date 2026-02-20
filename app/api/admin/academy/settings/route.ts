// app/api/admin/academy/settings/route.ts
// Admin: read/write platform_settings for the Academy.

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

const ALLOWED_KEYS = ['teacher_fee_percent', 'teacher_monthly_price_id', 'teacher_annual_price_id'];

export async function GET() {
  const adminUser = await getAdminUser();
  if (!adminUser || adminUser.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from('platform_settings')
    .select('key, value')
    .in('key', ALLOWED_KEYS);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return as flat object for easy consumption
  const settings = Object.fromEntries((data ?? []).map(({ key, value }) => [key, value]));
  return NextResponse.json(settings);
}

export async function PATCH(request: NextRequest) {
  const adminUser = await getAdminUser();
  if (!adminUser || adminUser.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json() as Record<string, string>;
  const db = getServiceClient();

  const upserts = Object.entries(body)
    .filter(([key]) => ALLOWED_KEYS.includes(key))
    .map(([key, value]) => ({ key, value: String(value), updated_at: new Date().toISOString() }));

  if (upserts.length === 0) {
    return NextResponse.json({ error: 'No valid keys provided' }, { status: 400 });
  }

  const { error } = await db
    .from('platform_settings')
    .upsert(upserts, { onConflict: 'key' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
