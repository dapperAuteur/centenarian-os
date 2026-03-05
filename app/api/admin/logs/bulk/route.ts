// app/api/admin/logs/bulk/route.ts
// PATCH: bulk mark logs as reviewed.
// Body: { ids: string[] } or { level: 'warn', before: '2026-03-01' }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const db = getDb();

  if (body.ids && Array.isArray(body.ids)) {
    const { error } = await db
      .from('app_logs')
      .update({ is_reviewed: true })
      .in('id', body.ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ updated: body.ids.length });
  }

  // Bulk by level + date range
  let query = db.from('app_logs').update({ is_reviewed: true }).eq('is_reviewed', false);
  if (body.level) query = query.eq('level', body.level);
  if (body.before) query = query.lte('created_at', `${body.before}T23:59:59Z`);

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
