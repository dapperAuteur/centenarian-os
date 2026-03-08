// app/api/finance/invoices/route.ts
// GET: list invoices with filters (direction, status)
// POST: create invoice with line items

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = request.nextUrl;
  const direction = url.searchParams.get('direction'); // receivable | payable
  const status = url.searchParams.get('status'); // draft | sent | paid | overdue | cancelled
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);
  const offset = Number(url.searchParams.get('offset') ?? 0);

  const db = getDb();
  let query = db
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('user_id', user.id)
    .order('invoice_date', { ascending: false })
    .range(offset, offset + limit - 1);

  const jobId = url.searchParams.get('job_id');

  if (direction) query = query.eq('direction', direction);
  if (status) query = query.eq('status', status);
  if (jobId) query = query.eq('job_id', jobId);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ invoices: data ?? [], count });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    direction, contact_name, contact_id, invoice_date, due_date,
    invoice_number, account_id, brand_id, category_id, notes, job_id,
    items = [],
  } = body;

  if (!direction || !contact_name?.trim()) {
    return NextResponse.json({ error: 'direction and contact_name are required' }, { status: 400 });
  }

  // Calculate totals from line items
  const lineItems = items.map((item: { description: string; quantity?: number; unit_price?: number; sort_order?: number }) => {
    const qty = Number(item.quantity ?? 1);
    const price = Number(item.unit_price ?? 0);
    return {
      description: item.description,
      quantity: qty,
      unit_price: price,
      amount: Math.round(qty * price * 100) / 100,
      sort_order: item.sort_order ?? 0,
    };
  });

  const subtotal = lineItems.reduce((s: number, i: { amount: number }) => s + i.amount, 0);
  const total = Math.round(subtotal * 100) / 100;

  const db = getDb();
  const { data: invoice, error } = await db
    .from('invoices')
    .insert({
      user_id: user.id,
      direction,
      status: 'draft',
      contact_name: contact_name.trim(),
      contact_id: contact_id ?? null,
      subtotal,
      tax_amount: 0,
      total,
      invoice_date: invoice_date ?? new Date().toISOString().split('T')[0],
      due_date: due_date ?? null,
      invoice_number: invoice_number ?? null,
      account_id: account_id ?? null,
      brand_id: brand_id ?? null,
      category_id: category_id ?? null,
      notes: notes ?? null,
      job_id: job_id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert line items
  if (lineItems.length > 0) {
    const { error: itemError } = await db
      .from('invoice_items')
      .insert(lineItems.map((item: { description: string; quantity: number; unit_price: number; amount: number; sort_order: number }) => ({
        ...item,
        invoice_id: invoice.id,
      })));

    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });
  }

  // Fetch the invoice with items
  const { data: full } = await db
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('id', invoice.id)
    .single();

  return NextResponse.json(full, { status: 201 });
}
