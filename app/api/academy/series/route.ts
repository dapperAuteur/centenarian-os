// app/api/academy/series/route.ts
// GET: list the courses that make up a series (one course per season), ordered
// by season_number. Powers the season switcher on the course detail page and
// the grouped series card in the catalog. Visibility rules mirror the catalog
// list route (published + public/members/scheduled); owners/admins additionally
// see their own drafts so they can wire seasons together before publishing.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const slug = new URL(request.url).searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = !!user && user.email === process.env.ADMIN_EMAIL;

  const db = getDb();
  const { data, error } = await db
    .from('courses')
    .select('id, title, slug, cover_image_url, season_number, series_title, is_published, visibility, published_at, teacher_id, profiles(username)')
    .eq('series_slug', slug)
    .order('season_number', { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const visible = (data ?? []).filter((c) => {
    // Owners + admin always see their own series entries, including drafts.
    if (isAdmin || (user && user.id === c.teacher_id)) return true;
    if (!c.is_published) return false;
    const visibility = c.visibility ?? 'public';
    if (visibility === 'public') return true;
    if (visibility === 'members') return !!user;
    if (visibility === 'scheduled') return !!c.published_at && new Date(c.published_at).getTime() <= now;
    return false;
  });

  return NextResponse.json(visible);
}
