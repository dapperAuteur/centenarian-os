// app/api/stripe/sync-renewal/route.ts
// Fetches the current period end for an existing monthly subscriber from Stripe
// and writes it to subscription_expires_at in their profile.
// Called by the billing page when subscription_expires_at is null for a monthly user.

import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();

  // Fetch the user's stripe_subscription_id from their profile
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('stripe_subscription_id, subscription_status')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  if (profile.subscription_status !== 'monthly' || !profile.stripe_subscription_id) {
    return NextResponse.json({ subscriptionExpiresAt: null });
  }

  // Retrieve subscription from Stripe to get current_period_end
  let subscriptionExpiresAt: string;
  try {
    const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id) as unknown as Stripe.Subscription;
    subscriptionExpiresAt = new Date(sub.current_period_end * 1000).toISOString();
  } catch (err) {
    console.error('[sync-renewal] Failed to retrieve Stripe subscription:', err);
    return NextResponse.json({ error: 'Could not fetch subscription from Stripe' }, { status: 502 });
  }

  // Persist to DB
  const { error: updateError } = await db
    .from('profiles')
    .update({ subscription_expires_at: subscriptionExpiresAt })
    .eq('id', user.id);

  if (updateError) {
    console.error('[sync-renewal] DB update failed:', updateError);
    return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
  }

  return NextResponse.json({ subscriptionExpiresAt });
}
