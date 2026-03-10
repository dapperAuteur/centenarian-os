// app/api/admin/demo/reset/route.ts
// Clears and reseeds all demo accounts with realistic dummy data.
// Called daily by Vercel cron (GET) or manually by admin (POST).
// Guard: Authorization: Bearer {CRON_SECRET}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

export async function GET(request: NextRequest) {
  if (!guard(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

export async function POST(request: NextRequest) {
  return GET(request);
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
}
