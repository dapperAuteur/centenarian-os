// app/api/admin/usage/route.ts
// GET: aggregated usage analytics with filters.

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
  const moduleFilter = url.searchParams.get('module');
  const subFilter = url.searchParams.get('subscription_type'); // free/monthly/lifetime/teacher/invited

  // Default 30 days
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const from = url.searchParams.get('from') || defaultFrom;
  const to = url.searchParams.get('to') || now.toISOString().slice(0, 10);

  const db = getDb();

  // Build base filter conditions for RPC or manual queries
  // Since Supabase JS doesn't support GROUP BY, we use RPC-style raw queries
  // via select + client-side aggregation for simplicity.
  let query = db
    .from('usage_events')
    .select('module, action, detail, user_type, subscription_type, user_id, created_at')
    .gte('created_at', `${from}T00:00:00Z`)
    .lte('created_at', `${to}T23:59:59Z`);

  if (excludeAdmin) query = query.neq('user_type', 'admin');
  if (excludeDemo) query = query.not('user_type', 'in', '("demo","tutorial")');
  if (moduleFilter) query = query.eq('module', moduleFilter);
  if (subFilter) query = query.eq('subscription_type', subFilter);

  // Fetch up to 10000 events for aggregation
  query = query.order('created_at', { ascending: false }).limit(10000);
  const { data: events, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!events || events.length === 0) {
    return NextResponse.json({
      byModule: [],
      byDay: [],
      byAction: [],
      bySubscription: [],
      topFeatures: [],
      summary: { totalEvents: 0, uniqueUsers: 0, avgPerDay: 0, topModule: null },
    });
  }

  // Aggregate by module
  const moduleCounts: Record<string, number> = {};
  const dayCounts: Record<string, number> = {};
  const actionCounts: Record<string, number> = {};
  const featureCounts: Record<string, number> = {};
  const subCounts: Record<string, number> = {};
  const uniqueUsers = new Set<string>();

  for (const e of events) {
    moduleCounts[e.module] = (moduleCounts[e.module] || 0) + 1;

    const day = e.created_at.slice(0, 10);
    dayCounts[day] = (dayCounts[day] || 0) + 1;

    actionCounts[e.action] = (actionCounts[e.action] || 0) + 1;

    const featureKey = `${e.module}|${e.action}|${e.detail || ''}`;
    featureCounts[featureKey] = (featureCounts[featureKey] || 0) + 1;

    const sub = e.subscription_type || 'unknown';
    subCounts[sub] = (subCounts[sub] || 0) + 1;

    if (e.user_id) uniqueUsers.add(e.user_id);
  }

  const byModule = Object.entries(moduleCounts)
    .map(([module, count]) => ({ module, count }))
    .sort((a, b) => b.count - a.count);

  const byDay = Object.entries(dayCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byAction = Object.entries(actionCounts)
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count);

  const topFeatures = Object.entries(featureCounts)
    .map(([key, count]) => {
      const [module, action, detail] = key.split('|');
      return { module, action, detail: detail || null, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const bySubscription = Object.entries(subCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const dayCount = Math.max(1, Object.keys(dayCounts).length);
  const topModule = byModule[0]?.module ?? null;

  return NextResponse.json({
    byModule,
    byDay,
    byAction,
    bySubscription,
    topFeatures,
    summary: {
      totalEvents: events.length,
      uniqueUsers: uniqueUsers.size,
      avgPerDay: Math.round(events.length / dayCount),
      topModule,
    },
  });
}
