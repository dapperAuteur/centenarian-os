// app/api/admin/logs/route.ts
// GET: paginated, filterable log viewer for admin dashboard.

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
  const level = url.searchParams.get('level');
  const source = url.searchParams.get('source');
  const logModule = url.searchParams.get('module');
  const search = url.searchParams.get('search');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const unreviewed = url.searchParams.get('unreviewed') === 'true';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));

  const db = getDb();
  let query = db.from('app_logs').select('*', { count: 'exact' });

  if (level) query = query.eq('level', level);
  if (source) query = query.eq('source', source);
  if (logModule) query = query.eq('module', logModule);
  if (search) query = query.ilike('message', `%${search}%`);
  if (from) query = query.gte('created_at', `${from}T00:00:00Z`);
  if (to) query = query.lte('created_at', `${to}T23:59:59Z`);
  if (unreviewed) query = query.eq('is_reviewed', false).in('level', ['warn', 'error']);

  const offset = (page - 1) * limit;
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    logs: data ?? [],
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / limit),
  });
}
