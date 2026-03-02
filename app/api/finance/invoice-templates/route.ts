// app/api/finance/invoice-templates/route.ts
// GET: list invoice templates
// POST: create template OR create invoice from template

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: templates, error } = await db
    .from('invoice_templates')
    .select('*, invoice_template_items(*)')
    .eq('user_id', user.id)
    .order('use_count', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sort items by sort_order
  for (const t of templates ?? []) {
    if (t.invoice_template_items) {
      t.invoice_template_items.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order);
    }
  }

  return NextResponse.json({ templates: templates ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const body = await request.json();

  // Mode: create invoice FROM template
  if (body.from_template_id) {
    const { data: template, error: tErr } = await db
      .from('invoice_templates')
      .select('*, invoice_template_items(*)')
      .eq('id', body.from_template_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    // Create invoice from template
    const { data: invoice, error: iErr } = await db
      .from('invoices')
      .insert({
        user_id: user.id,
        direction: template.direction,
        status: 'draft',
        contact_name: template.contact_name ?? '',
        contact_id: template.contact_id,
        subtotal: template.subtotal,
        tax_amount: template.tax_amount,
        total: template.total,
        amount_paid: 0,
        invoice_date: new Date().toISOString().split('T')[0],
        account_id: template.account_id,
        brand_id: template.brand_id,
        category_id: template.category_id,
        notes: template.notes,
      })
      .select('id')
      .single();

    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

    // Copy template items
    if (template.invoice_template_items?.length > 0) {
      const items = template.invoice_template_items.map((item: { description: string; quantity: number; unit_price: number; amount: number; sort_order: number }) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
        sort_order: item.sort_order,
      }));
      await db.from('invoice_items').insert(items);
    }

    // Increment use_count
    await db.from('invoice_templates').update({ use_count: template.use_count + 1 }).eq('id', template.id);

    return NextResponse.json({ id: invoice.id });
  }

  // Mode: create new template
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
  }

  const { data: newTemplate, error: createErr } = await db
    .from('invoice_templates')
    .insert({
      user_id: user.id,
      name: body.name.trim(),
      direction: body.direction || 'receivable',
      contact_name: body.contact_name || null,
      contact_id: body.contact_id || null,
      subtotal: body.subtotal ?? 0,
      tax_amount: body.tax_amount ?? 0,
      total: body.total ?? 0,
      account_id: body.account_id || null,
      brand_id: body.brand_id || null,
      category_id: body.category_id || null,
      notes: body.notes || null,
    })
    .select('id')
    .single();

  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });

  // Insert template items
  if (body.items?.length > 0) {
    const items = body.items.map((item: { description: string; quantity?: number; unit_price?: number; amount?: number; sort_order?: number }, idx: number) => ({
      template_id: newTemplate.id,
      description: item.description || '',
      quantity: item.quantity ?? 1,
      unit_price: item.unit_price ?? 0,
      amount: item.amount ?? 0,
      sort_order: item.sort_order ?? idx,
    }));
    await db.from('invoice_template_items').insert(items);
  }

  return NextResponse.json({ id: newTemplate.id });
}
