// app/api/finance/fx/currencies/route.ts
// GET:    { home_currency, supported: [{ code, name, sources }], mine: [{ code, name, symbol,
//          added, in_accounts, covered, rate_to_home }] }
//         `supported` = what the free sources cover (Frankfurter + ExchangeRate-API);
//         `mine` = currencies in the user's accounts plus ones they added, each with its current
//         rate to the home currency (cache first; fetched server-side when missing).
// POST:   { code, name?, symbol? } adds a currency to "My currencies". Answers `warning` when no
//         free source covers it (rates must then be entered by hand).
// DELETE: ?code=XXX removes an added currency (accounts keep theirs).
//
// Rates are never fetched from the browser. 503 { code: 'fx_not_migrated' } before migration 210.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceDb } from '@/lib/finance/transfers/server';
import { listSupportedCurrencies } from '@/lib/finance/fx/catalog';
import { currencyName, currencySymbol, normalizeCurrency } from '@/lib/finance/fx/math';
import { getRate, isFxSchemaMissing } from '@/lib/finance/fx/rates';
import { loadHomeCurrency } from '@/lib/finance/fx/server';

const NOT_READY = {
  error: 'Currencies are not set up in this database yet. Run migration 210 first.',
  code: 'fx_not_migrated',
};

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceDb();
  const [home, supported, accts, added] = await Promise.all([
    loadHomeCurrency(db, user.id),
    listSupportedCurrencies(),
    db.from('financial_accounts').select('currency').eq('user_id', user.id),
    db.from('user_currencies').select('code, name, symbol, created_at').eq('user_id', user.id).order('code'),
  ]);
  const schemaError = accts.error ?? added.error;
  if (schemaError) {
    if (isFxSchemaMissing(schemaError)) return NextResponse.json({ ...NOT_READY, home_currency: home, supported, mine: [] }, { status: 503 });
    return NextResponse.json({ error: schemaError.message }, { status: 500 });
  }

  const supportedCodes = new Set(supported.map((s) => s.code));
  const inAccounts = new Set(((accts.data ?? []) as { currency: string }[]).map((a) => a.currency));
  const addedRows = (added.data ?? []) as { code: string; name: string | null; symbol: string | null }[];
  const codes = [...new Set([home, ...inAccounts, ...addedRows.map((r) => r.code)])].sort();
  const today = todayUtc();

  const mine = await Promise.all(
    codes.map(async (code) => {
      const own = addedRows.find((r) => r.code === code);
      const { rate } = code === home ? { rate: null } : await getRate(db, user.id, code, home, today);
      return {
        code,
        name: own?.name || currencyName(code) || code,
        symbol: own?.symbol || currencySymbol(code) || code,
        added: Boolean(own),
        in_accounts: inAccounts.has(code),
        is_home: code === home,
        // An empty `supported` means the lookup failed, not that nothing is covered.
        covered: supported.length === 0 ? null : supportedCodes.has(code),
        rate_to_home: rate,
      };
    }),
  );

  return NextResponse.json({ home_currency: home, supported, mine });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const code = normalizeCurrency(body?.code);
  if (!code) return NextResponse.json({ error: 'Enter a three-letter currency code, like EUR or MXN.' }, { status: 400 });
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : currencyName(code);
  const symbol = typeof body?.symbol === 'string' && body.symbol.trim() ? body.symbol.trim().slice(0, 8) : currencySymbol(code);

  const db = getServiceDb();
  const { data, error } = await db
    .from('user_currencies')
    .insert({ user_id: user.id, code, name, symbol })
    .select('code, name, symbol, created_at')
    .maybeSingle();
  if (error) {
    if (isFxSchemaMissing(error)) return NextResponse.json(NOT_READY, { status: 503 });
    if (error.code === '23505') return NextResponse.json({ error: `${code} is already in your currencies.` }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const supported = await listSupportedCurrencies();
  const covered = supported.length === 0 ? null : supported.some((s) => s.code === code);
  const warning = covered === false
    ? `No free rate source covers ${code}. Enter the rates you get by hand (Settings → My currencies → Add a rate).`
    : null;
  return NextResponse.json({ currency: data, covered, warning }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const code = normalizeCurrency(request.nextUrl.searchParams.get('code'));
  if (!code) return NextResponse.json({ error: 'code is required' }, { status: 400 });

  const db = getServiceDb();
  const { error } = await db.from('user_currencies').delete().eq('user_id', user.id).eq('code', code);
  if (error) {
    if (isFxSchemaMissing(error)) return NextResponse.json(NOT_READY, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
