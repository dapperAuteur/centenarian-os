// app/api/finance/transactions/[id]/route.ts
// GET: fetch single transaction with full details. When it is one side of a
//      transfer, `transfer_partner` is the other side with its account label.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { loadGroupRows } from '@/lib/finance/transfers/server';

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
    .from('financial_transactions')
    .select('*, budget_categories(id, name, color), financial_accounts(id, name, account_type, institution_name, last_four, default_return_days), user_brands(id, name)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Check if linked to an invoice
  let linked_invoice = null;
  const { data: inv } = await db
    .from('invoices')
    .select('id, invoice_number, contact_name, total, direction')
    .eq('transaction_id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  linked_invoice = inv;

  // The other side of the transfer, when this row is in one. `select('*')`
  // has no transfer_group_id before migration 202, so nothing is looked up then.
  let transfer_partner = null;
  if (data.transfer_group_id) {
    const { rows } = await loadGroupRows(db, user.id, [data.transfer_group_id]);
    transfer_partner = rows.find((row) => row.id !== id) ?? null;
  }

  return NextResponse.json({ transaction: data, linked_invoice, transfer_partner });
}
