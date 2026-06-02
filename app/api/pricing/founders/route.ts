// app/api/pricing/founders/route.ts
// Public endpoint: returns lifetime founder's pricing counter + active promo.
//
// Pricing-page visibility (mirrors contractor-os):
//   - active=true  (remaining > 0): show Monthly + Lifetime (founders price); annual hidden
//   - active=false (remaining = 0): show Monthly + Annual; Lifetime hidden UNLESS an
//     admin lifetime-reactivation promo is running, in which case Lifetime returns
//     (discounted) alongside Annual.
// The checkout route enforces the same gates server-side.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getActiveLifetimePromo } from '@/lib/promo/active-lifetime-promo';

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
  const active = remaining > 0;

  // After founders sell out, an active admin promo can re-open lifetime sales.
  const activeLifetimePromo = active ? null : await getActiveLifetimePromo(db);

  return NextResponse.json({
    limit,
    count,
    remaining,
    active,
    // Back-compat with the annual-plan branch: annual is available once founders close.
    annualAvailable: !active,
    // Pricing-page visibility flags:
    show_lifetime: active || activeLifetimePromo !== null,
    show_annual: !active,
    active_lifetime_promo: activeLifetimePromo,
  });
}
