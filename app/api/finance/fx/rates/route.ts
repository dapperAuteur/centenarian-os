// app/api/finance/fx/rates/route.ts
// GET:    ?from=MXN&to=USD[&date=YYYY-MM-DD]
//         -> { from, to, current: ResolvedRate | null, history: [{ id, base, quote, rate,
//              rate_date, source, manual }] }  (the pair's last 90 stored rates, either direction,
//              the user's manual ones plus shared fetched ones; fetched rows are stored USD -> X)
// POST:   { from, to, rate, date } saves the user's manual rate (1 from = rate to) for that day;
//         manual rates win over fetched ones for this user.
// DELETE: ?id=<uuid> removes one of the user's manual rates.
//
// 503 { code: 'fx_not_migrated' } before migration 210.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceDb } from '@/lib/finance/transfers/server';
import { PIVOT, normalizeCurrency } from '@/lib/finance/fx/math';
import { getRate, isFxSchemaMissing, saveManualRate } from '@/lib/finance/fx/rates';
import { storableRate } from '@/lib/finance/fx/server';

const NOT_READY = {
  error: 'Currencies are not set up in this database yet. Run migration 210 first.',
  code: 'fx_not_migrated',
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const from = normalizeCurrency(params.get('from'));
  const to = normalizeCurrency(params.get('to'));
  if (!from || !to) return NextResponse.json({ error: 'from and to must be three-letter currency codes.' }, { status: 400 });
  const dateParam = params.get('date');
  const date = dateParam && DATE_RE.test(dateParam) ? dateParam : new Date().toISOString().slice(0, 10);

  const db = getServiceDb();
  const pairCodes = [...new Set([from, to, PIVOT])];
  const [shared, own, current] = await Promise.all([
    db.from('exchange_rates').select('id, base, quote, rate, rate_date, source, user_id')
      .is('user_id', null).in('base', pairCodes).in('quote', pairCodes)
      .order('rate_date', { ascending: false }).limit(90),
    db.from('exchange_rates').select('id, base, quote, rate, rate_date, source, user_id')
      .eq('user_id', user.id).in('base', pairCodes).in('quote', pairCodes)
      .order('rate_date', { ascending: false }).limit(90),
    getRate(db, user.id, from, to, date),
  ]);
  const error = shared.error ?? own.error ?? current.error;
  if (error) {
    if (isFxSchemaMissing(error)) return NextResponse.json(NOT_READY, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = { id: string; base: string; quote: string; rate: number | string; rate_date: string; source: string; user_id: string | null };
  const history = [...((own.data ?? []) as Row[]), ...((shared.data ?? []) as Row[])]
    .filter((r) => r.base !== r.quote)
    .sort((a, b) => (a.rate_date < b.rate_date ? 1 : a.rate_date > b.rate_date ? -1 : 0))
    .slice(0, 90)
    .map((r) => ({
      id: r.id,
      base: r.base,
      quote: r.quote,
      rate: Number(r.rate),
      rate_date: r.rate_date,
      source: r.source,
      manual: r.user_id !== null,
    }));

  return NextResponse.json({ from, to, date, current: current.rate, history });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const from = normalizeCurrency(body?.from);
  const to = normalizeCurrency(body?.to);
  const rate = Number(body?.rate);
  const date = typeof body?.date === 'string' && DATE_RE.test(body.date) ? body.date : null;
  if (!from || !to) return NextResponse.json({ error: 'Pick both currencies.' }, { status: 400 });
  if (from === to) return NextResponse.json({ error: 'Pick two different currencies.' }, { status: 400 });
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1e9) {
    return NextResponse.json({ error: 'Enter a rate greater than 0.' }, { status: 400 });
  }
  if (!date) return NextResponse.json({ error: 'Pick the date you got this rate.' }, { status: 400 });

  const db = getServiceDb();
  const { error } = await saveManualRate(db, user.id, { base: from, quote: to, rate: storableRate(rate), rate_date: date });
  if (error) {
    if (isFxSchemaMissing(error)) return NextResponse.json(NOT_READY, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, base: from, quote: to, rate: storableRate(rate), rate_date: date }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const db = getServiceDb();
  const { error } = await db
    .from('exchange_rates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('source', 'manual');
  if (error) {
    if (isFxSchemaMissing(error)) return NextResponse.json(NOT_READY, { status: 503 });
    if (error.code === '22P02') return NextResponse.json({ error: 'Rate not found' }, { status: 404 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
