// app/api/admin/users/[id]/resend-verification/route.ts
//
// POST — admin resends the Supabase email-confirmation link for a
// single user. Uses `auth.admin.generateLink({ type: 'signup', email })`
// which both returns the link and triggers Supabase's SMTP send (if
// configured — the signup flow already relies on it).
//
// Returns:
//   { ok: true, action_link }            — email dispatched (or link available for manual forward)
//   { ok: true, alreadyVerified: true }  — user already confirmed, no-op
//
// Admin-gated via ADMIN_EMAIL match, mirroring the pattern used by
// every other /api/admin route in this codebase.

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

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin || admin.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = getServiceClient();

  const { data: userRes, error: fetchErr } = await db.auth.admin.getUserById(id);
  if (fetchErr || !userRes?.user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  const { user } = userRes;
  if (!user.email) {
    return NextResponse.json({ error: 'User has no email on file' }, { status: 400 });
  }
  if (user.email_confirmed_at) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  // magiclink (not signup) — signup is for brand-new user creation and
  // requires a password. For an existing unverified user we want to
  // send a one-time login link; clicking it both logs them in and
  // confirms their email as a side effect.
  const { data: linkRes, error: linkErr } = await db.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  });
  if (linkErr || !linkRes) {
    return NextResponse.json({ error: linkErr?.message ?? 'Failed to generate link' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    action_link: linkRes.properties?.action_link ?? null,
  });
}
