// app/api/finance/invoices/[id]/route.ts
// PATCH: update invoice fields, mark as paid (auto-creates transaction)
// DELETE: delete invoice (only if draft or cancelled)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Verify ownership
  const { data: existing } = await db
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();

  // Handle "mark as paid" action
  if (body.mark_paid) {
    const paidDate = body.paid_date ?? new Date().toISOString().split('T')[0];
    const updates: Record<string, unknown> = {
      status: 'paid',
      paid_date: paidDate,
      amount_paid: existing.total,
      updated_at: new Date().toISOString(),
    };

    // Auto-create a financial transaction
    const txType = existing.direction === 'receivable' ? 'income' : 'expense';
    const { data: tx, error: txError } = await db
      .from('financial_transactions')
      .insert({
        user_id: user.id,
        amount: existing.total,
        type: txType,
        description: `Invoice ${existing.invoice_number || '#' + existing.id.slice(0, 8)} — ${existing.contact_name}`,
        vendor: existing.contact_name,
        transaction_date: paidDate,
        source: 'manual',
        category_id: existing.category_id,
        account_id: existing.account_id ?? body.account_id ?? null,
        brand_id: existing.brand_id,
      })
      .select('id')
      .single();

    if (txError) return NextResponse.json({ error: txError.message }, { status: 500 });

    updates.transaction_id = tx.id;
    if (body.account_id && !existing.account_id) updates.account_id = body.account_id;

    const { data, error } = await db
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .select('*, invoice_items(*)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Handle line items update
  if (body.items) {
    // Delete existing items and re-insert
    await db.from('invoice_items').delete().eq('invoice_id', id);

    const lineItems = body.items.map((item: { description: string; quantity?: number; unit_price?: number; sort_order?: number }) => {
      const qty = Number(item.quantity ?? 1);
      const price = Number(item.unit_price ?? 0);
      return {
        invoice_id: id,
        description: item.description,
        quantity: qty,
        unit_price: price,
        amount: Math.round(qty * price * 100) / 100,
        sort_order: item.sort_order ?? 0,
      };
    });

    if (lineItems.length > 0) {
      await db.from('invoice_items').insert(lineItems);
    }

    // Recalculate totals
    const subtotal = lineItems.reduce((s: number, i: { amount: number }) => s + i.amount, 0);
    body.subtotal = subtotal;
    body.total = Math.round(subtotal * 100) / 100;
    delete body.items;
  }

  // Standard field updates
  const allowed = [
    'contact_name', 'contact_id', 'status', 'invoice_date', 'due_date',
    'invoice_number', 'account_id', 'brand_id', 'category_id', 'notes',
    'subtotal', 'tax_amount', 'total', 'amount_paid',
  ];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Auto-mark overdue
  if (body.status === 'sent' && existing.due_date && new Date(existing.due_date) < new Date()) {
    updates.status = 'overdue';
  }

  const { data, error } = await db
    .from('invoices')
    .update(updates)
    .eq('id', id)
    .select('*, invoice_items(*)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
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

  const { data: existing } = await db
    .from('invoices')
    .select('status')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (existing.status === 'paid') {
    return NextResponse.json({ error: 'Cannot delete a paid invoice' }, { status: 400 });
  }

  const { error } = await db.from('invoices').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
