// app/api/admin/invites/[id]/clear-demo/route.ts
// Clears all demo data for an invited user's account.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { clearUserData } from '@/lib/demo/seed';

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function requireAdmin() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) return null;
  return user;
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = serviceDb();

  const { data: invite, error: fetchErr } = await db
    .from('invited_users')
    .select('user_id, demo_seeded')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  if (!invite.user_id) return NextResponse.json({ error: 'User has not accepted the invite yet' }, { status: 400 });
  if (!invite.demo_seeded) return NextResponse.json({ error: 'No demo data to clear' }, { status: 400 });

  try {
    await clearUserData(db, invite.user_id);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { error: updateErr } = await db
    .from('invited_users')
    .update({ demo_seeded: false, demo_seeded_at: null, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
