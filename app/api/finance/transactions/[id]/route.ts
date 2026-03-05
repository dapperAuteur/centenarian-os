// app/api/finance/transactions/[id]/route.ts
// GET: fetch single transaction with full details

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
    .from('financial_transactions')
    .select('*, budget_categories(id, name, color), financial_accounts(id, name, account_type, default_return_days), user_brands(id, name)')
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

  return NextResponse.json({ transaction: data, linked_invoice });
}
