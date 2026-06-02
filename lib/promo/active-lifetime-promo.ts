// lib/promo/active-lifetime-promo.ts
// Single source of truth for "is there an active CentenarianOS lifetime promo?"
// Used by:
//   - /api/pricing/founders  → exposes to pricing page + admin widget
//   - /api/stripe/checkout   → bypasses the sold-out gate when active
//   - /api/cashapp POST      → bypasses the sold-out gate when active
//
// "Active" means: app='centenarian' + is_active=true + start_date <= now <= end_date
// (end_date null = open-ended) + (max_uses null OR current_uses + reserved < max_uses).
//
// For CashApp the "reserved" count includes pending payments so we don't
// over-sell when multiple users submit before any are verified.
//
// Ported from contractor-os/lib/promo/active-lifetime-promo.ts; the only
// difference is the app filter ('centenarian' vs 'contractor') — both apps
// share the admin_promo_campaigns table, keyed by the `app` column.

import { SupabaseClient } from '@supabase/supabase-js';

export const PROMO_APP = 'centenarian';

export interface ActiveLifetimePromo {
  id: string;
  name: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  stripe_coupon_id: string | null;
  promo_code: string | null;
  end_date: string | null;
  max_uses: number | null;
  current_uses: number;
  remaining_uses: number | null;
}

/** Returns the most recently created active CentenarianOS lifetime promo, or null. */
export async function getActiveLifetimePromo(
  db: SupabaseClient,
): Promise<ActiveLifetimePromo | null> {
  const now = new Date().toISOString();

  const { data: campaigns } = await db
    .from('admin_promo_campaigns')
    .select('id, name, description, discount_type, discount_value, stripe_coupon_id, promo_code, end_date, max_uses, current_uses, plan_types')
    .eq('app', PROMO_APP)
    .eq('is_active', true)
    .lte('start_date', now)
    .or(`end_date.is.null,end_date.gte.${now}`)
    .order('created_at', { ascending: false });

  if (!campaigns?.length) return null;

  // Filter to campaigns that include the lifetime plan.
  const lifetimeCampaign = campaigns.find((c) => {
    const planTypes = Array.isArray(c.plan_types) ? c.plan_types : [];
    return planTypes.includes('lifetime');
  });

  if (!lifetimeCampaign) return null;

  // Apply max_uses cap (counts pending CashApp toward the reservation pool).
  let remaining: number | null = null;
  if (lifetimeCampaign.max_uses !== null) {
    const { count: pendingCashApp } = await db
      .from('cashapp_payments')
      .select('id', { count: 'exact', head: true })
      .eq('promo_campaign_id', lifetimeCampaign.id)
      .eq('status', 'pending');
    const reserved = (lifetimeCampaign.current_uses ?? 0) + (pendingCashApp ?? 0);
    remaining = Math.max(0, lifetimeCampaign.max_uses - reserved);
    if (remaining === 0) return null;
  }

  return {
    id: lifetimeCampaign.id,
    name: lifetimeCampaign.name,
    description: lifetimeCampaign.description,
    discount_type: lifetimeCampaign.discount_type,
    discount_value: lifetimeCampaign.discount_value,
    stripe_coupon_id: lifetimeCampaign.stripe_coupon_id,
    promo_code: lifetimeCampaign.promo_code,
    end_date: lifetimeCampaign.end_date,
    max_uses: lifetimeCampaign.max_uses,
    current_uses: lifetimeCampaign.current_uses ?? 0,
    remaining_uses: remaining,
  };
}

/** Atomically increment current_uses for a campaign. Caller has already confirmed redemption. */
export async function incrementCampaignUses(
  db: SupabaseClient,
  campaignId: string,
): Promise<void> {
  const { data: current } = await db
    .from('admin_promo_campaigns')
    .select('current_uses, max_uses, is_active')
    .eq('id', campaignId)
    .maybeSingle();

  if (!current) return;

  const newUses = (current.current_uses ?? 0) + 1;
  const shouldDeactivate =
    current.max_uses !== null && newUses >= current.max_uses;

  await db
    .from('admin_promo_campaigns')
    .update({
      current_uses: newUses,
      is_active: shouldDeactivate ? false : current.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId);
}
