// app/api/contractor/union/memberships/[id]/route.ts
// GET: single membership with payment history
// PATCH: update membership
// DELETE: delete membership

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
  const { data: membership, error } = await db
    .from('union_memberships')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!membership) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Get payment history
  const { data: payments } = await db
    .from('union_dues_payments')
    .select('*')
    .eq('membership_id', id)
    .eq('user_id', user.id)
    .order('payment_date', { ascending: false });

  return NextResponse.json({ membership, payments: payments ?? [] });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const allowed = [
    'union_name', 'local_number', 'member_id', 'status', 'join_date', 'expiration_date',
    'dues_amount', 'dues_frequency', 'next_dues_date', 'auto_pay',
    'initiation_fee', 'initiation_paid', 'notes',
  ];

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) {
      if (['dues_amount', 'initiation_fee'].includes(key)) {
        updates[key] = body[key] != null ? parseFloat(body[key]) : null;
      } else if (typeof body[key] === 'string' && ['union_name', 'local_number', 'member_id', 'notes'].includes(key)) {
        updates[key] = body[key].trim() || null;
      } else {
        updates[key] = body[key] ?? null;
      }
    }
  }

  const db = getDb();
  const { data, error } = await db
    .from('union_memberships')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ membership: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { error } = await db
    .from('union_memberships')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
