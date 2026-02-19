// app/api/stripe/webhook/route.ts
// Handles Stripe webhook events to sync subscription state

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';

// Service-role client bypasses RLS — only used server-side in this webhook
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = getServiceClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.supabase_user_id;
      const plan = session.metadata?.plan;

      if (!userId) break;

      if (session.mode === 'subscription' && plan === 'monthly') {
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'monthly',
            stripe_subscription_id: session.subscription as string,
          })
          .eq('id', userId);
      } else if (session.mode === 'payment' && plan === 'lifetime') {
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'lifetime',
            shirt_promo_code: process.env.SHIRT_PROMO_CODE ?? null,
            stripe_subscription_id: null,
            subscription_expires_at: null,
          })
          .eq('id', userId);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      // Downgrade to free unless they have a lifetime membership
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_status')
        .eq('stripe_customer_id', customerId)
        .single();

      if (profile && profile.subscription_status !== 'lifetime') {
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'free',
            stripe_subscription_id: null,
            subscription_expires_at: null,
          })
          .eq('stripe_customer_id', customerId);
      }
      break;
    }

    case 'invoice.payment_failed': {
      // Stripe handles dunning automatically; downgrade happens via subscription.deleted
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
