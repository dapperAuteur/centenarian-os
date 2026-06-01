// app/api/stripe/checkout/route.ts
// Creates a Stripe Checkout session for monthly, annual, lifetime, teacher, or
// Starter plans. Starter plans carry a `selected_modules` payload (the
// 3 module slugs the user picked) through to the webhook via metadata.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { isValidStarterSelection } from '@/lib/access/starter-modules';

const VALID_PLANS = [
  'monthly', 'annual', 'lifetime', 'teacher', 'teacher-annual',
  'starter-monthly', 'starter-annual',
];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { plan, selected_modules, stripeCouponId } = body as {
    plan?: string;
    selected_modules?: unknown;
    stripeCouponId?: string;
  };
  if (!plan || !VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  // Set when an active lifetime promo unlocks a post-sellout lifetime purchase.
  let promoCampaignId: string | null = null;

  const isStarterPlan = plan === 'starter-monthly' || plan === 'starter-annual';
  if (isStarterPlan) {
    if (
      !Array.isArray(selected_modules) ||
      !selected_modules.every((s) => typeof s === 'string') ||
      !isValidStarterSelection(selected_modules as string[])
    ) {
      return NextResponse.json(
        { error: 'Starter checkout requires selected_modules — exactly 3 unique valid module slugs.' },
        { status: 400 },
      );
    }
  }

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, subscription_status')
    .eq('id', user.id)
    .single();

  // Block redundant upgrades (only for main CentOS plans)
  const isTeacherPlan = plan === 'teacher' || plan === 'teacher-annual';

  if (!isTeacherPlan && profile?.subscription_status === 'lifetime') {
    return NextResponse.json({ error: 'Already a lifetime member' }, { status: 400 });
  }

  // Block Starter signup when user already has Monthly — they'd end up
  // with two overlapping subscriptions. Direction is "downgrade cancel
  // Monthly first, then sign up for Starter."
  if (isStarterPlan && profile?.subscription_status === 'monthly') {
    return NextResponse.json(
      { error: 'Cancel your Monthly plan first, then start Starter. Or swap your 3 modules if you already have Starter.' },
      { status: 400 },
    );
  }
  // Starter-to-Starter is a swap, not a re-checkout. Route them through
  // the module-picker PATCH endpoint instead.
  if (isStarterPlan && profile?.subscription_status === 'starter') {
    return NextResponse.json(
      { error: 'You already have Starter — use the module picker to change your 3 modules.' },
      { status: 400 },
    );
  }

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  let session;

  if (isTeacherPlan) {
    const teacherPriceId = plan === 'teacher-annual'
      ? process.env.TEACHER_ANNUAL_PRICE_ID
      : process.env.TEACHER_MONTHLY_PRICE_ID;
    if (!teacherPriceId) {
      return NextResponse.json({ error: 'Teacher plan not configured' }, { status: 503 });
    }
    session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: teacherPriceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard/teaching?onboarded=true`,
      cancel_url: `${baseUrl}/academy/teach`,
      metadata: { supabase_user_id: user.id, plan: 'teacher' },
    });
  } else if (plan === 'monthly') {
    session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_MONTHLY_PRICE_ID!, quantity: 1 }],
      success_url: `${baseUrl}/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing`,
      metadata: { supabase_user_id: user.id, plan: 'monthly' },
    });
  } else if (isStarterPlan) {
    const starterPriceId = plan === 'starter-annual'
      ? process.env.STRIPE_STARTER_ANNUAL_PRICE_ID
      : process.env.STRIPE_STARTER_MONTHLY_PRICE_ID;
    if (!starterPriceId) {
      return NextResponse.json({ error: 'Starter plan not configured' }, { status: 503 });
    }
    // Stripe metadata values must be strings ≤500 chars. 3 slugs joined
    // with commas fits easily. Webhook deserializes by splitting.
    const selectedModulesCsv = (selected_modules as string[]).join(',');
    session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: starterPriceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing`,
      metadata: {
        supabase_user_id: user.id,
        plan,
        selected_modules: selectedModulesCsv,
      },
      // Also stamp metadata on the subscription itself so
      // subscription.updated / subscription.deleted events can route
      // without needing to re-fetch the originating session.
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan,
          selected_modules: selectedModulesCsv,
        },
      },
    });
  } else if (plan === 'annual') {
    const annualPriceId = process.env.STRIPE_ANNUAL_PRICE_ID;
    if (!annualPriceId) {
      return NextResponse.json({ error: 'Annual plan not configured' }, { status: 503 });
    }
    session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: annualPriceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing`,
      metadata: { supabase_user_id: user.id, plan: 'annual' },
    });
  } else {
    // lifetime — check if founders slots are still available
    const svc = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const [limitRes, paidRes, cashappRes] = await Promise.all([
      svc.from('platform_settings').select('value').eq('key', 'lifetime_founders_limit').maybeSingle(),
      svc.from('profiles').select('id', { count: 'exact', head: true }).eq('subscription_status', 'lifetime').not('stripe_customer_id', 'is', null),
      svc.from('cashapp_payments').select('id', { count: 'exact', head: true }).eq('status', 'verified'),
    ]);
    const limit = Number(limitRes.data?.value ?? '100');
    const paidCount = (paidRes.count ?? 0) + (cashappRes.count ?? 0);

    // After founders sell out, lifetime is closed UNLESS an active admin
    // promo (app='centenarian') re-opens it. A valid promo's coupon bypasses
    // the gate; we stamp the campaign id so redemption increments its uses.
    if (paidCount >= limit) {
      let matchedCampaignId: string | null = null;
      if (stripeCouponId) {
        const now = new Date().toISOString();
        const { data: campaign } = await svc
          .from('admin_promo_campaigns')
          .select('id, is_active, plan_types, app, start_date, end_date, max_uses, current_uses')
          .eq('stripe_coupon_id', stripeCouponId)
          .eq('app', 'centenarian')
          .eq('is_active', true)
          .lte('start_date', now)
          .or(`end_date.is.null,end_date.gte.${now}`)
          .maybeSingle();
        if (campaign) {
          const planTypes = Array.isArray(campaign.plan_types) ? campaign.plan_types : [];
          const allowsLifetime = planTypes.includes('lifetime');
          const withinCap = campaign.max_uses === null || (campaign.current_uses ?? 0) < campaign.max_uses;
          if (allowsLifetime && withinCap) matchedCampaignId = campaign.id;
        }
      }
      if (!matchedCampaignId) {
        return NextResponse.json({ error: 'Lifetime founder slots sold out. Choose the Annual plan instead.' }, { status: 410 });
      }
      promoCampaignId = matchedCampaignId;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lifetimeParams: Record<string, any> = {
      customer: customerId,
      mode: 'payment',
      line_items: [{ price: process.env.STRIPE_LIFETIME_PRICE_ID!, quantity: 1 }],
      success_url: `${baseUrl}/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing`,
      metadata: {
        supabase_user_id: user.id,
        plan: 'lifetime',
        ...(promoCampaignId ? { promo_campaign_id: promoCampaignId } : {}),
      },
    };
    // Auto-apply the promo coupon (the lifetime base price never changes).
    if (stripeCouponId && promoCampaignId) {
      lifetimeParams.discounts = [{ coupon: stripeCouponId }];
    }
    session = await stripe.checkout.sessions.create(lifetimeParams);
  }

  return NextResponse.json({ url: session.url });
}
