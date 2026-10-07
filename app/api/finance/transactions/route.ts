// app/api/finance/transactions/route.ts
// GET: list transactions with filters (date range, category or ?uncategorized=1, type). A row that is one
//      side of a transfer comes with `transfer_partner`: the other side and its account.
//      `?batch=<import_batch_id>` lists the rows of one statement import.
// POST: create a new transaction (fills a missing category from the vendor's learned category;
//      account, category and brand must be the caller's own, else 400).
//      The amount is in the account's currency; a row on a foreign-currency account also gets
//      currency, fx_rate and amount_home (rate to the home currency on the transaction date).
// PATCH: update a transaction. One side of a transfer can't change its amount or type alone.
//      Changing the amount, date or account recomputes the home-currency amount.
// DELETE: delete a transaction. One side of a transfer answers 409 with the other side,
//      unless the caller says what to do with the pair: `?pair=delete` deletes both rows,
//      `?pair=unlink` unlinks the other row and deletes only this one.
// Reconciled periods (migration 221): GET marks each row with `reconciled_period`
//      ({ statement_date, reconciliation_id } or null) when it is dated inside a reconciled
//      statement period of its account, so the page can warn before an edit or delete. PATCH and
//      DELETE still go through and answer `reconciled_period` for the row before or after the
//      change, so the page can say the reconciliation may no longer match.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createTransaction, fxForRow as fxForRowWith } from '@/lib/capture/create-record';
import { transferEditConflict } from '@/lib/finance/transfers/pairing';
import { isMissingColumn, missingTransferColumn } from '@/lib/finance/transfers/schema';
import { clearTransferGroup, getServiceDb, loadGroupRows } from '@/lib/finance/transfers/server';
import { withOptionalFx } from '@/lib/finance/fx/totals';
import { loadHomeCurrency } from '@/lib/finance/fx/server';
import { annotateReconciled, reconciledPeriods } from '@/lib/finance/reconciliation/server';

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

  const jobId = params.get('job_id');
  // One statement import. The column arrives with migration 203.
  const batchId = params.get('batch')?.trim() || '';

  // The account's currency arrives with migration 210; before it, the query runs without it.
  const buildQuery = (fxColumnsExist: boolean) => {
    let query = supabase
      .from('financial_transactions')
      .select(
        fxColumnsExist
          ? '*, budget_categories(id, name, color), financial_accounts(id, name, institution_name, last_four, currency)'
          : '*, budget_categories(id, name, color), financial_accounts(id, name, institution_name, last_four)',
        { count: 'exact' },
      )
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (from) query = query.gte('transaction_date', from);
    if (to) query = query.lte('transaction_date', to);
    if (type) query = query.eq('type', type);
    if (categoryIds.length > 0) query = query.in('category_id', categoryIds);
    else if (params.get('uncategorized') === '1') query = query.is('category_id', null);
    if (accountIds.length > 0) query = query.in('account_id', accountIds);
    if (brandIds.length > 0) query = query.in('brand_id', brandIds);
    if (sourceModule) query = query.eq('source_module', sourceModule);
    if (source) query = query.eq('source', source);
    if (disputeStatus) query = query.eq('dispute_status', disputeStatus);
    if (jobId) query = query.eq('job_id', jobId);
    if (batchId) query = query.eq('import_batch_id', batchId);
    if (q) query = query.or(`description.ilike.%${q}%,vendor.ilike.%${q}%,notes.ilike.%${q}%,amount::text.ilike.%${q}%`);
    return query;
  };

  const [{ data, error, count }, homeCurrency] = await Promise.all([
    withOptionalFx((fxColumnsExist) => buildQuery(fxColumnsExist)),
    loadHomeCurrency(getServiceDb(), user.id),
  ]);

  // The import filter can fail in two ways that are not the caller's fault and
  // must not reach the screen as a raw Postgres error. Either way no row can be
  // shown to belong to that import, so the list is empty and `notice` says why.
  // (Running the query without the filter would show every transaction under a
  // "from one import" label, which is worse than showing none.)
  if (error && batchId) {
    if (isMissingColumn(error, 'import_batch_id')) {
      return NextResponse.json({
        transactions: [],
        total: 0,
        code: 'import_batches_not_migrated',
        notice:
          "Transactions can't be listed by import yet because this database is missing an update (migration 203). " +
          'Remove the "From one import" filter to see all transactions.',
      });
    }
    // 22P02: the id is not in the form the column expects, so it names no import.
    if (error.code === '22P02') {
      return NextResponse.json({
        transactions: [],
        total: 0,
        code: 'import_batch_not_found',
        notice: 'That import was not found. Remove the "From one import" filter to see all transactions.',
      });
    }
  }
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

  // The reconciled-period warning. Answers null on every row before migration 221.
  await annotateReconciled(supabase, user.id, transactions);

  return NextResponse.json({ transactions, total: count || 0, home_currency: homeCurrency });
}

/** The FX columns for a row on `accountId` (see fxForRow in lib/capture/create-record.ts). */
function fxForRow(userId: string, accountId: string | null, amount: number, date: string) {
  return fxForRowWith(getServiceDb(), userId, accountId, amount, date);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Learned category, FX fields and reference checks live in lib/capture/create-record.ts,
  // shared with the Google Calendar sync.
  const body = await request.json();
  const result = await createTransaction(supabase, user.id, body ?? {}, {
    fxDb: getServiceDb(),
    select: '*, budget_categories(id, name, color)',
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ transaction: result.value });
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

  // Where the row sits before the change, for the reconciled-period flag in the answer.
  const { data: placeBefore } = await supabase
    .from('financial_transactions')
    .select('account_id, transaction_date')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  // The home-currency amount follows the amount, the date and the account.
  if (payload.amount !== undefined || payload.transaction_date !== undefined || payload.account_id !== undefined) {
    const { data: before } = await supabase
      .from('financial_transactions')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (before) {
      const accountId = (payload.account_id !== undefined ? payload.account_id : before.account_id) as string | null;
      const amount = Number(payload.amount ?? before.amount);
      const date = String(payload.transaction_date ?? before.transaction_date);
      const fx = await fxForRow(user.id, accountId || null, amount, date);
      // `before` has amount_home only once migration 210 is applied; only then can it be cleared.
      if (Object.keys(fx).length > 0) Object.assign(payload, fx);
      else if ('amount_home' in before && (before.amount_home !== null || before.currency !== null)) {
        Object.assign(payload, { currency: null, fx_rate: null, amount_home: null });
      }
    }
  }

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
  // Inside a reconciled period before or after the change: the page says the reconciliation may not match now.
  const flags = await reconciledPeriods(supabase, user.id, [placeBefore ?? {}, data ?? {}]);
  return NextResponse.json({ transaction: data, reconciled_period: flags.find(Boolean) ?? null });
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
    .select('id, account_id, transaction_date, transfer_group_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  // Inside a reconciled period: still deleted, and the answer says so.
  const [deletedPeriod] = await reconciledPeriods(supabase, user.id, [target ?? {}]);
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
        const partnerPeriods = await reconciledPeriods(supabase, user.id, partners);
        return NextResponse.json({
          ok: true,
          deleted: [id, ...partners.map((row) => row.id)],
          reconciled_period: deletedPeriod ?? partnerPeriods.find(Boolean) ?? null,
        });
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
  return NextResponse.json({ ok: true, deleted: [id], reconciled_period: deletedPeriod ?? null });
}
