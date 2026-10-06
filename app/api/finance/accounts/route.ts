// app/api/finance/accounts/route.ts
// GET: list user's financial accounts (with computed balance). The balance is in the account's
//      own currency. Accounts not in the user's home currency also get `home_currency`,
//      `balance_home` and `fx` ({ rate, rate_date, source, stale }): today's rate, cache first,
//      fetched server-side when missing (lib/finance/fx).
// POST: create a new account. `currency` (ISO code) defaults to the user's home currency.
//       `nickname` (migration 218, optional): used in Google Calendar titles as @nickname; trimmed,
//       starts with a letter, up to 20 characters, unique per user among active accounts
//       (case-insensitive). 409 nickname_taken, 503 nickname_not_migrated before 218.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { convert, normalizeCurrency } from '@/lib/finance/fx/math';
import { getRate, isFxSchemaMissing } from '@/lib/finance/fx/rates';
import { loadHomeCurrency } from '@/lib/finance/fx/server';
import {
  NICKNAME_MIGRATION_MESSAGE,
  cleanNickname,
  isNicknameColumnMissing,
  nicknameTaken,
} from '@/lib/finance/account-nickname';

function getDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * Checks a nickname from a request body (migration 218): format, and not used by another active
 * account of the user (case-insensitive). Returns the value to store, or a response to send.
 */
async function checkNickname(
  db: ReturnType<typeof getDb>,
  userId: string,
  raw: unknown,
  selfId?: string,
): Promise<{ value: string | null } | { response: NextResponse }> {
  const cleaned = cleanNickname(raw);
  if (!cleaned.ok) return { response: NextResponse.json({ error: cleaned.error, code: 'invalid_nickname' }, { status: 400 }) };
  if (cleaned.value === null) return { value: null };
  const { data, error } = await db.from('financial_accounts').select('id, nickname, is_active').eq('user_id', userId);
  if (error) {
    if (isNicknameColumnMissing(error)) {
      return { response: NextResponse.json({ error: NICKNAME_MIGRATION_MESSAGE, code: 'nickname_not_migrated' }, { status: 503 }) };
    }
    return { response: NextResponse.json({ error: error.message }, { status: 500 }) };
  }
  if (nicknameTaken(cleaned.value, data ?? [], selfId)) {
    return {
      response: NextResponse.json(
        { error: `Another account already uses the nickname "${cleaned.value}".`, code: 'nickname_taken' },
        { status: 409 },
      ),
    };
  }
  return { value: cleaned.value };
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

  // Compute balance for each account: opening_balance + income - expenses
  const accountsWithBalance = await Promise.all(
    (accounts ?? []).map(async (acct) => {
      const { data: totals } = await db
        .from('financial_transactions')
        .select('type, amount')
        .eq('user_id', user.id)
        .eq('account_id', acct.id);

      const income = (totals ?? []).filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const expenses = (totals ?? []).filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

      const isDebtAccount = acct.account_type === 'credit_card' || acct.account_type === 'loan';
      // Debt accounts: expenses increase debt, payments (income) decrease it
      const balance = isDebtAccount
        ? -(Number(acct.opening_balance) + expenses - income)
        : Number(acct.opening_balance) + income - expenses;

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

  const db = getDb();
  let currency: string | null = null;
  if (body.currency !== undefined && body.currency !== null && body.currency !== '') {
    currency = normalizeCurrency(body.currency);
    if (!currency) return NextResponse.json({ error: 'Currency must be a three-letter code, like USD or MXN.' }, { status: 400 });
  }
  if (!currency) currency = await loadHomeCurrency(db, user.id);
  // Only when sent, so creating an account keeps working before migration 218.
  let nickname: string | null = null;
  if (body.nickname !== undefined) {
    const checked = await checkNickname(db, user.id, body.nickname);
    if ('response' in checked) return checked.response;
    nickname = checked.value;
  }
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
      ...(nickname ? { nickname } : {}),
    })
    .select()
    .single();

  if (error) {
    if (isNicknameColumnMissing(error)) {
      return NextResponse.json({ error: NICKNAME_MIGRATION_MESSAGE, code: 'nickname_not_migrated' }, { status: 503 });
    }
    if (error.code === '23505' && /nickname/i.test(error.message)) {
      return NextResponse.json({ error: 'Another account already uses that nickname.', code: 'nickname_taken' }, { status: 409 });
    }
    if (isFxSchemaMissing(error)) {
      return NextResponse.json(
        { error: 'Accounts in other currencies need a database update (migration 210). Create it in USD for now.', code: 'fx_not_migrated' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const isDebt = account_type === 'credit_card' || account_type === 'loan';
  const balance = isDebt ? -Number(opening_balance) : Number(opening_balance);
  return NextResponse.json({ ...data, balance }, { status: 201 });
}
