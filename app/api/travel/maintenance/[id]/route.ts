// app/api/travel/maintenance/[id]/route.ts
// GET: fetch single maintenance record with vehicle details

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
    .from('vehicle_maintenance')
    .select('*, vehicles(id, nickname, type)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let linked_transaction = null;
  if (data.transaction_id) {
    const { data: tx } = await db
      .from('financial_transactions')
      .select('id, amount, transaction_date, description')
      .eq('id', data.transaction_id)
      .maybeSingle();
    linked_transaction = tx;
  }

  return NextResponse.json({ maintenance: data, linked_transaction });
}
