// app/api/contractor/jobs/[id]/route.ts
// GET: job detail with linked counts
// PATCH: update job fields
// DELETE: delete job

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { estimateDrivingDistance, milesToKm } from '@/lib/geo/distance';
import { geocodeAddress } from '@/lib/geo/geocode';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const db = getDb();

  const { data: job, error } = await db
    .from('contractor_jobs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Fetch linked counts in parallel
  const [timeEntries, invoices, trips, expenses, documents] = await Promise.all([
    db.from('job_time_entries').select('id', { count: 'exact', head: true }).eq('job_id', id),
    db.from('invoices').select('id', { count: 'exact', head: true }).eq('job_id', id),
    db.from('trips').select('id', { count: 'exact', head: true }).eq('job_id', id),
    db.from('financial_transactions').select('id', { count: 'exact', head: true }).eq('job_id', id),
    db.from('job_documents').select('id', { count: 'exact', head: true }).eq('job_id', id),
  ]);

  return NextResponse.json({
    ...job,
    _counts: {
      time_entries: timeEntries.count ?? 0,
      invoices: invoices.count ?? 0,
      trips: trips.count ?? 0,
      expenses: expenses.count ?? 0,
      documents: documents.count ?? 0,
    },
  });
}

const ALLOWED_FIELDS = [
  'job_number', 'client_id', 'client_name', 'event_name',
  'location_id', 'location_name',
  'poc_contact_id', 'poc_name', 'poc_phone',
  'crew_coordinator_id', 'crew_coordinator_name', 'crew_coordinator_phone',
  'status', 'start_date', 'end_date',
  'is_multi_day', 'scheduled_dates',
  'pay_rate', 'ot_rate', 'dt_rate', 'rate_type',
  'distance_from_home_miles', 'distance_from_home_km', 'benefits_eligible', 'travel_benefits',
  'union_local', 'department', 'brand_id', 'est_pay_date',
  'is_public', 'share_contacts', 'notes', 'metadata',
];

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const body = await request.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ALLOWED_FIELDS) {
    if (key in body) updates[key] = body[key];
  }

  const db = getDb();
  const { data, error } = await db
    .from('contractor_jobs')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `Job number "${body.job_number}" already exists` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-recalculate distance if location changed and no manual distance provided
  const locationChanged = 'location_id' in body || 'location_name' in body;
  const manualDistance = 'distance_from_home_miles' in body;
  if (locationChanged && !manualDistance && (data.location_id || data.location_name)) {
    try {
      const { data: settings } = await db
        .from('travel_settings')
        .select('home_lat, home_lng')
        .eq('user_id', user.id)
        .maybeSingle();

      if (settings?.home_lat && settings?.home_lng) {
        let destLat: number | null = null;
        let destLng: number | null = null;

        if (data.location_id) {
          const { data: loc } = await db.from('contact_locations').select('lat, lng').eq('id', data.location_id).maybeSingle();
          if (loc?.lat && loc?.lng) { destLat = loc.lat; destLng = loc.lng; }
        }
        if (destLat === null && data.location_name) {
          const geo = await geocodeAddress(data.location_name);
          if (geo) {
            destLat = geo.lat; destLng = geo.lng;
            if (data.location_id) await db.from('contact_locations').update({ lat: geo.lat, lng: geo.lng }).eq('id', data.location_id);
          }
        }
        if (destLat !== null && destLng !== null) {
          const miles = estimateDrivingDistance(settings.home_lat, settings.home_lng, destLat, destLng, 'mi');
          const { data: updated } = await db
            .from('contractor_jobs')
            .update({ distance_from_home_miles: miles, distance_from_home_km: milesToKm(miles) })
            .eq('id', id)
            .select()
            .single();
          if (updated) return NextResponse.json(updated);
        }
      }
    } catch { /* non-blocking */ }
  }

  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const db = getDb();

  const { error } = await db
    .from('contractor_jobs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
