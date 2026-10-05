import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { checkOwned } from '@/lib/auth/ownership';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const platform = body.platform || 'link';

  const db = getDb();

  // Only a workout the caller may see (their own, or a public one) can be
  // shared and counted in share stats.
  const visible = await checkOwned(db, user.id, 'workout_templates', id, { allowPublic: true });
  if (visible.failed) return NextResponse.json({ error: 'Could not share the workout' }, { status: 500 });
  if (!visible.allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Ensure user has a public_alias
  const { data: profile } = await db
    .from('profiles')
    .select('public_alias')
    .eq('id', user.id)
    .single();

  let alias = profile?.public_alias;
  if (!alias) {
    alias = `user_${randomBytes(4).toString('hex')}`;
    await db.from('profiles').update({ public_alias: alias }).eq('id', user.id);
  }

  await db.from('content_shares').insert({
    user_alias: alias,
    content_type: 'workout',
    content_id: id,
    platform,
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://centenarianos.com';
  const shareUrl = `${baseUrl}/workouts/${id}`;

  return NextResponse.json({ share_url: shareUrl });
}
