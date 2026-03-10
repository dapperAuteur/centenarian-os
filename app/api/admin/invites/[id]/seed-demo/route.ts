// app/api/admin/invites/[id]/seed-demo/route.ts
// Seeds demo data for an invited user's account.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { clearUserData, seedVisitor, seedTutorial } from '@/lib/demo/seed';
import { seedContractor } from '@/lib/demo/seed-contractor';
import { seedLister } from '@/lib/demo/seed-lister';

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
    .select('user_id, demo_profile, demo_seeded')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  if (!invite.user_id) return NextResponse.json({ error: 'User has not accepted the invite yet' }, { status: 400 });
  if (!invite.demo_profile) return NextResponse.json({ error: 'No demo profile set on invite' }, { status: 400 });

  try {
    // Clear any existing data first to avoid unique constraint violations
    await clearUserData(db, invite.user_id);

    if (invite.demo_profile === 'visitor') {
      await seedVisitor(db, invite.user_id);
    } else if (invite.demo_profile === 'contractor_demo') {
      await seedContractor(db, invite.user_id);
    } else if (invite.demo_profile === 'lister_demo') {
      await seedLister(db, invite.user_id);
    } else {
      await seedTutorial(db, invite.user_id);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { error: updateErr } = await db
    .from('invited_users')
    .update({ demo_seeded: true, demo_seeded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
