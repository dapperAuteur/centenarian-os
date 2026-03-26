// app/api/schedules/[id]/pay-periods/[periodId]/line-items/route.ts
// CRUD for paycheck line items (earnings, taxes, deductions, benefits)
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

type Params = { params: Promise<{ id: string; periodId: string }> };

async function verifyOwnership(db: ReturnType<typeof getDb>, templateId: string, periodId: string, userId: string) {
  const { data } = await db
    .from('schedule_templates')
    .select('id')
    .eq('id', templateId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return false;

  const { data: period } = await db
    .from('schedule_pay_periods')
    .select('id')
    .eq('id', periodId)
    .eq('template_id', templateId)
    .maybeSingle();
  return !!period;
}

/** GET — list line items for a pay period */
export async function GET(request: NextRequest, { params }: Params) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, periodId } = await params;
  const db = getDb();

  if (!(await verifyOwnership(db, id, periodId, user.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data, error } = await db
    .from('paycheck_line_items')
    .select('*')
    .eq('pay_period_id', periodId)
    .order('line_type')
    .order('sort_order');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST — create line items (single or bulk array) */
export async function POST(request: NextRequest, { params }: Params) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, periodId } = await params;
  const db = getDb();

  if (!(await verifyOwnership(db, id, periodId, user.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const items = Array.isArray(body) ? body : body.items || [body];

  const rows = items.map((item: Record<string, unknown>, i: number) => ({
    pay_period_id: periodId,
    line_type: item.line_type,
    description: item.description,
    rate: item.rate || null,
    hours: item.hours || null,
    amount: item.amount,
    ytd_amount: item.ytd_amount || null,
    is_pretax: item.is_pretax || false,
    sort_order: item.sort_order ?? i,
  }));

  const { data, error } = await db
    .from('paycheck_line_items')
    .insert(rows)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also save line item descriptions as templates on the schedule finance row
  // so they persist for future pay periods
  if (body.save_as_template) {
    const templates = items.map((item: Record<string, unknown>) => ({
      line_type: item.line_type,
      description: item.description,
      rate: item.rate || null,
      hours: item.hours || null,
      is_pretax: item.is_pretax || false,
    }));

    await db
      .from('schedule_template_finance')
      .update({ line_item_templates: templates })
      .eq('template_id', id);
  }

  return NextResponse.json(data, { status: 201 });
}

/** PATCH — update a single line item */
export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, periodId } = await params;
  const db = getDb();

  if (!(await verifyOwnership(db, id, periodId, user.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  if (!body.line_item_id) return NextResponse.json({ error: 'line_item_id required' }, { status: 400 });

  const allowed = ['line_type', 'description', 'rate', 'hours', 'amount', 'ytd_amount', 'is_pretax', 'sort_order'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await db
    .from('paycheck_line_items')
    .update(updates)
    .eq('id', body.line_item_id)
    .eq('pay_period_id', periodId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE — remove a line item (or all for a period) */
export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, periodId } = await params;
  const { searchParams } = new URL(request.url);
  const lineItemId = searchParams.get('line_item_id');

  const db = getDb();

  if (!(await verifyOwnership(db, id, periodId, user.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (lineItemId) {
    const { error } = await db
      .from('paycheck_line_items')
      .delete()
      .eq('id', lineItemId)
      .eq('pay_period_id', periodId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // Delete all line items for period
    const { error } = await db
      .from('paycheck_line_items')
      .delete()
      .eq('pay_period_id', periodId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
