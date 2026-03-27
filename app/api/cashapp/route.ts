// app/api/cashapp/route.ts
// POST: Submit a CashApp lifetime payment for admin verification.
// GET: Get current user's CashApp payment status.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data } = await db
    .from('cashapp_payments')
    .select('id, amount, cashapp_name, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json(data ?? null);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Check if user already has lifetime
  const { data: profile } = await db
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single();

  if (profile?.subscription_status === 'lifetime') {
    return NextResponse.json({ error: 'Already a lifetime member' }, { status: 400 });
  }

  // Check for existing pending payment
  const { data: existing } = await db
    .from('cashapp_payments')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'You already have a pending CashApp payment' }, { status: 400 });
  }

  const { cashapp_name, screenshot_url } = await request.json();

  const { data: payment, error } = await db
    .from('cashapp_payments')
    .insert({
      user_id: user.id,
      amount: 100.00,
      cashapp_name: cashapp_name?.trim() || null,
      screenshot_url: screenshot_url?.trim() || null,
    })
    .select('id, status, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(payment, { status: 201 });
}
