// app/api/stripe/academy-webhook/route.ts
// Stripe Connect webhook for course enrollment events.
// This receives events forwarded from connected accounts (teachers).
// Configure in Stripe: Connect webhooks → checkout.session.completed, customer.subscription.deleted

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  // If the secret isn't configured yet, skip verification (not yet set up in Stripe)
  const webhookSecret = process.env.STRIPE_ACADEMY_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook verification failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const db = getDb();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.supabase_user_id;
      const courseId = session.metadata?.course_id;
      const type = session.metadata?.type;

      if (type !== 'course_enrollment' || !userId || !courseId) break;

      if (session.status !== 'complete') break;

      const { error } = await db
        .from('enrollments')
        .upsert({
          user_id: userId,
          course_id: courseId,
          stripe_checkout_session_id: session.id,
          status: 'active',
        }, { onConflict: 'user_id,course_id' });

      if (error) console.error('[academy-webhook] Enrollment upsert failed:', error);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      // Find the course associated with this subscription's price
      const priceId = sub.items?.data?.[0]?.price?.id;
      if (!priceId) break;

      const { data: course } = await db
        .from('courses')
        .select('id')
        .eq('stripe_price_id', priceId)
        .maybeSingle();

      if (!course) break;

      // Find the customer's user_id
      const { data: profile } = await db
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', sub.customer as string)
        .maybeSingle();

      if (!profile) break;

      await db
        .from('enrollments')
        .update({ status: 'cancelled' })
        .eq('user_id', profile.id)
        .eq('course_id', course.id);

      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
