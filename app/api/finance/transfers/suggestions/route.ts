// app/api/finance/transfers/suggestions/route.ts
// GET: transactions that look like transfers between the person's own accounts.
// Read only: it suggests, and the person links (./link) or records a payment (./pay).
//
// Two ways to call it:
//
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD   (both optional; no dates = all history)
//     -> { pairs, one_sided, accounts, window, truncated }
//        The review list. Rows that are already part of a transfer, or have
//        no account, are never looked at. A pair is returned when either of
//        its rows falls inside the window.
//
//   ?transaction_id=<id>
//     -> { transaction, candidates, accounts }
//        Every row that could be the other side of that one transaction, for
//        the "Mark as transfer" picker.

import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import {
  suggestTransferPairs,
  transferCandidatesFor,
  TRANSFER_WINDOW_DAYS,
  type DetectRow,
} from '@/lib/finance/transfers/detect';
import { accountLabel, toCents } from '@/lib/finance/transfers/pairing';
import { missingTransferColumn, TRANSFERS_NOT_READY, type DbErrorLike } from '@/lib/finance/transfers/schema';
import { ACCOUNT_SELECT, getServiceDb, type AccountRecord } from '@/lib/finance/transfers/server';
import { shiftDate } from '@/lib/finance/transaction-matching';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ROW_SELECT = 'id, account_id, amount, type, transaction_date, description, vendor';
/** Supabase returns at most 1,000 rows per request. */
const PAGE_SIZE = 1000;
/** The most rows one review looks at. Past this the answer says `truncated`. */
const MAX_ROWS = 5000;

interface DbRow {
  id: string;
  account_id: string | null;
  amount: number | string;
  type: 'expense' | 'income';
  transaction_date: string;
  description: string | null;
  vendor: string | null;
}

function toDetectRow(row: DbRow): DetectRow {
  return {
    id: row.id,
    account_id: row.account_id,
    date: row.transaction_date,
    amountCents: toCents(row.amount),
    type: row.type,
    description: row.description,
    vendor: row.vendor,
  };
}

/** A transaction as the review screens show it: always with its account's full label. */
function viewRow(row: DbRow, accountsById: ReadonlyMap<string, AccountRecord>) {
  const account = row.account_id ? accountsById.get(row.account_id) : undefined;
  return {
    id: row.id,
    date: row.transaction_date,
    amount: Number(row.amount),
    type: row.type,
    description: row.description,
    vendor: row.vendor,
    account_id: row.account_id,
    account_label: account ? accountLabel(account) : 'No account',
  };
}

function viewAccount(account: AccountRecord) {
  return {
    id: account.id,
    label: accountLabel(account),
    account_type: account.account_type,
    is_active: account.is_active,
  };
}

/** The person's ungrouped rows that have an account, newest first, between two dates (either may be null). */
async function loadUngroupedRows(
  db: SupabaseClient,
  userId: string,
  range: { from: string | null; to: string | null; amount?: number | string },
): Promise<{ rows: DbRow[]; truncated: boolean; error: DbErrorLike | null }> {
  const rows: DbRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    let query = db
      .from('financial_transactions')
      .select(ROW_SELECT)
      .eq('user_id', userId)
      .is('transfer_group_id', null)
      .not('account_id', 'is', null)
      .order('transaction_date', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (range.from) query = query.gte('transaction_date', range.from);
    if (range.to) query = query.lte('transaction_date', range.to);
    if (range.amount !== undefined) query = query.eq('amount', range.amount);

    const { data, error } = await query;
    if (error) return { rows: [], truncated: false, error };
    const page = (data ?? []) as unknown as DbRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { rows, truncated: false, error: null };
  }
  return { rows, truncated: true, error: null };
}

function failure(error: DbErrorLike) {
  if (missingTransferColumn(error)) return NextResponse.json(TRANSFERS_NOT_READY, { status: 503 });
  return NextResponse.json({ error: error.message ?? 'Could not load transactions' }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const from = params.get('from') || null;
  const to = params.get('to') || null;
  const transactionId = params.get('transaction_id') || null;
  if ((from && !ISO_DATE.test(from)) || (to && !ISO_DATE.test(to))) {
    return NextResponse.json({ error: 'from and to must be dates written YYYY-MM-DD' }, { status: 400 });
  }
  if (from && to && from > to) {
    return NextResponse.json({ error: '"from" must not be after "to"' }, { status: 400 });
  }

  const db = getServiceDb();

  const { data: accountRows, error: accountError } = await db
    .from('financial_accounts')
    .select(ACCOUNT_SELECT)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });
  if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });
  const accounts = (accountRows ?? []) as unknown as AccountRecord[];
  const accountsById = new Map(accounts.map((account) => [account.id, account]));

  // ── One transaction: who could its other side be? ───────────────────────
  if (transactionId) {
    const { data: found, error: findError } = await db
      .from('financial_transactions')
      .select(`${ROW_SELECT}, transfer_group_id`)
      .eq('user_id', user.id)
      .eq('id', transactionId)
      .maybeSingle();
    if (findError) return failure(findError);
    const target = found as unknown as (DbRow & { transfer_group_id: string | null }) | null;
    if (!target) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    if (target.transfer_group_id) {
      return NextResponse.json(
        { error: 'This transaction is already part of a transfer.' },
        { status: 409 },
      );
    }

    // Only rows with the same amount near the same date can match, so ask for just those.
    const nearby = await loadUngroupedRows(db, user.id, {
      from: shiftDate(target.transaction_date, -TRANSFER_WINDOW_DAYS),
      to: shiftDate(target.transaction_date, TRANSFER_WINDOW_DAYS),
      amount: target.amount,
    });
    if (nearby.error) return failure(nearby.error);

    const rowsById = new Map(nearby.rows.map((row) => [row.id, row]));
    const candidates = transferCandidatesFor(target.id, nearby.rows.map(toDetectRow), accounts).flatMap(
      (candidate) => {
        const other = rowsById.get(candidate.rowId);
        if (!other) return [];
        return [{
          transaction: viewRow(other, accountsById),
          kind: candidate.kind,
          days_apart: candidate.daysApart,
          reasons: candidate.reasons,
        }];
      },
    );
    return NextResponse.json({
      transaction: viewRow(target, accountsById),
      candidates,
      accounts: accounts.map(viewAccount),
    });
  }

  // ── The review list ─────────────────────────────────────────────────────
  // The other side of a transfer can sit just outside the window, so load a
  // few extra days on each end and trim afterwards.
  const loaded = await loadUngroupedRows(db, user.id, {
    from: from ? shiftDate(from, -TRANSFER_WINDOW_DAYS) : null,
    to: to ? shiftDate(to, TRANSFER_WINDOW_DAYS) : null,
  });
  if (loaded.error) return failure(loaded.error);

  const rowsById = new Map(loaded.rows.map((row) => [row.id, row]));
  const inWindow = (id: string): boolean => {
    const date = rowsById.get(id)?.transaction_date;
    if (!date) return false;
    return (!from || date >= from) && (!to || date <= to);
  };

  const suggestions = suggestTransferPairs(loaded.rows.map(toDetectRow), accounts);

  const pairs = suggestions.pairs
    .filter((pair) => inWindow(pair.fromId) || inWindow(pair.toId))
    .map((pair) => ({
      from: viewRow(rowsById.get(pair.fromId)!, accountsById),
      to: viewRow(rowsById.get(pair.toId)!, accountsById),
      kind: pair.kind,
      confidence: pair.confidence,
      days_apart: pair.daysApart,
      from_candidates: pair.fromCandidates,
      to_candidates: pair.toCandidates,
      reasons: pair.reasons,
    }));

  const oneSided = suggestions.oneSided
    .filter((item) => inWindow(item.rowId))
    .map((item) => {
      const toAccount = item.toAccountId ? accountsById.get(item.toAccountId) : undefined;
      return {
        transaction: viewRow(rowsById.get(item.rowId)!, accountsById),
        kind: item.kind,
        to_account_id: toAccount?.id ?? null,
        to_account_label: toAccount ? accountLabel(toAccount) : null,
        reasons: item.reasons,
      };
    });

  return NextResponse.json({
    pairs,
    one_sided: oneSided,
    accounts: accounts.map(viewAccount),
    window: { from, to },
    truncated: loaded.truncated,
  });
}
