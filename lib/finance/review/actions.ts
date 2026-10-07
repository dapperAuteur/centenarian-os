// lib/finance/review/actions.ts
// What the finance Review page's buttons do (POST /api/finance/review), and
// the transfer linking that "Re-run transfer matching" on an import reuses.
//
// Every write is scoped to the user (`.eq('user_id', ...)`), every id the
// browser sends is checked to be the user's before anything changes, and a
// row that changed since the page loaded is reported, never forced:
//   - link pairs      the two rows get one transfer_group_id (and the kind),
//                     only while both are still unlinked; half a link is undone
//   - link payments   a payment is linked to the matching row on the account
//                     the person chose, or, when there is none and they allow
//                     it, the other side is recorded there (as the importer does)
//   - merge matches   the person's entry is kept and takes the imported row's
//                     statement identity; the imported copy is deleted
//   - dismiss/restore "Not a transfer" and the like, remembered per user
//   - categorize      one budget category (the user's own) on many rows
//
// Relative imports end in `.ts` for `node --test --experimental-strip-types`.

import type { SupabaseClient } from '@supabase/supabase-js';
import { ownedIds } from '../../auth/ownership.ts';
import { ID_CHUNK, chunk } from '../csv-import/db.ts';
import { ImportError } from '../csv-import/errors.ts';
import { LINKABLE_SOURCES } from '../csv-import/plan.ts';
import { clearGroup, counterEntryDescription, pickCounterpart, PAYMENT_WINDOW_DAYS } from '../csv-import/transfer-links.ts';
import { accountLabel, checkPair, kindForDestination, toCents, type TransferKind } from '../transfers/pairing.ts';
import { TRANSFERS_NOT_READY, isMissingColumn, missingTransferColumn, withOptionalKind } from '../transfers/schema.ts';
import { scoreCandidate, shiftDate } from '../transaction-matching.ts';
import { REVIEW_MIGRATION_CODE, REVIEW_MIGRATION_MESSAGE, isReviewSchemaMissing } from './schema.ts';
import { dismissalKey, isDismissalSection, type DismissalSection } from './sections.ts';

/** The most items one request acts on (the transactions bulk route's own limit). */
export const MAX_REVIEW_BATCH = 200;
/** The most dismissals one request saves (moving a browser's old answers to the account at once). */
export const MAX_DISMISS_BATCH = 2000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const bad = (message: string): ImportError => new ImportError(400, 'bad_request', message);

function writeFailure(error: { code?: string | null; message?: string | null } | null, doing: string): ImportError {
  if (missingTransferColumn(error)) return new ImportError(503, TRANSFERS_NOT_READY.code, TRANSFERS_NOT_READY.error);
  if (isReviewSchemaMissing(error)) return new ImportError(503, REVIEW_MIGRATION_CODE, REVIEW_MIGRATION_MESSAGE);
  const detail = error?.message?.trim();
  return new ImportError(500, 'database_error', detail ? `Could not ${doing}: ${detail}` : `Could not ${doing}.`);
}

/** A list from the request, checked for size. Throws ImportError 400. */
function readList(value: unknown, name: string, max: number = MAX_REVIEW_BATCH): unknown[] {
  if (!Array.isArray(value) || value.length === 0) throw bad(`${name} must be a non-empty list.`);
  if (value.length > max) throw bad(`Up to ${max.toLocaleString('en-US')} ${name} at a time.`);
  return value;
}

/** A transaction as the writes here read it. */
export interface ActionRow {
  id: string;
  account_id: string | null;
  amount: number | string;
  type: 'expense' | 'income';
  transaction_date: string;
  description: string | null;
  vendor: string | null;
  source: string | null;
  external_id: string | null;
  import_batch_id: string | null;
  category_id: string | null;
  transfer_group_id: string | null;
}

const ROW_COLUMNS =
  'id, account_id, amount, type, transaction_date, description, vendor, source, external_id, import_batch_id, category_id, transfer_group_id';

/** The user's rows among `ids`, by id. Someone else's id is simply absent. */
export async function loadRows(db: SupabaseClient, userId: string, ids: readonly string[]): Promise<Map<string, ActionRow>> {
  const rows = new Map<string, ActionRow>();
  for (const group of chunk([...new Set(ids)], ID_CHUNK)) {
    const { data, error } = await db.from('financial_transactions').select(ROW_COLUMNS).eq('user_id', userId).in('id', group);
    if (error) throw writeFailure(error, 'read the transactions');
    for (const row of (data ?? []) as ActionRow[]) rows.set(row.id, row);
  }
  return rows;
}

interface AccountRow {
  id: string;
  name: string;
  account_type: string;
  institution_name: string | null;
  last_four: string | null;
  currency?: string | null;
}

/** The user's accounts among `ids`, by id. `currency` arrives with migration 210; before it everything is USD. */
async function loadAccounts(db: SupabaseClient, userId: string, ids: readonly string[]): Promise<Map<string, AccountRow>> {
  const wanted = [...new Set(ids.filter(Boolean))];
  if (wanted.length === 0) return new Map();
  const run = (withCurrency: boolean) =>
    db
      .from('financial_accounts')
      .select(withCurrency ? 'id, name, account_type, institution_name, last_four, currency' : 'id, name, account_type, institution_name, last_four')
      .eq('user_id', userId)
      .in('id', wanted);
  let result = await run(true);
  if (result.error && isMissingColumn(result.error, 'currency')) result = await run(false);
  if (result.error) throw writeFailure(result.error, 'read your accounts');
  return new Map(((result.data ?? []) as unknown as AccountRow[]).map((account) => [account.id, account]));
}

export interface ActionFailure {
  /** The transaction the failure is about (the first of a pair). */
  id: string;
  reason: string;
}

/**
 * Gives two rows one new transfer group, only while both are still unlinked.
 * Returns null when it worked, else the reason. Never leaves half a transfer.
 */
export async function groupPair(
  db: SupabaseClient,
  userId: string,
  ids: readonly [string, string],
  kind: TransferKind,
): Promise<string | null> {
  const groupId = crypto.randomUUID();
  const { data, error } = await withOptionalKind((kindColumnExists) =>
    db
      .from('financial_transactions')
      .update(kindColumnExists ? { transfer_group_id: groupId, transfer_kind: kind } : { transfer_group_id: groupId })
      .eq('user_id', userId)
      .in('id', [...ids])
      .is('transfer_group_id', null)
      .select('id'),
  );
  const grouped = ((data ?? []) as { id: string }[]).map((row) => row.id);
  if (error || grouped.length !== 2) {
    if (grouped.length > 0) await clearGroup(db, userId, grouped);
    if (error && missingTransferColumn(error)) return TRANSFERS_NOT_READY.error;
    return error?.message ?? 'One of the two was just linked to another transfer.';
  }
  return null;
}

// ── Link suggested transfer pairs ─────────────────────────────────────────

export interface LinkPairsResult {
  linked: number;
  failed: ActionFailure[];
}

/** `pairs`: [{ from_id, to_id }]. Each pair is checked again (amounts, accounts, direction) before it is linked. */
export async function linkTransferPairs(db: SupabaseClient, userId: string, pairsValue: unknown): Promise<LinkPairsResult> {
  const pairs = readList(pairsValue, 'pairs').map((item) => {
    if (!isRecord(item) || !isUuid(item.from_id) || !isUuid(item.to_id) || item.from_id === item.to_id) {
      throw bad('Each pair needs two different transaction ids, from_id and to_id.');
    }
    return { from: item.from_id, to: item.to_id };
  });
  const rows = await loadRows(db, userId, pairs.flatMap((pair) => [pair.from, pair.to]));
  const accountIds = [...rows.values()].map((row) => row.account_id).filter((id): id is string => Boolean(id));
  const accounts = await loadAccounts(db, userId, accountIds);
  const accountTypes = new Map([...accounts.values()].map((account) => [account.id, account.account_type]));

  const result: LinkPairsResult = { linked: 0, failed: [] };
  const used = new Set<string>();
  for (const pair of pairs) {
    const a = rows.get(pair.from);
    const b = rows.get(pair.to);
    if (!a || !b) {
      result.failed.push({ id: pair.from, reason: 'One of these transactions was not found.' });
      continue;
    }
    if (a.transfer_group_id || b.transfer_group_id || used.has(a.id) || used.has(b.id)) {
      result.failed.push({ id: pair.from, reason: 'One of these transactions is already part of a transfer.' });
      continue;
    }
    const check = checkPair(
      { id: a.id, account_id: a.account_id, amountCents: toCents(a.amount), type: a.type },
      { id: b.id, account_id: b.account_id, amountCents: toCents(b.amount), type: b.type },
      accountTypes,
    );
    if (!check.ok) {
      result.failed.push({ id: pair.from, reason: check.error });
      continue;
    }
    const failure = await groupPair(db, userId, [check.fromId, check.toId], check.kind);
    if (failure) {
      result.failed.push({ id: pair.from, reason: failure });
      continue;
    }
    used.add(a.id);
    used.add(b.id);
    result.linked += 1;
  }
  return result;
}

// ── Link one-sided card and loan payments ─────────────────────────────────

export interface LinkPaymentsResult {
  /** Linked to the matching row already on the other account. */
  linked: number;
  /** No matching row, so the other side was recorded on that account. */
  recorded: number;
  /** No matching row, and recording it was turned off. */
  unmatched: number;
  failed: ActionFailure[];
}

/**
 * `items`: [{ transaction_id, account_id }], the account on the other side of
 * each payment ("Paid from" for a payment on a card or loan, "Paid to" for
 * money out of a bank account). The same rules as the importer's "Paid from"
 * (lib/finance/csv-import/transfer-links.ts): the opposite type, the same
 * amount to the cent, within 5 days, not already linked; closest date wins.
 */
export async function linkPayments(
  db: SupabaseClient,
  userId: string,
  itemsValue: unknown,
  options: { recordMissing?: boolean } = {},
): Promise<LinkPaymentsResult> {
  const recordMissing = options.recordMissing !== false;
  const items = readList(itemsValue, 'items').map((item) => {
    if (!isRecord(item) || !isUuid(item.transaction_id) || !isUuid(item.account_id)) {
      throw bad('Each payment needs its transaction_id and the account_id on the other side.');
    }
    return { id: item.transaction_id, otherAccountId: item.account_id };
  });
  const rows = await loadRows(db, userId, items.map((item) => item.id));
  const accounts = await loadAccounts(db, userId, [
    ...items.map((item) => item.otherAccountId),
    ...[...rows.values()].map((row) => row.account_id ?? ''),
  ]);

  const result: LinkPaymentsResult = { linked: 0, recorded: 0, unmatched: 0, failed: [] };
  const claimed = new Set<string>();
  for (const item of items) {
    const row = rows.get(item.id);
    if (!row) {
      result.failed.push({ id: item.id, reason: 'This transaction was not found.' });
      continue;
    }
    if (row.transfer_group_id) {
      result.failed.push({ id: item.id, reason: 'This transaction is already part of a transfer.' });
      continue;
    }
    const own = row.account_id ? accounts.get(row.account_id) : undefined;
    const other = accounts.get(item.otherAccountId);
    if (!own) {
      result.failed.push({ id: item.id, reason: 'This transaction has no account, so it can’t be linked.' });
      continue;
    }
    if (!other || other.id === own.id) {
      result.failed.push({ id: item.id, reason: 'Choose one of your other accounts.' });
      continue;
    }
    if ((own.currency ?? 'USD') !== (other.currency ?? 'USD')) {
      result.failed.push({
        id: item.id,
        reason: `${accountLabel(other)} is in ${other.currency ?? 'USD'}. Record it with Exchange money instead.`,
      });
      continue;
    }

    const otherType = row.type === 'income' ? 'expense' : 'income';
    const kind = kindForDestination(row.type === 'income' ? own.account_type : other.account_type);
    const cents = toCents(row.amount);
    const found = await db
      .from('financial_transactions')
      .select('id, transaction_date')
      .eq('user_id', userId)
      .eq('account_id', other.id)
      .eq('type', otherType)
      .eq('amount', cents / 100)
      .gte('transaction_date', shiftDate(row.transaction_date, -PAYMENT_WINDOW_DAYS))
      .lte('transaction_date', shiftDate(row.transaction_date, PAYMENT_WINDOW_DAYS))
      .is('transfer_group_id', null);
    if (found.error) {
      result.failed.push({ id: item.id, reason: writeFailure(found.error, 'look for the other side').message });
      continue;
    }
    const counterpart = pickCounterpart(
      row.transaction_date,
      ((found.data ?? []) as { id: string; transaction_date: string }[]).filter((candidate) => candidate.id !== row.id),
      claimed,
    );
    if (counterpart) {
      const failure = await groupPair(db, userId, [row.id, counterpart.id], kind);
      if (failure) {
        result.failed.push({ id: item.id, reason: failure });
        continue;
      }
      claimed.add(counterpart.id);
      result.linked += 1;
      continue;
    }
    if (!recordMissing) {
      result.unmatched += 1;
      continue;
    }

    const groupId = crypto.randomUUID();
    const inserted = await withOptionalKind((kindColumnExists) =>
      db
        .from('financial_transactions')
        .insert({
          user_id: userId,
          account_id: other.id,
          amount: cents / 100,
          type: otherType,
          description: counterEntryDescription(otherType, own, other),
          transaction_date: row.transaction_date,
          source: 'transfer',
          transfer_group_id: groupId,
          ...(kindColumnExists ? { transfer_kind: kind } : {}),
        })
        .select('id'),
    );
    const counterId = ((inserted.data ?? []) as { id: string }[])[0]?.id;
    if (inserted.error || !counterId) {
      result.failed.push({
        id: item.id,
        reason: inserted.error ? writeFailure(inserted.error, `record the payment on ${accountLabel(other)}`).message : 'Nothing was saved.',
      });
      continue;
    }
    const linkedRow = await withOptionalKind((kindColumnExists) =>
      db
        .from('financial_transactions')
        .update(kindColumnExists ? { transfer_group_id: groupId, transfer_kind: kind } : { transfer_group_id: groupId })
        .eq('user_id', userId)
        .eq('id', row.id)
        .is('transfer_group_id', null)
        .select('id'),
    );
    if (linkedRow.error || (linkedRow.data ?? []).length !== 1) {
      // Take the recorded side back out so a failed link never changes a balance.
      await db.from('financial_transactions').delete().eq('user_id', userId).eq('id', counterId).eq('source', 'transfer');
      result.failed.push({ id: item.id, reason: linkedRow.error?.message ?? 'This transaction was just linked elsewhere.' });
      continue;
    }
    result.recorded += 1;
  }
  return result;
}

// ── Merge an imported row into the entry the person made ──────────────────

export interface MergeResult {
  merged: number;
  failed: ActionFailure[];
}

/**
 * `pairs`: [{ imported_id, entry_id }]. Keeps the person's entry (its notes,
 * receipt and category stay) and gives it the imported row's statement
 * identity, import and account, the same link a statement import makes when it
 * finds the match itself. Then the imported copy is deleted. Undoing that
 * import later unlinks the entry and keeps it.
 *
 * Order, so a failure part way never loses a row: the imported row lets go of
 * its identity, the entry takes it (only while still unlinked), and only then
 * is the imported row deleted. If the entry can't take it, the imported row
 * gets it back.
 */
export async function mergeMatches(db: SupabaseClient, userId: string, pairsValue: unknown): Promise<MergeResult> {
  const pairs = readList(pairsValue, 'pairs').map((item) => {
    if (!isRecord(item) || !isUuid(item.imported_id) || !isUuid(item.entry_id) || item.imported_id === item.entry_id) {
      throw bad('Each pair needs imported_id and entry_id.');
    }
    return { importedId: item.imported_id, entryId: item.entry_id };
  });
  const rows = await loadRows(db, userId, pairs.flatMap((pair) => [pair.importedId, pair.entryId]));

  const result: MergeResult = { merged: 0, failed: [] };
  const used = new Set<string>();
  for (const pair of pairs) {
    const imported = rows.get(pair.importedId);
    const entry = rows.get(pair.entryId);
    if (!imported || !entry || used.has(pair.importedId) || used.has(pair.entryId)) {
      result.failed.push({ id: pair.importedId, reason: 'One of these transactions was not found.' });
      continue;
    }
    const externalId = imported.external_id;
    if (imported.source !== 'csv_import' || !externalId || !imported.account_id || imported.transfer_group_id) {
      result.failed.push({ id: pair.importedId, reason: 'Only a row a statement import added, and not part of a transfer, can be merged.' });
      continue;
    }
    if (!LINKABLE_SOURCES.includes(entry.source ?? '') || entry.external_id || entry.transfer_group_id) {
      result.failed.push({ id: pair.importedId, reason: 'Your entry is already linked to another statement row or transfer.' });
      continue;
    }
    const score =
      entry.type === imported.type
        ? scoreCandidate(
            {
              amount: toCents(imported.amount) / 100,
              date: imported.transaction_date,
              merchant: imported.vendor,
              description: imported.description,
              accountId: imported.account_id,
            },
            entry,
          )
        : null;
    if (!score) {
      result.failed.push({ id: pair.importedId, reason: 'These two no longer look like the same purchase.' });
      continue;
    }

    // 1. The imported row lets go of its statement identity (only if it still holds it).
    const released = await db
      .from('financial_transactions')
      .update({ external_id: null })
      .eq('user_id', userId)
      .eq('id', imported.id)
      .eq('external_id', externalId)
      .select('id');
    if (released.error || (released.data ?? []).length !== 1) {
      result.failed.push({ id: pair.importedId, reason: released.error?.message ?? 'The imported row changed since the page loaded.' });
      continue;
    }

    // 2. The entry takes it, with the import and the account; its own category and name stay when it has them.
    const values: Record<string, unknown> = { external_id: externalId, import_batch_id: imported.import_batch_id };
    if (!entry.account_id) values.account_id = imported.account_id;
    if (!entry.category_id && imported.category_id) values.category_id = imported.category_id;
    if (!entry.vendor?.trim() && imported.vendor) values.vendor = imported.vendor;
    const taken = await db
      .from('financial_transactions')
      .update(values)
      .eq('user_id', userId)
      .eq('id', entry.id)
      .is('external_id', null)
      .select('id');
    if (taken.error || (taken.data ?? []).length !== 1) {
      await db.from('financial_transactions').update({ external_id: externalId }).eq('user_id', userId).eq('id', imported.id);
      result.failed.push({ id: pair.importedId, reason: taken.error?.message ?? 'Your entry was just linked to something else.' });
      continue;
    }

    // 3. The imported copy goes.
    const removed = await db
      .from('financial_transactions')
      .delete()
      .eq('user_id', userId)
      .eq('id', imported.id)
      .eq('source', 'csv_import')
      .select('id');
    if (removed.error || (removed.data ?? []).length !== 1) {
      result.failed.push({
        id: pair.importedId,
        reason: `Your entry was linked, but the imported copy couldn't be removed${removed.error ? `: ${removed.error.message}` : ''}. Delete it from the transactions list.`,
      });
      continue;
    }
    used.add(imported.id);
    used.add(entry.id);
    result.merged += 1;
  }
  return result;
}

// ── Remember "not a transfer" and the like ─────────────────────────────────

export interface DismissItem {
  section: DismissalSection;
  transaction_id: string;
  other_transaction_id: string | null;
}

/** Checks a list of dismissals. Malformed items are refused (400), not skipped. Pure. */
export function readDismissItems(value: unknown): DismissItem[] {
  const items = readList(value, 'items', MAX_DISMISS_BATCH).map((item) => {
    if (!isRecord(item) || !isDismissalSection(item.section) || !isUuid(item.transaction_id)) {
      throw bad('Each item needs a section (transfer_pair, one_sided_payment or possible_match) and a transaction_id.');
    }
    const other = item.other_transaction_id ?? null;
    if (other !== null && !isUuid(other)) throw bad('other_transaction_id is not a transaction id.');
    if ((item.section === 'transfer_pair' || item.section === 'possible_match') && other === null) {
      throw bad(`A ${item.section} answer needs both transactions.`);
    }
    return { section: item.section, transaction_id: item.transaction_id.toLowerCase(), other_transaction_id: other ? (other as string).toLowerCase() : null };
  });
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = dismissalKey(item.section, item.transaction_id, item.other_transaction_id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Saves the answers. Only answers about the user's own transactions are kept
 * (an id that isn't theirs is dropped, and the database checks again). Saving
 * an answer twice is fine. Returns how many are now on file.
 */
export async function dismissSuggestions(db: SupabaseClient, userId: string, value: unknown): Promise<{ dismissed: number }> {
  const items = readDismissItems(value);
  const owned = await ownedIds(db, userId, 'financial_transactions', items.flatMap((item) => [item.transaction_id, item.other_transaction_id]));
  if (owned.failed) throw new ImportError(500, 'database_error', 'Could not check those transactions.');
  const mine = items.filter(
    (item) => owned.has(item.transaction_id) && (item.other_transaction_id === null || owned.has(item.other_transaction_id)),
  );
  if (mine.length === 0) return { dismissed: 0 };

  // What is already on file, so the insert only carries new answers.
  const existing = new Set<string>();
  for (const group of chunk([...new Set(mine.map((item) => item.transaction_id))], ID_CHUNK)) {
    const { data, error } = await db
      .from('finance_review_dismissals')
      .select('section, transaction_id, other_transaction_id')
      .eq('user_id', userId)
      .in('transaction_id', group);
    if (error) throw writeFailure(error, 'read the answers on file');
    for (const row of (data ?? []) as DismissItem[]) {
      existing.add(dismissalKey(row.section, row.transaction_id, row.other_transaction_id));
    }
  }
  const fresh = mine.filter((item) => !existing.has(dismissalKey(item.section, item.transaction_id, item.other_transaction_id)));
  for (const group of chunk(fresh, 200)) {
    const payload = group.map((item) => ({ user_id: userId, ...item }));
    const { error } = await db.from('finance_review_dismissals').insert(payload);
    if (!error) continue;
    if (error.code !== '23505') throw writeFailure(error, 'remember your answer');
    // Another request saved one of these in the meantime: save the rest one at a time.
    for (const row of payload) {
      const single = await db.from('finance_review_dismissals').insert(row);
      if (single.error && single.error.code !== '23505') throw writeFailure(single.error, 'remember your answer');
    }
  }
  return { dismissed: mine.length };
}

/** Forgets answers: every one in the given sections. Returns how many were removed. */
export async function restoreDismissals(db: SupabaseClient, userId: string, sectionsValue: unknown): Promise<{ restored: number }> {
  const sections = Array.isArray(sectionsValue) ? sectionsValue.filter(isDismissalSection) : [];
  if (sections.length === 0) throw bad('sections must list transfer_pair, one_sided_payment or possible_match.');
  const { data, error } = await db
    .from('finance_review_dismissals')
    .delete()
    .eq('user_id', userId)
    .in('section', sections)
    .select('id');
  if (error) throw writeFailure(error, 'bring the suggestions back');
  return { restored: (data ?? []).length };
}

/** The user's answers for the given sections, newest first (the Possible transfers panel reads these). */
export async function listDismissals(db: SupabaseClient, userId: string, sections: readonly DismissalSection[]): Promise<DismissItem[]> {
  const { data, error } = await db
    .from('finance_review_dismissals')
    .select('section, transaction_id, other_transaction_id')
    .eq('user_id', userId)
    .in('section', [...sections])
    .order('created_at', { ascending: false })
    .limit(MAX_DISMISS_BATCH * 5);
  if (error) throw writeFailure(error, 'read the answers on file');
  return (data ?? []) as DismissItem[];
}

// ── Categorize ────────────────────────────────────────────────────────────

/**
 * Sets one budget category (or none, with null) on the user's rows among
 * `ids`. The category must be the user's own. Returns how many rows changed.
 */
export async function categorizeRows(
  db: SupabaseClient,
  userId: string,
  idsValue: unknown,
  categoryValue: unknown,
): Promise<{ updated: number }> {
  const ids = readList(idsValue, 'ids').filter(isUuid);
  if (ids.length === 0) throw bad('ids must be transaction ids.');
  if (categoryValue !== null && !isUuid(categoryValue)) throw bad('category_id must be one of your categories, or null for none.');
  if (categoryValue !== null) {
    const owned = await ownedIds(db, userId, 'budget_categories', [categoryValue]);
    if (owned.failed) throw new ImportError(500, 'database_error', 'Could not check the category.');
    if (!owned.has(categoryValue)) throw new ImportError(400, 'bad_reference', 'Invalid reference: category_id');
  }
  let updated = 0;
  for (const group of chunk([...new Set(ids)], ID_CHUNK)) {
    const { data, error } = await db
      .from('financial_transactions')
      .update({ category_id: categoryValue })
      .eq('user_id', userId)
      .in('id', group)
      .select('id');
    if (error) throw writeFailure(error, 'set the category');
    updated += (data ?? []).length;
  }
  return { updated };
}
