// lib/capture/calendar-records.ts
// The records a tagged Google Calendar event creates next to its planner task (plans/59, 4.4),
// and how the sync keeps them in step with later changes to the event.
//
//   #expense / #income  -> a transaction (source 'manual', tag 'google-calendar'). The account is
//                          the one an "@1234" / "@visa" in the title names among the accounts
//                          ticked for the connection, else the connection's default; its
//                          currency follows that account (lib/capture/calendar-accounts.ts).
//                          An "@" that matches no ticked account, or more than one, creates
//                          nothing and flags the item.
//   #meal               -> a meal log
//   #workout            -> a workout log
//   #trip               -> NO record: travel is moving to RideWitUS. The parsed trip stays on
//                          calendar_sync_items.parsed and the task says so.
//   missing data        -> no record (the item is already parse_status 'flagged')
//
// The task stays the calendar anchor. Transactions and workouts are also linked to it in
// activity_links; activity_links has no 'meal' type (a CHECK on a shared table), so a meal is
// linked only through calendar_sync_items.record_type / record_id.
//
// RULES
//   create   the record's id is chosen first and saved on the sync row with a snapshot of the
//            values about to be written; then the record is inserted with that id. A run that
//            dies in between finds the id on the next run and inserts (or reuses) that row, so a
//            retry never makes a second record.
//   change   the record is updated only while it still equals the stored snapshot (nobody
//            edited it in CentenarianOS). Otherwise the sync leaves it alone and flags the item
//            "needs a look". A record the user deleted is not brought back.
//   cancel   a transaction is NEVER deleted: the item is flagged instead. A meal or workout is
//            deleted only while untouched (same values as the snapshot, no ingredients or
//            exercises added); otherwise it is kept and flagged.
//
// "Untouched" is decided by comparing the record's current values with the snapshot, never by
// updated_at (financial_transactions has a BEFORE UPDATE trigger that moves it on every write).
//
// `db` must be the service-role client; every query here filters on userId.
// Relative imports keep ".ts" so this file runs under node --test (tests/unit/calendar-records.test.ts).

import type { SupabaseClient } from '@supabase/supabase-js';
import { checkOwned, ownedIds } from '../auth/ownership.ts';
import {
  readAccountChoice,
  resolveEventAccount,
  type AccountResolution,
  type CalendarAccountChoice,
  type OwnedAccount,
} from './calendar-accounts.ts';
import type { EventTaskFields } from '../calendar/event-fields.ts';
import {
  createMealLog,
  createTransaction,
  createWorkoutLog,
  updateTransactionFields,
  type CreateResult,
} from './create-record.ts';

export type RecordType = 'transaction' | 'meal' | 'workout';

/** tags[] value on every transaction the calendar sync creates (provenance; source stays 'manual'). */
export const CALENDAR_TRANSACTION_TAG = 'google-calendar';
export const CALENDAR_TRANSACTION_NOTE = 'Created from a Google Calendar event.';

const TABLE: Record<RecordType, string> = {
  transaction: 'financial_transactions',
  meal: 'meal_logs',
  workout: 'workout_logs',
};

/** activity_links type per record type; null where activity_links has none. */
const LINK_TYPE: Record<RecordType, string | null> = {
  transaction: 'transaction',
  meal: null,
  workout: 'workout',
};

/** Child rows that mean the user added to the record (so it is no longer "untouched"). */
const CHILDREN: Partial<Record<RecordType, { table: string; column: string }>> = {
  meal: { table: 'meal_log_ingredients', column: 'meal_log_id' },
  workout: { table: 'workout_log_exercises', column: 'log_id' },
};

export const RECORD_LABEL: Record<RecordType, string> = {
  transaction: 'transaction',
  meal: 'meal log',
  workout: 'workout log',
};

export const isRecordType = (value: unknown): value is RecordType =>
  value === 'transaction' || value === 'meal' || value === 'workout';

/** The calendar-owned fields of a record, normalized so stored and read values compare equal. */
export type RecordValues = Record<string, string | number | null>;

export interface DesiredRecord {
  type: RecordType;
  values: RecordValues;
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/** Picks and normalizes the fields the sync owns for `type` out of a row (or a snapshot). */
export function normalizeValues(type: RecordType, row: Record<string, unknown>): RecordValues {
  switch (type) {
    case 'transaction':
      return {
        amount: row.amount === null || row.amount === undefined ? null : Math.abs(Number(row.amount)).toFixed(2),
        type: text(row.type),
        vendor: text(row.vendor),
        description: text(row.description),
        transaction_date: text(row.transaction_date)?.slice(0, 10) ?? null,
        account_id: text(row.account_id)?.toLowerCase() ?? null,
      };
    case 'meal':
      return {
        date: text(row.date)?.slice(0, 10) ?? null,
        time: text(row.time)?.slice(0, 5) ?? null,
        meal_type: text(row.meal_type),
        notes: text(row.notes),
      };
    case 'workout':
      return {
        name: text(row.name),
        date: text(row.date)?.slice(0, 10) ?? null,
        duration_min: row.duration_min === null || row.duration_min === undefined ? null : Number(row.duration_min),
      };
  }
}

export function sameValues(a: RecordValues | null | undefined, b: RecordValues | null | undefined): boolean {
  if (!a || !b) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if ((a[key] ?? null) !== (b[key] ?? null)) return false;
  return true;
}

/**
 * The record an event should have, or null (an untagged event, a #trip, or a tag whose data is
 * missing). Pure. `accountId` is the connection's default account, already checked as the user's.
 */
export function desiredRecord(fields: EventTaskFields, accountId: string | null): DesiredRecord | null {
  if (fields.parseStatus !== 'ok') return null;
  const parsed = fields.parsed;
  switch (parsed.kind) {
    case 'expense':
    case 'income':
      if (parsed.amountCents === undefined || parsed.amountCents <= 0) return null;
      return {
        type: 'transaction',
        values: normalizeValues('transaction', {
          amount: parsed.amountCents / 100,
          type: parsed.kind,
          vendor: parsed.vendor || fields.activity,
          description: fields.activity,
          transaction_date: fields.date,
          account_id: accountId,
        }),
      };
    case 'meal':
      return {
        type: 'meal',
        values: normalizeValues('meal', {
          date: fields.date,
          time: fields.time,
          meal_type: parsed.mealType ?? null,
          notes: fields.activity,
        }),
      };
    case 'workout':
      return {
        type: 'workout',
        values: normalizeValues('workout', {
          name: fields.activity,
          date: fields.date,
          duration_min: parsed.durationMin ?? null,
        }),
      };
    default:
      return null;
  }
}

/** The connection's default account when it is still one of the user's accounts, else null. */
export async function usableDefaultAccount(
  db: SupabaseClient,
  userId: string,
  accountId: string | null | undefined,
): Promise<string | null> {
  if (!accountId) return null;
  const check = await checkOwned(db, userId, 'financial_accounts', accountId);
  if (check.failed) throw new Error('Checking the default account failed.');
  return check.allowed ? accountId : null;
}

/** One connection's ticked accounts, checked against the owner, plus the user's accounts for "@" matching. */
export interface CalendarAccountContext {
  choice: CalendarAccountChoice;
  owned: OwnedAccount[];
}

/**
 * Loads what resolveEventAccount needs for one connection. Ticked and default ids the user no
 * longer owns (an account deleted since) are dropped through ownedIds (lib/auth/ownership.ts);
 * `owned` is every account of the user, so an "@" naming an unticked account can say so.
 */
export async function loadCalendarAccounts(
  db: SupabaseClient,
  userId: string,
  settings: Record<string, unknown> | null | undefined,
): Promise<CalendarAccountContext> {
  const saved = readAccountChoice(settings);
  const check = await ownedIds(db, userId, 'financial_accounts', [...saved.allowedIds, ...Object.keys(saved.nicknames)]);
  if (check.failed) throw new Error('Checking the calendar accounts failed.');
  const choice: CalendarAccountChoice = {
    allowedIds: saved.allowedIds.filter((id) => check.has(id)),
    defaultId: saved.defaultId && check.has(saved.defaultId) ? saved.defaultId : null,
    nicknames: Object.fromEntries(Object.entries(saved.nicknames).filter(([id]) => check.has(id))),
  };
  const { data, error } = await db.from('financial_accounts').select('id, last_four').eq('user_id', userId);
  if (error) throw new Error(`Reading the finance accounts failed: ${error.message}`);
  const owned = ((data as OwnedAccount[] | null) ?? []).filter((a) => typeof a.id === 'string');
  return { choice, owned };
}

/** The account for one event: only money titles read "@"; other kinds get the default. */
export function accountForEvent(fields: EventTaskFields | null, context: CalendarAccountContext): AccountResolution {
  const parsed = fields?.parsed;
  const ref = parsed && (parsed.kind === 'expense' || parsed.kind === 'income') ? parsed.accountRef : undefined;
  return resolveEventAccount(ref, context.choice, context.owned);
}

// ── Keeping the record in step with the event ───────────────────────────────────

/** What the sync row says about the record (calendar_sync_items.record_type / record_id / parsed.record_snapshot). */
export interface RecordState {
  record_type: RecordType | null;
  record_id: string | null;
  snapshot: RecordValues | null;
}

export const EMPTY_RECORD_STATE: RecordState = { record_type: null, record_id: null, snapshot: null };

export interface RecordOutcome extends RecordState {
  /** Why the item needs a look, or null. */
  review: string | null;
  /** A record was inserted by this call. */
  created: boolean;
}

export interface SyncRecordInput {
  userId: string;
  /** The planner task the record is linked to. */
  taskId: string | null;
  /** create: a new event (or a create that did not finish); update: the event changed; cancel: it was cancelled. */
  mode: 'create' | 'update' | 'cancel';
  /** The event's task fields (null when cancelled). */
  fields: EventTaskFields | null;
  /** What the sync row held before this event was processed. */
  state: RecordState;
  /** The account for this event's transaction (already checked as the user's): see accountForEvent. */
  accountId: string | null;
  /**
   * Set when the title's "@account" could not be matched to exactly one ticked account. No
   * transaction is created or changed; the item is flagged with this text.
   */
  accountReview?: string | null;
  /**
   * Saves a planned record on the sync row BEFORE the record is inserted, so a retry finds it.
   * Called with the planned state, and with EMPTY_RECORD_STATE if the insert is refused.
   */
  persist: (state: RecordState) => Promise<void>;
  /** New ids (tests pass a deterministic one). */
  newId?: () => string;
}

interface Deps {
  db: SupabaseClient;
}

const outcome = (state: RecordState, review: string | null = null, created = false): RecordOutcome => ({
  ...state,
  review,
  created,
});

async function loadRecord(db: SupabaseClient, userId: string, type: RecordType, id: string) {
  const { data, error } = await db.from(TABLE[type]).select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Reading the ${RECORD_LABEL[type]} failed: ${error.message}`);
  return (data as Record<string, unknown> | null) ?? null;
}

/** True when the user changed the record since the sync wrote it (values, transfer pairing, child rows). */
async function isTouched(
  db: SupabaseClient,
  type: RecordType,
  row: Record<string, unknown>,
  snapshot: RecordValues | null,
): Promise<boolean> {
  if (!sameValues(normalizeValues(type, row), snapshot)) return true;
  if (type === 'transaction' && row.transfer_group_id) return true;
  const children = CHILDREN[type];
  if (children) {
    const { data, error } = await db.from(children.table).select('id').eq(children.column, row.id).limit(1);
    if (error) return true; // unknown: treat as touched, the safe answer
    if (Array.isArray(data) && data.length > 0) return true;
  }
  return false;
}

async function linkToTask(db: SupabaseClient, userId: string, taskId: string | null, type: RecordType, id: string) {
  const linkType = LINK_TYPE[type];
  if (!taskId || !linkType) return;
  const { error } = await db.from('activity_links').upsert(
    {
      user_id: userId,
      source_type: 'task',
      source_id: taskId,
      target_type: linkType,
      target_id: id,
      relationship: 'google_calendar',
    },
    { onConflict: 'user_id,source_type,source_id,target_type,target_id', ignoreDuplicates: true },
  );
  if (error) throw new Error(`Linking the task to the ${RECORD_LABEL[type]} failed: ${error.message}`);
}

async function unlinkFromTask(db: SupabaseClient, userId: string, type: RecordType, id: string) {
  const linkType = LINK_TYPE[type];
  if (!linkType) return;
  await db
    .from('activity_links')
    .delete()
    .eq('user_id', userId)
    .eq('source_type', 'task')
    .eq('target_type', linkType)
    .eq('target_id', id);
}

function insertRecord(
  db: SupabaseClient,
  userId: string,
  desired: DesiredRecord,
  id: string,
): Promise<CreateResult<Record<string, unknown>>> {
  const v = desired.values;
  switch (desired.type) {
    case 'transaction':
      return createTransaction(
        db,
        userId,
        {
          amount: v.amount,
          type: v.type as string,
          vendor: v.vendor as string | null,
          description: v.description as string | null,
          transaction_date: v.transaction_date,
          account_id: v.account_id as string | null,
          tags: [CALENDAR_TRANSACTION_TAG],
          notes: CALENDAR_TRANSACTION_NOTE,
        },
        { id, select: 'id' },
      );
    case 'meal':
      return createMealLog(db, userId, { date: v.date, time: v.time, meal_type: v.meal_type, notes: v.notes }, { id });
    case 'workout':
      return createWorkoutLog(db, userId, { name: v.name, date: v.date, duration_min: v.duration_min }, { id });
  }
}

async function updateRecord(db: SupabaseClient, userId: string, type: RecordType, id: string, values: RecordValues) {
  let message: string | null;
  if (type === 'transaction') {
    message = await updateTransactionFields(db, userId, id, {
      amount: Number(values.amount),
      type: values.type as string,
      vendor: values.vendor as string | null,
      description: values.description as string | null,
      transaction_date: values.transaction_date as string,
      account_id: values.account_id as string | null,
    });
  } else {
    const { error } = await db.from(TABLE[type]).update(values).eq('id', id).eq('user_id', userId);
    message = error?.message ?? null;
  }
  if (message) throw new Error(`Updating the ${RECORD_LABEL[type]} failed: ${message}`);
}

/**
 * Inserts the desired record under a pre-saved id. With `reuseId`, a row already there under
 * that id (a create interrupted after the insert) is kept instead of inserted again.
 */
async function createFor(
  deps: Deps,
  input: SyncRecordInput,
  desired: DesiredRecord,
  reuseId: string | null,
): Promise<RecordOutcome> {
  const { db } = deps;
  if (reuseId) {
    const existing = await loadRecord(db, input.userId, desired.type, reuseId);
    if (existing) {
      await linkToTask(db, input.userId, input.taskId, desired.type, reuseId);
      return outcome({ record_type: desired.type, record_id: reuseId, snapshot: input.state.snapshot ?? desired.values });
    }
  }
  const id = reuseId ?? (input.newId ?? (() => crypto.randomUUID()))();
  const planned: RecordState = { record_type: desired.type, record_id: id, snapshot: desired.values };
  await input.persist(planned);
  const result = await insertRecord(db, input.userId, desired, id);
  if (!result.ok) {
    await input.persist(EMPTY_RECORD_STATE);
    // A refused request (bad data) will not succeed on a retry: flag it. A server error is
    // thrown so the event is retried on the next run.
    if (result.status === 400) {
      return outcome(EMPTY_RECORD_STATE, `The ${RECORD_LABEL[desired.type]} could not be created: ${result.error}.`);
    }
    throw new Error(`Creating the ${RECORD_LABEL[desired.type]} failed: ${result.error}`);
  }
  await linkToTask(db, input.userId, input.taskId, desired.type, id);
  return outcome(planned, null, true);
}

/** Creates, updates, keeps or removes the record of one event. See RULES at the top of the file. */
export async function syncEventRecord(db: SupabaseClient, input: SyncRecordInput): Promise<RecordOutcome> {
  const deps: Deps = { db };
  const { userId, state } = input;
  const desired = input.fields ? desiredRecord(input.fields, input.accountId) : null;
  const storedType = isRecordType(state.record_type) && state.record_id ? state.record_type : null;

  // ── Cancelled ──
  if (input.mode === 'cancel') {
    if (!storedType || !state.record_id) return outcome(state);
    const row = await loadRecord(db, userId, storedType, state.record_id);
    if (!row) return outcome(state);
    if (storedType === 'transaction') {
      return outcome(
        state,
        'The event was cancelled. Its transaction was kept, because the sync never deletes money records. Delete it yourself if it should not count.',
      );
    }
    if (await isTouched(db, storedType, row, state.snapshot)) {
      return outcome(
        state,
        `The event was cancelled, but its ${RECORD_LABEL[storedType]} was changed in CentenarianOS, so it was kept. Delete it yourself if it should go.`,
      );
    }
    const { error } = await db.from(TABLE[storedType]).delete().eq('id', state.record_id).eq('user_id', userId);
    if (error) throw new Error(`Removing the ${RECORD_LABEL[storedType]} failed: ${error.message}`);
    await unlinkFromTask(db, userId, storedType, state.record_id);
    return outcome(EMPTY_RECORD_STATE);
  }

  // An "@account" that names no single ticked account: never guess, write no transaction.
  const accountBlocked = desired?.type === 'transaction' && input.accountReview ? input.accountReview : null;

  // ── No record yet (new event, a resumed create, or a tag added later) ──
  if (!storedType || !state.record_id) {
    if (!desired) return outcome(EMPTY_RECORD_STATE);
    if (accountBlocked) return outcome(EMPTY_RECORD_STATE, `${accountBlocked} No transaction was created.`);
    return createFor(deps, input, desired, null);
  }

  // ── A record id is stored ──
  const row = await loadRecord(db, userId, storedType, state.record_id);
  if (!row) {
    // create: the insert never happened (the run stopped right after saving the id); do it now.
    if (input.mode === 'create' && desired && desired.type === storedType) {
      if (accountBlocked) return outcome(EMPTY_RECORD_STATE, `${accountBlocked} No transaction was created.`);
      return createFor(deps, input, desired, state.record_id);
    }
    // update: the user deleted the record. Respect that; do not bring it back.
    return outcome(state);
  }
  if (input.mode === 'create') {
    await linkToTask(db, userId, input.taskId, storedType, state.record_id);
    return outcome(state);
  }

  if (!desired || desired.type !== storedType) {
    return outcome(
      state,
      `The event's title no longer describes this ${RECORD_LABEL[storedType]}, so the ${RECORD_LABEL[storedType]} was left as it is. Check it.`,
    );
  }
  if (accountBlocked) return outcome(state, `${accountBlocked} Its transaction was left as it is.`);
  // Nothing the record holds changed (e.g. only the event's description did).
  if (sameValues(desired.values, state.snapshot)) return outcome(state);
  // The record already holds the new values (a run that updated it but stopped before saving
  // the snapshot, or the user made the same change): adopt them, write nothing.
  if (sameValues(normalizeValues(storedType, row), desired.values)) {
    return outcome({ ...state, record_type: storedType, snapshot: desired.values });
  }
  if (await isTouched(db, storedType, row, state.snapshot)) {
    return outcome(
      state,
      `The event changed, but its ${RECORD_LABEL[storedType]} was edited in CentenarianOS, so the change was not copied. Check it.`,
    );
  }
  await updateRecord(db, userId, storedType, state.record_id, desired.values);
  return outcome({ record_type: storedType, record_id: state.record_id, snapshot: desired.values });
}
