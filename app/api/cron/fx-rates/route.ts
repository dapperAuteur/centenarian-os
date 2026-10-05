// app/api/cron/fx-rates/route.ts
// GET: the daily exchange-rate refresh (vercel.json cron, "0 17 * * *": after the ECB's ~16:00
// CET publication that Frankfurter serves).
//
// Guard: Authorization: Bearer {CRON_SECRET}, the header Vercel Cron sends when CRON_SECRET is
// set, same check as app/api/cron/calendar-sync/route.ts. Middleware does not cover /api/*, so
// this is the only gate.
//
// Service role. Refreshes the latest USD -> X rate for every currency any user has (account
// currencies, user_currencies, home currencies): one Frankfurter request plus, only for codes
// Frankfurter lacks, one ExchangeRate-API request. Stores into the shared exchange_rates cache.
// Then, within a time budget, fills missing home-currency amounts for users with non-USD
// accounts (statement imports store amounts in the account's currency without converting).
//
// -> 200 { codes, stored, skipped, uncovered, backfill: { users, converted, unconverted,
//          skipped_for_time } } · 401 bad or missing secret

import { NextRequest, NextResponse } from 'next/server';
import { getServiceDb } from '@/lib/finance/transfers/server';
import { DEFAULT_HOME_CURRENCY, isCurrencyCode } from '@/lib/finance/fx/math';
import { isFxSchemaMissing, refreshLatest } from '@/lib/finance/fx/rates';
import { backfillHomeAmounts } from '@/lib/finance/fx/server';

export const maxDuration = 60;
const PAGE = 1000;
/** Stop starting new backfills after this. */
const BUDGET_MS = 45_000;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/** Distinct values of one text column, read page by page. */
async function distinctCodes(
  db: ReturnType<typeof getServiceDb>,
  table: string,
  column: string,
): Promise<{ codes: Set<string>; error: { code?: string; message: string } | null }> {
  const codes = new Set<string>();
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db
      .from(table)
      .select(column)
      .not(column, 'is', null)
      .order(column, { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) return { codes, error };
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    for (const row of rows) {
      const value = row[column];
      if (isCurrencyCode(value)) codes.add(value);
    }
    if (rows.length < PAGE) return { codes, error: null };
  }
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceDb();
  const all = new Set<string>([DEFAULT_HOME_CURRENCY]);
  for (const [table, column] of [
    ['financial_accounts', 'currency'],
    ['user_currencies', 'code'],
    ['profiles', 'home_currency'],
  ] as const) {
    const { codes, error } = await distinctCodes(db, table, column);
    if (error) {
      if (isFxSchemaMissing(error)) {
        return NextResponse.json({ error: 'Migration 210 is not applied yet.', code: 'fx_not_migrated' }, { status: 503 });
      }
      console.error(`[api/cron/fx-rates] reading ${table}.${column} failed:`, error.message);
      return NextResponse.json({ error: 'Could not list currencies.' }, { status: 500 });
    }
    codes.forEach((c) => all.add(c));
  }

  const codes = [...all].sort();
  const res = await refreshLatest(db, codes);
  if (res.error) {
    console.error('[api/cron/fx-rates] refresh failed:', res.error.message);
    return NextResponse.json({ error: 'Could not store rates.' }, { status: 500 });
  }
  // Users with at least one non-USD account (USD-home users are the common case; a user with a
  // different home currency is converted when they set it, see /api/finance/fx/home).
  const deadline = Date.now() + BUDGET_MS;
  const userIds = new Set<string>();
  const { data: foreign, error: foreignError } = await db
    .from('financial_accounts')
    .select('user_id')
    .neq('currency', 'USD')
    .limit(PAGE);
  if (foreignError) console.error('[api/cron/fx-rates] listing foreign accounts failed:', foreignError.message);
  for (const row of (foreign ?? []) as { user_id: string }[]) userIds.add(row.user_id);

  let converted = 0;
  let unconverted = 0;
  let done = 0;
  for (const userId of userIds) {
    if (Date.now() > deadline) break;
    const filled = await backfillHomeAmounts(db, userId, { limit: 500 });
    if (filled.error) {
      console.error('[api/cron/fx-rates] backfill failed for one user:', filled.error.message);
    } else {
      converted += filled.updated;
      unconverted += filled.unconverted;
    }
    done += 1;
  }

  return NextResponse.json({
    codes,
    stored: res.stored,
    skipped: res.skipped,
    uncovered: res.uncovered,
    backfill: { users: done, converted, unconverted, skipped_for_time: userIds.size - done },
  });
}
