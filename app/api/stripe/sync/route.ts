// app/api/stripe/sync/route.ts
// Syncs subscription status directly from a Stripe checkout session.
// Called by the billing page after a successful checkout redirect.
// This provides a reliable fallback when webhooks are delayed or misconfigured.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { createShopifyPromoCode } from '@/lib/shopify/createPromoCode';
import { logInfo, logError } from '@/lib/logging';

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
    logError({ source: 'sync', module: 'stripe', message: 'Failed to retrieve Stripe session', metadata: { sessionId: session_id, error: err instanceof Error ? err.message : String(err) }, userId: user.id });
    return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
  }

  // Security: ensure this session belongs to the authenticated user
  if (session.metadata?.supabase_user_id !== user.id) {
    logError({ source: 'sync', module: 'stripe', message: 'User ID mismatch on session', metadata: { sessionId: session_id }, userId: user.id });
    return NextResponse.json({ error: 'Session does not belong to this user' }, { status: 403 });
  }

  // Use session.status === 'complete' as the primary check.
  // payment_status can be 'paid' or 'no_payment_required' depending on plan config.
  if (session.status !== 'complete') {
    logInfo({ source: 'sync', module: 'stripe', message: 'Session not yet complete', metadata: { sessionId: session_id, status: session.status }, userId: user.id });
    return NextResponse.json({ status: 'pending' });
  }

  const plan = session.metadata?.plan;
  logInfo({ source: 'sync', module: 'stripe', message: 'Processing session', metadata: { sessionId: session_id, mode: session.mode, plan }, userId: user.id });
  const db = getServiceClient();

  if (session.mode === 'subscription' && plan === 'monthly') {
    // Fetch subscription period end so we can show the renewal date immediately
    let subscriptionExpiresAt: string | null = null;
    try {
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = sub as any;
      const rawEnd: number | undefined = s.items?.data?.[0]?.current_period_end ?? s.current_period_end;
      if (rawEnd && typeof rawEnd === 'number') {
        subscriptionExpiresAt = new Date(rawEnd * 1000).toISOString();
      }
    } catch (err) {
      logError({ source: 'sync', module: 'stripe', message: 'Failed to retrieve subscription for period_end', metadata: { error: err instanceof Error ? err.message : String(err) }, userId: user.id });
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
      logError({ source: 'sync', module: 'stripe', message: 'DB update failed for monthly', metadata: { error: error.message }, userId: user.id });
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      logError({ source: 'sync', module: 'stripe', message: 'No profile row found', metadata: { hint: 'run migration 036 to backfill profiles' }, userId: user.id });
      return NextResponse.json({ error: 'Profile not found — account setup incomplete' }, { status: 404 });
    }
    logInfo({ source: 'sync', module: 'stripe', message: 'Monthly subscription synced', metadata: { sessionId: session_id }, userId: user.id });
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
        logError({ source: 'sync', module: 'stripe', message: 'Failed to create Shopify promo code', metadata: { error: err instanceof Error ? err.message : String(err) }, userId: user.id });
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
      logError({ source: 'sync', module: 'stripe', message: 'DB update failed for lifetime', metadata: { error: error.message }, userId: user.id });
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      logError({ source: 'sync', module: 'stripe', message: 'No profile row found', metadata: { hint: 'run migration 036 to backfill profiles' }, userId: user.id });
      return NextResponse.json({ error: 'Profile not found — account setup incomplete' }, { status: 404 });
    }
    logInfo({ source: 'sync', module: 'stripe', message: 'Lifetime purchase synced', metadata: { sessionId: session_id }, userId: user.id });
    return NextResponse.json({ status: 'lifetime' });
  }

  if (session.mode === 'subscription' && plan === 'teacher') {
    const { error: roleErr } = await db
      .from('profiles')
      .update({ role: 'teacher' })
      .eq('id', user.id);
    if (roleErr) {
      logError({ source: 'sync', module: 'stripe', message: 'Failed to set teacher role', metadata: { error: roleErr.message }, userId: user.id });
    }
    const { error: tpErr } = await db
      .from('teacher_profiles')
      .upsert({ user_id: user.id, stripe_subscription_id: session.subscription as string }, { onConflict: 'user_id' });
    if (tpErr) {
      logError({ source: 'sync', module: 'stripe', message: 'Failed to upsert teacher_profile', metadata: { error: tpErr.message }, userId: user.id });
    }
    logInfo({ source: 'sync', module: 'stripe', message: 'Teacher subscription synced', metadata: { sessionId: session_id }, userId: user.id });
    return NextResponse.json({ status: 'teacher' });
  }

  if (session.mode === 'subscription' && (plan === 'contractor' || plan === 'lister')) {
    const { data: pData } = await db
      .from('profiles')
      .select('products')
      .eq('id', user.id)
      .maybeSingle();
    const currentProducts: string[] = pData?.products ?? [];
    if (!currentProducts.includes(plan)) {
      const { error } = await db
        .from('profiles')
        .update({ products: [...currentProducts, plan] })
        .eq('id', user.id);
      if (error) {
        logError({ source: 'sync', module: 'stripe', message: `Failed to add ${plan} product`, metadata: { error: error.message }, userId: user.id });
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }
    }
    logInfo({ source: 'sync', module: 'stripe', message: `${plan} subscription synced`, metadata: { sessionId: session_id }, userId: user.id });
    return NextResponse.json({ status: plan });
  }

  logInfo({ source: 'sync', module: 'stripe', message: 'No matching plan/mode handler', metadata: { mode: session.mode, plan }, userId: user.id });
  return NextResponse.json({ status: 'free' });
}
