// app/api/institutions/[slug]/route.ts
// GET: Public (no auth required) — institution detail with published offers.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const db = getDb();

  const { data: institution, error } = await db
    .from('institutions')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!institution) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Fetch published offers for this institution
  const { data: offers } = await db
    .from('institution_offers')
    .select('*')
    .eq('institution_id', institution.id)
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  return NextResponse.json({ institution, offers: offers ?? [] });
}
