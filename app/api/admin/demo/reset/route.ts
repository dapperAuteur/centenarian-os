// app/api/admin/demo/reset/route.ts
// Clears and reseeds all demo accounts with realistic dummy data.
// Called daily by Vercel cron (GET) or manually from the admin dashboard (POST).
// Guard: GET needs Authorization: Bearer {CRON_SECRET}. POST accepts that OR a signed-in
// ADMIN_EMAIL session — the dashboard's "Reset demo data" button has no way to hold the secret.
// Middleware does not cover /api/*, so these checks are the only gate.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { clearUserData, seedTutorial, seedVisitor } from '@/lib/demo/seed';
import { syncAllKnowledge } from '@/lib/admin/syncKnowledge';

type SeedType = 'tutorial' | 'visitor';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function guard(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

async function isAdminSession(): Promise<boolean> {
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
  return !!user && !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;
}

export async function GET(request: NextRequest) {
  if (!guard(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runReset();
}

export async function POST(request: NextRequest) {
  if (!guard(request) && !(await isAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runReset();
}

async function runReset() {
  const tutorialUserId = process.env.DEMO_TUTORIAL_USER_ID;
  const visitorUserId = process.env.DEMO_VISITOR_USER_ID;

  if (!tutorialUserId || !visitorUserId) {
    return NextResponse.json({ error: 'Demo user IDs not configured' }, { status: 500 });
  }

  const supabase = db();
  const resetList: SeedType[] = [];
  try {
    await resetUser(supabase, tutorialUserId, 'tutorial');
    resetList.push('tutorial');

    await resetUser(supabase, visitorUserId, 'visitor');
    resetList.push('visitor');

    // Fire-and-forget: sync help articles + course embeddings + timestamp
    syncAllKnowledge().catch((e) => console.error('[cron] syncAllKnowledge failed:', e));

    return NextResponse.json({ ok: true, reset: resetList, at: new Date().toISOString() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function resetUser(supabase: ReturnType<typeof db>, userId: string, type: SeedType) {
  await clearUserData(supabase, userId);
  switch (type) {
    case 'tutorial':
      await seedTutorial(supabase, userId);
      break;
    case 'visitor':
      await seedVisitor(supabase, userId);
      break;
  }
  // Ensure demo users pass the subscription gate (isPaid check in dashboard layout)
  await supabase
    .from('profiles')
    .update({ subscription_status: 'lifetime' })
    .eq('id', userId);
}
