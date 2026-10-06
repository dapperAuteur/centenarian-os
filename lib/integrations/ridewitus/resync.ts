// lib/integrations/ridewitus/resync.ts
// RideWitUS's "Sync now" (PRD §6.10, option D): one signed request asks
// CentenarianOS to re-send its current facts for one user through the normal
// outgoing path (integration_outbox -> the RideWitUS receivers), so a resync
// and a live event update the same rows on the RideWitUS side by event_id.
//
// SCOPES
//   envelopes  every linked savings goal's envelope.balance, plus retirements
//              (lib/integrations/ridewitus/envelope.ts). Current state, so
//              `since` does not narrow it.
//   calendar   the calendar activity feed (PRD §6.5a). Built on another
//              branch: it registers its handler with registerResyncHandler('calendar', ...).
//              Until then the scope answers not_available.
//   matches    cost.matched (PRD §6.5). Not built yet: not_available.
//
// RATE LIMIT: one request per WitUS subject per 5 minutes (PRD §6.10). The
// limiter lives in module memory, so it is per warm instance (same honesty
// note as lib/auth/handoff-rate-limit.ts): on Vercel Fluid Compute instances
// are reused, which stops a button being hammered, but it does not coordinate
// across instances. The work it guards is idempotent (latest-state upserts),
// so a second resync on another instance is wasted effort, never wrong data.
//
// No '@/' imports, so node --test loads it (tests/unit/ridewitus-resync.test.ts).

import { isWitusSub } from '../../witus/identity.ts';
import { ENVELOPE_RECEIVER, enqueueEnvelopeBalances } from './envelope.ts';
import type { OutboxDb } from '../outbox.ts';

export const RESYNC_SCOPES = ['calendar', 'matches', 'envelopes'] as const;
export type ResyncScope = (typeof RESYNC_SCOPES)[number];

export const RESYNC_WINDOW_MS = 5 * 60_000;

export interface ResyncRequest {
  witusSub: string;
  scopes: ResyncScope[];
  /** 'YYYY-MM-DD' or ISO; passed to handlers that can narrow by it. */
  since: string | null;
}

export type ParsedResync = { ok: true; value: ResyncRequest } | { ok: false; code: string; error: string };

/** Checks the body: { witus_sub, scopes?: [...], since? }. No scopes = all of them. */
export function parseResyncBody(raw: unknown): ParsedResync {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, code: 'invalid_body', error: 'Send { witus_sub, scopes, since } as JSON.' };
  }
  const body = raw as Record<string, unknown>;
  if (!isWitusSub(body.witus_sub)) return { ok: false, code: 'invalid_subject', error: 'witus_sub is required.' };

  let scopes: ResyncScope[] = [...RESYNC_SCOPES];
  if (body.scopes !== undefined) {
    if (!Array.isArray(body.scopes)) return { ok: false, code: 'invalid_scope', error: 'scopes must be an array.' };
    const unknown = body.scopes.filter((s) => !(RESYNC_SCOPES as readonly unknown[]).includes(s));
    if (unknown.length) {
      return { ok: false, code: 'invalid_scope', error: `Unknown scope. Use: ${RESYNC_SCOPES.join(', ')}.` };
    }
    scopes = [...new Set(body.scopes as ResyncScope[])];
    if (!scopes.length) scopes = [...RESYNC_SCOPES];
  }

  let since: string | null = null;
  if (body.since !== undefined && body.since !== null) {
    if (typeof body.since !== 'string' || Number.isNaN(Date.parse(body.since))) {
      return { ok: false, code: 'invalid_since', error: 'since must be a date (YYYY-MM-DD) or an ISO timestamp.' };
    }
    since = body.since;
  }
  return { ok: true, value: { witusSub: body.witus_sub, scopes, since } };
}

/** Fixed window, one request per key per window. */
export class ResyncRateLimiter {
  private last = new Map<string, number>();
  private readonly windowMs: number;
  private readonly maxKeys: number;

  // Plain fields, not parameter properties: node --experimental-strip-types cannot strip those.
  constructor(windowMs = RESYNC_WINDOW_MS, maxKeys = 10_000) {
    this.windowMs = windowMs;
    this.maxKeys = maxKeys;
  }

  /** Allowed: records the request. Refused: how many seconds until the next one is allowed. */
  check(key: string, nowMs = Date.now()): { ok: true } | { ok: false; retryAfterSeconds: number } {
    if (this.last.size > this.maxKeys) {
      for (const [k, at] of this.last) if (nowMs - at >= this.windowMs) this.last.delete(k);
    }
    const at = this.last.get(key);
    if (at !== undefined && nowMs - at < this.windowMs) {
      return { ok: false, retryAfterSeconds: Math.ceil((this.windowMs - (nowMs - at)) / 1000) };
    }
    this.last.set(key, nowMs);
    return { ok: true };
  }

  reset(): void {
    this.last.clear();
  }
}

export interface ScopeContext {
  db: OutboxDb;
  userId: string;
  witusSub: string;
  since: string | null;
  origin: string;
  now: Date;
  /** False when a receiver's URL or secret is unset: its scope is skipped (a no-op), not queued. */
  receiverReady?: (receiver: string) => boolean;
}

export interface ScopeReport {
  status: 'queued' | 'nothing_to_send' | 'not_available' | 'skipped' | 'error';
  /** Events written to the outbox for this scope. */
  queued: number;
  detail?: Record<string, unknown>;
  note?: string;
}

export type ScopeHandler = (ctx: ScopeContext) => Promise<ScopeReport>;

const envelopesHandler: ScopeHandler = async (ctx) => {
  if (ctx.receiverReady && !ctx.receiverReady(ENVELOPE_RECEIVER)) {
    return { status: 'skipped', queued: 0, note: 'not_configured' };
  }
  const result = await enqueueEnvelopeBalances(ctx.db, ctx.userId, { goalIds: 'all', origin: ctx.origin, now: ctx.now });
  if (result.skipped) {
    return {
      status: result.skipped === 'lookup_failed' ? 'error' : 'skipped',
      queued: 0,
      note: result.skipped,
    };
  }
  return {
    status: result.queued ? 'queued' : 'nothing_to_send',
    queued: result.queued,
    detail: { active: result.active, retired: result.retired },
  };
};

const handlers: Partial<Record<ResyncScope, ScopeHandler>> = {
  envelopes: envelopesHandler,
  // calendar: registered by the calendar activity feed (PRD §6.5a) via registerResyncHandler.
  // matches:  cost.matched (PRD §6.5) is not built yet.
};

/** For other modules (the calendar activity feed) to plug their re-send into "Sync now". */
export function registerResyncHandler(scope: ResyncScope, handler: ScopeHandler): void {
  handlers[scope] = handler;
}

export function resyncHandlerFor(scope: ResyncScope): ScopeHandler | undefined {
  return handlers[scope];
}

/** Run each requested scope. A scope that throws reports 'error' and does not stop the others. */
export async function runResync(ctx: ScopeContext, scopes: ResyncScope[]): Promise<Record<ResyncScope, ScopeReport>> {
  const out = {} as Record<ResyncScope, ScopeReport>;
  for (const scope of scopes) {
    const handler = handlers[scope];
    if (!handler) {
      out[scope] = { status: 'not_available', queued: 0, note: 'not built yet' };
      continue;
    }
    try {
      out[scope] = await handler(ctx);
    } catch {
      out[scope] = { status: 'error', queued: 0, note: 'handler failed' };
    }
  }
  return out;
}
