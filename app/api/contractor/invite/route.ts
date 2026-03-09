// app/api/contractor/invite/route.ts
// GET: list invites sent by this user
// POST: invite a peer (contractor invites contractor, lister invites contractor/lister)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function authClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const MAX_INVITES_PER_USER = 10;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data, error } = await db
    .from('invited_users')
    .select('id, email, product, access_type, is_active, accepted_at, invited_at')
    .eq('invited_by', user.id)
    .order('invited_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invites: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { email, product } = body;

  if (!email?.trim()) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const validProducts = ['contractor', 'lister'];
  if (!product || !validProducts.includes(product)) {
    return NextResponse.json({ error: 'product must be contractor or lister' }, { status: 400 });
  }

  const db = getDb();

  // Check user's role — listers can invite to both, workers can only invite contractor
  const { data: profile } = await db
    .from('profiles')
    .select('contractor_role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.contractor_role ?? 'worker';
  const invitedByRole = ['lister', 'union_leader'].includes(role) ? 'lister' : 'contractor';

  if (product === 'lister' && !['lister', 'union_leader'].includes(role)) {
    return NextResponse.json({ error: 'Only listers can invite other listers' }, { status: 403 });
  }

  // Check invite limit
  const { count } = await db
    .from('invited_users')
    .select('id', { count: 'exact', head: true })
    .eq('invited_by', user.id);

  if ((count ?? 0) >= MAX_INVITES_PER_USER) {
    return NextResponse.json({ error: `Maximum ${MAX_INVITES_PER_USER} invites reached` }, { status: 400 });
  }

  // Create invite
  const { data: invite, error: insertErr } = await db
    .from('invited_users')
    .insert({
      email: email.trim().toLowerCase(),
      invited_by: user.id,
      product,
      invited_by_role: invitedByRole,
      access_type: 'trial',
    })
    .select()
    .single();

  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json({ error: 'This email has already been invited to this product' }, { status: 409 });
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Send magic link — redirect to the appropriate subdomain via auth callback
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const subdomainUrl = product === 'lister'
    ? siteUrl.replace('://', '://lister.')
    : siteUrl.replace('://', '://contractor.');
  const destination = product === 'lister'
    ? '/dashboard/contractor/lister'
    : '/dashboard/contractor';
  const redirectTo = `${subdomainUrl}/auth/callback?next=${encodeURIComponent(destination)}`;

  const ac = authClient();
  const { error: inviteErr } = await ac.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
    redirectTo,
  });

  if (inviteErr) {
    console.error('[contractor/invite] inviteUserByEmail error:', inviteErr.message, inviteErr);
    const alreadyExists =
      inviteErr.message.toLowerCase().includes('already') ||
      (inviteErr as { status?: number }).status === 422;
    if (alreadyExists) {
      return NextResponse.json({ ...invite, already_exists: true });
    }
    await db.from('invited_users').delete().eq('id', invite.id);
    return NextResponse.json({ error: inviteErr.message }, { status: 500 });
  }

  return NextResponse.json({ ...invite, already_exists: false }, { status: 201 });
}
