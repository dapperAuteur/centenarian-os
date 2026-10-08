// lib/finance/brands/server.ts
// Database reads for business (brand) figures: every transaction tagged to a business (all pages,
// so the 1000-row cap can't cut a P&L short), the Wallet's one row per business
// (loadBrandSummaries) and the business page (loadBrandPage). Rules: ./logic.ts.
//
// ONE LOADER. Every business figure the Wallet shows goes through loadBrandSummaries(), so when
// CentenarianOS starts pushing business summaries to Work.WitUS as a signed event (plans/66, BAM's
// answer to W1: CentOS owns the business page and pushes), the event is built from the same
// numbers the page shows.
//
// Callers pass a service-role client and the signed-in user's id; every query is scoped with
// .eq('user_id', userId). Imports only sibling files with .ts extensions (and types), so the tests
// run it against the in-memory fake (tests/unit/wallet.test.ts).

import type { SupabaseClient } from '@supabase/supabase-js';
import { isUuid } from '../../auth/ownership.ts';
import { withOptionalFx } from '../fx/totals.ts';
import { getExpectedIncome } from '../income-source.ts';
import {
  CASH_FLOW_GRANULARITIES,
  EXPECTED_INCOME_DAYS,
  OPEN_INVOICE_STATUSES,
  brandOfRow,
  cashFlowStart,
  cashFlowTable,
  daysAhead,
  expectedIncomeTotal,
  moneyInOut,
  openInvoices,
  yearStart,
} from './logic.ts';
import type { BrandTxnRow, CashFlowGranularity, CashFlowTable, InvoiceRow, MoneyInOut, OpenInvoices } from './logic.ts';

export const BRAND_PAGE_SIZE = 1000;

export interface DbErr {
  code?: string | null;
  message?: string | null;
}

export interface BrandRecord {
  id: string;
  name: string;
  dba_name: string | null;
  ein: string | null;
  address?: string | null;
  website?: string | null;
  color: string | null;
  description?: string | null;
  is_active: boolean;
}

export interface LoadBrandRowsOptions {
  /** One business; omitted or null = every row tagged to any business. */
  brandId?: string | null;
  /** Inclusive YYYY-MM-DD bounds; omitted = open-ended. */
  from?: string | null;
  to?: string | null;
}

/**
 * Every transaction tagged to a business in the window, newest first, read 1000 rows at a time.
 * Selects '*' plus the account's currency (migration 210); before 210 it runs without it and every
 * row reads as home currency.
 */
export async function loadBrandTransactions<T extends BrandTxnRow = BrandTxnRow>(
  db: SupabaseClient,
  userId: string,
  options: LoadBrandRowsOptions = {},
): Promise<{ rows: T[]; error: DbErr | null }> {
  const result = await withOptionalFx(async (fxColumnsExist) => {
    const rows: T[] = [];
    for (let offset = 0; ; offset += BRAND_PAGE_SIZE) {
      let query = db
        .from('financial_transactions')
        .select(fxColumnsExist ? '*, financial_accounts(currency)' : '*')
        .eq('user_id', userId);
      query = options.brandId ? query.eq('brand_id', options.brandId) : query.not('brand_id', 'is', null);
      if (options.from) query = query.gte('transaction_date', options.from);
      if (options.to) query = query.lte('transaction_date', options.to);
      const res = await query
        .order('transaction_date', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + BRAND_PAGE_SIZE - 1);
      if (res.error) return { data: rows, error: res.error as DbErr };
      const page = (res.data ?? []) as unknown as T[];
      rows.push(...page);
      if (page.length < BRAND_PAGE_SIZE) return { data: rows, error: null };
    }
  });
  return { rows: result.data, error: result.error };
}

export interface BrandSummary {
  id: string;
  name: string;
  dba_name: string | null;
  color: string | null;
  is_active: boolean;
  /** Jan 1 through today, home currency. */
  this_year: MoneyInOut;
  invoices: OpenInvoices;
  /** Expected income in the next EXPECTED_INCOME_DAYS days. */
  expected_income: number;
  expected_income_count: number;
}

export interface BrandSummaries {
  home_currency: string;
  brands: BrandSummary[];
  /** Across every business, this year. */
  totals: { money_in: number; money_out: number; net: number; unconverted: number };
}

async function loadBrands(db: SupabaseClient, userId: string): Promise<{ brands: BrandRecord[]; error: DbErr | null }> {
  const res = await db.from('user_brands').select('*').eq('user_id', userId).order('name', { ascending: true });
  if (res.error) return { brands: [], error: res.error };
  return { brands: (res.data ?? []) as BrandRecord[], error: null };
}

async function loadOpenInvoices(db: SupabaseClient, userId: string, brandId: string | null): Promise<{ rows: InvoiceRow[]; error: DbErr | null }> {
  let query = db
    .from('invoices')
    .select('brand_id, direction, status, total, amount_paid')
    .eq('user_id', userId)
    .in('status', [...OPEN_INVOICE_STATUSES]);
  query = brandId ? query.eq('brand_id', brandId) : query.not('brand_id', 'is', null);
  const res = await query.range(0, BRAND_PAGE_SIZE - 1);
  if (res.error) return { rows: [], error: res.error };
  return { rows: (res.data ?? []) as InvoiceRow[], error: null };
}

/**
 * One row per business for the Wallet: this year's money in, out and net, open invoices and
 * expected income in the next 90 days. Account tags (plans/66 W4) arrive with migration 227; until
 * then only a transaction's own tag counts.
 */
export async function loadBrandSummaries(
  db: SupabaseClient,
  userId: string,
  today: string,
  home: string,
): Promise<{ summaries: BrandSummaries | null; error: DbErr | null }> {
  const { brands, error } = await loadBrands(db, userId);
  if (error) return { summaries: null, error };
  const empty = { money_in: 0, money_out: 0, net: 0, unconverted: 0 };
  if (brands.length === 0) return { summaries: { home_currency: home, brands: [], totals: empty }, error: null };

  const [rowsRes, invoiceRes, expected] = await Promise.all([
    loadBrandTransactions(db, userId, { from: yearStart(today), to: today }),
    loadOpenInvoices(db, userId, null),
    getExpectedIncome(db, userId, today, daysAhead(today, EXPECTED_INCOME_DAYS)),
  ]);
  if (rowsRes.error) return { summaries: null, error: rowsRes.error };
  if (invoiceRes.error) return { summaries: null, error: invoiceRes.error };

  const summaries = brands.map((b): BrandSummary => {
    const own = rowsRes.rows.filter((r) => brandOfRow(r) === b.id);
    const expectedOwn = expected.filter((e) => e.brand_id === b.id);
    return {
      id: b.id,
      name: b.name,
      dba_name: b.dba_name ?? null,
      color: b.color ?? null,
      is_active: b.is_active !== false,
      this_year: moneyInOut(own, home),
      invoices: openInvoices(invoiceRes.rows.filter((i) => i.brand_id === b.id)),
      expected_income: expectedIncomeTotal(expectedOwn),
      expected_income_count: expectedOwn.length,
    };
  });
  const totals = summaries.reduce(
    (t, s) => ({
      money_in: Math.round((t.money_in + s.this_year.money_in) * 100) / 100,
      money_out: Math.round((t.money_out + s.this_year.money_out) * 100) / 100,
      net: Math.round((t.net + s.this_year.net) * 100) / 100,
      unconverted: t.unconverted + s.this_year.unconverted,
    }),
    empty,
  );
  return { summaries: { home_currency: home, brands: summaries, totals }, error: null };
}

export interface BrandPage {
  brand: BrandRecord;
  home_currency: string;
  today: string;
  /** Jan 1 through today; its `unconverted` counts this year's rows only. */
  this_year: MoneyInOut;
  /** Each table counts the rows left out of its own periods (`unconverted`). */
  cash_flow: Record<CashFlowGranularity, CashFlowTable>;
  invoices: OpenInvoices;
  expected_income: { total: number; count: number; until: string };
  /** What is tagged to this business today (all time). */
  tagged: { transactions: number | null; invoices: number | null; trips: number | null };
}

async function countTagged(db: SupabaseClient, userId: string, table: string, brandId: string): Promise<number | null> {
  const res = await db.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('brand_id', brandId);
  if (res.error) return null;
  return typeof res.count === 'number' ? res.count : null;
}

/**
 * The business page's figures, or { page: null } when the business isn't the caller's. An id that
 * isn't a UUID (a mistyped or cut-off link) is not found either, rather than reaching the database
 * and failing there.
 */
export async function loadBrandPage(
  db: SupabaseClient,
  userId: string,
  brandId: string,
  today: string,
  home: string,
): Promise<{ page: BrandPage | null; error: DbErr | null }> {
  if (!isUuid(brandId)) return { page: null, error: null };
  const brandRes = await db.from('user_brands').select('*').eq('id', brandId).eq('user_id', userId).maybeSingle();
  if (brandRes.error) return { page: null, error: brandRes.error };
  const brand = brandRes.data as BrandRecord | null;
  if (!brand) return { page: null, error: null };

  const until = daysAhead(today, EXPECTED_INCOME_DAYS);
  const [rowsRes, invoiceRes, expected, transactions, invoices, trips] = await Promise.all([
    loadBrandTransactions(db, userId, { brandId, from: cashFlowStart(today), to: today }),
    loadOpenInvoices(db, userId, brandId),
    getExpectedIncome(db, userId, today, until),
    countTagged(db, userId, 'financial_transactions', brandId),
    countTagged(db, userId, 'invoices', brandId),
    countTagged(db, userId, 'trips', brandId),
  ]);
  if (rowsRes.error) return { page: null, error: rowsRes.error };
  if (invoiceRes.error) return { page: null, error: invoiceRes.error };

  const cashFlow = Object.fromEntries(
    CASH_FLOW_GRANULARITIES.map((g) => [g, cashFlowTable(rowsRes.rows, home, today, g)]),
  ) as Record<CashFlowGranularity, CashFlowTable>;
  const expectedOwn = expected.filter((e) => e.brand_id === brandId);
  return {
    page: {
      brand,
      home_currency: home,
      today,
      this_year: moneyInOut(rowsRes.rows, home, yearStart(today), today),
      cash_flow: cashFlow,
      invoices: openInvoices(invoiceRes.rows),
      expected_income: { total: expectedIncomeTotal(expectedOwn), count: expectedOwn.length, until },
      tagged: { transactions, invoices, trips },
    },
    error: null,
  };
}
