// app/api/finance/accounts/[id]/unlink-teller/route.ts
// POST: Unlink a Teller connection from an account.
// Clears teller fields but preserves all transactions.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  const { data: acct } = await db
    .from('financial_accounts')
    .select('user_id, teller_account_id')
    .eq('id', id)
    .maybeSingle();

  if (!acct || acct.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!acct.teller_account_id) {
    return NextResponse.json({ error: 'Account is not linked to Teller' }, { status: 400 });
  }

  const { error } = await db
    .from('financial_accounts')
    .update({
      teller_enrollment_id: null,
      teller_account_id: null,
      last_synced_at: null,
      oldest_transaction_date: null,
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
