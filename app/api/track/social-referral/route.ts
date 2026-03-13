// app/api/track/social-referral/route.ts
// POST: log a social media referral visit from CentenarianOS pages.
// No auth required. Deduplication: ignores if the same source+path was logged
// in the last 5 minutes. Writes app='centenarian' to distinguish from the
// contractor app (Work.WitUS) which shares the same social_referrals table.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const VALID_SOURCES = ['twitter', 'linkedin', 'facebook', 'instagram', 'other'];

export async function POST(request: NextRequest) {
  let body: { source?: string; path?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const source = body.source?.toLowerCase() ?? 'other';
  const path = body.path ?? '/';

  if (!VALID_SOURCES.includes(source)) {
    return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
  }

  const db = getDb();

  // Dedup: skip if same source+path+app logged in last 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count } = await db
    .from('social_referrals')
    .select('id', { count: 'exact', head: true })
    .eq('source', source)
    .eq('path', path)
    .eq('app', 'centenarian')
    .gte('created_at', fiveMinutesAgo);

  if ((count ?? 0) > 0) {
    return NextResponse.json({ skipped: true });
  }

  const { error } = await db
    .from('social_referrals')
    .insert({ source, path, app: 'centenarian' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ logged: true });
}
