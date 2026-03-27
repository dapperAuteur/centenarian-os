// app/api/pricing/founders/route.ts
// Public endpoint: returns lifetime founder's pricing counter.

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

  const [limitRes, paidCountRes, cashappCountRes] = await Promise.all([
    db.from('platform_settings').select('value').eq('key', 'lifetime_founders_limit').maybeSingle(),
    // Count only PAID lifetime members (have stripe_customer_id = paid via Stripe)
    db.from('profiles').select('id', { count: 'exact', head: true })
      .eq('subscription_status', 'lifetime')
      .not('stripe_customer_id', 'is', null),
    // Also count verified CashApp lifetime payments
    db.from('cashapp_payments').select('id', { count: 'exact', head: true })
      .eq('status', 'verified'),
  ]);

  const limit = Number(limitRes.data?.value ?? '100');
  const count = (paidCountRes.count ?? 0) + (cashappCountRes.count ?? 0);
  const remaining = Math.max(0, limit - count);

  return NextResponse.json({
    limit,
    count,
    remaining,
    active: remaining > 0,
    annualAvailable: remaining <= 0,
  });
}
