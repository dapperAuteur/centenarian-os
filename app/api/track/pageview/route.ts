// app/api/track/pageview/route.ts
// POST: Record an anonymous page view. No auth required.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

let _db: ReturnType<typeof createServiceClient> | null = null;
function getDb() {
  if (!_db) {
    _db = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _db;
}

function classifyUser(userId?: string | null, userEmail?: string | null): string {
  if (userEmail && userEmail === process.env.ADMIN_EMAIL) return 'admin';
  if (userId && userId === process.env.DEMO_TUTORIAL_USER_ID) return 'tutorial';
  if (userId && userId === process.env.DEMO_VISITOR_USER_ID) return 'demo';
  if (userId) return 'real';
  return 'anonymous';
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.path || typeof body.path !== 'string' || !body.path.startsWith('/')) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Optionally resolve user for classification
  let userType = 'anonymous';
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userType = classifyUser(user?.id, user?.email);
  } catch {
    // No session — stays anonymous
  }

  // page_views table not yet in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (getDb().from('page_views') as any)
    .insert({
      path: body.path,
      referrer: body.referrer || null,
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
      user_type: userType,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) console.error('[pageview] insert failed:', error.message);
    });

  return NextResponse.json({ ok: true });
}
