// lib/finance/csv-import/plan.ts
// Works out what importing a statement would do, without writing anything:
// which rows are new, which are already in the account, which are the same
// purchase as a manual or scanned entry, and which can't be imported.
//
// The decisions are pure functions (classifyRow, planRows, buildPlanIndex),
// tested in tests/unit/csv-import-plan.test.ts. planImport adds the database
// reads around them. Relative imports end in `.ts` so those tests can load
// this file under `node --test --experimental-strip-types`.
//
// The rules, in the order classifyRow applies them:
//   invalid            the row carries an issue (a pending row that was left
//                      out, an amount too large to store).
//   duplicate          (a) its external id is already on a row in the account;
//   duplicate_in_file  an earlier row of this file has the same external id
//                      (only bank IDs can repeat: hash ids carry a counter);
//   duplicate          (b) a row in the account has the same date, cents, type
//                      and vendor key. This is how old bank-sync rows and
//                      imports made before external ids count as duplicates.
//                      Each existing row answers for ONE statement row, so two
//                      identical coffees against one existing row are one
//                      duplicate and one new row.
//   matches            findBestMatch picks an unlinked manual or scanned entry
//                      of the same type, in the account or with no account.
//                      Each entry is matched once.
//   new                everything else.
//
// Unlinked manual and scanned entries are match candidates, not rule (b)
// targets: an identical manual entry is linked (and gets the external id)
// rather than reported as a duplicate.

import type { SupabaseClient } from '@supabase/supabase-js';
import { loadLearnedCategoryIndex } from '../learned-categories.ts';
import {
  MATCH_WINDOW_DAYS,
  findBestMatch,
  lookupLearnedCategory,
  shiftDate,
  vendorKey,
} from '../transaction-matching.ts';
import type { LearnedCategoryIndex, ManualCandidate } from '../transaction-matching.ts';
import { readAllPages } from './db.ts';
import type { PageResult } from './db.ts';
import { dbFailure } from './errors.ts';
import { assignExternalIds } from './parse.ts';
import type {
  MatchSummary,
  NormalizedRow,
  PlanTotals,
  PlannedRow,
  RowActionKind,
} from './types.ts';

/** financial_transactions.amount is NUMERIC(10,2): the largest value it holds, in cents. */
export const MAX_AMOUNT_CENTS = 9_999_999_999;

/** Sources whose rows a person typed or scanned, and that a statement row may be linked to. */
export const LINKABLE_SOURCES: readonly string[] = ['manual', 'scan'];

export const PENDING_REASON =
  'Still pending at the bank. Import it after it posts, or choose to include pending rows.';

/** A transaction already in the database, as the plan reads it. */
export interface ExistingTransaction {
  id: string;
  transaction_date: string;
  amount: number | string;
  type: string;
  description: string | null;
  vendor: string | null;
  external_id: string | null;
  source: string | null;
  account_id: string | null;
}

/** A normalized row with its dedupe key; the key is null on a pending row that was left out. */
export type PlanInputRow = NormalizedRow & { externalId: string | null };

type MatchCandidate = ManualCandidate & { type: string };

/** Everything classifyRow looks up. Built once per import by buildPlanIndex. */
export interface PlanIndex {
  accountId: string;
  /** external_id -> id of the row in the account that holds it. */
  byExternalId: ReadonlyMap<string, string>;
  /**
   * transactionKey -> ids of rows in the account that count as "already here"
   * under the same-transaction rule, in id order.
   */
  byKey: ReadonlyMap<string, readonly string[]>;
  /** Unlinked manual and scanned entries, in the account or with no account. */
  candidates: readonly MatchCandidate[];
  learned: LearnedCategoryIndex;
  /** Lowercased budget category name -> id. */
  categoryIdByName: ReadonlyMap<string, string>;
}

/**
 * What earlier rows of the file have already used, so one existing row
 * answers for one statement row. classifyRow reads it; planRows fills it.
 */
export interface PlanClaims {
  /** external id -> spreadsheet row that had it first. */
  seenExternalIds: Map<string, number>;
  /** Existing rows already reported as the duplicate of an earlier statement row. */
  usedDuplicates: Set<string>;
  /** Manual or scanned entries already matched to an earlier statement row. */
  claimedMatches: Set<string>;
}

export function createClaims(): PlanClaims {
  return { seenExternalIds: new Map(), usedDuplicates: new Set(), claimedMatches: new Set() };
}

/** A stored amount (dollars, as a number or numeric string) as positive integer cents. */
export function toCents(amount: number | string | null | undefined): number {
  const value = Math.abs(Number(amount));
  return Number.isFinite(value) ? Math.round(value * 100) : Number.NaN;
}

/**
 * The same-transaction key: date, cents, direction and vendor key. Statement
 * rows use their description; stored rows use their description, or their
 * vendor when the description is blank.
 */
export function transactionKey(
  date: string,
  cents: number,
  type: string,
  name: string | null | undefined,
): string {
  return [date.slice(0, 10), cents, type, vendorKey(name)].join('|');
}

function existingKey(row: ExistingTransaction): string {
  const name = row.description?.trim() ? row.description : row.vendor;
  return transactionKey(row.transaction_date, toCents(row.amount), row.type, name);
}

/** True for a row a statement row may be linked to: typed or scanned, and not linked yet. */
function isLinkable(row: ExistingTransaction): boolean {
  return row.external_id == null && LINKABLE_SOURCES.includes(row.source ?? '');
}

/**
 * Indexes what is already in the database for one import.
 *
 * - `accountRows`: the account's rows in the statement's date range.
 * - `unassigned`: the person's rows with no account in that range (only the
 *   unlinked manual and scanned ones are used).
 * - `fileExternalIds`: every external id in the file. A stored row holding one
 *   of them is the duplicate of that exact statement row, so it is kept out of
 *   the same-transaction index: it must not also absorb a second, identical row.
 */
export function buildPlanIndex(input: {
  accountId: string;
  accountRows: readonly ExistingTransaction[];
  unassigned?: readonly ExistingTransaction[];
  fileExternalIds?: ReadonlySet<string>;
  learned?: LearnedCategoryIndex;
  categories?: readonly { id: string; name: string }[];
}): PlanIndex {
  const fileExternalIds = input.fileExternalIds ?? new Set<string>();
  const byExternalId = new Map<string, string>();
  const byKey = new Map<string, string[]>();
  const candidates: MatchCandidate[] = [];

  const accountRows = [...input.accountRows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const row of accountRows) {
    if (row.external_id != null) {
      if (!byExternalId.has(row.external_id)) byExternalId.set(row.external_id, row.id);
      if (fileExternalIds.has(row.external_id)) continue;
    }
    if (isLinkable(row)) {
      candidates.push(row);
      continue;
    }
    const key = existingKey(row);
    const ids = byKey.get(key);
    if (ids) ids.push(row.id);
    else byKey.set(key, [row.id]);
  }
  for (const row of input.unassigned ?? []) {
    if (row.account_id == null && isLinkable(row)) candidates.push(row);
  }

  const categoryIdByName = new Map<string, string>();
  for (const category of input.categories ?? []) {
    const name = category.name?.trim().toLowerCase();
    if (name && !categoryIdByName.has(name)) categoryIdByName.set(name, category.id);
  }

  return {
    accountId: input.accountId,
    byExternalId,
    byKey,
    candidates,
    learned: input.learned ?? { vendor: new Map(), customer: new Map() },
    categoryIdByName,
  };
}

/**
 * The category a row gets when the person picks none: the vendor's learned
 * category first, then the file's own category column matched by name against
 * the person's budget categories. `type` decides whether vendors or customers
 * are searched, so pass the direction the row will be saved with.
 */
export function suggestCategory(
  row: Pick<NormalizedRow, 'vendor' | 'description' | 'categoryName'>,
  type: string,
  index: Pick<PlanIndex, 'learned' | 'categoryIdByName'>,
): { id: string | null; source: 'learned' | 'category_name' | null } {
  const learned =
    lookupLearnedCategory(index.learned, row.vendor, type) ??
    lookupLearnedCategory(index.learned, row.description, type);
  if (learned) return { id: learned, source: 'learned' };
  const byName = row.categoryName
    ? index.categoryIdByName.get(row.categoryName.trim().toLowerCase())
    : undefined;
  if (byName) return { id: byName, source: 'category_name' };
  return { id: null, source: null };
}

function invalidReason(row: PlanInputRow): string | null {
  if (row.issues.length > 0) return row.issues.join('; ');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return `Date "${row.date}" is not a real date`;
  if (!Number.isSafeInteger(row.amountCents) || row.amountCents <= 0) return 'Amount is not a number';
  if (row.amountCents > MAX_AMOUNT_CENTS) return 'Amount is larger than the app can store';
  if (!row.externalId) return 'The row has no import ID';
  return null;
}

/**
 * Decides one statement row's status. Pure: it reads `claims` and changes
 * nothing, so the caller records what the result used (see planRows).
 */
export function classifyRow(row: PlanInputRow, index: PlanIndex, claims: PlanClaims): PlannedRow {
  const base = (
    status: PlannedRow['status'],
    defaultAction: RowActionKind,
    extra: Partial<PlannedRow> = {},
  ): PlannedRow => {
    const suggestion =
      status === 'invalid' ? { id: null, source: null } : suggestCategory(row, row.type, index);
    return {
      ...row,
      status,
      defaultAction,
      suggestedCategoryId: suggestion.id,
      suggestedCategorySource: suggestion.source,
      ...extra,
    };
  };

  const invalid = invalidReason(row);
  if (invalid) return base('invalid', 'skip', { reason: invalid });
  const externalId = row.externalId as string;

  const sameId = index.byExternalId.get(externalId);
  if (sameId) {
    return base('duplicate', 'skip', {
      duplicateOf: sameId,
      duplicateRule: 'external_id',
      reason: 'This statement row was imported before.',
    });
  }

  const firstRow = claims.seenExternalIds.get(externalId);
  if (firstRow !== undefined) {
    return base('duplicate_in_file', 'skip', {
      duplicateOfRow: firstRow,
      reason: `Row ${firstRow} of this file has the same bank ID.`,
    });
  }

  const key = transactionKey(row.date, row.amountCents, row.type, row.description);
  const sameTransaction = index.byKey.get(key)?.find((id) => !claims.usedDuplicates.has(id));
  if (sameTransaction) {
    return base('duplicate', 'skip', {
      duplicateOf: sameTransaction,
      duplicateRule: 'same_transaction',
      reason: 'A transaction with the same date, amount and vendor is already in this account.',
    });
  }

  const match = findBestMatch(
    {
      amount: row.amountCents / 100,
      date: row.date,
      merchant: row.vendor,
      description: row.description,
      accountId: index.accountId,
    },
    // Money out never matches money in: a $50 refund is not the $50 purchase.
    index.candidates.filter((candidate) => candidate.type === row.type),
    claims.claimedMatches,
  );
  if (match) {
    const summary: MatchSummary = {
      id: match.id,
      transaction_date: match.transaction_date,
      amount: toCents(match.amount) / 100,
      vendor: match.vendor,
      description: match.description,
      account_id: match.account_id,
    };
    return base('matches', 'link', { match: summary });
  }

  return base('new', 'insert');
}

/** Records what a classified row used, so later rows can't use it again. */
export function recordClaims(planned: PlannedRow, claims: PlanClaims): void {
  if (planned.status === 'invalid' || !planned.externalId) return;
  if (!claims.seenExternalIds.has(planned.externalId)) {
    claims.seenExternalIds.set(planned.externalId, planned.rowNumber);
  }
  if (planned.status === 'duplicate' && planned.duplicateRule === 'same_transaction' && planned.duplicateOf) {
    claims.usedDuplicates.add(planned.duplicateOf);
  }
  if (planned.status === 'matches' && planned.match) claims.claimedMatches.add(planned.match.id);
}

/** Classifies every row in file order. Earlier rows get first pick of duplicates and matches. */
export function planRows(rows: readonly PlanInputRow[], index: PlanIndex): PlannedRow[] {
  const claims = createClaims();
  return rows.map((row) => {
    const planned = classifyRow(row, index, claims);
    recordClaims(planned, claims);
    return planned;
  });
}

export function countStatuses(rows: readonly PlannedRow[]): PlanTotals {
  const totals: PlanTotals = {
    rows: rows.length,
    new: 0,
    duplicate: 0,
    duplicate_in_file: 0,
    matches: 0,
    invalid: 0,
  };
  for (const row of rows) totals[row.status] += 1;
  return totals;
}

/**
 * Gives each row its external id. Rows the bank marks pending are left out
 * unless `includePending` is set: they get no id and an issue saying why, so
 * classifyRow reports them as invalid. The ids of the other rows are counted
 * without them (see assignExternalIds), so preview and commit must use the
 * same `includePending` to agree.
 */
export function identifyRows(rows: readonly NormalizedRow[], includePending: boolean): PlanInputRow[] {
  const leftOut = (row: NormalizedRow): boolean => row.pending === true && !includePending;
  const ids = new Map<number, string>();
  for (const row of assignExternalIds(rows.filter((r) => !leftOut(r)))) {
    ids.set(row.rowNumber, row.externalId);
  }
  return rows.map((row) =>
    leftOut(row)
      ? { ...row, issues: [...row.issues, PENDING_REASON], externalId: null }
      : { ...row, externalId: ids.get(row.rowNumber) ?? null },
  );
}

const EXISTING_COLUMNS =
  'id, transaction_date, amount, type, description, vendor, external_id, source, account_id';

export interface PlanResult {
  rows: PlannedRow[];
  totals: PlanTotals;
}

/**
 * Plans the import of a statement's rows into one account. Reads only.
 *
 * Reads the account's rows in the statement's date range (widened by the
 * match window), the person's unlinked manual and scanned entries with no
 * account in that range, their learned vendor categories and their budget
 * categories, then classifies every row (see the rules at the top of this
 * file). The caller must already have checked that the account is the user's.
 *
 * Throws ImportError when a read fails; "Run migration 203 first" when the
 * import columns don't exist yet.
 */
export async function planImport(
  db: SupabaseClient,
  userId: string,
  accountId: string,
  rows: readonly NormalizedRow[],
  options: { includePending?: boolean } = {},
): Promise<PlanResult> {
  const identified = identifyRows(rows, options.includePending === true);
  const usable = identified.filter((row) => row.externalId !== null && row.issues.length === 0);

  let index = buildPlanIndex({ accountId, accountRows: [] });
  if (usable.length > 0) {
    const dates = usable.map((row) => row.date).sort();
    const from = shiftDate(dates[0], -MATCH_WINDOW_DAYS);
    const to = shiftDate(dates[dates.length - 1], MATCH_WINDOW_DAYS);

    const [accountRows, unassigned, learned, categories] = await Promise.all([
      readAllPages<ExistingTransaction>('read this account\'s transactions', (start, end) =>
        db
          .from('financial_transactions')
          .select(EXISTING_COLUMNS)
          .eq('user_id', userId)
          .eq('account_id', accountId)
          .gte('transaction_date', from)
          .lte('transaction_date', to)
          .order('id')
          .range(start, end) as unknown as PageResult<ExistingTransaction>,
      ),
      readAllPages<ExistingTransaction>('read your unassigned transactions', (start, end) =>
        db
          .from('financial_transactions')
          .select(EXISTING_COLUMNS)
          .eq('user_id', userId)
          .is('account_id', null)
          .is('external_id', null)
          .in('source', [...LINKABLE_SOURCES])
          .gte('transaction_date', from)
          .lte('transaction_date', to)
          .order('id')
          .range(start, end) as unknown as PageResult<ExistingTransaction>,
      ),
      loadLearnedCategoryIndex(db, userId),
      loadCategories(db, userId),
    ]);

    index = buildPlanIndex({
      accountId,
      accountRows,
      unassigned,
      fileExternalIds: new Set(usable.map((row) => row.externalId as string)),
      learned,
      categories,
    });
  }

  const planned = planRows(identified, index);
  return { rows: planned, totals: countStatuses(planned) };
}

/** The person's budget categories, for matching a file's category column by name. */
export async function loadCategories(
  db: SupabaseClient,
  userId: string,
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await db.from('budget_categories').select('id, name').eq('user_id', userId);
  if (error) throw dbFailure(error, 'read your budget categories');
  return (data ?? []) as { id: string; name: string }[];
}
