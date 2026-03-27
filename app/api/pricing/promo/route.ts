// app/api/pricing/promo/route.ts
// Public endpoint: returns the active promo campaign (if any).

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const db = getDb();
  const now = new Date().toISOString();

  const { data } = await db
    .from('admin_promo_campaigns')
    .select('id, name, description, discount_type, discount_value, promo_code, end_date, max_uses, current_uses, plan_types')
    .eq('is_active', true)
    .lte('start_date', now)
    .or(`end_date.is.null,end_date.gte.${now}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return NextResponse.json(null);

  // Check if max uses exceeded
  if (data.max_uses && data.current_uses >= data.max_uses) {
    return NextResponse.json(null);
  }

  return NextResponse.json(data);
}
