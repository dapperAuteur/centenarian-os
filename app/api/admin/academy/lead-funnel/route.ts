// app/api/admin/academy/lead-funnel/route.ts
// GET (admin only): lead-funnel analytics. Downloads and optional emails captured on the
// free lead magnets, plus how many of those lead sessions became signups and enrollments.
// Reads via the service-role client; guarded by ADMIN_EMAIL.

import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

function getDb() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET() {
  const sb = await createServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  const { data: dls } = await db
    .from('lead_download_events')
    .select('document_title, session_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5000);
  const { count: emailCount } = await db.from('lead_emails').select('*', { count: 'exact', head: true });

  const byDocMap: Record<string, number> = {};
  const dailyMap: Record<string, number> = {};
  const sessions = new Set<string>();
  for (const d of dls ?? []) {
    const t = d.document_title || 'Unknown';
    byDocMap[t] = (byDocMap[t] || 0) + 1;
    const day = (d.created_at || '').slice(0, 10);
    if (day) dailyMap[day] = (dailyMap[day] || 0) + 1;
    if (d.session_id) sessions.add(d.session_id);
  }
  const byDocument = Object.entries(byDocMap).map(([document, count]) => ({ document, count })).sort((a, b) => b.count - a.count);
  const daily = Object.entries(dailyMap).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

  // Of the sessions that downloaded, how many became users, and how many enrolled?
  const sessionIds = [...sessions].slice(0, 1000);
  let leadsSignedUp = 0;
  let leadsEnrolled = 0;
  if (sessionIds.length) {
    const { data: profs } = await db.from('profiles').select('id').in('lead_session_id', sessionIds);
    leadsSignedUp = profs?.length ?? 0;
    const userIds = (profs ?? []).map((p) => p.id);
    if (userIds.length) {
      const { count } = await db.from('enrollments').select('*', { count: 'exact', head: true }).in('user_id', userIds).eq('status', 'active');
      leadsEnrolled = count ?? 0;
    }
  }

  return NextResponse.json({
    summary: {
      downloads: dls?.length ?? 0,
      emails: emailCount ?? 0,
      downloadSessions: sessions.size,
      leadsSignedUp,
      leadsEnrolled,
    },
    byDocument,
    daily,
  });
}
