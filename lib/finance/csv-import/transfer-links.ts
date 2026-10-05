// lib/finance/csv-import/transfer-links.ts
// Links imported payments to the person's other account as transfers, at
// the end of a statement import. A card or loan payment is money moving
// between two of the person's own accounts, so it must not count as income
// on the card or as spending on the bank account.
//
// For each row the person tied to another account in the review step
// ("Paid from <checking>", or on a bank statement "This paid <card>"):
//   1. Find the other side on that account: the opposite type, the same amount
//      to the cent, within TRANSFER_WINDOW_DAYS, not already in a transfer.
//      Closest date wins; one row is used once.
//   2. Found: give both rows one transfer_group_id and the transfer_kind
//      (card_payment / loan_payment / transfer, from the account the money
//      reached), the same write POST /api/finance/transfers/link makes.
//   3. Not found: when the person allowed it (the default), record the other
//      side on that account as POST /api/finance/transfers/pay does:
//      source 'transfer', same amount and date, same group. When that
//      account's own statement is imported later, its real row links to this
//      entry instead of being added twice (see plan.ts, transfer entries).
//   4. Otherwise the row stays an ordinary row.
// A row that can't be linked is reported; the import itself is not undone.
//
// Undo (undo.ts) takes the transfer apart again: entries recorded here are
// deleted and the other side's link is cleared.
//
// Relative imports end in `.ts` so tests/unit/csv-import-plan.test.ts can
// load this file under `node --test --experimental-strip-types`.

import type { SupabaseClient } from '@supabase/supabase-js';
import { daysBetween, shiftDate } from '../transaction-matching.ts';
import { accountLabel, kindForDestination } from '../transfers/pairing.ts';
import { missingTransferColumn, withOptionalKind } from '../transfers/schema.ts';
import { ID_CHUNK, chunk } from './db.ts';
import type { RejectedRow, TransactionType, TransferLinkResult } from './types.ts';

/** Two sides of one payment may be this many days apart (the transfer feature's own window). */
export const PAYMENT_WINDOW_DAYS = 5;

export const TRANSFERS_NOT_READY_REASON =
  "Couldn't be linked as a transfer: the database is missing an update (migration 202). The row was imported as an ordinary transaction.";

export interface LinkAccount {
  id: string;
  name: string;
  account_type: string;
  institution_name: string | null;
  last_four: string | null;
}

/** One imported row the person tied to another account. */
export interface TransferIntent {
  rowNumber: number;
  /** The row's external id: how the saved transaction is found again. */
  externalId: string;
  type: TransactionType;
  amountCents: number;
  date: string;
  otherAccountId: string;
  recordMissing: boolean;
}

interface SavedRow {
  id: string;
  external_id: string;
  transfer_group_id: string | null;
}

interface CandidateRow {
  id: string;
  transaction_date: string;
}

const failure = (rowNumber: number, reason: string): RejectedRow => ({ row: rowNumber, reason });

/** Picks the closest-dated candidate that isn't claimed yet. Ties go to the lower id. */
export function pickCounterpart(
  date: string,
  candidates: readonly CandidateRow[],
  claimed: ReadonlySet<string>,
): CandidateRow | null {
  let best: CandidateRow | null = null;
  let bestDays = Infinity;
  for (const candidate of candidates) {
    if (claimed.has(candidate.id)) continue;
    const days = daysBetween(date, candidate.transaction_date);
    if (days > PAYMENT_WINDOW_DAYS) continue;
    if (days < bestDays || (days === bestDays && best !== null && candidate.id < best.id)) {
      best = candidate;
      bestDays = days;
    }
  }
  return best;
}

/** The description of a recorded other side: "Payment to Citi Costco ••1234" / "Payment from AZFCU Checking ••5678". */
export function counterEntryDescription(otherSideType: TransactionType, importedAccount: LinkAccount): string {
  return otherSideType === 'expense'
    ? `Payment to ${accountLabel(importedAccount)}`
    : `Payment from ${accountLabel(importedAccount)}`;
}

/**
 * Links each intent's imported row to the other account (see the top of
 * this file). `account` is the account the statement was imported into.
 */
export async function linkStatementTransfers(
  db: SupabaseClient,
  userId: string,
  account: LinkAccount,
  intents: readonly TransferIntent[],
): Promise<TransferLinkResult> {
  const result: TransferLinkResult = { linked: 0, recorded: 0, unmatched: 0, failed: [] };
  if (intents.length === 0) return result;

  // The saved transactions, by external id (inserted and linked rows both carry it).
  const saved = new Map<string, SavedRow>();
  for (const group of chunk(intents.map((intent) => intent.externalId), ID_CHUNK)) {
    const { data, error } = await db
      .from('financial_transactions')
      .select('id, external_id, transfer_group_id')
      .eq('user_id', userId)
      .eq('account_id', account.id)
      .in('external_id', group);
    if (error) {
      const reason = missingTransferColumn(error) ? TRANSFERS_NOT_READY_REASON : `Couldn't be linked as a transfer: ${error.message}`;
      return { ...result, failed: intents.map((intent) => failure(intent.rowNumber, reason)) };
    }
    for (const row of (data ?? []) as SavedRow[]) saved.set(row.external_id, row);
  }

  const otherIds = [...new Set(intents.map((intent) => intent.otherAccountId))];
  const { data: accountRows, error: accountError } = await db
    .from('financial_accounts')
    .select('id, name, account_type, institution_name, last_four')
    .eq('user_id', userId)
    .in('id', otherIds);
  if (accountError) {
    return {
      ...result,
      failed: intents.map((intent) => failure(intent.rowNumber, `Couldn't be linked as a transfer: ${accountError.message}`)),
    };
  }
  const accounts = new Map(((accountRows ?? []) as LinkAccount[]).map((row) => [row.id, row]));

  const claimed = new Set<string>();
  const ordered = [...intents].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.rowNumber - b.rowNumber));
  for (let index = 0; index < ordered.length; index++) {
    const intent = ordered[index];
    const row = saved.get(intent.externalId);
    if (!row) {
      result.failed.push(failure(intent.rowNumber, "Couldn't be linked as a transfer: the row wasn't saved."));
      continue;
    }
    // Already one side of a transfer (it was linked to a payment another import recorded).
    if (row.transfer_group_id) {
      result.linked += 1;
      continue;
    }
    const other = accounts.get(intent.otherAccountId);
    if (!other || other.id === account.id) {
      result.failed.push(failure(intent.rowNumber, "Couldn't be linked as a transfer: the other account wasn't found."));
      continue;
    }

    const otherType: TransactionType = intent.type === 'income' ? 'expense' : 'income';
    const kind = kindForDestination(intent.type === 'income' ? account.account_type : other.account_type);
    const amount = intent.amountCents / 100;

    const found = await db
      .from('financial_transactions')
      .select('id, transaction_date')
      .eq('user_id', userId)
      .eq('account_id', other.id)
      .eq('type', otherType)
      .eq('amount', amount)
      .gte('transaction_date', shiftDate(intent.date, -PAYMENT_WINDOW_DAYS))
      .lte('transaction_date', shiftDate(intent.date, PAYMENT_WINDOW_DAYS))
      .is('transfer_group_id', null);
    if (found.error) {
      if (missingTransferColumn(found.error)) {
        for (const rest of ordered.slice(index)) result.failed.push(failure(rest.rowNumber, TRANSFERS_NOT_READY_REASON));
        break;
      }
      result.failed.push(failure(intent.rowNumber, `Couldn't be linked as a transfer: ${found.error.message}`));
      continue;
    }
    const counterpart = pickCounterpart(intent.date, (found.data ?? []) as CandidateRow[], claimed);
    const groupId = crypto.randomUUID();

    if (counterpart) {
      const { data: grouped, error } = await withOptionalKind((kindColumnExists) =>
        db
          .from('financial_transactions')
          .update(kindColumnExists ? { transfer_group_id: groupId, transfer_kind: kind } : { transfer_group_id: groupId })
          .eq('user_id', userId)
          .in('id', [row.id, counterpart.id])
          .is('transfer_group_id', null)
          .select('id'),
      );
      if (error || (grouped ?? []).length !== 2) {
        // Never leave half a transfer: take back whichever row did get the group.
        const ids = ((grouped ?? []) as { id: string }[]).map((item) => item.id);
        if (ids.length > 0) await clearGroup(db, userId, ids);
        result.failed.push(
          failure(intent.rowNumber, `Couldn't be linked as a transfer: ${error?.message ?? 'the other row was just linked elsewhere.'}`),
        );
        continue;
      }
      claimed.add(counterpart.id);
      result.linked += 1;
      continue;
    }

    if (!intent.recordMissing) {
      result.unmatched += 1;
      continue;
    }

    const { data: inserted, error: insertError } = await withOptionalKind((kindColumnExists) =>
      db
        .from('financial_transactions')
        .insert({
          user_id: userId,
          account_id: other.id,
          amount,
          type: otherType,
          description: counterEntryDescription(otherType, account),
          transaction_date: intent.date,
          source: 'transfer',
          transfer_group_id: groupId,
          ...(kindColumnExists ? { transfer_kind: kind } : {}),
        })
        .select('id'),
    );
    const counterId = ((inserted ?? []) as { id: string }[])[0]?.id;
    if (insertError || !counterId) {
      result.failed.push(
        failure(
          intent.rowNumber,
          insertError && missingTransferColumn(insertError)
            ? TRANSFERS_NOT_READY_REASON
            : `Couldn't record the payment on ${accountLabel(other)}: ${insertError?.message ?? 'nothing was saved.'}`,
        ),
      );
      continue;
    }
    const { data: linkedRows, error: linkError } = await withOptionalKind((kindColumnExists) =>
      db
        .from('financial_transactions')
        .update(kindColumnExists ? { transfer_group_id: groupId, transfer_kind: kind } : { transfer_group_id: groupId })
        .eq('user_id', userId)
        .eq('id', row.id)
        .is('transfer_group_id', null)
        .select('id'),
    );
    if (linkError || (linkedRows ?? []).length !== 1) {
      // Take the recorded side back out so a failed link never changes a balance.
      await db.from('financial_transactions').delete().eq('user_id', userId).eq('id', counterId).eq('source', 'transfer');
      result.failed.push(
        failure(intent.rowNumber, `Couldn't be linked as a transfer: ${linkError?.message ?? 'the row was just linked elsewhere.'}`),
      );
      continue;
    }
    result.recorded += 1;
  }

  result.failed.sort((a, b) => a.row - b.row);
  return result;
}

/** Takes rows out of their transfer group (and clears the kind when the column exists). */
export async function clearGroup(db: SupabaseClient, userId: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await withOptionalKind((kindColumnExists) =>
    db
      .from('financial_transactions')
      .update(kindColumnExists ? { transfer_group_id: null, transfer_kind: null } : { transfer_group_id: null })
      .eq('user_id', userId)
      .in('id', [...ids]),
  );
}
