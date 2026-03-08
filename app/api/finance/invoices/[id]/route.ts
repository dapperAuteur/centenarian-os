// app/api/finance/invoices/[id]/route.ts
// GET: fetch single invoice with full details
// PATCH: update invoice fields, mark as paid, unmark paid/sent
// DELETE: delete invoice (only if not paid)

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
    .from('invoices')
    .select('*, invoice_items(*), budget_categories(id, name, color)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Sort line items by sort_order
  if (data.invoice_items) {
    data.invoice_items.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order);
  }

  // Fetch linked transaction details if paid
  let linked_transaction = null;
  if (data.transaction_id) {
    const { data: tx } = await db
      .from('financial_transactions')
      .select('id, amount, transaction_date, description')
      .eq('id', data.transaction_id)
      .maybeSingle();
    linked_transaction = tx;
  }

  return NextResponse.json({ invoice: data, linked_transaction });
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

  // Handle "unmark paid" — revert paid invoice
  if (body.unmark_paid) {
    if (existing.status !== 'paid') {
      return NextResponse.json({ error: 'Invoice is not paid' }, { status: 400 });
    }

    // Delete the auto-created transaction
    if (existing.transaction_id) {
      await db.from('financial_transactions').delete().eq('id', existing.transaction_id);
    }

    const revertStatus = body.revert_to || 'sent';
    const { data, error } = await db
      .from('invoices')
      .update({
        status: revertStatus,
        paid_date: null,
        amount_paid: 0,
        transaction_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, invoice_items(*)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Handle "unmark sent" — revert to draft
  if (body.unmark_sent) {
    if (existing.status !== 'sent' && existing.status !== 'overdue') {
      return NextResponse.json({ error: 'Invoice is not in sent/overdue status' }, { status: 400 });
    }

    const { data, error } = await db
      .from('invoices')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, invoice_items(*)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

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

    const lineItems = body.items.map((item: { description: string; quantity?: number; unit_price?: number; sort_order?: number; item_type?: string }) => {
      const qty = Number(item.quantity ?? 1);
      const price = Number(item.unit_price ?? 0);
      return {
        invoice_id: id,
        description: item.description,
        quantity: qty,
        unit_price: price,
        amount: Math.round(qty * price * 100) / 100,
        sort_order: item.sort_order ?? 0,
        item_type: item.item_type || 'line_item',
      };
    });

    if (lineItems.length > 0) {
      await db.from('invoice_items').insert(lineItems);
    }

    // Recalculate totals (only line_items, not benefits)
    const earnings = lineItems.filter((i: { item_type: string }) => i.item_type === 'line_item');
    const subtotal = earnings.reduce((s: number, i: { amount: number }) => s + i.amount, 0);
    body.subtotal = subtotal;
    body.total = Math.round(subtotal * 100) / 100;
    delete body.items;
  }

  // Standard field updates
  const allowed = [
    'direction', 'contact_name', 'contact_id', 'status', 'invoice_date', 'due_date',
    'invoice_number', 'invoice_number_prefix', 'account_id', 'brand_id', 'category_id', 'notes',
    'subtotal', 'tax_amount', 'total', 'amount_paid', 'custom_fields', 'job_id',
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
    .select('id, transaction_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Clean up linked transaction if exists
  if (existing.transaction_id) {
    await db.from('financial_transactions').delete().eq('id', existing.transaction_id);
  }

  const { error } = await db.from('invoices').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
