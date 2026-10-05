// lib/integrations/ridewitus/envelope.ts
// The `envelope.balance` event (RideWitUS PRD §6.5, owner answer Q6): a
// savings goal's progress, sent to RideWitUS for goals linked to something
// RideWitUS shows (a planned trip, or an equipment item such as a bike).
//
// WHICH GOALS
//   savings_goals rows (migration 212) with linked_trip_id or
//   linked_equipment_id set. savings_goals has NO vehicle link column today, so
//   a goal of kind 'vehicle' with no trip/equipment link is not sent. The PRD's
//   `link_type: vehicle` needs an additive link column first (PRD prerequisite
//   `ride_link_type` / `ride_link_id`); until then link_type is 'trip' or
//   'equipment'.
//
// LINK IDS ARE CENTENARIANOS IDS
//   link_id is the CentenarianOS trips.id / equipment.id, and every event says
//   so with link_source: 'centenarian-os'. RideWitUS has no ids for these yet;
//   the Stage 4 migration (PRD §9.4) maps them.
//
// RETIRING
//   A goal that is deleted, unlinked, or no longer the user's sends
//   is_active: false with the last payload it was sent with (read back from
//   integration_outbox), so RideWitUS drops it without CentenarianOS keeping
//   any other state. An archived goal is sent with is_active: false too.
//
// IDENTITY
//   Events carry witus_sub (PRD §6.3). A user with no witus_identities row has
//   never signed in to CentenarianOS with WitUS, so RideWitUS cannot know them:
//   nothing is queued, and the result says `no_identity`.
//
// Pure apart from the injected client, with no '@/' imports, so node --test
// loads it (tests/unit/ridewitus-envelope.test.ts).

import { witusSubForUserId } from '../../witus/identity.ts';
import { enqueue, previousPayloads } from '../outbox.ts';
import type { OutboxDb, OutboxEvent } from '../outbox.ts';

export const ENVELOPE_RECEIVER = 'ridewitus.envelope_balance';
export const ENVELOPE_EVENT_TYPE = 'envelope.balance';
export const ENVELOPE_SCHEMA_VERSION = 1;
/** CentenarianOS treats a missing currency as USD (lib/finance/fx/math.ts DEFAULT_HOME_CURRENCY). */
const FALLBACK_CURRENCY = 'USD';

const GOAL_SELECT =
  'id, user_id, name, kind, target_amount, target_date, funding_account_id, starting_amount, status, linked_trip_id, linked_equipment_id';

type Row = Record<string, unknown>;

export interface EnvelopeGoal {
  id: string;
  name: string;
  kind: string;
  target_amount: number | string;
  target_date: string | null;
  starting_amount: number | string | null;
  status: string;
  linked_trip_id: string | null;
  linked_equipment_id: string | null;
}

export interface EnvelopePayload extends Record<string, unknown> {
  event_id: string;
  event_type: typeof ENVELOPE_EVENT_TYPE;
  schema_version: number;
  witus_sub: string;
  occurred_at: string;
  is_active: boolean;
  envelope_id: string;
  link_type: 'trip' | 'equipment';
  link_id: string;
  link_source: 'centenarian-os';
  label: string;
  goal_kind: string;
  /** Saved so far, as a decimal string. */
  balance: string;
  target_amount: string;
  target_date: string | null;
  currency: string;
  status: string;
  as_of: string;
  deep_link: string;
}

const cents = (v: unknown): number => Math.round(Number(v ?? 0) * 100) || 0;
const decimal = (c: number): string => (c / 100).toFixed(2);

export function envelopeEventId(goalId: string): string {
  return `envelope:${goalId}`;
}

export function linkOf(goal: Pick<EnvelopeGoal, 'linked_trip_id' | 'linked_equipment_id'>): { link_type: 'trip' | 'equipment'; link_id: string } | null {
  if (goal.linked_trip_id) return { link_type: 'trip', link_id: goal.linked_trip_id };
  if (goal.linked_equipment_id) return { link_type: 'equipment', link_id: goal.linked_equipment_id };
  return null;
}

/** The event for one linked goal. null when the goal has no trip or equipment link. */
export function buildEnvelopeEvent(args: {
  goal: EnvelopeGoal;
  /** SUM(savings_allocations.amount) for the goal. */
  allocated: number | string;
  currency: string | null;
  witusSub: string;
  now: Date;
  origin: string;
}): EnvelopePayload | null {
  const link = linkOf(args.goal);
  if (!link) return null;
  const nowIso = args.now.toISOString();
  const saved = cents(args.goal.starting_amount) + cents(args.allocated);
  return {
    event_id: envelopeEventId(args.goal.id),
    event_type: ENVELOPE_EVENT_TYPE,
    schema_version: ENVELOPE_SCHEMA_VERSION,
    witus_sub: args.witusSub,
    occurred_at: nowIso,
    is_active: args.goal.status !== 'archived',
    envelope_id: args.goal.id,
    ...link,
    link_source: 'centenarian-os',
    label: args.goal.name,
    goal_kind: args.goal.kind,
    balance: decimal(saved),
    target_amount: decimal(cents(args.goal.target_amount)),
    target_date: args.goal.target_date ?? null,
    currency: args.currency || FALLBACK_CURRENCY,
    status: args.goal.status,
    as_of: nowIso,
    deep_link: new URL('/dashboard/finance/savings', args.origin).toString(),
  };
}

/** A retirement (is_active: false) built from the last payload sent for that fact. */
export function retireEvent(previous: Record<string, unknown>, witusSub: string, now: Date): EnvelopePayload | null {
  if (typeof previous.envelope_id !== 'string' || typeof previous.event_id !== 'string') return null;
  const nowIso = now.toISOString();
  return { ...(previous as EnvelopePayload), witus_sub: witusSub, is_active: false, occurred_at: nowIso, as_of: nowIso };
}

export interface EnvelopeEmitResult {
  /** Events written to the outbox (active plus retired). */
  queued: number;
  active: number;
  retired: number;
  skipped: 'no_identity' | 'missing_table' | 'savings_not_migrated' | 'lookup_failed' | null;
  error: string | null;
}

const empty = (skipped: EnvelopeEmitResult['skipped'], error: string | null = null): EnvelopeEmitResult => ({
  queued: 0,
  active: 0,
  retired: 0,
  skipped,
  error,
});

function isMissing(error: { code?: string; message?: string } | null | undefined, table: string): boolean {
  if (!error) return false;
  if (error.code === 'PGRST205' || error.code === '42P01') return true;
  const message = error.message ?? '';
  return message.includes(table) && /schema cache|does not exist/.test(message);
}

/**
 * Queue envelope.balance for this user's linked goals.
 *   goalIds: 'all'  every linked goal, and a retirement for every fact sent
 *                   before whose goal is gone or unlinked (resync, nightly).
 *   goalIds: [...]  just these goals (after a write): linked ones are sent,
 *                   gone or unlinked ones are retired if they were sent before.
 */
export async function enqueueEnvelopeBalances(
  db: OutboxDb,
  userId: string,
  options: { goalIds: string[] | 'all'; origin: string; now?: Date },
): Promise<EnvelopeEmitResult> {
  const now = options.now ?? new Date();
  const wanted = options.goalIds === 'all' ? null : [...new Set(options.goalIds.filter((id) => typeof id === 'string' && id))];
  if (wanted && wanted.length === 0) return empty(null);

  const identity = await witusSubForUserId(db, userId);
  if (!identity.ok) return empty(identity.reason === 'lookup_failed' ? 'lookup_failed' : 'no_identity');
  const sub = identity.sub;

  let goalQuery = db.from('savings_goals').select(GOAL_SELECT).eq('user_id', userId);
  if (wanted) goalQuery = goalQuery.in('id', wanted);
  const goalsRes = await goalQuery;
  if (goalsRes.error) {
    return isMissing(goalsRes.error, 'savings_goals') ? empty('savings_not_migrated') : empty('lookup_failed', goalsRes.error.message);
  }
  const goals = ((goalsRes.data ?? []) as Row[])
    .filter((g) => g.user_id === userId)
    .map((g) => g as unknown as EnvelopeGoal);
  const linked = goals.filter((g) => linkOf(g));

  // Saved so far = starting_amount + SUM(allocations).
  const allocated = new Map<string, number>();
  if (linked.length) {
    const allocRes = await db
      .from('savings_allocations')
      .select('goal_id, amount, user_id')
      .eq('user_id', userId)
      .in('goal_id', linked.map((g) => g.id));
    if (allocRes.error) return empty('lookup_failed', allocRes.error.message);
    for (const a of (allocRes.data ?? []) as Row[]) {
      if (a.user_id !== userId) continue;
      const id = String(a.goal_id);
      allocated.set(id, (allocated.get(id) ?? 0) + cents(a.amount));
    }
  }

  // Each goal's currency is its funding account's (migration 210).
  const accountIds = [...new Set(linked.map((g) => (g as unknown as Row).funding_account_id).filter((id): id is string => typeof id === 'string'))];
  const currencies = new Map<string, string>();
  if (accountIds.length) {
    const accRes = await db.from('financial_accounts').select('id, currency, user_id').eq('user_id', userId).in('id', accountIds);
    // Before migration 210 there is no currency column: fall back, don't fail.
    if (!accRes.error) {
      for (const a of (accRes.data ?? []) as Row[]) {
        if (a.user_id === userId && typeof a.currency === 'string') currencies.set(String(a.id), a.currency);
      }
    }
  }

  const events: OutboxEvent[] = [];
  const activeIds = new Set<string>();
  for (const goal of linked) {
    const accountId = (goal as unknown as Row).funding_account_id;
    const payload = buildEnvelopeEvent({
      goal,
      allocated: (allocated.get(goal.id) ?? 0) / 100,
      currency: typeof accountId === 'string' ? currencies.get(accountId) ?? null : null,
      witusSub: sub,
      now,
      origin: options.origin,
    });
    if (!payload) continue;
    activeIds.add(payload.event_id);
    events.push({ user_id: userId, receiver: ENVELOPE_RECEIVER, event_id: payload.event_id, event_type: ENVELOPE_EVENT_TYPE, payload });
  }
  const active = events.length;

  // Retire facts sent before whose goal is gone or no longer linked.
  const prev = await previousPayloads(db, userId, ENVELOPE_RECEIVER);
  if (prev.missingTable) return empty('missing_table', prev.error);
  if (prev.error) return empty('lookup_failed', prev.error);
  const consider = wanted ? wanted.map(envelopeEventId) : [...prev.payloads.keys()];
  let retired = 0;
  for (const eventId of consider) {
    if (activeIds.has(eventId)) continue;
    const previous = prev.payloads.get(eventId);
    if (!previous || previous.is_active === false) continue;
    const payload = retireEvent(previous, sub, now);
    if (!payload) continue;
    events.push({ user_id: userId, receiver: ENVELOPE_RECEIVER, event_id: eventId, event_type: ENVELOPE_EVENT_TYPE, payload });
    retired += 1;
  }

  const result = await enqueue(db, events, now);
  if (result.missingTable) return empty('missing_table', result.error);
  if (result.error) return empty('lookup_failed', result.error);
  return { queued: result.queued, active, retired, skipped: null, error: null };
}

/** Users with at least one linked goal (for the nightly re-send). */
export async function usersWithLinkedGoals(db: OutboxDb): Promise<{ userIds: string[]; error: string | null }> {
  const { data, error } = await db
    .from('savings_goals')
    .select('user_id, linked_trip_id, linked_equipment_id')
    .or('linked_trip_id.not.is.null,linked_equipment_id.not.is.null')
    .limit(10000);
  if (error) return { userIds: [], error: error.message ?? 'read failed' };
  const ids = new Set<string>();
  for (const row of (data ?? []) as Row[]) {
    if ((row.linked_trip_id || row.linked_equipment_id) && typeof row.user_id === 'string') ids.add(row.user_id);
  }
  return { userIds: [...ids], error: null };
}
