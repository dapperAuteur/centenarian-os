// app/api/academy/courses/[id]/enroll/route.ts
// POST: enroll in a course.
//   - Free courses: direct enrollment.
//   - Paid courses: create Stripe checkout with application_fee for CentOS.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id: courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Get course details
  const { data: course } = await db
    .from('courses')
    .select('id, title, price, price_type, is_published, teacher_id, stripe_price_id, stripe_product_id, teacher_profiles(stripe_connect_account_id, stripe_connect_onboarded)')
    .eq('id', courseId)
    .single();

  if (!course || !course.is_published) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  }

  // Block teacher from enrolling in own course
  if (course.teacher_id === user.id) {
    return NextResponse.json({ error: 'You cannot enroll in your own course' }, { status: 400 });
  }

  // Check existing enrollment
  const { data: existing } = await db
    .from('enrollments')
    .select('status')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle();

  if (existing?.status === 'active') {
    return NextResponse.json({ error: 'Already enrolled' }, { status: 400 });
  }

  // Free course — enroll directly
  if (course.price_type === 'free' || Number(course.price) === 0) {
    await db.from('enrollments').upsert({
      user_id: user.id,
      course_id: courseId,
      status: 'active',
    }, { onConflict: 'user_id,course_id' });

    return NextResponse.json({ enrolled: true });
  }

  // Paid course — create Stripe checkout
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teacherProfile = (course as any).teacher_profiles;
  if (!teacherProfile?.stripe_connect_account_id || !teacherProfile?.stripe_connect_onboarded) {
    return NextResponse.json({ error: 'Teacher has not set up payouts yet' }, { status: 503 });
  }

  // Get platform fee
  const { data: feeSetting } = await db
    .from('platform_settings')
    .select('value')
    .eq('key', 'teacher_fee_percent')
    .maybeSingle();

  const feePercent = Number(feeSetting?.value ?? '15');
  const priceInCents = Math.round(Number(course.price) * 100);
  const applicationFee = Math.round(priceInCents * (feePercent / 100));

  // Get or create Stripe customer for the student
  const { data: profile } = await db
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  let customerId = profile?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await db.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.headers.get('origin') ?? 'http://localhost:3000';

  if (course.price_type === 'one_time') {
    // Create a one-time price on the fly (or use course.stripe_price_id if set)
    const { data: courseWithPrice } = await db
      .from('courses')
      .select('stripe_price_id, stripe_product_id')
      .eq('id', courseId)
      .single();

    let priceId = courseWithPrice?.stripe_price_id;

    if (!priceId) {
      // Create product + price in Stripe
      const product = await stripe.products.create(
        { name: course.title, metadata: { course_id: courseId } },
        { stripeAccount: teacherProfile.stripe_connect_account_id },
      );
      const price = await stripe.prices.create(
        { unit_amount: priceInCents, currency: 'usd', product: product.id },
        { stripeAccount: teacherProfile.stripe_connect_account_id },
      );
      priceId = price.id;
      await db.from('courses').update({ stripe_product_id: product.id, stripe_price_id: priceId }).eq('id', courseId);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: { destination: teacherProfile.stripe_connect_account_id },
      },
      success_url: `${baseUrl}/academy/${courseId}?enrolled=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/academy/${courseId}`,
      metadata: { supabase_user_id: user.id, course_id: courseId, type: 'course_enrollment' },
    }, { stripeAccount: teacherProfile.stripe_connect_account_id });

    return NextResponse.json({ url: session.url });
  }

  // Subscription course
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let priceId = (course as any).stripe_price_id as string | undefined;
  if (!priceId) {
    const product = await stripe.products.create(
      { name: course.title, metadata: { course_id: courseId } },
      { stripeAccount: teacherProfile.stripe_connect_account_id },
    );
    const price = await stripe.prices.create(
      { unit_amount: priceInCents, currency: 'usd', product: product.id, recurring: { interval: 'month' } },
      { stripeAccount: teacherProfile.stripe_connect_account_id },
    );
    priceId = price.id;
    await db.from('courses').update({ stripe_product_id: product.id, stripe_price_id: priceId }).eq('id', courseId);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      application_fee_percent: feePercent,
      transfer_data: { destination: teacherProfile.stripe_connect_account_id },
    },
    success_url: `${baseUrl}/academy/${courseId}?enrolled=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/academy/${courseId}`,
    metadata: { supabase_user_id: user.id, course_id: courseId, type: 'course_enrollment' },
  }, { stripeAccount: teacherProfile.stripe_connect_account_id });

  return NextResponse.json({ url: session.url });
}
