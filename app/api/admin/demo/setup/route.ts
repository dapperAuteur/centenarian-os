// app/api/admin/demo/setup/route.ts
// ONE-TIME endpoint: creates both demo users via the Supabase Admin Auth API,
// then seeds their data. Returns the user UUIDs so you can add them to env vars.
//
// Usage (run once after deploy):
//   curl -X POST https://centenarianos.com/api/admin/demo/setup \
//     -H "Authorization: Bearer YOUR_CRON_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"tutorial_email":"tutorial@centenarianos.com","tutorial_password":"YourPassword1!","visitor_email":"demo@centenarianos.com","visitor_password":"YourPassword2!"}'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function guard(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!guard(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { tutorial_email?: string; tutorial_password?: string; visitor_email?: string; visitor_password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { tutorial_email, tutorial_password, visitor_email, visitor_password } = body;
  if (!tutorial_email || !tutorial_password || !visitor_email || !visitor_password) {
    return NextResponse.json({
      error: 'Required: tutorial_email, tutorial_password, visitor_email, visitor_password',
    }, { status: 400 });
  }

  const supabase = db();
  const results: Record<string, string> = {};

  // Create or fetch tutorial user
  const tutorialId = await upsertUser(supabase, tutorial_email, tutorial_password);
  if (typeof tutorialId !== 'string') return tutorialId; // error response
  results.tutorial_user_id = tutorialId;

  // Create or fetch visitor user
  const visitorId = await upsertUser(supabase, visitor_email, visitor_password);
  if (typeof visitorId !== 'string') return visitorId;
  results.visitor_user_id = visitorId;

  return NextResponse.json({
    ok: true,
    users: results,
    next_steps: [
      `Add to .env.local and Vercel env vars:`,
      `DEMO_TUTORIAL_USER_ID=${results.tutorial_user_id}`,
      `DEMO_VISITOR_USER_ID=${results.visitor_user_id}`,
      `Then call GET /api/admin/demo/reset to seed the data.`,
    ],
  });
}

async function upsertUser(
  supabase: ReturnType<typeof db>,
  email: string,
  password: string,
): Promise<string | Response> {
  // Check if user already exists
  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email === email);
  if (found) return found.id;

  // Create new user
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    return NextResponse.json({ error: `Failed to create ${email}: ${error.message}` }, { status: 500 }) as unknown as Response;
  }

  return data.user.id;
}
