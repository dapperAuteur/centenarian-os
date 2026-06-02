// app/api/banners/route.ts
// GET: return the first active CentenarianOS banner matching the user's tier.
// Ported from contractor-os; app filter is 'centenarian'.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const tier = request.nextUrl.searchParams.get('tier') || 'free';
  const now = new Date().toISOString();
  const db = getDb();

  const { data: banners } = await db
    .from('marketing_banners')
    .select('id, title, body, cta_text, cta_url')
    .eq('app', 'centenarian')
    .eq('is_active', true)
    .contains('target_tiers', [tier])
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!banners || banners.length === 0) {
    return NextResponse.json(null);
  }

  return NextResponse.json(banners[0]);
}
