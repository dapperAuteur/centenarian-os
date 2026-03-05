// app/api/auth/demo-login/route.ts
// Public endpoint: signs in the visitor demo account and sets auth cookies.
// Optional JSON body { from?: string } tracks which feature page drove the demo login.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { trackUsage } from '@/lib/trackUsage';

export async function POST(request: Request) {
  const email = 'demo@centenarianos.com';
  const password = process.env.DEMO_VISITOR_PASSWORD;

  if (!password) {
    return NextResponse.json({ error: 'Demo login not configured' }, { status: 500 });
  }

  // Parse optional referral source + redirect target
  let from: string | undefined;
  let redirectPath: string | undefined;
  try {
    const body = await request.json();
    if (body.from && typeof body.from === 'string') from = body.from;
    if (body.redirect && typeof body.redirect === 'string' && body.redirect.startsWith('/')) {
      redirectPath = body.redirect;
    }
  } catch { /* no body — that's fine */ }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: 'Demo login failed' }, { status: 500 });
  }

  // Fire-and-forget: track which page drove the demo login
  trackUsage({
    userId: process.env.DEMO_VISITOR_USER_ID,
    module: 'demo',
    action: 'login',
    detail: from ? `from:${from}` : 'from:demo-page',
  });

  return NextResponse.json({ ok: true, redirect: redirectPath || '/dashboard/planner' });
}
