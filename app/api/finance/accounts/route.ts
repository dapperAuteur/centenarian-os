// app/api/finance/accounts/route.ts
// GET: list user's financial accounts (with computed balance). The balance is in the account's
//      own currency, worked out by lib/finance/balance/logic.ts (opening balance plus the
//      transactions after the starting-balance date, every page of them; debts negative).
//      Accounts not in the user's home currency also get `home_currency`,
//      `balance_home` and `fx` ({ rate, rate_date, source, stale }): today's rate, cache first,
//      fetched server-side when missing (lib/finance/fx).
//      Each account also gets `reconciliation`: the latest reconciliation (statement date, status,
//      difference) and the date it is reconciled through, or null (none, or before migration 221).
// POST: create a new account. `currency` (ISO code) defaults to the user's home currency.
//      `opening_balance_date` (YYYY-MM-DD, migration 221) is the day the opening balance is as of.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { convert, normalizeCurrency } from '@/lib/finance/fx/math';
import { getRate, isFxSchemaMissing } from '@/lib/finance/fx/rates';
import { isMissingColumn } from '@/lib/finance/transfers/schema';
import { loadHomeCurrency } from '@/lib/finance/fx/server';
import { signedFromStatementCents } from '@/lib/finance/balance/logic';
import { loadBalanceRows, signedBalancesCents } from '@/lib/finance/balance/server';
import { isDateString, RECONCILE_NOT_READY } from '@/lib/finance/reconciliation/logic';
import { loadReconcileStatus } from '@/lib/finance/reconciliation/server';

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

  const { data: accounts, error } = await db
    .from('financial_accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const home = await loadHomeCurrency(db, user.id);
  const today = new Date().toISOString().slice(0, 10);

  // One balance rule for the whole app (lib/finance/balance/logic.ts), over every page of
  // transactions. Debts read negative.
  const list = accounts ?? [];
  const { rows, error: rowsError } = await loadBalanceRows(db, user.id, list.map((a) => a.id));
  if (rowsError) return NextResponse.json({ error: rowsError.message ?? 'Could not load transactions.' }, { status: 500 });
  const balances = signedBalancesCents(list, rows);
  // Latest reconciliation per account; empty before migration 221.
  const reconcile = await loadReconcileStatus(db, user.id, list.map((a) => a.id));

  const accountsWithBalance = await Promise.all(
    list.map(async (raw) => {
      const balance = (balances.get(raw.id) ?? 0) / 100;
      const acct = { ...raw, reconciliation: reconcile.byAccount.get(raw.id) ?? null };

      // Before migration 210 there is no currency column: every account is in USD.
      const currency: string = acct.currency ?? 'USD';
      if (currency === home) return { ...acct, currency, balance, home_currency: home };

      const { rate } = await getRate(db, user.id, currency, home, today);
      return {
        ...acct,
        currency,
        balance,
        home_currency: home,
        balance_home: rate ? convert(balance, rate.rate) : null,
        fx: rate,
      };
    })
  );

  return NextResponse.json(accountsWithBalance);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    name, account_type, institution_name, last_four,
    interest_rate, credit_limit, opening_balance = 0,
    monthly_fee, due_date, statement_date, notes,
    // Institution policy fields
    dispute_window_days, default_return_days,
    promo_apr, promo_apr_expires, promo_description,
    bt_apr, bt_fee_percent, bt_expires, bt_description,
    rewards_type, rewards_rate, annual_fee,
  } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (!account_type) return NextResponse.json({ error: 'Account type is required' }, { status: 400 });
  // The day the starting balance is as of (migration 221). Sent only when set, so creating an
  // account keeps working before the migration.
  const openingDate = body.opening_balance_date;
  if (openingDate !== undefined && openingDate !== null && openingDate !== '' && !isDateString(openingDate)) {
    return NextResponse.json({ error: 'The starting balance date must be a date, like 2026-01-31.' }, { status: 400 });
  }

  const db = getDb();
  let currency: string | null = null;
  if (body.currency !== undefined && body.currency !== null && body.currency !== '') {
    currency = normalizeCurrency(body.currency);
    if (!currency) return NextResponse.json({ error: 'Currency must be a three-letter code, like USD or MXN.' }, { status: 400 });
  }
  if (!currency) currency = await loadHomeCurrency(db, user.id);
  const { data, error } = await db
    .from('financial_accounts')
    .insert({
      user_id: user.id,
      name: name.trim(),
      account_type,
      institution_name: institution_name ?? null,
      last_four: last_four ?? null,
      interest_rate: interest_rate != null ? Number(interest_rate) : null,
      credit_limit: credit_limit != null ? Number(credit_limit) : null,
      opening_balance: Number(opening_balance),
      monthly_fee: monthly_fee != null ? Number(monthly_fee) : null,
      due_date: due_date != null ? Number(due_date) : null,
      statement_date: statement_date != null ? Number(statement_date) : null,
      notes: notes ?? null,
      dispute_window_days: dispute_window_days != null ? Number(dispute_window_days) : null,
      default_return_days: default_return_days != null ? Number(default_return_days) : null,
      promo_apr: promo_apr != null ? Number(promo_apr) : null,
      promo_apr_expires: promo_apr_expires ?? null,
      promo_description: promo_description ?? null,
      bt_apr: bt_apr != null ? Number(bt_apr) : null,
      bt_fee_percent: bt_fee_percent != null ? Number(bt_fee_percent) : null,
      bt_expires: bt_expires ?? null,
      bt_description: bt_description ?? null,
      rewards_type: rewards_type ?? null,
      rewards_rate: rewards_rate ?? null,
      annual_fee: annual_fee != null ? Number(annual_fee) : null,
      // Sent only when it isn't USD, so creating a USD account keeps working before migration 210.
      ...(currency !== 'USD' ? { currency } : {}),
      ...(isDateString(openingDate) ? { opening_balance_date: openingDate } : {}),
    })
    .select()
    .single();

  if (error) {
    if (isMissingColumn(error, 'opening_balance_date')) {
      return NextResponse.json({ error: RECONCILE_NOT_READY.startingDateError, code: RECONCILE_NOT_READY.code }, { status: 503 });
    }
    if (isFxSchemaMissing(error)) {
      return NextResponse.json(
        { error: 'Accounts in other currencies need a database update (migration 210). Create it in USD for now.', code: 'fx_not_migrated' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // A new account has no transactions yet: its balance is the opening balance.
  const balance = signedFromStatementCents(account_type, Math.round(Number(opening_balance) * 100)) / 100;
  return NextResponse.json({ ...data, balance, reconciliation: null }, { status: 201 });
}
