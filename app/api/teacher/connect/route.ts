// app/api/teacher/connect/route.ts
// Creates or returns a Stripe Connect Express onboarding link for the current teacher.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify teacher role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'teacher' && user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Teacher account required' }, { status: 403 });
  }

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Get or create Stripe Connect account
  const { data: teacherProfile } = await db
    .from('teacher_profiles')
    .select('stripe_connect_account_id, stripe_connect_onboarded')
    .eq('user_id', user.id)
    .maybeSingle();

  let accountId = teacherProfile?.stripe_connect_account_id;

  async function createLiveModeAccount() {
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email!,
      metadata: { supabase_user_id: user.id },
    });
    await db
      .from('teacher_profiles')
      .upsert(
        { user_id: user.id, stripe_connect_account_id: account.id, stripe_connect_onboarded: false },
        { onConflict: 'user_id' },
      );
    return account.id;
  }

  if (!accountId) {
    accountId = await createLiveModeAccount();
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.headers.get('origin') ?? 'http://localhost:3000';

  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/dashboard/teaching/payouts?refresh=true`,
      return_url: `${baseUrl}/dashboard/teaching/payouts?connected=true`,
      type: 'account_onboarding',
    });
    return NextResponse.json({ url: accountLink.url });
  } catch (err: unknown) {
    // Stale test-mode account stored — clear it and create a fresh live-mode account
    const isTestModeConflict =
      typeof err === 'object' &&
      err !== null &&
      'type' in err &&
      (err as { type: string }).type === 'StripeInvalidRequestError';

    if (isTestModeConflict) {
      accountId = await createLiveModeAccount();
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${baseUrl}/dashboard/teaching/payouts?refresh=true`,
        return_url: `${baseUrl}/dashboard/teaching/payouts?connected=true`,
        type: 'account_onboarding',
      });
      return NextResponse.json({ url: accountLink.url });
    }

    throw err;
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data } = await db
    .from('teacher_profiles')
    .select('stripe_connect_account_id, stripe_connect_onboarded')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data?.stripe_connect_account_id) {
    return NextResponse.json({ connected: false, onboarded: false });
  }

  // Check live status from Stripe if not yet marked onboarded
  if (!data.stripe_connect_onboarded) {
    try {
      const account = await stripe.accounts.retrieve(data.stripe_connect_account_id);
      const onboarded = !!(account.details_submitted && account.charges_enabled);

      if (onboarded) {
        await db
          .from('teacher_profiles')
          .update({ stripe_connect_onboarded: true })
          .eq('user_id', user.id);
      }

      return NextResponse.json({ connected: true, onboarded });
    } catch {
      // Stale test-mode account — treat as not yet connected so POST can recreate it
      return NextResponse.json({ connected: false, onboarded: false });
    }
  }

  return NextResponse.json({ connected: true, onboarded: true });
}
