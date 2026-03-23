// app/api/schedules/[id]/expenses/route.ts
// Link/unlink financial transactions as job expenses
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
 * GET /api/schedules/[id]/expenses
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  // Verify ownership
  const { data: template } = await db
    .from('schedule_templates')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await db
    .from('schedule_expenses')
    .select(`
      *,
      transaction:financial_transactions(
        id, amount, type, description, vendor, transaction_date, category_id
      )
    `)
    .eq('template_id', id)
    .order('expense_date', { ascending: false });

  if (error) {
    console.error('[Schedule Expenses] GET failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/schedules/[id]/expenses
 * Link a financial transaction as a job expense
 * Body: { transaction_id, expense_date?, description?, is_deductible? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  if (!body.transaction_id) {
    return NextResponse.json({ error: 'transaction_id required' }, { status: 400 });
  }

  const db = getDb();

  // Verify template ownership
  const { data: template } = await db
    .from('schedule_templates')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Verify transaction exists and belongs to user
  const { data: txn } = await db
    .from('financial_transactions')
    .select('id, transaction_date')
    .eq('id', body.transaction_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!txn) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

  const { data, error } = await db
    .from('schedule_expenses')
    .insert([{
      template_id: id,
      transaction_id: body.transaction_id,
      expense_date: body.expense_date || txn.transaction_date,
      description: body.description || null,
      is_deductible: body.is_deductible || false,
    }])
    .select()
    .single();

  if (error) {
    console.error('[Schedule Expenses] POST failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

/**
 * DELETE /api/schedules/[id]/expenses?expense_id=xxx
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const expenseId = searchParams.get('expense_id');

  if (!expenseId) return NextResponse.json({ error: 'expense_id required' }, { status: 400 });

  const db = getDb();

  // Verify ownership
  const { data: template } = await db
    .from('schedule_templates')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await db
    .from('schedule_expenses')
    .delete()
    .eq('id', expenseId)
    .eq('template_id', id);

  if (error) {
    console.error('[Schedule Expenses] DELETE failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
