// app/api/inbody-scans/route.ts
// GET: Fetch inbody_scans for the authenticated user.
// Query params:
//   ?days=30|90|365|all  (default: 90)
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD  (overrides days)
//   ?limit=N             (default 500, max 2000)

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const daysParam = searchParams.get('days') ?? '90';
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const limitParam = Math.min(parseInt(searchParams.get('limit') ?? '500', 10), 2000);

  let query = supabase
    .from('inbody_scans')
    .select('*')
    .eq('user_id', user.id)
    .order('logged_date', { ascending: true })
    .limit(limitParam);

  if (fromParam && toParam) {
    query = query.gte('logged_date', fromParam).lte('logged_date', toParam);
  } else if (daysParam !== 'all') {
    const days = parseInt(daysParam, 10) || 90;
    const from = new Date();
    from.setDate(from.getDate() - days);
    query = query.gte('logged_date', from.toISOString().split('T')[0]);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ scans: data ?? [] });
}
