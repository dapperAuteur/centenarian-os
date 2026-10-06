// app/api/finance/accounts/[id]/route.ts
// PATCH: update account fields, including csv_import_mapping (the statement-import
//        settings saved for the account: { mapping, sign, dateOrder, includePending?, preset? } or null)
//        and currency (ISO code; only while the account has no transactions, because changing it
//        would re-read every amount on the account in a different currency)
//        and nickname (migration 218; used in Google Calendar titles as @nickname; null or "" clears
//        it; unique per user among active accounts, case-insensitive, also checked when an account
//        is reactivated; 409 nickname_taken, 503 nickname_not_migrated before 218)
// DELETE: deactivate (soft) or hard-delete if no transactions

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import {
  ImportError,
  MIGRATION_REQUIRED_MESSAGE,
  isMissingSchemaError,
} from '@/lib/finance/csv-import/errors';
import { sanitizeSavedMapping } from '@/lib/finance/csv-import/service';
import { normalizeCurrency } from '@/lib/finance/fx/math';
import { isFxSchemaMissing } from '@/lib/finance/fx/rates';
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

type Params = { params: Promise<{ id: string }> };

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


export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: acct } = await db
    .from('financial_accounts')
    .select('user_id')
    .eq('id', id)
    .maybeSingle();

  if (!acct || acct.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const allowed = [
    'name', 'account_type', 'institution_name', 'last_four',
    'interest_rate', 'credit_limit', 'opening_balance',
    'monthly_fee', 'due_date', 'statement_date', 'is_active', 'notes',
    // Institution policy fields
    'dispute_window_days', 'default_return_days',
    'promo_apr', 'promo_apr_expires', 'promo_description',
    'bt_apr', 'bt_fee_percent', 'bt_expires', 'bt_description',
    'rewards_type', 'rewards_rate', 'annual_fee',
    // Statement-import settings remembered for this account (migration 203)
    'csv_import_mapping',
    // Multi-currency (migration 210)
    'currency',
    // Calendar @nickname (migration 218)
    'nickname',
  ];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  if ('currency' in updates) {
    const code = normalizeCurrency(updates.currency);
    if (!code) return NextResponse.json({ error: 'Currency must be a three-letter code, like USD or MXN.' }, { status: 400 });
    const { data: current, error: currentError } = await db
      .from('financial_accounts')
      .select('currency')
      .eq('id', id)
      .maybeSingle();
    if (currentError) {
      if (isFxSchemaMissing(currentError)) {
        return NextResponse.json(
          { error: 'Accounts in other currencies need a database update (migration 210).', code: 'fx_not_migrated' },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: currentError.message }, { status: 500 });
    }
    if ((current as { currency?: string } | null)?.currency === code) {
      delete updates.currency;
    } else {
      const { count } = await db
        .from('financial_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', id);
      if ((count ?? 0) > 0) {
        return NextResponse.json(
          {
            error:
              "This account already has transactions, so its currency can't change (their amounts would be read in the new currency). " +
              'Create a new account in the other currency instead.',
            code: 'currency_locked',
          },
          { status: 409 },
        );
      }
      updates.currency = code;
    }
  }

  if ('nickname' in updates) {
    const checked = await checkNickname(db, user.id, updates.nickname, id);
    if ('response' in checked) return checked.response;
    updates.nickname = checked.value;
  } else if (updates.is_active === true) {
    // Reactivating: its nickname must not have been taken meanwhile. Before 218 there is none.
    const { data: self, error: selfError } = await db.from('financial_accounts').select('nickname').eq('id', id).maybeSingle();
    if (!selfError && (self as { nickname?: string | null } | null)?.nickname) {
      const checked = await checkNickname(db, user.id, (self as { nickname: string }).nickname, id);
      if ('response' in checked) return checked.response;
    }
  }

  // { mapping, sign, dateOrder, includePending?, preset? } or null to forget it.
  // Checked here so a malformed value can't be stored and break the next import.
  if ('csv_import_mapping' in updates) {
    try {
      updates.csv_import_mapping = sanitizeSavedMapping(updates.csv_import_mapping);
    } catch (err) {
      const message = err instanceof ImportError ? err.message : 'csv_import_mapping is not valid.';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const { data, error } = await db
    .from('financial_accounts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (isNicknameColumnMissing(error)) {
      return NextResponse.json({ error: NICKNAME_MIGRATION_MESSAGE, code: 'nickname_not_migrated' }, { status: 503 });
    }
    if (error.code === '23505' && /nickname/i.test(error.message)) {
      return NextResponse.json({ error: 'Another account already uses that nickname.', code: 'nickname_taken' }, { status: 409 });
    }
    // The column arrives with migration 203: say so instead of a raw schema error.
    if (isMissingSchemaError(error)) {
      return NextResponse.json(
        { error: MIGRATION_REQUIRED_MESSAGE, code: 'migration_required' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: acct } = await db
    .from('financial_accounts')
    .select('user_id')
    .eq('id', id)
    .maybeSingle();

  if (!acct || acct.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Check if any transactions reference this account
  const { count } = await db
    .from('financial_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', id);

  if ((count ?? 0) > 0) {
    // Soft-delete: deactivate so transactions remain intact
    const { error } = await db
      .from('financial_accounts')
      .update({ is_active: false })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ deactivated: true });
  }

  const { error } = await db.from('financial_accounts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
