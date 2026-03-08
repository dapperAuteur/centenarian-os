// app/api/contractor/union/memberships/[id]/payments/route.ts
// GET: list payments for a membership
// POST: record a dues payment

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data, error } = await db
    .from('union_dues_payments')
    .select('*')
    .eq('membership_id', id)
    .eq('user_id', user.id)
    .order('payment_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { amount, payment_date, period_start, period_end, payment_method, confirmation_number, notes } = body;

  if (!amount || !payment_date) {
    return NextResponse.json({ error: 'amount and payment_date required' }, { status: 400 });
  }

  const db = getDb();

  // Verify ownership
  const { data: membership } = await db
    .from('union_memberships')
    .select('id, next_dues_date, dues_frequency, dues_amount')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return NextResponse.json({ error: 'Membership not found' }, { status: 404 });

  // Insert payment
  const { data: payment, error } = await db
    .from('union_dues_payments')
    .insert({
      membership_id: id,
      user_id: user.id,
      amount: parseFloat(amount),
      payment_date,
      period_start: period_start || null,
      period_end: period_end || null,
      payment_method: payment_method?.trim() || null,
      confirmation_number: confirmation_number?.trim() || null,
      notes: notes?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-advance next_dues_date if it matches or is past
  if (membership.next_dues_date) {
    const nextDue = new Date(membership.next_dues_date);
    const payDate = new Date(payment_date);
    if (payDate >= nextDue) {
      const freq = membership.dues_frequency || 'quarterly';
      const months: Record<string, number> = { monthly: 1, quarterly: 3, semi_annual: 6, annual: 12 };
      const advanceMonths = months[freq] ?? 3;
      const newNext = new Date(nextDue);
      newNext.setMonth(newNext.getMonth() + advanceMonths);
      await db.from('union_memberships').update({
        next_dues_date: newNext.toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      }).eq('id', id);
    }
  }

  return NextResponse.json({ payment }, { status: 201 });
}
