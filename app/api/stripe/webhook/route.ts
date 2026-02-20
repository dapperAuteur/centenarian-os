// app/api/stripe/webhook/route.ts
// Handles Stripe webhook events to sync subscription state

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';
import { createShopifyPromoCode } from '@/lib/shopify/createPromoCode';

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
        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_status: 'monthly',
            stripe_subscription_id: session.subscription as string,
          })
          .eq('id', userId);
        if (error) console.error('[webhook] Failed to update monthly status for user', userId, error);
      } else if (session.mode === 'payment' && plan === 'lifetime') {
        let promoCode: string | null = null;
        try {
          promoCode = await createShopifyPromoCode();
        } catch (err) {
          console.error('[webhook] Failed to create Shopify promo code for user', userId, err);
          // Do not throw — purchase is complete; code will show as pending on billing page
        }

        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_status: 'lifetime',
            shirt_promo_code: promoCode,
            stripe_subscription_id: null,
            subscription_expires_at: null,
          })
          .eq('id', userId);
        if (error) console.error('[webhook] Failed to update lifetime status for user', userId, error);
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
        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_status: 'free',
            stripe_subscription_id: null,
            subscription_expires_at: null,
          })
          .eq('stripe_customer_id', customerId);
        if (error) console.error('[webhook] Failed to downgrade subscription for customer', customerId, error);
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
