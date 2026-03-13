// app/api/admin/seo/stats/route.ts
// Admin-only endpoint returning SEO & social performance metrics for CentenarianOS.
// Filters og_image_requests and social_referrals by app='centenarian' to avoid
// mixing data with the contractor app (Work.WitUS) which shares these tables.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const STATIC_PAGE_COUNT = 18; // matches static routes in sitemap.ts

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  const now = new Date();
  const d7  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // ── OG image renders (centenarian only) ───────────────────────────────────
  const [
    { count: ogTotal },
    { count: og7d },
    { count: og30d },
    { data: ogRows },
  ] = await Promise.all([
    db.from('og_image_requests').select('id', { count: 'exact', head: true }).eq('app', 'centenarian'),
    db.from('og_image_requests').select('id', { count: 'exact', head: true }).eq('app', 'centenarian').gte('created_at', d7),
    db.from('og_image_requests').select('id', { count: 'exact', head: true }).eq('app', 'centenarian').gte('created_at', d30),
    db.from('og_image_requests').select('profile_username').eq('app', 'centenarian').limit(5000),
  ]);

  // Aggregate and parse top items (profiles / blog: / cert:)
  const itemCounts: Record<string, { count: number; type: string }> = {};
  for (const row of ogRows ?? []) {
    const key = row.profile_username;
    if (!itemCounts[key]) {
      let type = 'profile';
      if (key.startsWith('blog:')) type = 'blog';
      else if (key.startsWith('cert:')) type = 'certificate';
      itemCounts[key] = { count: 0, type };
    }
    itemCounts[key].count++;
  }
  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([key, data]) => ({ key, og_renders: data.count, type: data.type }));

  // ── Social referrals (centenarian only) ───────────────────────────────────
  const [
    { count: refTotal },
    { count: ref7d },
    { count: ref30d },
    { data: referralRows },
    { data: recentReferrals },
  ] = await Promise.all([
    db.from('social_referrals').select('id', { count: 'exact', head: true }).eq('app', 'centenarian'),
    db.from('social_referrals').select('id', { count: 'exact', head: true }).eq('app', 'centenarian').gte('created_at', d7),
    db.from('social_referrals').select('id', { count: 'exact', head: true }).eq('app', 'centenarian').gte('created_at', d30),
    db.from('social_referrals').select('source').eq('app', 'centenarian').limit(5000),
    db.from('social_referrals')
      .select('source, path, created_at')
      .eq('app', 'centenarian')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const bySource: Record<string, number> = {};
  for (const row of referralRows ?? []) {
    bySource[row.source] = (bySource[row.source] ?? 0) + 1;
  }

  // ── Content shares (CentenarianOS-unique table) ───────────────────────────
  const { data: shareRows } = await db
    .from('content_shares')
    .select('content_type, platform')
    .gte('shared_at', d30)
    .limit(2000);

  const sharesByPlatform: Record<string, number> = {};
  const sharesByType: Record<string, number> = {};
  for (const row of shareRows ?? []) {
    sharesByPlatform[row.platform] = (sharesByPlatform[row.platform] ?? 0) + 1;
    sharesByType[row.content_type] = (sharesByType[row.content_type] ?? 0) + 1;
  }

  // ── Organic referrers from page_views (CentenarianOS-unique) ─────────────
  const { data: pageViewReferrers } = await db
    .from('page_views')
    .select('referrer')
    .not('referrer', 'is', null)
    .gte('created_at', d30)
    .limit(3000);

  const SOCIAL_HOSTS: Record<string, string> = {
    'twitter.com': 'twitter', 't.co': 'twitter', 'x.com': 'twitter',
    'linkedin.com': 'linkedin',
    'facebook.com': 'facebook', 'fb.com': 'facebook',
    'instagram.com': 'instagram',
  };
  const pvBySource: Record<string, number> = {};
  for (const row of pageViewReferrers ?? []) {
    if (!row.referrer) continue;
    try {
      const host = new URL(row.referrer).hostname.replace('www.', '');
      for (const [domain, src] of Object.entries(SOCIAL_HOSTS)) {
        if (host === domain || host.endsWith(`.${domain}`)) {
          pvBySource[src] = (pvBySource[src] ?? 0) + 1;
          break;
        }
      }
    } catch { /* ignore invalid URLs */ }
  }
  const totalSocialPageViews = Object.values(pvBySource).reduce((a, b) => a + b, 0);

  // ── Sitemap coverage counts ────────────────────────────────────────────────
  const [
    { count: profileCount },
    { count: blogCount },
    { count: recipeCount },
    { count: courseCount },
    { count: institutionCount },
  ] = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }).not('username', 'is', null),
    db.from('blog_posts').select('id', { count: 'exact', head: true }).eq('visibility', 'public').not('published_at', 'is', null),
    db.from('recipes').select('id', { count: 'exact', head: true }).eq('visibility', 'public').not('published_at', 'is', null),
    db.from('courses').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    db.from('institutions').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  return NextResponse.json({
    og_renders: {
      total: ogTotal ?? 0,
      last_7d: og7d ?? 0,
      last_30d: og30d ?? 0,
      top_items: topItems,
    },
    social_referrals: {
      total: refTotal ?? 0,
      last_7d: ref7d ?? 0,
      last_30d: ref30d ?? 0,
      by_source: bySource,
      recent: recentReferrals ?? [],
    },
    content_shares: {
      total_30d: (shareRows ?? []).length,
      by_platform: sharesByPlatform,
      by_type: sharesByType,
    },
    page_view_referrers: {
      by_source: pvBySource,
      total_social_30d: totalSocialPageViews,
    },
    sitemap_coverage: {
      profiles: profileCount ?? 0,
      blog_posts: blogCount ?? 0,
      recipes: recipeCount ?? 0,
      courses: courseCount ?? 0,
      institutions: institutionCount ?? 0,
      static_pages: STATIC_PAGE_COUNT,
      total: (profileCount ?? 0) + (blogCount ?? 0) + (recipeCount ?? 0) + (courseCount ?? 0) + (institutionCount ?? 0) + STATIC_PAGE_COUNT,
    },
  });
}
