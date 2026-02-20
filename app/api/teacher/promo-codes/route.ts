// app/api/teacher/promo-codes/route.ts
// GET: list teacher's promo codes
// POST: create a new promo code (creates a Stripe coupon)
// DELETE: ?id=<id> deletes a promo code

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

async function getTeacher(userId: string, userEmail: string | undefined) {
  const db = getDb();
  const { data: profile } = await db.from('profiles').select('role').eq('id', userId).single();
  if (profile?.role !== 'teacher' && userEmail !== process.env.ADMIN_EMAIL) {
    return null;
  }
  return profile;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!await getTeacher(user.id, user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('promo_codes')
    .select('id, code, discount_percent, max_uses, uses_count, expires_at, created_at, stripe_coupon_id')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!await getTeacher(user.id, user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { code, discount_percent, max_uses, expires_at } = await request.json();

  if (!code?.trim()) return NextResponse.json({ error: 'Code required' }, { status: 400 });
  if (!discount_percent || discount_percent < 1 || discount_percent > 100) {
    return NextResponse.json({ error: 'discount_percent must be 1–100' }, { status: 400 });
  }

  // Create Stripe coupon
  const couponParams: Record<string, unknown> = {
    percent_off: discount_percent,
    duration: 'once',
    name: code.trim().toUpperCase(),
    id: `TEACHER_${user.id.slice(0, 8)}_${code.trim().toUpperCase()}`,
  };
  if (max_uses) couponParams.max_redemptions = max_uses;
  if (expires_at) couponParams.redeem_by = Math.floor(new Date(expires_at).getTime() / 1000);

  let stripeCouponId: string;
  try {
    const coupon = await stripe.coupons.create(couponParams);
    stripeCouponId = coupon.id;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const db = getDb();
  const { data, error } = await db
    .from('promo_codes')
    .insert({
      teacher_id: user.id,
      code: code.trim().toUpperCase(),
      stripe_coupon_id: stripeCouponId,
      discount_percent,
      max_uses: max_uses ?? null,
      expires_at: expires_at ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!await getTeacher(user.id, user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = getDb();
  const { data: promo } = await db
    .from('promo_codes')
    .select('stripe_coupon_id, teacher_id')
    .eq('id', id)
    .eq('teacher_id', user.id)
    .single();

  if (!promo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Delete Stripe coupon
  try {
    await stripe.coupons.del(promo.stripe_coupon_id);
  } catch {
    // ignore if already deleted in Stripe
  }

  await db.from('promo_codes').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
