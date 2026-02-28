// app/api/planner/export/route.ts
// GET: export planner tasks as CSV
// Uses service role client because planner uses direct supabase queries
// and RLS may not be set up for API route access.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { buildCsvResponse } from '@/lib/csv/helpers';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const params = request.nextUrl.searchParams;
  const from = params.get('from');
  const to = params.get('to');
  const tag = params.get('tag');
  const completed = params.get('completed');

  let query = db
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  if (tag) query = query.eq('tag', tag);
  if (completed === 'true') query = query.eq('completed', true);
  if (completed === 'false') query = query.eq('completed', false);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []).map((r) => [
    r.date || '',
    r.time || '',
    r.activity || '',
    r.description || '',
    r.tag || '',
    String(r.priority ?? ''),
    String(r.completed ?? false),
    String(r.estimated_cost ?? ''),
    String(r.actual_cost ?? ''),
    String(r.revenue ?? ''),
  ]);

  return buildCsvResponse(
    ['Date', 'Time', 'Activity', 'Description', 'Tag', 'Priority', 'Completed', 'Estimated Cost', 'Actual Cost', 'Revenue'],
    rows,
    'centenarianos-tasks-export.csv',
  );
}
