// app/api/user/preferences/route.ts
// GET: read authenticated user's dashboard_home preference
// PATCH: update dashboard_home (validated against NAV_GROUPS allowlist)

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { NAV_GROUPS } from '@/components/nav/NavConfig';

// Allowlist: all non-admin nav hrefs
const ALLOWED_HOMES = NAV_GROUPS
  .flatMap((g) => g.items)
  .filter((i) => !i.adminOnly)
  .map((i) => i.href);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('dashboard_home')
    .eq('id', user.id)
    .single();

  return NextResponse.json({ dashboard_home: profile?.dashboard_home ?? '/dashboard/blog' });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { dashboard_home } = body;

  if (!dashboard_home || !ALLOWED_HOMES.includes(dashboard_home)) {
    return NextResponse.json({ error: 'Invalid dashboard_home value' }, { status: 400 });
  }

  const { error } = await supabase
    .from('profiles')
    .update({ dashboard_home })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ dashboard_home });
}
