// app/api/admin/users/resend-selected/route.ts
//
// POST { ids: string[] } — resend the Supabase email-confirmation link to the
// selected users (by auth user id). Lets the admin pick a subset to work around
// the 100-per-call cap on "resend to all unverified".
//
// For each id: look up the auth user, skip if already verified or missing an
// email, otherwise generateLink({ type: 'magiclink' }) (clicking it logs the
// user in AND confirms their email — same rationale as the single-user route).
// Sequential to respect Supabase's per-email rate limit. Capped at MAX_BULK.
//
// Response: { attempted, succeeded, failed, alreadyVerified, skippedMissingEmail }
// Admin-gated via ADMIN_EMAIL match.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const MAX_BULK = 100;

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

export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin || admin.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const rawIds: unknown = body?.ids;
  const ids: string[] = Array.isArray(rawIds)
    ? [...new Set(rawIds.filter((x): x is string => typeof x === 'string' && x.length > 0))]
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: 'No users selected.' }, { status: 400 });
  }
  if (ids.length > MAX_BULK) {
    return NextResponse.json(
      { error: `Too many selected (${ids.length}, max ${MAX_BULK} per send). Deselect some and send in passes.`, total: ids.length },
      { status: 413 },
    );
  }

  const db = getServiceClient();

  let succeeded = 0;
  let failed = 0;
  let alreadyVerified = 0;
  let skippedMissingEmail = 0;

  // Sequential — Supabase's per-email rate limit is the ceiling.
  for (const id of ids) {
    const { data: got, error: getErr } = await db.auth.admin.getUserById(id);
    const user = got?.user;
    if (getErr || !user) { failed++; continue; }
    if (user.email_confirmed_at) { alreadyVerified++; continue; }
    if (!user.email) { skippedMissingEmail++; continue; }
    const { error } = await db.auth.admin.generateLink({ type: 'magiclink', email: user.email });
    if (error) failed++; else succeeded++;
  }

  return NextResponse.json({
    attempted: ids.length,
    succeeded,
    failed,
    alreadyVerified,
    skippedMissingEmail,
  });
}
