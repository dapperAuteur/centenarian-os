// app/api/contractor/jobs/export/route.ts
// GET: export contractor jobs as CSV

import { NextRequest } from 'next/server';
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
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const db = getDb();
  let query = db
    .from('contractor_jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('start_date', { ascending: false });

  if (from) query = query.gte('start_date', from);
  if (to) query = query.lte('start_date', to);

  const { data: jobs } = await query;

  const headers = [
    'job_number', 'client_name', 'event_name', 'location_name',
    'status', 'start_date', 'end_date', 'pay_rate', 'ot_rate', 'dt_rate',
    'rate_type', 'union_local', 'department', 'benefits_eligible',
    'distance_from_home_miles', 'poc_name', 'crew_coordinator_name', 'notes',
  ];

  const rows = (jobs ?? []).map((j) => [
    j.job_number ?? '',
    j.client_name ?? '',
    j.event_name ?? '',
    j.location_name ?? '',
    j.status ?? '',
    j.start_date ?? '',
    j.end_date ?? '',
    String(j.pay_rate ?? ''),
    String(j.ot_rate ?? ''),
    String(j.dt_rate ?? ''),
    j.rate_type ?? '',
    j.union_local ?? '',
    j.department ?? '',
    j.benefits_eligible ? 'true' : 'false',
    String(j.distance_from_home_miles ?? ''),
    j.poc_name ?? '',
    j.crew_coordinator_name ?? '',
    j.notes ?? '',
  ]);

  return buildCsvResponse(headers, rows, `contractor-jobs-${new Date().toISOString().slice(0, 10)}.csv`);
}
