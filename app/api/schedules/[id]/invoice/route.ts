// app/api/schedules/[id]/invoice/route.ts
// Convert a pay period into an invoice
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function authorize() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * POST /api/schedules/[id]/invoice
 * Convert pay period → invoice
 * Body: { pay_period_id }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  if (!body.pay_period_id) {
    return NextResponse.json({ error: 'pay_period_id required' }, { status: 400 });
  }

  const db = getDb();

  // Fetch template + finance + pay period
  const { data: template } = await db
    .from('schedule_templates')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: finance } = await db
    .from('schedule_template_finance')
    .select('*')
    .eq('template_id', id)
    .maybeSingle();

  if (!finance) {
    return NextResponse.json({ error: 'No finance configuration' }, { status: 400 });
  }

  const { data: payPeriod } = await db
    .from('schedule_pay_periods')
    .select('*')
    .eq('id', body.pay_period_id)
    .eq('template_id', id)
    .maybeSingle();

  if (!payPeriod) {
    return NextResponse.json({ error: 'Pay period not found' }, { status: 404 });
  }

  // Build invoice line items
  const items: { description: string; quantity: number; unit_price: number; amount: number; sort_order: number; item_type: string }[] = [];
  let sortOrder = 0;

  // Main work line item
  const payableDays = payPeriod.days_worked + payPeriod.days_paid_off;
  const rateLabel = finance.rate_type === 'hourly'
    ? `${finance.hours_per_day || 8}h/day @ $${finance.pay_rate}/hr`
    : `$${finance.pay_rate}/${finance.rate_type}`;

  items.push({
    description: `${template.name} — ${payPeriod.period_start} to ${payPeriod.period_end} (${rateLabel})`,
    quantity: payableDays,
    unit_price: finance.rate_type === 'hourly'
      ? finance.pay_rate * (finance.hours_per_day || 8)
      : finance.pay_rate,
    amount: payPeriod.estimated_gross || 0,
    sort_order: sortOrder++,
    item_type: 'line_item',
  });

  // Per diem line item
  if (finance.per_diem_amount && payPeriod.per_diem_total) {
    items.push({
      description: 'Per Diem',
      quantity: payableDays,
      unit_price: finance.per_diem_amount,
      amount: payPeriod.per_diem_total,
      sort_order: sortOrder++,
      item_type: 'line_item',
    });
  }

  // Travel income line item
  if (finance.travel_income_amount && payPeriod.travel_income_total) {
    items.push({
      description: 'Travel Reimbursement',
      quantity: payableDays,
      unit_price: finance.travel_income_amount,
      amount: payPeriod.travel_income_total,
      sort_order: sortOrder++,
      item_type: 'line_item',
    });
  }

  // Deductions as benefit items
  const deductions = finance.deductions || [];
  for (const ded of deductions) {
    items.push({
      description: ded.label,
      quantity: 1,
      unit_price: -ded.amount,
      amount: -ded.amount,
      sort_order: sortOrder++,
      item_type: 'benefit',
    });
  }

  const subtotal = items
    .filter(i => i.item_type === 'line_item')
    .reduce((sum, i) => sum + i.amount, 0);
  const total = items.reduce((sum, i) => sum + i.amount, 0);

  // Create invoice
  let invoiceNumber: string | undefined;
  if (finance.invoice_template_id) {
    // Get next invoice number from template prefix
    const { data: tmpl } = await db
      .from('invoice_templates')
      .select('invoice_number_prefix')
      .eq('id', finance.invoice_template_id)
      .maybeSingle();

    if (tmpl?.invoice_number_prefix) {
      const prefix = tmpl.invoice_number_prefix;
      const { count } = await db
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .like('invoice_number', `${prefix}-%`);
      invoiceNumber = `${prefix}-${String((count || 0) + 1).padStart(3, '0')}`;
    }
  }

  const { data: invoice, error: invError } = await db
    .from('invoices')
    .insert([{
      user_id: user.id,
      direction: 'receivable',
      status: 'draft',
      contact_name: finance.invoice_contact_id ? undefined : template.name,
      contact_id: finance.invoice_contact_id || null,
      subtotal: Math.round(subtotal * 100) / 100,
      tax_amount: 0,
      total: Math.round(total * 100) / 100,
      amount_paid: 0,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: payPeriod.period_end,
      invoice_number: invoiceNumber || null,
      account_id: finance.pay_account_id || null,
      category_id: finance.pay_category_id || null,
      custom_fields: {
        schedule_name: template.name,
        period_start: payPeriod.period_start,
        period_end: payPeriod.period_end,
        days_worked: payPeriod.days_worked,
        schedule_template_id: id,
      },
      notes: `Generated from schedule "${template.name}" for period ${payPeriod.period_start} to ${payPeriod.period_end}`,
    }])
    .select()
    .single();

  if (invError) {
    console.error('[Schedule Invoice] Create failed:', invError);
    return NextResponse.json({ error: invError.message }, { status: 500 });
  }

  // Create invoice items
  const invoiceItems = items.map(item => ({
    invoice_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    amount: item.amount,
    sort_order: item.sort_order,
    item_type: item.item_type,
  }));

  const { error: itemsError } = await db
    .from('invoice_items')
    .insert(invoiceItems);

  if (itemsError) {
    console.error('[Schedule Invoice] Items creation failed:', itemsError);
  }

  return NextResponse.json({
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    total: invoice.total,
    items_count: items.length,
  }, { status: 201 });
}
