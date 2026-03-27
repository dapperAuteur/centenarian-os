// app/api/admin/cashapp/route.ts
// GET: List all CashApp payments (admin only).
// PATCH: Approve or reject a CashApp payment.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createShopifyPromoCode } from '@/lib/shopify/createPromoCode';
import { logInfo, logError } from '@/lib/logging';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function getAdminUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => { try { cookieStore.set({ name, value, ...options }); } catch {} },
        remove: (name: string, options: CookieOptions) => { try { cookieStore.set({ name, value: '', ...options }); } catch {} },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin || admin.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from('cashapp_payments')
    .select(`
      id, user_id, amount, cashapp_name, screenshot_url, status,
      admin_notes, verified_at, created_at
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with user emails
  const userIds = [...new Set((data ?? []).map((p) => p.user_id))];
  const { data: profiles } = await db
    .from('profiles')
    .select('id, email, subscription_status')
    .in('id', userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const enriched = (data ?? []).map((p) => ({
    ...p,
    email: profileMap.get(p.user_id)?.email ?? null,
    current_status: profileMap.get(p.user_id)?.subscription_status ?? 'free',
  }));

  return NextResponse.json(enriched);
}

export async function PATCH(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin || admin.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, action, admin_notes } = await request.json();
  if (!id || !['verify', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const db = getServiceClient();

  // Fetch the payment
  const { data: payment } = await db
    .from('cashapp_payments')
    .select('id, user_id, status')
    .eq('id', id)
    .maybeSingle();

  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  if (payment.status !== 'pending') {
    return NextResponse.json({ error: 'Payment already processed' }, { status: 400 });
  }

  const newStatus = action === 'verify' ? 'verified' : 'rejected';

  // Update payment status
  const { error: updateErr } = await db
    .from('cashapp_payments')
    .update({
      status: newStatus,
      admin_notes: admin_notes || null,
      verified_by: admin.id,
      verified_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // If verified, activate lifetime membership
  if (action === 'verify') {
    let promoCode: string | null = null;
    try {
      promoCode = await createShopifyPromoCode();
    } catch (err) {
      logError({ source: 'admin', module: 'cashapp', message: 'Failed to create Shopify promo code', metadata: { error: err instanceof Error ? err.message : String(err) }, userId: payment.user_id });
    }

    const { error: profileErr } = await db
      .from('profiles')
      .update({
        subscription_status: 'lifetime',
        shirt_promo_code: promoCode,
        stripe_subscription_id: null,
        subscription_expires_at: null,
      })
      .eq('id', payment.user_id);

    if (profileErr) {
      logError({ source: 'admin', module: 'cashapp', message: 'Failed to activate lifetime', metadata: { error: profileErr.message }, userId: payment.user_id });
      return NextResponse.json({ error: 'Payment verified but membership activation failed' }, { status: 500 });
    }

    logInfo({ source: 'admin', module: 'cashapp', message: 'CashApp payment verified — lifetime activated', metadata: { paymentId: id }, userId: payment.user_id });
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
