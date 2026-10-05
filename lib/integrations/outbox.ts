// lib/integrations/outbox.ts
// The outgoing half of CentenarianOS's server-to-server events (migration 217,
// integration_outbox). CentenarianOS had no outbox for outgoing events before
// this (lib/sender-outbox.ts is the WitUS social-post Outbox, a different
// thing), so this is the pattern every new emitter uses.
//
// HOW A FACT TRAVELS
//   1. After the user's write, the emitter calls enqueue(): one row per fact,
//      keyed (receiver, user_id, event_id). A newer change to the same fact
//      replaces the payload and sets the row back to pending, so the receiver
//      only ever gets the current state.
//   2. drain() sends due pending rows, batched per receiver (at most 500 per
//      request, the receivers' limit), signed with that receiver's secret.
//   3. A failed send is retried on a backoff (RETRY_DELAYS_MS) by the next
//      drain: the next write by that user, or the daily cron
//      /api/cron/integration-outbox. After the last delay the row is 'failed'.
//   4. A row the receiver refused with `unknown_subject` (the person has not
//      signed in to the sibling with WitUS yet) stays pending on the same
//      backoff but never becomes 'failed': it goes through once they do.
//
// RECEIVERS
//   Each receiver's URL and secret come from env vars named in RECEIVERS. A
//   receiver with either unset is a no-op: drain() leaves its rows pending and
//   reports `not_configured`, so setting the env vars later delivers them.
//
// RESPONSE CONTRACT (RideWitUS PRD §6.2): a 2xx answer means the batch was
// received; per-row refusals come back as `rejected` entries, either
// `{ event_id, reason }` objects or strings that start with the event_id. Rows
// not named as rejected are marked sent.
//
// Pure apart from the injected client, env, fetch and clock, with no '@/'
// imports, so node --test loads it (tests/unit/integration-outbox.test.ts).

import { postSigned } from '../events/sign-request.ts';
import type { FetchLike } from '../events/sign-request.ts';

export interface OutboxDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface ReceiverSpec {
  /** Env var holding the receiver's full URL. */
  urlEnv: string;
  /** Env var holding the shared HMAC secret for this receiver only. */
  secretEnv: string;
}

/**
 * Every receiver CentenarianOS sends to. Names follow RideWitUS PRD §6.5: one
 * secret per receiver so either can be rotated alone.
 * The calendar activity feed (PRD §6.5a) adds 'ridewitus.calendar_activity' here.
 */
export const RECEIVERS: Readonly<Record<string, ReceiverSpec>> = {
  'ridewitus.envelope_balance': {
    urlEnv: 'ENVELOPE_BALANCE_EVENTS_URL',
    secretEnv: 'ENVELOPE_BALANCE_EVENTS_SECRET',
  },
};

/**
 * CentenarianOS's slug in gemini/witus/lib/products.ts ('centenarianos', checked
 * 2026-10-05). The Inbox/Outbox senders use INBOX_SOURCE_SLUG='centenarian-os'
 * instead; WITUS_SOURCE_SLUG overrides this one if the receiver expects that.
 */
export const DEFAULT_SOURCE_SLUG = 'centenarianos';

export const OUTBOX_TABLE = 'integration_outbox';
export const MAX_BATCH = 500;
/** 1 min, 5 min, 30 min, 2 h, 12 h (PRD §6.7), then 'failed'. */
export const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000] as const;

export type Env = Record<string, string | undefined>;

export interface OutboxEvent {
  user_id: string;
  receiver: string;
  event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
}

export interface OutboxRow extends OutboxEvent {
  id: string;
  status: string;
  attempts: number;
}

export interface EnqueueResult {
  queued: number;
  /** The table is not there yet (migration 217 not applied). Nothing was queued. */
  missingTable: boolean;
  error: string | null;
}

function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === 'PGRST205' || error.code === '42P01') return true;
  const message = error.message ?? '';
  return /integration_outbox/.test(message) && /schema cache|does not exist/.test(message);
}

/** Queue (or replace) the latest payload for each fact. */
export async function enqueue(db: OutboxDb, events: OutboxEvent[], now: Date = new Date()): Promise<EnqueueResult> {
  if (!events.length) return { queued: 0, missingTable: false, error: null };
  const nowIso = now.toISOString();
  const rows = events.map((e) => ({
    user_id: e.user_id,
    receiver: e.receiver,
    event_id: e.event_id,
    event_type: e.event_type,
    payload: e.payload,
    status: 'pending',
    attempts: 0,
    next_attempt_at: nowIso,
    last_status: null,
    last_error: null,
    sent_at: null,
  }));
  const { error } = await db.from(OUTBOX_TABLE).upsert(rows, { onConflict: 'receiver,user_id,event_id' });
  if (error) {
    return { queued: 0, missingTable: isMissingTableError(error), error: error.message ?? 'enqueue failed' };
  }
  return { queued: rows.length, missingTable: false, error: null };
}

/** The payloads already queued or sent for this user and receiver, by event_id. */
export async function previousPayloads(
  db: OutboxDb,
  userId: string,
  receiver: string,
): Promise<{ payloads: Map<string, Record<string, unknown>>; error: string | null; missingTable: boolean }> {
  const payloads = new Map<string, Record<string, unknown>>();
  const { data, error } = await db
    .from(OUTBOX_TABLE)
    .select('event_id, payload')
    .eq('user_id', userId)
    .eq('receiver', receiver)
    .limit(5000);
  if (error) return { payloads, error: error.message ?? 'read failed', missingTable: isMissingTableError(error) };
  for (const row of (data ?? []) as { event_id: string; payload: Record<string, unknown> }[]) {
    if (row.payload && typeof row.payload === 'object') payloads.set(row.event_id, row.payload);
  }
  return { payloads, error: null, missingTable: false };
}

export interface ReceiverReport {
  receiver: string;
  /** Rows the receiver accepted. */
  sent: number;
  /** Rows to try again later (send failure or unknown_subject). */
  retrying: number;
  /** Rows given up on (out of retries, or refused for a reason that a retry cannot fix). */
  failed: number;
  /** Rows left untouched because the receiver's URL or secret is not set. */
  skipped: number;
  note: 'not_configured' | null;
}

export interface DrainOptions {
  env: Env;
  /** Only this user's rows (after a write). Omit for every user's (the cron). */
  userId?: string;
  /** Only these receivers. Omit for all. */
  receivers?: string[];
  fetchImpl?: FetchLike;
  now?: Date;
  /** Most rows read per drain. */
  limit?: number;
  /** Extra immediate attempts per batch on a network error or 5xx, with sleep() between. */
  quickRetries?: number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

export interface DrainResult {
  receivers: ReceiverReport[];
  missingTable: boolean;
  error: string | null;
}

/** Event ids the receiver refused, with the reason. */
export function rejectedIds(body: unknown, sentIds: string[]): Map<string, string> {
  const out = new Map<string, string>();
  const list = body && typeof body === 'object' ? (body as { rejected?: unknown }).rejected : null;
  if (!Array.isArray(list)) return out;
  for (const item of list) {
    if (item && typeof item === 'object') {
      const id = (item as { event_id?: unknown }).event_id;
      const reason = (item as { reason?: unknown }).reason;
      if (typeof id === 'string') out.set(id, typeof reason === 'string' ? reason : 'rejected');
    } else if (typeof item === 'string') {
      const id = sentIds.find((candidate) => item.startsWith(candidate));
      if (id) out.set(id, item.includes('unknown_subject') ? 'unknown_subject' : item.slice(id.length).replace(/^[:\s-]+/, '') || 'rejected');
    }
  }
  return out;
}

function retryAt(attempts: number, now: Date): { status: 'pending' | 'failed'; next: string } {
  const delay = RETRY_DELAYS_MS[attempts - 1];
  if (delay === undefined) return { status: 'failed', next: now.toISOString() };
  return { status: 'pending', next: new Date(now.getTime() + delay).toISOString() };
}

async function markRows(db: OutboxDb, ids: string[], values: Record<string, unknown>): Promise<void> {
  if (!ids.length) return;
  await db.from(OUTBOX_TABLE).update(values).in('id', ids);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Send due pending rows. Never throws for a send failure; it reports and reschedules. */
export async function drain(db: OutboxDb, options: DrainOptions): Promise<DrainResult> {
  const now = options.now ?? new Date();
  let query = db
    .from(OUTBOX_TABLE)
    .select('id, user_id, receiver, event_id, event_type, payload, status, attempts')
    .eq('status', 'pending')
    .lte('next_attempt_at', now.toISOString());
  if (options.userId) query = query.eq('user_id', options.userId);
  if (options.receivers?.length) query = query.in('receiver', options.receivers);
  const { data, error } = await query.order('next_attempt_at', { ascending: true }).limit(options.limit ?? 2000);
  if (error) return { receivers: [], missingTable: isMissingTableError(error), error: error.message ?? 'read failed' };

  const byReceiver = new Map<string, OutboxRow[]>();
  for (const row of (data ?? []) as OutboxRow[]) {
    const list = byReceiver.get(row.receiver) ?? [];
    list.push(row);
    byReceiver.set(row.receiver, list);
  }

  const source = options.env.WITUS_SOURCE_SLUG || DEFAULT_SOURCE_SLUG;
  const reports: ReceiverReport[] = [];
  for (const [receiver, rows] of byReceiver) {
    const report: ReceiverReport = { receiver, sent: 0, retrying: 0, failed: 0, skipped: 0, note: null };
    reports.push(report);
    const spec = Object.prototype.hasOwnProperty.call(RECEIVERS, receiver) ? RECEIVERS[receiver] : null;
    const url = spec ? options.env[spec.urlEnv] : undefined;
    const secret = spec ? options.env[spec.secretEnv] : undefined;
    if (!url || !secret) {
      report.skipped = rows.length;
      report.note = 'not_configured';
      continue;
    }

    for (let i = 0; i < rows.length; i += MAX_BATCH) {
      const batch = rows.slice(i, i + MAX_BATCH);
      const sentIds = batch.map((r) => r.event_id);
      let result = await postSigned({
        url,
        secret,
        source,
        payload: { events: batch.map((r) => r.payload) },
        fetchImpl: options.fetchImpl,
        timeoutMs: options.timeoutMs,
        nowSeconds: Math.floor(now.getTime() / 1000),
      });
      for (let retry = 0; retry < (options.quickRetries ?? 0) && !result.ok && (result.status === 0 || result.status >= 500); retry++) {
        await (options.sleep ?? defaultSleep)(500 * 2 ** retry);
        result = await postSigned({
          url,
          secret,
          source,
          payload: { events: batch.map((r) => r.payload) },
          fetchImpl: options.fetchImpl,
          timeoutMs: options.timeoutMs,
        });
      }

      const nowIso = now.toISOString();
      if (!result.ok) {
        // The whole batch failed. 4xx other than 429 will not get better by
        // retrying the same bytes, but the receiver may be mid-deploy, so it
        // is retried on the same backoff and gives up after the last delay.
        const byAttempts = new Map<number, string[]>();
        for (const row of batch) {
          const attempts = (row.attempts ?? 0) + 1;
          byAttempts.set(attempts, [...(byAttempts.get(attempts) ?? []), row.id]);
        }
        for (const [attempts, ids] of byAttempts) {
          const next = retryAt(attempts, now);
          await markRows(db, ids, {
            status: next.status,
            attempts,
            next_attempt_at: next.next,
            last_status: result.status || null,
            last_error: result.error ?? 'send failed',
          });
          if (next.status === 'failed') report.failed += ids.length;
          else report.retrying += ids.length;
        }
        continue;
      }

      const rejected = rejectedIds(result.body, sentIds);
      const okIds = batch.filter((r) => !rejected.has(r.event_id)).map((r) => r.id);
      await markRows(db, okIds, {
        status: 'sent',
        attempts: 0,
        sent_at: nowIso,
        last_status: result.status,
        last_error: null,
      });
      report.sent += okIds.length;

      for (const row of batch.filter((r) => rejected.has(r.event_id))) {
        const reason = rejected.get(row.event_id)!;
        const attempts = (row.attempts ?? 0) + 1;
        if (reason === 'unknown_subject') {
          // Waits for the person to sign in with WitUS; never escalates to failed.
          const delay = RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length) - 1];
          await markRows(db, [row.id], {
            status: 'pending',
            attempts,
            next_attempt_at: new Date(now.getTime() + delay).toISOString(),
            last_status: result.status,
            last_error: 'unknown_subject',
          });
          report.retrying += 1;
        } else {
          await markRows(db, [row.id], {
            status: 'failed',
            attempts,
            last_status: result.status,
            last_error: reason.slice(0, 500),
          });
          report.failed += 1;
        }
      }
    }
  }
  return { receivers: reports, missingTable: false, error: null };
}
