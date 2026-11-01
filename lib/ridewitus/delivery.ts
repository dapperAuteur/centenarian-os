// lib/ridewitus/delivery.ts
// How `calendar.activity` events reach RideWitUS. Kept behind a small interface (ActivityDelivery)
// so the emitter does not care how an event travels.
//
// The app's delivery is the durable outbox (outboxActivityDelivery, CentOS plan 70 branch C-2):
//   1. enqueue one integration_outbox row per event (receiver 'ridewitus.calendar_activity',
//      migration 217), keyed (receiver, user_id, event_id), so a newer change to the same calendar
//      event replaces the queued payload instead of adding a row;
//   2. drain that user's due rows at once (lib/integrations/outbox.ts): one signed POST per 500
//      events, two quick retries on a network error or 5xx;
//   3. anything not accepted stays pending and is retried on the outbox backoff by the next write
//      or the daily cron /api/cron/integration-outbox. A RideWitUS outage during a sync no longer
//      loses the changes.
// If the outbox table is missing (a database without migration 217), it falls back to the direct
// signed POST below, so nothing regresses.
//
// The wire format is unchanged either way:
//   POST $RIDEWITUS_CALENDAR_ACTIVITY_URL           (RideWitUS POST /api/events/calendar-activity)
//   Content-Type:      application/json
//   X-Witus-Source:    centenarianos                 (slug in gemini/witus/lib/products.ts)
//   X-Witus-Timestamp: <unix seconds>
//   X-Witus-Signature: sha256=<hex(HMAC-SHA256(secret, `${timestamp}.${rawBody}`))>
//   body:              { "events": [ ...at most 500 ] }
// Contract: docs/integrations/ridewitus-contract.md (E6).
//
// Missing URL or secret -> a no-op that reports `not_configured`; nothing is queued or sent.
// Direct POST retries: network errors, 408, 429 and 5xx, up to 3 attempts per batch (waits 1 s,
// then 4 s). Other 4xx answers are not retried: sending the same body again would get the same answer.
// Logs carry at most the HTTP status and counts: never the body, the secret or the signature.
//
// The relative imports keep their ".ts" extension because this file runs under
// `node --test --experimental-strip-types` (tests/unit/calendar-activity.test.ts,
// tests/unit/calendar-outbox.test.ts).

import { createHmac } from 'node:crypto';
import { batchEvents, type CalendarActivityEvent } from './calendar-activity.ts';
import { drain, enqueue, MAX_BATCH, type DrainOptions, type DrainResult, type OutboxDb, type OutboxEvent } from '../integrations/outbox.ts';
import type { FetchLike } from '../events/sign-request.ts';

/** X-Witus-Source for CentenarianOS. Read from gemini/witus/lib/products.ts (slug "centenarianos"). */
export const CENTOS_SOURCE_SLUG = 'centenarianos';
export const ACTIVITY_URL_ENV = 'RIDEWITUS_CALENDAR_ACTIVITY_URL';
export const ACTIVITY_SECRET_ENV = 'CALENDAR_ACTIVITY_EVENTS_SECRET';
/** integration_outbox receiver key; its URL and secret env names are the two above (RECEIVERS in lib/integrations/outbox.ts). */
export const CALENDAR_ACTIVITY_RECEIVER = 'ridewitus.calendar_activity';

const LABEL = '[lib/ridewitus/delivery]';
const RETRY_WAITS_MS = [1_000, 4_000];
const REQUEST_TIMEOUT_MS = 8_000;

export interface DeliveryResult {
  /** True when every batch was accepted, or there was nothing to send. */
  ok: boolean;
  /** Events in accepted batches. */
  sent: number;
  /** Events in batches that failed after their retries. */
  failed: number;
  /** Set when nothing was attempted. */
  skipped?: 'not_configured';
  /** The last HTTP status seen, for logs. */
  status?: number;
  /** Outbox delivery: rows written to integration_outbox. */
  queued?: number;
  /** Outbox delivery: rows left pending for a later retry (a send failure or unknown_subject). Not lost. */
  retrying?: number;
}

/** Anything that can take a list of events and get them to RideWitUS. */
export interface ActivityDelivery {
  readonly configured: boolean;
  deliver(events: CalendarActivityEvent[]): Promise<DeliveryResult>;
}

export interface SignedHeaders {
  'Content-Type': 'application/json';
  'X-Witus-Source': string;
  'X-Witus-Timestamp': string;
  'X-Witus-Signature': string;
}

/** Headers for `rawBody`, signed exactly as lib/events/verify-signature.ts expects. */
export function signWitusRequest(rawBody: string, secret: string, timestampSeconds: number, source: string = CENTOS_SOURCE_SLUG): SignedHeaders {
  const ts = String(Math.floor(timestampSeconds));
  const signature = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  return {
    'Content-Type': 'application/json',
    'X-Witus-Source': source,
    'X-Witus-Timestamp': ts,
    'X-Witus-Signature': `sha256=${signature}`,
  };
}

export interface HttpDeliveryOptions {
  url?: string | null;
  secret?: string | null;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Unix seconds; injectable for tests. */
  nowSeconds?: () => number;
  retryWaitsMs?: number[];
}

const retryable = (status: number) => status === 408 || status === 429 || status >= 500;

/** The signed-POST delivery. Not configured (URL or secret missing) -> every call is a no-op. */
export function httpActivityDelivery(options: HttpDeliveryOptions = {}): ActivityDelivery {
  const url = options.url?.trim() || null;
  const secret = options.secret || null;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const nowSeconds = options.nowSeconds ?? (() => Date.now() / 1000);
  const waits = options.retryWaitsMs ?? RETRY_WAITS_MS;
  const configured = !!url && !!secret;

  return {
    configured,
    async deliver(events) {
      if (!configured || !url || !secret) return { ok: true, sent: 0, failed: 0, skipped: 'not_configured' };
      if (events.length === 0) return { ok: true, sent: 0, failed: 0 };

      let sent = 0;
      let failed = 0;
      let lastStatus: number | undefined;
      for (const batch of batchEvents(events)) {
        const rawBody = JSON.stringify({ events: batch });
        let accepted = false;
        for (let attempt = 0; attempt <= waits.length; attempt += 1) {
          if (attempt > 0) await sleep(waits[attempt - 1]);
          try {
            const res = await fetchImpl(url, {
              method: 'POST',
              // Signed per attempt: the timestamp must fall inside the receiver's 300 s window.
              headers: { ...signWitusRequest(rawBody, secret, nowSeconds()) },
              body: rawBody,
              signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
            lastStatus = res.status;
            if (res.ok) {
              accepted = true;
              break;
            }
            if (!retryable(res.status)) break;
          } catch {
            lastStatus = undefined;
          }
        }
        if (accepted) sent += batch.length;
        else {
          failed += batch.length;
          console.error(`${LABEL} a batch of ${batch.length} calendar.activity event(s) was not accepted (status ${lastStatus ?? 'network error'}).`);
        }
      }
      return { ok: failed === 0, sent, failed, status: lastStatus };
    },
  };
}

export interface OutboxDeliveryOptions {
  /** A SERVICE-ROLE client: integration_outbox has RLS on with no policies. */
  db: OutboxDb;
  userId: string;
  env?: Record<string, string | undefined>;
  /** Injected in tests; defaults to the outbox drain. */
  drainImpl?: (db: OutboxDb, options: DrainOptions) => Promise<DrainResult>;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  /** Used when integration_outbox is missing (migration 217 not applied). */
  fallback?: ActivityDelivery;
}

/** One outbox row per event; a repeated event_id in one call keeps the last (one upsert cannot touch a row twice). */
export function outboxRows(userId: string, events: CalendarActivityEvent[]): OutboxEvent[] {
  const byId = new Map<string, OutboxEvent>();
  for (const event of events) {
    byId.set(event.event_id, {
      user_id: userId,
      receiver: CALENDAR_ACTIVITY_RECEIVER,
      event_id: event.event_id,
      event_type: event.event_type,
      payload: event as unknown as Record<string, unknown>,
    });
  }
  return [...byId.values()];
}

/**
 * Queue events in integration_outbox for one user, then try to send that user's due calendar rows
 * at once. Not configured (URL or secret missing) -> every call is a no-op and nothing is queued.
 */
export function outboxActivityDelivery(options: OutboxDeliveryOptions): ActivityDelivery {
  const env = options.env ?? process.env;
  const url = env[ACTIVITY_URL_ENV]?.trim() || null;
  const secret = env[ACTIVITY_SECRET_ENV] || null;
  const configured = !!url && !!secret;
  const runDrain = options.drainImpl ?? drain;
  const now = options.now ?? (() => new Date());

  return {
    configured,
    async deliver(events) {
      if (!configured) return { ok: true, sent: 0, failed: 0, skipped: 'not_configured' };
      if (events.length === 0) return { ok: true, sent: 0, failed: 0 };

      const rows = outboxRows(options.userId, events);
      let queued = 0;
      for (let i = 0; i < rows.length; i += MAX_BATCH) {
        const result = await enqueue(options.db, rows.slice(i, i + MAX_BATCH), now());
        if (result.missingTable && queued === 0) {
          console.error(`${LABEL} integration_outbox is missing (run migration 217); sending directly instead.`);
          const fallback = options.fallback ?? httpActivityDelivery({ url, secret, fetchImpl: options.fetchImpl as typeof fetch | undefined, sleep: options.sleep });
          return fallback.deliver(events);
        }
        if (result.error) {
          console.error(`${LABEL} could not queue ${rows.length - queued} calendar.activity event(s).`);
          return { ok: false, sent: 0, failed: rows.length - queued, queued };
        }
        queued += result.queued;
      }

      const drained = await runDrain(options.db, {
        env,
        userId: options.userId,
        receivers: [CALENDAR_ACTIVITY_RECEIVER],
        quickRetries: 2,
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
        now: now(),
      });
      if (drained.error) {
        // The rows are queued; the next write or the daily cron sends them.
        console.error(`${LABEL} queued ${queued} calendar.activity event(s); the immediate send could not read the outbox.`);
        return { ok: true, sent: 0, failed: 0, queued, retrying: queued };
      }
      const report = drained.receivers.find((r) => r.receiver === CALENDAR_ACTIVITY_RECEIVER);
      const sent = report?.sent ?? 0;
      const failed = report?.failed ?? 0;
      const retrying = report?.retrying ?? 0;
      if (failed || retrying) {
        console.error(`${LABEL} calendar.activity: sent ${sent}, retrying ${retrying}, failed ${failed}.`);
      }
      return { ok: failed === 0, sent, failed, queued, retrying };
    },
  };
}

/**
 * The delivery the app uses: the outbox for this user. Without a database client and user (only
 * tests and scripts call it that way), the direct signed POST.
 */
export function defaultActivityDelivery(
  context: { db: OutboxDb; userId: string } | null = null,
  env: Record<string, string | undefined> = process.env,
): ActivityDelivery {
  if (context) return outboxActivityDelivery({ db: context.db, userId: context.userId, env });
  return httpActivityDelivery({ url: env[ACTIVITY_URL_ENV], secret: env[ACTIVITY_SECRET_ENV] });
}
