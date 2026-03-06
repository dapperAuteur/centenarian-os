// app/api/admin/traffic/route.ts
// GET: Aggregated page view analytics for admin dashboard.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = request.nextUrl;
  const excludeAdmin = url.searchParams.get('exclude_admin') === 'true';
  const excludeDemo = url.searchParams.get('exclude_demo') === 'true';
  const pathPrefix = url.searchParams.get('path_prefix');

  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const from = url.searchParams.get('from') || defaultFrom;
  const to = url.searchParams.get('to') || now.toISOString().slice(0, 10);

  const db = getDb();

  // page_views table not yet in generated types — cast to any
  let query = (db.from('page_views') as any)
    .select('path, referrer, utm_source, utm_medium, utm_campaign, user_type, created_at')
    .gte('created_at', `${from}T00:00:00Z`)
    .lte('created_at', `${to}T23:59:59Z`);

  if (excludeAdmin) query = query.neq('user_type', 'admin');
  if (excludeDemo) query = query.not('user_type', 'in', '("demo","tutorial")');
  if (pathPrefix) query = query.like('path', `${pathPrefix}%`);

  query = query.order('created_at', { ascending: false }).limit(10000);
  const { data: views, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!views || views.length === 0) {
    return NextResponse.json({
      summary: { totalViews: 0, uniquePaths: 0, avgPerDay: 0, topReferrer: null },
      byDay: [],
      byPath: [],
      byReferrer: [],
      byUtmSource: [],
      byUserType: [],
    });
  }

  const dayCounts: Record<string, number> = {};
  const pathCounts: Record<string, { count: number; referrers: Set<string> }> = {};
  const referrerCounts: Record<string, number> = {};
  const utmCounts: Record<string, number> = {};
  const userTypeCounts: Record<string, number> = {};
  const uniquePaths = new Set<string>();

  for (const v of views) {
    const day = v.created_at.slice(0, 10);
    dayCounts[day] = (dayCounts[day] || 0) + 1;

    uniquePaths.add(v.path);
    if (!pathCounts[v.path]) pathCounts[v.path] = { count: 0, referrers: new Set() };
    pathCounts[v.path].count++;
    if (v.referrer) pathCounts[v.path].referrers.add(v.referrer);

    if (v.referrer) {
      // Extract domain from referrer
      try {
        const domain = new URL(v.referrer).hostname.replace(/^www\./, '');
        referrerCounts[domain] = (referrerCounts[domain] || 0) + 1;
      } catch {
        referrerCounts[v.referrer] = (referrerCounts[v.referrer] || 0) + 1;
      }
    }

    if (v.utm_source) {
      utmCounts[v.utm_source] = (utmCounts[v.utm_source] || 0) + 1;
    }

    const ut = v.user_type || 'anonymous';
    userTypeCounts[ut] = (userTypeCounts[ut] || 0) + 1;
  }

  const byDay = Object.entries(dayCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byPath = Object.entries(pathCounts)
    .map(([path, d]) => ({ path, count: d.count, unique_referrers: d.referrers.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  const byReferrer = Object.entries(referrerCounts)
    .map(([referrer, count]) => ({ referrer, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const byUtmSource = Object.entries(utmCounts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  const byUserType = Object.entries(userTypeCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const dayCount = Math.max(1, Object.keys(dayCounts).length);
  const topReferrer = byReferrer[0]?.referrer ?? null;

  return NextResponse.json({
    summary: {
      totalViews: views.length,
      uniquePaths: uniquePaths.size,
      avgPerDay: Math.round(views.length / dayCount),
      topReferrer,
    },
    byDay,
    byPath,
    byReferrer,
    byUtmSource,
    byUserType,
  });
}
