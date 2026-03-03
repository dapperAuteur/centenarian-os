// app/api/finance/invoice-templates/[id]/route.ts
// PATCH: update template
// DELETE: delete template

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
  const body = await request.json();

  const allowed = [
    'name', 'direction', 'contact_name', 'contact_id',
    'subtotal', 'tax_amount', 'total',
    'account_id', 'brand_id', 'category_id', 'notes',
    'invoice_number_prefix', 'custom_fields',
  ];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Handle line items update (delete-and-reinsert)
  if (body.items) {
    await db.from('invoice_template_items').delete().eq('template_id', id);

    const lineItems = body.items.map((item: { description: string; quantity?: number; unit_price?: number; sort_order?: number; item_type?: string }, idx: number) => {
      const qty = Number(item.quantity ?? 1);
      const price = Number(item.unit_price ?? 0);
      return {
        template_id: id,
        description: item.description || '',
        quantity: qty,
        unit_price: price,
        amount: Math.round(qty * price * 100) / 100,
        sort_order: item.sort_order ?? idx,
        item_type: item.item_type || 'line_item',
      };
    });

    if (lineItems.length > 0) {
      await db.from('invoice_template_items').insert(lineItems);
    }

    // Recalculate totals (only line_items, not benefits)
    const earnings = lineItems.filter((i: { item_type: string }) => i.item_type === 'line_item');
    const subtotal = earnings.reduce((s: number, i: { amount: number }) => s + i.amount, 0);
    updates.subtotal = subtotal;
    updates.total = Math.round(subtotal * 100) / 100;
    delete body.items;
  }

  const { data, error } = await db
    .from('invoice_templates')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*, invoice_template_items(*)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sort items
  if (data.invoice_template_items) {
    data.invoice_template_items.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order);
  }

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
  const { error } = await db
    .from('invoice_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
