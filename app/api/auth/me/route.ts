// app/api/auth/me/route.ts
// Returns whether the current user is admin, teacher, or invited.
// Also performs lazy invite acceptance: links user_id when a pending invite matches by email.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function serviceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ isAdmin: false, isTeacher: false, role: 'member', isInvited: false, inviteModules: null, inviteExpiresAt: null });
  }

  const isAdmin = user.email === process.env.ADMIN_EMAIL;

  // Demo users always get full access
  const demoUserIds = [
    process.env.DEMO_TUTORIAL_USER_ID,
    process.env.DEMO_VISITOR_USER_ID,
  ].filter(Boolean);
  const demoEmails = [
    process.env.DEMO_TUTORIAL_USER_EMAIL,
    process.env.DEMO_VISITOR_USER_EMAIL,
    process.env.DEMO_CONTRACTOR_EMAIL,
  ].filter(Boolean);
  const isDemoUser = demoUserIds.includes(user.id) || (user.email && demoEmails.includes(user.email));

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, username')
    .eq('id', user.id)
    .maybeSingle();

  const role = isAdmin ? 'admin' : (profile?.role ?? 'member');
  const isTeacher = role === 'teacher' || isAdmin;

  // Check invited_users via service role (no RLS on this table)
  const db = serviceDb();
  let invite: { id: string; is_active: boolean; expires_at: string | null; allowed_modules: string[] | null } | null = null;

  const { data: existingInvite } = await db
    .from('invited_users')
    .select('id, is_active, expires_at, allowed_modules')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingInvite) {
    invite = existingInvite;
  } else if (user.email) {
    // Lazy-accept: link this user to any pending invite for their email
    const { data: pendingInvite } = await db
      .from('invited_users')
      .select('id, is_active, expires_at, allowed_modules')
      .eq('email', user.email)
      .is('user_id', null)
      .maybeSingle();

    if (pendingInvite) {
      await db
        .from('invited_users')
        .update({ user_id: user.id, accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', pendingInvite.id);
      invite = pendingInvite;
    }
  }

  const now = new Date();
  const isInvited = !!(invite?.is_active && (!invite.expires_at || new Date(invite.expires_at) > now));

  return NextResponse.json({
    isAdmin,
    isTeacher,
    isDemoUser: !!isDemoUser,
    role,
    username: profile?.username ?? null,
    userId: user.id,
    isInvited,
    inviteModules: isInvited ? (invite?.allowed_modules ?? null) : null,
    inviteExpiresAt: isInvited ? (invite?.expires_at ?? null) : null,
  });
}
