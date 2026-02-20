// app/api/stripe/sync/route.ts
// Syncs subscription status directly from a Stripe checkout session.
// Called by the billing page after a successful checkout redirect.
// This provides a reliable fallback when webhooks are delayed or misconfigured.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';
import { createShopifyPromoCode } from '@/lib/shopify/createPromoCode';

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: NextRequest) {
  // Auth check — user must be logged in
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { session_id } = await request.json();

  if (!session_id || typeof session_id !== 'string') {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
  }

  // Retrieve the session from Stripe
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(session_id);
  } catch (err) {
    console.error('[sync] Failed to retrieve Stripe session:', err);
    return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
  }

  // Security: ensure this session belongs to the authenticated user
  if (session.metadata?.supabase_user_id !== user.id) {
    console.error('[sync] User ID mismatch — metadata:', session.metadata?.supabase_user_id, 'auth:', user.id);
    return NextResponse.json({ error: 'Session does not belong to this user' }, { status: 403 });
  }

  // Use session.status === 'complete' as the primary check.
  // payment_status can be 'paid' or 'no_payment_required' depending on plan config.
  if (session.status !== 'complete') {
    console.log('[sync] Session not yet complete — status:', session.status, 'payment_status:', session.payment_status);
    return NextResponse.json({ status: 'pending' });
  }

  console.log('[sync] Processing session:', {
    mode: session.mode,
    plan: session.metadata?.plan,
    payment_status: session.payment_status,
    userId: user.id,
  });

  const plan = session.metadata?.plan;
  const db = getServiceClient();

  if (session.mode === 'subscription' && plan === 'monthly') {
    // Fetch subscription period end so we can show the renewal date immediately
    let subscriptionExpiresAt: string | null = null;
    try {
      const sub = await stripe.subscriptions.retrieve(session.subscription as string) as unknown as Stripe.Subscription;
      subscriptionExpiresAt = new Date(sub.current_period_end * 1000).toISOString();
    } catch (err) {
      console.error('[sync] Failed to retrieve subscription for period_end:', err);
    }

    const { data: updated, error } = await db
      .from('profiles')
      .update({
        subscription_status: 'monthly',
        stripe_subscription_id: (session.subscription as string) ?? null,
        subscription_expires_at: subscriptionExpiresAt,
        cancel_at_period_end: false,
        cancel_at: null,
      })
      .eq('id', user.id)
      .select('id');

    if (error) {
      console.error('[sync] DB update failed for monthly:', error);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      console.error('[sync] No profile row for user:', user.id, '— run migration 036 to backfill profiles');
      return NextResponse.json({ error: 'Profile not found — account setup incomplete' }, { status: 404 });
    }
    return NextResponse.json({ status: 'monthly' });
  }

  if (session.mode === 'payment' && plan === 'lifetime') {
    // Check if promo code already exists (idempotency guard)
    const { data: profile } = await db
      .from('profiles')
      .select('subscription_status, shirt_promo_code')
      .eq('id', user.id)
      .maybeSingle();

    let promoCode = profile?.shirt_promo_code ?? null;

    // Only generate promo if not already lifetime
    if (profile?.subscription_status !== 'lifetime') {
      try {
        promoCode = await createShopifyPromoCode();
      } catch (err) {
        console.error('[sync] Failed to create Shopify promo code:', err);
      }
    }

    const { data: updated, error } = await db
      .from('profiles')
      .update({
        subscription_status: 'lifetime',
        shirt_promo_code: promoCode,
        stripe_subscription_id: null,
        subscription_expires_at: null,
      })
      .eq('id', user.id)
      .select('id');

    if (error) {
      console.error('[sync] DB update failed for lifetime:', error);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      console.error('[sync] No profile row for user:', user.id, '— run migration 036 to backfill profiles');
      return NextResponse.json({ error: 'Profile not found — account setup incomplete' }, { status: 404 });
    }
    return NextResponse.json({ status: 'lifetime' });
  }

  console.log('[sync] No matching plan/mode handler — mode:', session.mode, 'plan:', plan);
  return NextResponse.json({ status: 'free' });
}
