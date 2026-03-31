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
    .select('dashboard_home_centos, scan_auto_save_images, likes_public, show_done_counts, clock_format, fiscal_year_start_month, fiscal_year_start_day')
    .eq('id', user.id)
    .single();

  return NextResponse.json({
    dashboard_home: profile?.dashboard_home_centos ?? '/dashboard/blog',
    scan_auto_save_images: profile?.scan_auto_save_images ?? false,
    likes_public: profile?.likes_public ?? false,
    show_done_counts: profile?.show_done_counts ?? false,
    clock_format: profile?.clock_format ?? '12h',
    fiscal_year_start_month: profile?.fiscal_year_start_month ?? 1,
    fiscal_year_start_day: profile?.fiscal_year_start_day ?? 1,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { dashboard_home, scan_auto_save_images } = body;

  const updates: Record<string, unknown> = {};

  if (dashboard_home !== undefined) {
    if (!ALLOWED_HOMES.includes(dashboard_home)) {
      return NextResponse.json({ error: 'Invalid dashboard_home value' }, { status: 400 });
    }
    updates.dashboard_home_centos = dashboard_home;
  }

  if (scan_auto_save_images !== undefined) {
    updates.scan_auto_save_images = !!scan_auto_save_images;
  }

  if (body.likes_public !== undefined) {
    updates.likes_public = !!body.likes_public;
  }

  if (body.show_done_counts !== undefined) {
    updates.show_done_counts = !!body.show_done_counts;
  }

  if (body.clock_format !== undefined) {
    if (body.clock_format !== '12h' && body.clock_format !== '24h') {
      return NextResponse.json({ error: 'clock_format must be "12h" or "24h"' }, { status: 400 });
    }
    updates.clock_format = body.clock_format;
  }

  if (body.fiscal_year_start_month !== undefined) {
    const m = Number(body.fiscal_year_start_month);
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      return NextResponse.json({ error: 'fiscal_year_start_month must be 1-12' }, { status: 400 });
    }
    updates.fiscal_year_start_month = m;
  }

  if (body.fiscal_year_start_day !== undefined) {
    const d = Number(body.fiscal_year_start_day);
    if (!Number.isInteger(d) || d < 1 || d > 28) {
      return NextResponse.json({ error: 'fiscal_year_start_day must be 1-28' }, { status: 400 });
    }
    updates.fiscal_year_start_day = d;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(updates);
}
