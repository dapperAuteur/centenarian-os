// app/api/stripe/checkout/route.ts
// Creates a Stripe Checkout session for monthly, annual, lifetime, or teacher plans

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';

const VALID_PLANS = ['monthly', 'annual', 'lifetime', 'teacher', 'teacher-annual'];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { plan } = await request.json();
  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
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
    if (paidCount >= limit) {
      return NextResponse.json({ error: 'Lifetime founder slots sold out. Choose the Annual plan instead.' }, { status: 410 });
    }

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
