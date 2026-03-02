// app/api/finance/transactions/[id]/duplicate/route.ts
// POST: duplicate a transaction (copy fields, reset to today)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  const { data: original, error: fetchErr } = await db
    .from('financial_transactions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: newTx, error: insertErr } = await db
    .from('financial_transactions')
    .insert({
      user_id: user.id,
      amount: original.amount,
      type: original.type,
      description: original.description,
      vendor: original.vendor,
      transaction_date: new Date().toISOString().split('T')[0],
      source: 'manual',
      category_id: original.category_id,
      account_id: original.account_id,
      brand_id: original.brand_id,
      tags: original.tags,
      notes: original.notes,
    })
    .select('id')
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ id: newTx.id });
}
