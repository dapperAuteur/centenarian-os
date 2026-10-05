// app/api/finance/fx/exchange/route.ts
// POST: "Exchange money" between two of the user's accounts in different currencies (a USD
// checking or cash account to a peso cash account at a booth or ATM, say).
//
// Body: { from_account_id, to_account_id, sent, received, fee?, date, description? }
//   sent      amount that left `from`, in its currency (fee not included)
//   received  amount that reached `to`, in its currency
//   fee       optional, in `from`'s currency
//
// Writes, in one insert statement (all or nothing):
//   - the transfer pair: an expense on `from` and an income on `to`, source = 'transfer', one
//     transfer_group_id, transfer_kind = 'transfer'; never counted as spending or income;
//   - the fee, when there is one, as an ordinary expense on `from` (real spending).
// Then saves the rate actually got (received / sent) as the user's manual rate for that date, so
// later spending from the foreign cash is valued at what it cost. Rules: lib/finance/fx/exchange.ts.
//
// -> 201 { transfer_group_id, rate, inverse, rows } · 400 bad input · 503 before migrations 202/210

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceDb } from '@/lib/finance/transfers/server';
import { missingTransferColumn, TRANSFERS_NOT_READY, withOptionalKind } from '@/lib/finance/transfers/schema';
import { planExchange } from '@/lib/finance/fx/exchange';
import { isCurrencyCode } from '@/lib/finance/fx/math';
import { getRate, isFxSchemaMissing, saveManualRate } from '@/lib/finance/fx/rates';
import { loadHomeCurrency, storableRate } from '@/lib/finance/fx/server';

const NOT_READY = {
  error: 'Currencies are not set up in this database yet. Run migration 210 first.',
  code: 'fx_not_migrated',
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { from_account_id, to_account_id, sent, received, fee, date, description } = body ?? {};
  if (typeof from_account_id !== 'string' || typeof to_account_id !== 'string' || !from_account_id || !to_account_id) {
    return NextResponse.json({ error: 'Pick both accounts.' }, { status: 400 });
  }
  if (typeof date !== 'string' || !DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Pick the date of the exchange.' }, { status: 400 });
  }

  const db = getServiceDb();
  const { data: accountRows, error: acctError } = await db
    .from('financial_accounts')
    .select('id, name, currency, is_active')
    .eq('user_id', user.id)
    .in('id', [from_account_id, to_account_id]);
  if (acctError) {
    if (isFxSchemaMissing(acctError)) return NextResponse.json(NOT_READY, { status: 503 });
    return NextResponse.json({ error: acctError.message }, { status: 500 });
  }
  const accounts = (accountRows ?? []) as { id: string; name: string; currency: string; is_active: boolean }[];
  const from = accounts.find((a) => a.id === from_account_id);
  const to = accounts.find((a) => a.id === to_account_id);
  if (!from || !to) return NextResponse.json({ error: 'One or both accounts not found.' }, { status: 400 });
  const inactive = [from, to].find((a) => !a.is_active);
  if (inactive) return NextResponse.json({ error: `Account "${inactive.name}" is inactive.` }, { status: 400 });
  if (!isCurrencyCode(from.currency) || !isCurrencyCode(to.currency)) {
    return NextResponse.json({ error: 'Both accounts need a currency.' }, { status: 400 });
  }

  const home = await loadHomeCurrency(db, user.id);
  let sourceToHome: number | null = null;
  if (from.currency !== home && to.currency !== home) {
    const { rate, error } = await getRate(db, user.id, from.currency, home, date);
    if (error && !isFxSchemaMissing(error)) return NextResponse.json({ error: error.message }, { status: 500 });
    sourceToHome = rate?.rate ?? null;
  }

  let plan;
  try {
    plan = planExchange({
      from: { id: from.id, name: from.name, currency: from.currency },
      to: { id: to.id, name: to.name, currency: to.currency },
      home,
      sent: Number(sent),
      received: Number(received),
      fee: fee === undefined || fee === null || fee === '' ? null : Number(fee),
      sourceToHome,
      description: typeof description === 'string' ? description : null,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Check the amounts.' }, { status: 400 });
  }

  const groupId = crypto.randomUUID();
  // Every row carries every key, so the multi-row insert never sends NULL for a default by accident.
  const { data: inserted, error: insertError } = await withOptionalKind((kindColumnExists) =>
    db
      .from('financial_transactions')
      .insert(
        plan.rows.map((row) => ({
          user_id: user.id,
          account_id: row.account_id,
          amount: row.amount,
          type: row.type,
          description: row.description,
          transaction_date: date,
          source: row.is_transfer_side ? 'transfer' : 'manual',
          transfer_group_id: row.is_transfer_side ? groupId : null,
          ...(kindColumnExists ? { transfer_kind: row.is_transfer_side ? 'transfer' : null } : {}),
          currency: row.currency,
          fx_rate: row.fx_rate === null ? null : storableRate(row.fx_rate),
          amount_home: row.amount_home,
        })),
      )
      .select('id, account_id, amount, type, currency, fx_rate, amount_home, transfer_group_id'),
  );
  if (insertError) {
    if (missingTransferColumn(insertError)) return NextResponse.json(TRANSFERS_NOT_READY, { status: 503 });
    if (isFxSchemaMissing(insertError)) return NextResponse.json(NOT_READY, { status: 503 });
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // The rate the user actually got. A failure here leaves the rows in place (they already carry
  // their home amounts) and is reported, not rolled back.
  // Stored in the direction where the rate is >= 1 (1 USD = 17.5 MXN, not 1 MXN = 0.0571 USD),
  // so 8 decimal places keep its precision.
  const manual = plan.manualRate.rate >= 1
    ? plan.manualRate
    : { base: plan.manualRate.quote, quote: plan.manualRate.base, rate: plan.math.inverse };
  const { error: rateError } = await saveManualRate(db, user.id, {
    base: manual.base,
    quote: manual.quote,
    rate: storableRate(manual.rate),
    rate_date: date,
  });

  return NextResponse.json(
    {
      transfer_group_id: groupId,
      rate: plan.math.rate,
      inverse: plan.math.inverse,
      effective_rate: plan.math.effective_rate,
      rows: inserted ?? [],
      rate_saved: !rateError,
      ...(rateError ? { warning: 'The exchange was saved, but the rate could not be saved as your manual rate.' } : {}),
    },
    { status: 201 },
  );
}
