// app/api/finance/transactions/route.ts
// GET: list transactions with filters (date range, category, type). A row that is one
//      side of a transfer comes with `transfer_partner`: the other side and its account.
// POST: create a new transaction (fills a missing category from the vendor's learned category)
// PATCH: update a transaction. One side of a transfer can't change its amount or type alone.
// DELETE: delete a transaction. One side of a transfer answers 409 with the other side,
//      unless the caller says what to do with the pair: `?pair=delete` deletes both rows,
//      `?pair=unlink` unlinks the other row and deletes only this one.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findLearnedCategory } from '@/lib/finance/learned-categories';
import { transferEditConflict } from '@/lib/finance/transfers/pairing';
import { missingTransferColumn } from '@/lib/finance/transfers/schema';
import { clearTransferGroup, loadGroupRows } from '@/lib/finance/transfers/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const from = params.get('from');
  const to = params.get('to');
  const type = params.get('type'); // 'expense' | 'income'
  // Multi-value filters (comma-separated); fall back to legacy single-value params
  const accountIds = params.get('account_ids')?.split(',').filter(Boolean)
    ?? (params.get('account_id') ? [params.get('account_id')!] : []);
  const categoryIds = params.get('category_ids')?.split(',').filter(Boolean)
    ?? (params.get('category_id') ? [params.get('category_id')!] : []);
  const brandIds = params.get('brand_ids')?.split(',').filter(Boolean)
    ?? (params.get('brand_id') ? [params.get('brand_id')!] : []);
  const sourceModule = params.get('source_module');
  const source = params.get('source');
  const disputeStatus = params.get('dispute_status');
  const q = params.get('q')?.trim() || '';
  const limit = Math.min(parseInt(params.get('limit') || '100') || 100, 500);
  const offset = parseInt(params.get('offset') || '0');

  let query = supabase
    .from('financial_transactions')
    .select('*, budget_categories(id, name, color), financial_accounts(id, name, institution_name, last_four)', { count: 'exact' })
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (from) query = query.gte('transaction_date', from);
  if (to) query = query.lte('transaction_date', to);
  if (type) query = query.eq('type', type);
  if (categoryIds.length > 0) query = query.in('category_id', categoryIds);
  if (accountIds.length > 0) query = query.in('account_id', accountIds);
  if (brandIds.length > 0) query = query.in('brand_id', brandIds);
  if (sourceModule) query = query.eq('source_module', sourceModule);
  if (source) query = query.eq('source', source);
  if (disputeStatus) query = query.eq('dispute_status', disputeStatus);
  const jobId = params.get('job_id');
  if (jobId) query = query.eq('job_id', jobId);
  if (q) query = query.or(`description.ilike.%${q}%,vendor.ilike.%${q}%,notes.ilike.%${q}%,amount::text.ilike.%${q}%`);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Rows that are one side of a transfer get the other side attached, so the
  // list can show "Transfer ↔ <account>". Before migration 202 no row has a
  // transfer_group_id, so nothing is looked up. A failed lookup only costs the badge.
  const transactions = data || [];
  const groupIds = transactions
    .map((tx) => tx.transfer_group_id as string | null | undefined)
    .filter((groupId): groupId is string => Boolean(groupId));
  if (groupIds.length > 0) {
    const { rows: groupRows } = await loadGroupRows(supabase, user.id, groupIds);
    for (const tx of transactions) {
      if (!tx.transfer_group_id) continue;
      const partner = groupRows.find(
        (row) => row.transfer_group_id === tx.transfer_group_id && row.id !== tx.id,
      );
      tx.transfer_partner = partner ?? null;
    }
  }

  return NextResponse.json({ transactions, total: count || 0 });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    amount, type, description, vendor, transaction_date, category_id, suggested_category_id,
    account_id, brand_id, tags, notes,
  } = body;

  if (!amount || !transaction_date) {
    return NextResponse.json({ error: 'Amount and date are required' }, { status: 400 });
  }

  // Category, in order: what the user picked; the vendor's learned category
  // (set by answering "Always" to the categorize prompt); then a suggestion
  // such as the receipt scanner's guess, so a learned category beats the AI.
  let resolvedCategoryId: string | null = category_id || null;
  if (!resolvedCategoryId && typeof vendor === 'string' && vendor.trim()) {
    resolvedCategoryId = await findLearnedCategory(supabase, user.id, vendor, type || 'expense');
  }
  if (!resolvedCategoryId && typeof suggested_category_id === 'string' && suggested_category_id) {
    resolvedCategoryId = suggested_category_id;
  }

  const { data, error } = await supabase
    .from('financial_transactions')
    .insert({
      user_id: user.id,
      amount: Math.abs(parseFloat(amount)),
      type: type || 'expense',
      description: description?.trim() || null,
      vendor: vendor?.trim() || null,
      transaction_date,
      category_id: resolvedCategoryId,
      account_id: account_id || null,
      brand_id: brand_id || null,
      tags: tags || null,
      notes: notes?.trim() || null,
      source: 'manual',
    })
    .select('*, budget_categories(id, name, color)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transaction: data });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });

  const allowed = [
    'amount', 'type', 'description', 'vendor', 'transaction_date', 'category_id',
    'account_id', 'brand_id', 'transaction_id', 'source_module', 'source_module_id', 'tags', 'notes',
    'dispute_status', 'dispute_date', 'dispute_notes',
    'return_deadline', 'return_policy_days', 'return_status',
  ];
  const payload: Record<string, unknown> = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) payload[key] = updates[key];
  }
  if (payload.amount) payload.amount = Math.abs(parseFloat(String(payload.amount)));

  // One side of a transfer must keep the amount and type that match the other
  // side. Category, notes, date and the rest are free to change.
  if (payload.amount !== undefined || payload.type !== undefined) {
    const { data: current, error: currentError } = await supabase
      .from('financial_transactions')
      .select('amount, type, transfer_group_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    // A database without transfer_group_id (before migration 202) has no transfers to protect.
    if (currentError && !missingTransferColumn(currentError)) {
      return NextResponse.json({ error: currentError.message }, { status: 500 });
    }
    if (current?.transfer_group_id) {
      const conflict = transferEditConflict(current, { amount: payload.amount, type: payload.type });
      if (conflict) {
        return NextResponse.json(
          { error: conflict, transfer_group_id: current.transfer_group_id },
          { status: 409 },
        );
      }
    }
  }

  const { data, error } = await supabase
    .from('financial_transactions')
    .update(payload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*, budget_categories(id, name, color)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transaction: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Accept id from query param OR request body
  let id = request.nextUrl.searchParams.get('id');
  if (!id) {
    try {
      const body = await request.json();
      id = body.id ?? null;
    } catch { /* no body */ }
  }
  if (!id) return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });

  // Is this row one side of a transfer? A database without transfer_group_id
  // (before migration 202) has no transfers, so the lookup error is ignored.
  const pairMode = request.nextUrl.searchParams.get('pair');
  const { data: target, error: targetError } = await supabase
    .from('financial_transactions')
    .select('id, transfer_group_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (targetError && !missingTransferColumn(targetError)) {
    return NextResponse.json({ error: targetError.message }, { status: 500 });
  }

  const groupId: string | null = target?.transfer_group_id ?? null;
  if (groupId) {
    const { rows: groupRows, error: groupError } = await loadGroupRows(supabase, user.id, [groupId]);
    if (groupError) {
      return NextResponse.json({ error: groupError.message ?? 'Could not load the transfer' }, { status: 500 });
    }
    const partners = groupRows.filter((row) => row.id !== id);

    // A row whose other side is already gone is deleted like any other row.
    if (partners.length > 0) {
      if (pairMode === 'delete') {
        const { error } = await supabase
          .from('financial_transactions')
          .delete()
          .eq('user_id', user.id)
          .eq('transfer_group_id', groupId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true, deleted: [id, ...partners.map((row) => row.id)] });
      }

      if (pairMode !== 'unlink') {
        return NextResponse.json(
          {
            error:
              'This transaction is one side of a transfer. Delete both sides, or unlink the transfer and delete only this one.',
            transfer_group_id: groupId,
            partner: partners[0],
          },
          { status: 409 },
        );
      }

      // pair=unlink: the other side stays as an ordinary transaction.
      const { error: unlinkError } = await clearTransferGroup(
        supabase,
        user.id,
        partners.map((row) => row.id),
      );
      if (unlinkError) {
        return NextResponse.json(
          { error: unlinkError.message ?? 'Could not unlink the transfer' },
          { status: 500 },
        );
      }
    }
  }

  const { error } = await supabase
    .from('financial_transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: [id] });
}
