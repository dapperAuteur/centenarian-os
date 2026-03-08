// app/api/contractor/venues/route.ts
// GET: list contact_locations used in contractor jobs (venue directory)
// PATCH: update knowledge_base / schematics_url on a location

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Get all locations linked to this user's jobs
  const { data: jobs } = await db
    .from('contractor_jobs')
    .select('location_id, location_name')
    .eq('user_id', user.id)
    .not('location_id', 'is', null);

  const locationIds = [...new Set((jobs ?? []).map((j) => j.location_id).filter(Boolean))];

  if (locationIds.length === 0) {
    return NextResponse.json({ venues: [] });
  }

  const { data: venues, error } = await db
    .from('contact_locations')
    .select('id, contact_id, label, address, lat, lng, notes, schematics_url, knowledge_base')
    .in('id', locationIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Count jobs per venue
  const jobCounts: Record<string, number> = {};
  for (const j of jobs ?? []) {
    if (j.location_id) {
      jobCounts[j.location_id] = (jobCounts[j.location_id] || 0) + 1;
    }
  }

  const enriched = (venues ?? []).map((v) => ({
    ...v,
    job_count: jobCounts[v.id] ?? 0,
  }));

  return NextResponse.json({ venues: enriched });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const body = await request.json();
  const { location_id, knowledge_base, schematics_url } = body;

  if (!location_id) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  // Verify user has a job at this venue
  const { data: jobLink } = await db
    .from('contractor_jobs')
    .select('id')
    .eq('user_id', user.id)
    .eq('location_id', location_id)
    .limit(1)
    .maybeSingle();

  if (!jobLink) {
    return NextResponse.json({ error: 'No jobs at this venue' }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (knowledge_base !== undefined) updates.knowledge_base = knowledge_base;
  if (schematics_url !== undefined) updates.schematics_url = schematics_url;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await db
    .from('contact_locations')
    .update(updates)
    .eq('id', location_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
