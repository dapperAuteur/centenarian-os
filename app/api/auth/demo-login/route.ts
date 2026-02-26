// app/api/auth/demo-login/route.ts
// Public endpoint: signs in the visitor demo account and sets auth cookies.
// No request body needed — credentials are server-only env vars.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const email = 'demo@centenarianos.com';
  const password = process.env.DEMO_VISITOR_PASSWORD;

  if (!password) {
    return NextResponse.json({ error: 'Demo login not configured' }, { status: 500 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: 'Demo login failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, redirect: '/dashboard/planner' });
}
