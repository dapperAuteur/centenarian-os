// lib/calendar/google-sync.ts
// Server-only. The Google Calendar -> CentenarianOS sync engine (plans/59, Part 4.2). One-way:
// nothing is ever written to Google.
//
// syncConnection(db, connectionId, { budgetMs }) reads every switched-on calendar of one
// connected Google account and mirrors its events into planner tasks:
//
//   READ     incremental events.list from the stored sync token; with no token (first run, or a
//            calendar just switched on) a full read of 30 days back to 180 days ahead; a 410 on
//            the token falls back to that full read (lib/calendar/fetch-changes.ts).
//   PER EVENT (decision in lib/calendar/event-fields.ts decideSyncAction)
//            same etag as last time -> nothing
//            new                    -> a task under "Google Calendar: <calendar name>"
//            changed / moved        -> the task's date, time, title, description follow
//            cancelled              -> the task is archived (status 'archived', archived_at); never deleted
//            task deleted by user   -> not recreated
//            `completed` is never written by the sync, so a task ticked off in the planner stays ticked.
//   RECORDS  The title goes through parseCaptureTitle; the result is stored in
//            calendar_sync_items.parsed / parse_status. A tagged event also gets a record next
//            to its task (phase 4.4, lib/capture/calendar-records.ts): #expense / #income -> a
//            transaction on the connection's default account, #meal -> a meal log, #workout ->
//            a workout log. #trip creates no trip (travel is moving to RideWitUS): the parsed
//            trip stays on the row and the task says so. The record follows later changes only
//            while nobody edited it; a cancelled event never deletes a transaction. Anything the
//            sync would not do on its own flags the row (parse_status 'flagged', parse_error says
//            why; parsed.record_review holds the record part) for the settings page's
//            "Needs a look" list.
//   SAVED    calendar_sync_items (one row per event; tasks.source_type = 'google_calendar',
//            tasks.source_id = calendar_sync_items.id), the calendar's new sync token and
//            last_synced_at, and on the connection last_synced_at, last_error and
//            last_sync_summary (migration 205).
//
// `db` must be a SERVICE-ROLE client: calendar_connections is closed to browser roles, and
// the cron has no user session. Every task / item query is scoped by the connection's user_id.
//
// Never use updated_at as a marker for anything: several tables have BEFORE UPDATE triggers
// that set it on every write. The sync decides by Google's etag instead.

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveImportMilestone } from '@/lib/planner/import-milestone';
import { GoogleAuthError, listEvents, type GoogleClientOptions, type GoogleEvent } from '@/lib/google/calendar-client';
import { getConnectionById, throwDbError, withAccessToken, type CalendarConnection } from '@/lib/google/connection';
import { describeCalendarError } from '@/lib/google/route-helpers';
import { fetchCalendarChanges } from '@/lib/calendar/fetch-changes';
import type { ParsedCapture } from '@/lib/capture/parse-tokens';
import {
  EMPTY_RECORD_STATE,
  isRecordType,
  syncEventRecord,
  usableDefaultAccount,
  type RecordOutcome,
  type RecordState,
  type RecordValues,
} from '@/lib/capture/calendar-records';
import {
  addCounts,
  decideSyncAction,
  emptyCounts,
  eventToTaskFields,
  type EventTaskFields,
  parseResultOf,
  type ParseStatus,
  type SyncCounts,
  type SyncItemState,
} from '@/lib/calendar/event-fields';

const LABEL = '[lib/calendar/google-sync]';

export const TASK_SOURCE_TYPE = 'google_calendar';
/** Prefix of the milestone each calendar's tasks are filed under. */
export const CALENDAR_MILESTONE_PREFIX = 'Google Calendar: ';
/** At most this many error lines are kept per run. */
const MAX_ERRORS = 10;
/** Event ids per `.in()` lookup, to keep the request URL short. */
const LOOKUP_CHUNK = 100;

export type SyncRunStatus = 'ok' | 'partial' | 'needs_reauth' | 'error' | 'skipped';

/** What one run did for one Google account. Saved as calendar_connections.last_sync_summary. */
export interface SyncSummary {
  connection_id: string;
  account_email: string | null;
  status: SyncRunStatus;
  counts: SyncCounts;
  calendars_synced: number;
  calendars_total: number;
  errors: string[];
  started_at: string;
  finished_at: string;
}

export interface SyncOptions {
  /** Time this run may use, in ms. The run stops between calendars or events once it is spent. */
  budgetMs?: number;
  /** Absolute deadline (ms since the epoch); overrides budgetMs. */
  deadline?: number;
  /** Passed to the Google client (tests, or a custom fetch). */
  clientOptions?: GoogleClientOptions;
}

interface CalendarRow {
  id: string;
  calendar_id: string;
  summary: string | null;
  time_zone: string | null;
  sync_token: string | null;
  milestone_id: string | null;
}

interface ItemRow extends SyncItemState {
  event_id: string;
  record_type: string | null;
  record_id: string | null;
  parsed: StoredParsed | null;
  parse_status: ParseStatus | null;
  parse_error: string | null;
}

/** calendar_sync_items.parsed: the parser's output plus what the sync knows about the record. */
type StoredParsed = Record<string, unknown> & {
  /** The calendar-owned values last written to the record (lib/capture/calendar-records.ts). */
  record_snapshot?: RecordValues | null;
  /** Why the record part needs a look, or null. */
  record_review?: string | null;
};

/** The record part of a stored row. */
function recordStateOf(item: ItemRow | null): RecordState {
  if (!item || !isRecordType(item.record_type) || !item.record_id) return EMPTY_RECORD_STATE;
  return {
    record_type: item.record_type,
    record_id: item.record_id,
    snapshot: item.parsed?.record_snapshot ?? null,
  };
}

/** The parser fields of a stored row, without the record part. */
function baseParsed(parsed: StoredParsed | null | undefined): Record<string, unknown> {
  if (!parsed) return {};
  const { record_snapshot: _snapshot, record_review: _review, ...rest } = parsed;
  void _snapshot;
  void _review;
  return rest;
}

/**
 * calendar_sync_items columns for a record state. `base` is the parser part of `parsed`; the
 * parse status and error are the parser's, unless the record needs a look, which flags the row.
 */
function recordColumns(
  state: RecordState,
  review: string | null,
  base: Record<string, unknown>,
  parseStatus: ParseStatus | null,
  parseError: string | null,
) {
  const columns: Record<string, unknown> = {
    record_type: state.record_type,
    record_id: state.record_id,
    parsed: { ...base, record_snapshot: state.snapshot, record_review: review },
  };
  if (review) {
    columns.parse_status = 'flagged';
    columns.parse_error = [parseError, review].filter(Boolean).join(' ').slice(0, 1000);
  } else if (parseStatus) {
    columns.parse_status = parseStatus;
    columns.parse_error = parseError;
  }
  return columns;
}

const DEFAULT_BUDGET_MS = 50_000;

function pushError(errors: string[], message: string) {
  if (errors.length < MAX_ERRORS) errors.push(message);
}

/** A short, safe message for an error (never a token or a raw stack). */
function errorMessage(err: unknown): string {
  const info = describeCalendarError(err);
  if (info.code !== 'internal') return info.message;
  return err instanceof Error ? err.message.replace(/^\[[^\]]+\]\s*/, '') : 'Unknown error';
}

/** The calendar_sync_items columns that describe the event as Google sent it. */
function itemSnapshot(event: GoogleEvent, fields: EventTaskFields | null) {
  return {
    event_status: event.status ?? null,
    title_snapshot: event.summary ?? null,
    event_updated: event.updated ?? null,
    ...(fields
      ? { parsed: fields.parsed, parse_status: fields.parseStatus, parse_error: fields.parseError }
      : {}),
  };
}

/** Saves a planned (or cleared) record on the sync row before the record itself is written. */
async function persistRecord(db: SupabaseClient, itemId: string, state: RecordState, fields: EventTaskFields) {
  const { error } = await db
    .from('calendar_sync_items')
    .update({
      record_type: state.record_type,
      record_id: state.record_id,
      parsed: { ...fields.parsed, record_snapshot: state.snapshot, record_review: null },
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);
  if (error) throwDbError(error, 'Saving the planned record');
}

/** Planner task columns the sync owns. `completed`, `tag`, `priority` and `milestone_id` are left to the user after creation. */
function taskPatch(fields: EventTaskFields) {
  return { date: fields.date, time: fields.time, activity: fields.activity, description: fields.description };
}

async function loadItems(
  db: SupabaseClient,
  userId: string,
  calendarId: string,
  eventIds: string[],
): Promise<Map<string, ItemRow>> {
  const items = new Map<string, ItemRow>();
  for (let i = 0; i < eventIds.length; i += LOOKUP_CHUNK) {
    const chunk = eventIds.slice(i, i + LOOKUP_CHUNK);
    const { data, error } = await db
      .from('calendar_sync_items')
      .select('id, event_id, etag, task_id, event_status, record_type, record_id, parsed, parse_status, parse_error')
      .eq('user_id', userId)
      .eq('calendar_id', calendarId)
      .in('event_id', chunk);
    if (error) throwDbError(error, 'Reading synced events');
    for (const row of (data as ItemRow[] | null) ?? []) items.set(row.event_id, row);
  }
  return items;
}

/**
 * Syncs one calendar. Returns its counts and whether it finished (so its new sync token may be
 * stored). Throws GoogleAuthError (connection needs reconnecting) and Google/API errors.
 */
async function syncCalendar(
  db: SupabaseClient,
  conn: CalendarConnection,
  cal: CalendarRow,
  deadline: number,
  errors: string[],
  clientOptions: GoogleClientOptions,
): Promise<{ counts: SyncCounts; complete: boolean }> {
  const counts = emptyCounts();
  const userId = conn.user_id;
  const nowMs = Date.now();

  const changes = await withAccessToken(
    db,
    conn,
    (accessToken) =>
      fetchCalendarChanges(
        (params) => listEvents(accessToken, cal.calendar_id, params, clientOptions),
        { syncToken: cal.sync_token, now: nowMs, deadline },
      ),
    clientOptions,
  );

  const timeZone = changes.timeZone ?? cal.time_zone;
  const defaultTag = conn.settings?.default_tag ?? null;
  // Transactions go to the connection's default account, while it is still the user's.
  const accountId = await usableDefaultAccount(db, userId, conn.settings?.default_account_id ?? null);

  // The same event can appear twice across pages of one run; the last copy wins.
  const events = new Map<string, GoogleEvent>();
  for (const event of changes.events) events.set(event.id, event);
  const items = await loadItems(db, userId, cal.calendar_id, [...events.keys()]);

  let milestoneId = cal.milestone_id;
  const ensureMilestone = async (): Promise<string> => {
    if (milestoneId) return milestoneId;
    const name = cal.summary?.trim() || cal.calendar_id;
    const resolved = await resolveImportMilestone(db, userId, `${CALENDAR_MILESTONE_PREFIX}${name}`);
    milestoneId = resolved.milestoneId;
    const { error } = await db
      .from('calendar_sync_calendars')
      .update({ milestone_id: milestoneId })
      .eq('id', cal.id);
    if (error) throwDbError(error, 'Saving the calendar milestone');
    return milestoneId;
  };

  let complete = changes.complete;
  let eventFailures = 0;

  for (const event of events.values()) {
    if (Date.now() >= deadline) {
      complete = false;
      break;
    }
    const item = items.get(event.id) ?? null;
    const decision = decideSyncAction(event, item);
    if (decision.action === 'skip') {
      counts.unchanged += 1;
      continue;
    }
    if (decision.action === 'ignore') continue;

    try {
      const fields = event.status === 'cancelled' ? null : eventToTaskFields(event, timeZone, defaultTag);
      const now = new Date().toISOString();

      if (decision.action === 'archive' && item?.task_id) {
        const { error } = await db
          .from('tasks')
          .update({ status: 'archived', archived_at: now, updated_at: now })
          .eq('id', item.task_id);
        if (error) throwDbError(error, 'Archiving the task');
        // The record: a transaction is never deleted (flagged instead); an untouched meal or
        // workout goes with the event.
        const base = baseParsed(item.parsed);
        const parsedResult =
          typeof base.kind === 'string'
            ? parseResultOf(base as unknown as Pick<ParsedCapture, 'kind' | 'warnings'>)
            : { parseStatus: null, parseError: null };
        const record = await syncEventRecord(db, {
          userId,
          taskId: item.task_id,
          mode: 'cancel',
          fields: null,
          state: recordStateOf(item),
          accountId,
          persist: async () => {},
        });
        const { error: itemError } = await db
          .from('calendar_sync_items')
          .update({
            ...itemSnapshot(event, null),
            ...recordColumns(record, record.review, base, parsedResult.parseStatus, parsedResult.parseError),
            etag: event.etag ?? null,
            connection_id: conn.id,
            updated_at: now,
          })
          .eq('id', item.id);
        if (itemError) throwDbError(itemError, 'Saving the synced event');
        counts.archived += 1;
        if (record.review) counts.flagged += 1;
        continue;
      }

      if (decision.action === 'update' && item?.task_id && fields) {
        const patch: Record<string, unknown> = { ...taskPatch(fields), updated_at: now };
        if (decision.unarchive) {
          patch.status = 'active';
          patch.archived_at = null;
        }
        const { error } = await db.from('tasks').update(patch).eq('id', item.task_id);
        if (error) throwDbError(error, 'Updating the task');
        const record = await syncEventRecord(db, {
          userId,
          taskId: item.task_id,
          mode: 'update',
          fields,
          state: recordStateOf(item),
          accountId,
          persist: (state) => persistRecord(db, item.id, state, fields),
        });
        const { error: itemError } = await db
          .from('calendar_sync_items')
          .update({
            ...itemSnapshot(event, fields),
            ...recordColumns(record, record.review, { ...fields.parsed }, fields.parseStatus, fields.parseError),
            etag: event.etag ?? null,
            connection_id: conn.id,
            updated_at: now,
          })
          .eq('id', item.id);
        if (itemError) throwDbError(itemError, 'Saving the synced event');
        counts.updated += 1;
        if (record.created) counts.records += 1;
        if (fields.parseStatus === 'flagged' || record.review) counts.flagged += 1;
        continue;
      }

      if (decision.action === 'create' && fields) {
        // 1. The mapping row first, WITHOUT the etag, so tasks.source_id has an id to point
        //    at. If the run dies before step 3, the row has no etag and no task, and the next
        //    run resumes the create instead of skipping the event.
        let itemId = item?.id ?? null;
        if (!itemId) {
          const { data, error } = await db
            .from('calendar_sync_items')
            .upsert(
              {
                user_id: userId,
                connection_id: conn.id,
                calendar_id: cal.calendar_id,
                event_id: event.id,
                etag: null,
                ...itemSnapshot(event, fields),
                updated_at: now,
              },
              { onConflict: 'user_id,calendar_id,event_id' },
            )
            .select('id')
            .maybeSingle();
          if (error) throwDbError(error, 'Saving the synced event');
          if (!data) throw new Error('Saving the synced event returned no row.');
          itemId = data.id as string;
        }

        // 2. The task. A resumed create first looks for a task already pointing at the row.
        const { data: existingTask, error: lookupError } = await db
          .from('tasks')
          .select('id')
          .eq('source_type', TASK_SOURCE_TYPE)
          .eq('source_id', itemId)
          .limit(1)
          .maybeSingle();
        if (lookupError) throwDbError(lookupError, 'Looking up the task');

        let taskId = (existingTask?.id as string | undefined) ?? null;
        if (taskId) {
          const { error } = await db.from('tasks').update(taskPatch(fields)).eq('id', taskId);
          if (error) throwDbError(error, 'Updating the task');
        } else {
          const { data: task, error } = await db
            .from('tasks')
            .insert({
              milestone_id: await ensureMilestone(),
              ...taskPatch(fields),
              tag: fields.tag,
              completed: false,
              status: 'active',
              source_type: TASK_SOURCE_TYPE,
              source_id: itemId,
            })
            .select('id')
            .single();
          if (error || !task) throwDbError(error ?? { message: 'no row returned' }, 'Creating the task');
          taskId = task.id as string;
        }

        // 3. The record a tag asks for (transaction, meal, workout), linked to the task. Its id
        //    is saved on the row before the insert, so a resumed create reuses it.
        const rowId = itemId;
        const record: RecordOutcome = await syncEventRecord(db, {
          userId,
          taskId,
          mode: 'create',
          fields,
          state: recordStateOf(item),
          accountId,
          persist: (state) => persistRecord(db, rowId, state, fields),
        });

        // 4. Now the etag and the task link: the create is done.
        const { error: itemError } = await db
          .from('calendar_sync_items')
          .update({
            ...recordColumns(record, record.review, { ...fields.parsed }, fields.parseStatus, fields.parseError),
            etag: event.etag ?? null,
            task_id: taskId,
            connection_id: conn.id,
            updated_at: now,
          })
          .eq('id', itemId);
        if (itemError) throwDbError(itemError, 'Saving the synced event');
        counts.created += 1;
        if (record.created) counts.records += 1;
        if (fields.parseStatus === 'flagged' || record.review) counts.flagged += 1;
        continue;
      }

      // record_only, or an event without a usable start: refresh the stored row, touch no task.
      // The record part of `parsed` (snapshot, review) is kept as it was.
      if (item) {
        const keep = fields
          ? recordColumns(recordStateOf(item), item.parsed?.record_review ?? null, { ...fields.parsed }, fields.parseStatus, fields.parseError)
          : {};
        const { error } = await db
          .from('calendar_sync_items')
          .update({ ...itemSnapshot(event, fields), ...keep, etag: event.etag ?? null, connection_id: conn.id, updated_at: now })
          .eq('id', item.id);
        if (error) throwDbError(error, 'Saving the synced event');
      }
    } catch (err) {
      eventFailures += 1;
      pushError(errors, `${cal.summary ?? cal.calendar_id}: "${event.summary ?? event.id}": ${errorMessage(err)}`);
    }
  }

  // Store the new sync token only when every change was read AND applied. Otherwise the next
  // run reads the same changes again (unchanged ones are skipped by etag), so nothing is lost.
  const calendarPatch: Record<string, unknown> = {
    last_synced_at: new Date().toISOString(),
    last_error: eventFailures > 0 ? `${eventFailures} event(s) could not be synced; they will be retried.` : null,
  };
  if (changes.timeZone) calendarPatch.time_zone = changes.timeZone;
  if (complete && eventFailures === 0 && changes.nextSyncToken) {
    calendarPatch.sync_token = changes.nextSyncToken;
  } else if (changes.tokenReset) {
    // Google said the old token is gone; never send it again.
    calendarPatch.sync_token = null;
  }
  const { error } = await db.from('calendar_sync_calendars').update(calendarPatch).eq('id', cal.id);
  if (error) throwDbError(error, 'Saving the calendar sync state');

  return { counts, complete: complete && eventFailures === 0 };
}

/**
 * Syncs every switched-on calendar of one Google connection. Never throws for a Google or
 * per-event problem: those are reported in the summary (and saved on the connection).
 * Throws only when the connection itself cannot be read.
 */
export async function syncConnection(
  db: SupabaseClient,
  connectionId: string,
  options: SyncOptions = {},
): Promise<SyncSummary> {
  const startedAt = new Date().toISOString();
  const deadline = options.deadline ?? Date.now() + (options.budgetMs ?? DEFAULT_BUDGET_MS);
  const clientOptions = options.clientOptions ?? {};

  const conn = await getConnectionById(db, connectionId);
  if (!conn) throw new Error(`${LABEL} Connection ${connectionId} not found.`);

  const summary: SyncSummary = {
    connection_id: conn.id,
    account_email: conn.account_email,
    status: 'ok',
    counts: emptyCounts(),
    calendars_synced: 0,
    calendars_total: 0,
    errors: [],
    started_at: startedAt,
    finished_at: startedAt,
  };

  if (conn.status !== 'active') {
    summary.status = conn.status === 'needs_reauth' ? 'needs_reauth' : 'skipped';
    summary.errors.push(
      conn.status === 'needs_reauth'
        ? 'Google no longer accepts the saved authorization. Reconnect this account.'
        : 'This connection is not active.',
    );
    return summary;
  }

  const { data: calendarRows, error: calError } = await db
    .from('calendar_sync_calendars')
    .select('id, calendar_id, summary, time_zone, sync_token, milestone_id')
    .eq('connection_id', conn.id)
    .eq('enabled', true)
    .order('last_synced_at', { ascending: true, nullsFirst: true });
  if (calError) throwDbError(calError, 'Reading the calendars to sync');
  const calendars = (calendarRows as CalendarRow[] | null) ?? [];
  summary.calendars_total = calendars.length;

  let partial = false;
  for (const cal of calendars) {
    if (Date.now() >= deadline) {
      partial = true;
      break;
    }
    try {
      const result = await syncCalendar(db, conn, cal, deadline, summary.errors, clientOptions);
      summary.counts = addCounts(summary.counts, result.counts);
      summary.calendars_synced += 1;
      if (!result.complete) partial = true;
    } catch (err) {
      if (err instanceof GoogleAuthError) {
        // withAccessToken has already marked the connection needs_reauth.
        summary.status = 'needs_reauth';
        pushError(summary.errors, 'Google no longer accepts the saved authorization. Reconnect this account.');
        break;
      }
      partial = true;
      const message = errorMessage(err);
      pushError(summary.errors, `${cal.summary ?? cal.calendar_id}: ${message}`);
      const { error } = await db
        .from('calendar_sync_calendars')
        .update({ last_error: message.slice(0, 500) })
        .eq('id', cal.id);
      if (error) console.error(`${LABEL} could not save a calendar error:`, error.message);
    }
  }

  if (summary.status !== 'needs_reauth') {
    if (summary.errors.length > 0 && summary.calendars_synced === 0 && calendars.length > 0) summary.status = 'error';
    else if (partial || summary.errors.length > 0) summary.status = 'partial';
  }
  summary.finished_at = new Date().toISOString();

  // needs_reauth: markNeedsReauth already wrote status and last_error; do not overwrite them.
  const patch: Record<string, unknown> = { last_sync_summary: summary };
  if (summary.status !== 'needs_reauth') {
    patch.last_synced_at = summary.finished_at;
    patch.last_error = summary.errors.length > 0 ? summary.errors.join(' | ').slice(0, 1000) : null;
  }
  const { error } = await db.from('calendar_connections').update(patch).eq('id', conn.id);
  if (error) {
    console.error(`${LABEL} could not save the sync result for ${conn.id}:`, error.message);
    pushError(summary.errors, 'The sync ran, but its result could not be saved.');
  }
  return summary;
}
