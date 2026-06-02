// app/api/admin/promos/route.ts
// Admin CRUD for promotional campaigns.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { stripe } from '@/lib/stripe';

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
    .from('admin_promo_campaigns')
    .select('*')
    .eq('app', 'centenarian')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin || admin.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, discount_type, discount_value, plan_types, promo_code, start_date, end_date, max_uses } = body;

  if (!name || !discount_type || discount_value == null) {
    return NextResponse.json({ error: 'name, discount_type, and discount_value are required' }, { status: 400 });
  }

  const code = promo_code?.trim().toUpperCase() || null;

  // Create a Stripe coupon for monetary discounts, then (if the admin supplied
  // a code) a Stripe promotion code wrapping it so customers can type it at
  // checkout. The lifetime base price never changes — the discount lives on
  // the coupon. free_months carries no Stripe coupon (handled at checkout).
  let stripeCouponId: string | null = null;
  try {
    if (discount_type === 'percentage') {
      const coupon = await stripe.coupons.create({
        percent_off: Number(discount_value),
        duration: 'once',
        name,
      });
      stripeCouponId = coupon.id;
    } else if (discount_type === 'fixed') {
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(Number(discount_value) * 100),
        currency: 'usd',
        duration: 'once',
        name,
      });
      stripeCouponId = coupon.id;
    }
    if (stripeCouponId && code) {
      await stripe.promotionCodes.create({ promotion: { type: 'coupon', coupon: stripeCouponId }, code });
    }
  } catch {
    // Stripe coupon/promotion-code creation failed — proceed without it.
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from('admin_promo_campaigns')
    .insert({
      app: 'centenarian',
      name,
      description: description || null,
      discount_type,
      discount_value: Number(discount_value),
      stripe_coupon_id: stripeCouponId,
      plan_types: plan_types || ['lifetime'],
      promo_code: code,
      start_date: start_date || new Date().toISOString(),
      end_date: end_date || null,
      max_uses: max_uses || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin || admin.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, is_active, end_date, max_uses } = await request.json();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const db = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (is_active !== undefined) updates.is_active = is_active;
  if (end_date !== undefined) updates.end_date = end_date;
  if (max_uses !== undefined) updates.max_uses = max_uses;

  const { data, error } = await db
    .from('admin_promo_campaigns')
    .update(updates)
    .eq('id', id)
    .eq('app', 'centenarian')
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Soft-delete (deactivate) a campaign. Scoped to app='centenarian' so a CentOS
// admin can never deactivate a contractor campaign in the shared table.
export async function DELETE(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin || admin.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const db = getServiceClient();
  const { error } = await db
    .from('admin_promo_campaigns')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('app', 'centenarian');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
