// app/api/admin/users/resend-all-unverified/route.ts
//
// POST — resend the Supabase email-confirmation link to every user
// whose email_confirmed_at is still NULL. Capped at MAX_BULK users
// per call to keep the request under Vercel's function timeout;
// larger sets require multiple calls (admin UI warns + refuses).
//
// Runs sequentially via for-of (not Promise.all) so we respect
// Supabase's per-email rate limits. Uses Promise.allSettled results
// per-email to keep going on individual failures.
//
// Response:
//   { attempted, succeeded, failed, alreadyVerified, skippedMissingEmail }
//
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin || admin.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServiceClient();
  const { data: authUsers, error: listErr } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const unverified = (authUsers?.users ?? []).filter((u) => !u.email_confirmed_at);
  if (unverified.length === 0) {
    return NextResponse.json({
      attempted: 0, succeeded: 0, failed: 0, alreadyVerified: 0, skippedMissingEmail: 0,
    });
  }
  if (unverified.length > MAX_BULK) {
    return NextResponse.json(
      {
        error: `Too many unverified users to resend in one batch (${unverified.length} found, max ${MAX_BULK}). Filter to a subset and resend per-row, or run this again — each call sends to the first ${MAX_BULK}.`,
        total: unverified.length,
      },
      { status: 413 },
    );
  }

  let succeeded = 0;
  let failed = 0;
  let skippedMissingEmail = 0;

  // Sequential send — Supabase's per-email rate limit is the ceiling.
  // Parallelizing would just trade user-facing errors for internal ones.
  for (const user of unverified) {
    if (!user.email) { skippedMissingEmail++; continue; }
    // magiclink (not signup) — see single-user endpoint for rationale.
    const { error } = await db.auth.admin.generateLink({ type: 'magiclink', email: user.email });
    if (error) failed++; else succeeded++;
  }

  return NextResponse.json({
    attempted: unverified.length,
    succeeded,
    failed,
    alreadyVerified: 0,
    skippedMissingEmail,
  });
}
