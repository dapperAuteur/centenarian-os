import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServiceClient();

  // Fetch all tour events
  const { data: events } = await db
    .from('tour_events')
    .select('id, public_alias, app, module_slug, event_type, step_index, step_title, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  // Fetch module_tours summary
  const { data: tours } = await db
    .from('module_tours')
    .select('app, module_slug, status')
    .order('created_at', { ascending: false });

  // Aggregate stats
  const allEvents = events || [];
  const allTours = tours || [];

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const recentEvents = allEvents.filter((e) => new Date(e.created_at) >= sevenDaysAgo);

  const countByType = (evts: typeof allEvents, type: string) =>
    evts.filter((e) => e.event_type === type).length;

  // Tour completion rates per module
  const moduleStats: Record<string, { started: number; completed: number; skipped: number; exited: number }> = {};
  for (const t of allTours) {
    const key = `${t.app}:${t.module_slug}`;
    if (!moduleStats[key]) moduleStats[key] = { started: 0, completed: 0, skipped: 0, exited: 0 };
    if (t.status === 'completed') moduleStats[key].completed++;
    if (t.status === 'skipped') moduleStats[key].skipped++;
    if (t.status === 'in_progress') moduleStats[key].started++;
  }

  // Top feature pages by demo clicks
  const demoCounts: Record<string, number> = {};
  for (const e of allEvents) {
    if (e.event_type === 'cta_demo_click') {
      const key = `${e.app}:${e.module_slug}`;
      demoCounts[key] = (demoCounts[key] || 0) + 1;
    }
  }

  // Recent activity (alias-based, no PII)
  const recentActivity = allEvents.slice(0, 50).map((e) => ({
    alias: e.public_alias || 'anonymous',
    app: e.app,
    module: e.module_slug,
    event: e.event_type,
    step: e.step_index !== null ? `${(e.step_index || 0) + 1}` : null,
    stepTitle: e.step_title,
    time: e.created_at,
  }));

  return NextResponse.json({
    overview: {
      total_tours_started: countByType(allEvents, 'tour_started'),
      total_tours_completed: countByType(allEvents, 'tour_completed'),
      total_tours_skipped: countByType(allEvents, 'tour_skipped'),
      total_tours_exited: countByType(allEvents, 'tour_exited'),
      total_demo_logins: countByType(allEvents, 'cta_demo_click'),
      total_feature_views: countByType(allEvents, 'feature_page_view'),
      total_signup_clicks: countByType(allEvents, 'cta_signup_click'),
      last_7_days: {
        tours_started: countByType(recentEvents, 'tour_started'),
        tours_completed: countByType(recentEvents, 'tour_completed'),
        demo_logins: countByType(recentEvents, 'cta_demo_click'),
        feature_views: countByType(recentEvents, 'feature_page_view'),
      },
    },
    module_stats: moduleStats,
    top_demo_sources: Object.entries(demoCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([key, count]) => ({ module: key, count })),
    recent_activity: recentActivity,
  });
}
