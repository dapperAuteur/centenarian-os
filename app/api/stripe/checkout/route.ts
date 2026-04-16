// app/api/stripe/checkout/route.ts
// Creates a Stripe Checkout session for monthly, lifetime, teacher, or
// Starter plans. Starter plans carry a `selected_modules` payload (the
// 3 module slugs the user picked) through to the webhook via metadata.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { isValidStarterSelection } from '@/lib/access/starter-modules';

const VALID_PLANS = [
  'monthly', 'lifetime', 'teacher', 'teacher-annual',
  'starter-monthly', 'starter-annual',
];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { plan, selected_modules } = body as { plan?: string; selected_modules?: unknown };
  if (!plan || !VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

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
  } else {
    // lifetime
    session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{ price: process.env.STRIPE_LIFETIME_PRICE_ID!, quantity: 1 }],
      success_url: `${baseUrl}/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing`,
      metadata: { supabase_user_id: user.id, plan: 'lifetime' },
    });
  }

  return NextResponse.json({ url: session.url });
}
