// app/api/finance/invoices/[id]/duplicate/route.ts
// POST: duplicate an invoice (copy fields + line items, reset to draft)

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

  // Fetch original invoice + items
  const { data: original, error: fetchErr } = await db
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Create duplicate invoice — reset to draft, clear payment info
  const { data: newInvoice, error: insertErr } = await db
    .from('invoices')
    .insert({
      user_id: user.id,
      direction: original.direction,
      status: 'draft',
      contact_name: original.contact_name,
      contact_id: original.contact_id,
      subtotal: original.subtotal,
      tax_amount: original.tax_amount,
      total: original.total,
      amount_paid: 0,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: null,
      paid_date: null,
      invoice_number: null,
      account_id: original.account_id,
      brand_id: original.brand_id,
      category_id: original.category_id,
      transaction_id: null,
      notes: original.notes,
    })
    .select('id')
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Copy line items
  if (original.invoice_items?.length > 0) {
    const items = original.invoice_items.map((item: { description: string; quantity: number; unit_price: number; amount: number; sort_order: number }) => ({
      invoice_id: newInvoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
      sort_order: item.sort_order,
    }));

    const { error: itemsErr } = await db.from('invoice_items').insert(items);
    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: newInvoice.id });
}
