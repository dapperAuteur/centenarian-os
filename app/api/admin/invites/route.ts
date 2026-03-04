// app/api/admin/invites/route.ts
// Admin-only invite management.
// GET: list all invited_users rows.
// POST: create invite + send Supabase magic link.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function adminAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function requireAdmin() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) return null;
  return user;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = serviceDb();
  const { data, error } = await db
    .from('invited_users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { email, access_type = 'trial', expires_at, allowed_modules, demo_profile, notes } = body;

  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });

  const db = serviceDb();

  // 1. Insert invite record
  const { data: invite, error: insertErr } = await db
    .from('invited_users')
    .insert([{
      email,
      invited_by: admin.id,
      access_type,
      expires_at: expires_at || null,
      allowed_modules: (allowed_modules && allowed_modules.length > 0) ? allowed_modules : null,
      demo_profile: demo_profile || null,
      notes: notes || null,
    }])
    .select()
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // 2. Send Supabase invite email (creates user + sends magic link)
  const authClient = adminAuthClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const { error: inviteErr } = await authClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/dashboard/planner`,
  });

  if (inviteErr) {
    // User already has an account — invite record stays; lazy-accept links them on login
    const alreadyExists =
      inviteErr.message.toLowerCase().includes('already') ||
      (inviteErr as { status?: number }).status === 422;
    if (alreadyExists) {
      return NextResponse.json({ ...invite, already_exists: true });
    }
    // Unexpected error — remove the invite record
    await db.from('invited_users').delete().eq('id', invite.id);
    return NextResponse.json({ error: inviteErr.message }, { status: 500 });
  }

  return NextResponse.json({ ...invite, already_exists: false });
}
