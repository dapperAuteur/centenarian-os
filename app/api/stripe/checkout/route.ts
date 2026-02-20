// app/api/stripe/checkout/route.ts
// Creates a Stripe Checkout session for monthly or lifetime plans

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { plan } = await request.json();
  if (!['monthly', 'lifetime', 'teacher', 'teacher-annual'].includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, subscription_status')
    .eq('id', user.id)
    .single();

  // Block redundant upgrades (only for member plans — teacher is a separate role any member can add)
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

    // Save customer ID (use service role below in webhook; anon client is fine here since it's their own row)
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.headers.get('origin') ?? 'http://localhost:3000';

  let session;

  if (plan === 'teacher' || plan === 'teacher-annual') {
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
      // Both teacher plans use 'teacher' as plan marker in webhook
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
  } else {
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
