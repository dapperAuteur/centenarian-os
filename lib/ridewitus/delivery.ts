// lib/ridewitus/delivery.ts
// How `calendar.activity` events reach RideWitUS. Kept behind a small interface so the delivery
// can move to a durable outbox table later without touching the emitter: swap what
// defaultActivityDelivery() returns.
//
// Today: a signed HTTP POST after each sync, with retries.
//   POST $RIDEWITUS_CALENDAR_ACTIVITY_URL           (RideWitUS POST /api/events/calendar-activity)
//   Content-Type:      application/json
//   X-Witus-Source:    centenarianos                 (slug in gemini/witus/lib/products.ts)
//   X-Witus-Timestamp: <unix seconds>
//   X-Witus-Signature: sha256=<hex(HMAC-SHA256(secret, `${timestamp}.${rawBody}`))>
//   body:              { "events": [ ...at most 500 ] }
// The same wire format lib/events/verify-signature.ts checks on the receiving side (PRD §6.2).
//
// Missing URL or secret -> a no-op that reports `not_configured`; nothing is sent.
// Retries: network errors, 408, 429 and 5xx, up to 3 attempts per batch (waits 1 s, then 4 s).
// Other 4xx answers are not retried: sending the same body again would get the same answer.
// Logs carry at most the HTTP status and counts: never the body, the secret or the signature.
//
// The relative imports keep their ".ts" extension because this file runs under
// `node --test --experimental-strip-types` (tests/unit/calendar-activity.test.ts).

import { createHmac } from 'node:crypto';
import { batchEvents, type CalendarActivityEvent } from './calendar-activity.ts';

/** X-Witus-Source for CentenarianOS. Read from gemini/witus/lib/products.ts (slug "centenarianos"). */
export const CENTOS_SOURCE_SLUG = 'centenarianos';
export const ACTIVITY_URL_ENV = 'RIDEWITUS_CALENDAR_ACTIVITY_URL';
export const ACTIVITY_SECRET_ENV = 'CALENDAR_ACTIVITY_EVENTS_SECRET';

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

/**
 * The delivery the app uses. BUNDLE NOTE: when the integration_outbox table (migration 217)
 * lands, return an outbox-backed ActivityDelivery here; the emitter does not change.
 */
export function defaultActivityDelivery(env: Record<string, string | undefined> = process.env): ActivityDelivery {
  return httpActivityDelivery({ url: env[ACTIVITY_URL_ENV], secret: env[ACTIVITY_SECRET_ENV] });
}
