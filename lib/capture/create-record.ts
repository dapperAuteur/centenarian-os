// lib/capture/create-record.ts
// Server-only `(db, userId, input)` helpers that create (and, for the calendar sync, update)
// the records a capture can produce: a transaction, a meal log, a workout log. They hold the
// rules the API routes used to keep inline, so a route and the Google Calendar sync (which runs
// from a cron with no user session) save records the same way:
//
//   createTransaction  POST /api/finance/transactions: the vendor's learned category fills a
//                      missing category, a row on a foreign-currency account gets currency /
//                      fx_rate / amount_home (migration 210), and every referenced id (account,
//                      category, brand) must be the user's own (lib/auth/ownership.ts).
//   createMealLog      POST /api/meals (meals used to be a browser-side insert only).
//   createWorkoutLog   POST /api/workouts/logs: template, exercise and equipment ids are kept
//                      only when the user may reference them; anything else is saved as "no link".
//
// `db` reads and writes; every query is scoped by `userId`. Routes pass their client, the sync
// passes the service-role client. `options.fxDb` is the client used for the currency lookups
// (the transactions route keeps using the service-role client there, as it did before).
//
// Never use updated_at to decide whether a row changed: financial_transactions has a BEFORE
// UPDATE trigger that moves it on every write.
//
// Relative imports keep their ".ts" extension so this file loads under
// `node --test --experimental-strip-types` (tests/unit/calendar-records.test.ts).

import type { SupabaseClient } from '@supabase/supabase-js';
import { checkOwned, checkReferences, invalidReferenceMessage, ownedIds } from '../auth/ownership.ts';
import { findLearnedCategory } from '../finance/learned-categories.ts';
import { fxFieldsFor, loadAccountCurrency, loadHomeCurrency } from '../finance/fx/server.ts';

/** Success, or an HTTP status and a message the route can answer with. */
export type CreateResult<T> = { ok: true; value: T } | { ok: false; status: 400 | 500; error: string };

const fail = (status: 400 | 500, error: string): { ok: false; status: 400 | 500; error: string } => ({
  ok: false,
  status,
  error,
});

const trimmed = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

// ── Transactions ────────────────────────────────────────────────────────────────

export interface TransactionInput {
  amount: unknown;
  type?: string | null;
  description?: string | null;
  vendor?: string | null;
  transaction_date: unknown;
  category_id?: string | null;
  /** A guess (e.g. the receipt scanner's); a learned category beats it. */
  suggested_category_id?: string | null;
  account_id?: string | null;
  brand_id?: string | null;
  tags?: string[] | null;
  notes?: string | null;
}

/**
 * A pre-chosen primary key. Server code only (never from a request body): the calendar sync
 * stores the id before inserting, so a create that is retried finds its row instead of doubling it.
 */
export interface CreateOptions {
  id?: string;
}

export interface TransactionOptions extends CreateOptions {
  /** Client for the home / account currency and rate lookups. Defaults to `db`. */
  fxDb?: SupabaseClient;
  /** PostgREST select for the returned row. */
  select?: string;
}

/**
 * The FX columns for a row on `accountId`: {} when the account is in the home currency (or has
 * no currency column yet, before migration 210), so nothing new is sent to the database.
 */
export async function fxForRow(
  db: SupabaseClient,
  userId: string,
  accountId: string | null,
  amount: number,
  date: string,
): Promise<Record<string, unknown>> {
  if (!accountId || !Number.isFinite(amount)) return {};
  const home = await loadHomeCurrency(db, userId);
  const currency = await loadAccountCurrency(db, userId, accountId, home);
  if (!currency || currency === home) return {};
  const { fields } = await fxFieldsFor(db, userId, currency, home, amount, date);
  return { ...fields };
}

/** Creates one transaction with `source = 'manual'`. */
export async function createTransaction(
  db: SupabaseClient,
  userId: string,
  input: TransactionInput,
  options: TransactionOptions = {},
): Promise<CreateResult<Record<string, unknown>>> {
  const { amount, type, description, vendor, transaction_date, category_id, suggested_category_id, account_id, brand_id, tags, notes } = input;
  if (!amount || !transaction_date) return fail(400, 'Amount and date are required');

  const refs = await checkReferences(db, userId, [
    { field: 'account_id', table: 'financial_accounts', id: account_id },
    { field: 'category_id', table: 'budget_categories', id: category_id },
    { field: 'brand_id', table: 'user_brands', id: brand_id },
  ]);
  if (refs.failed) return fail(500, 'Could not save the transaction');
  if (!refs.ok) return fail(400, invalidReferenceMessage(refs.invalid));

  // Category, in order: what the user picked; the vendor's learned category (set by answering
  // "Always" to the categorize prompt); then a suggestion such as the receipt scanner's guess,
  // so a learned category beats the AI. A suggestion that is not the user's own is dropped.
  const kind = type || 'expense';
  let resolvedCategoryId: string | null = category_id || null;
  if (!resolvedCategoryId && typeof vendor === 'string' && vendor.trim()) {
    resolvedCategoryId = await findLearnedCategory(db, userId, vendor, kind);
  }
  if (!resolvedCategoryId && typeof suggested_category_id === 'string' && suggested_category_id) {
    const suggested = await checkOwned(db, userId, 'budget_categories', suggested_category_id);
    if (suggested.allowed) resolvedCategoryId = suggested_category_id;
  }

  const parsedAmount = parseFloat(String(amount));
  const date = String(transaction_date);
  const fx = await fxForRow(options.fxDb ?? db, userId, account_id || null, parsedAmount, date);

  const { data, error } = await db
    .from('financial_transactions')
    .insert({
      ...(options.id ? { id: options.id } : {}),
      ...fx,
      user_id: userId,
      amount: Math.abs(parsedAmount),
      type: kind,
      description: description?.trim() || null,
      vendor: vendor?.trim() || null,
      transaction_date: date,
      category_id: resolvedCategoryId,
      account_id: account_id || null,
      brand_id: brand_id || null,
      tags: tags || null,
      notes: notes?.trim() || null,
      source: 'manual',
    })
    .select(options.select ?? '*')
    .maybeSingle();

  if (error) return fail(500, error.message);
  if (!data) return fail(500, 'Saving the transaction returned no row.');
  return { ok: true, value: data as unknown as Record<string, unknown> };
}

export interface TransactionPatch {
  amount?: number;
  type?: string;
  vendor?: string | null;
  description?: string | null;
  transaction_date?: string;
  account_id?: string | null;
}

/**
 * Updates the calendar-owned fields of one of the user's transactions and recomputes the
 * home-currency amount, as PATCH /api/finance/transactions does. Returns an error message or null.
 */
export async function updateTransactionFields(
  db: SupabaseClient,
  userId: string,
  id: string,
  patch: TransactionPatch,
  fxDb?: SupabaseClient,
): Promise<string | null> {
  const payload: Record<string, unknown> = { ...patch };
  if (patch.amount !== undefined) payload.amount = Math.abs(patch.amount);
  if (patch.amount !== undefined || patch.transaction_date !== undefined || patch.account_id !== undefined) {
    const { data: before, error: readError } = await db
      .from('financial_transactions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (readError) return readError.message;
    if (!before) return 'The transaction was not found.';
    const row = before as Record<string, unknown>;
    const accountId = (patch.account_id !== undefined ? patch.account_id : row.account_id) as string | null;
    const fx = await fxForRow(fxDb ?? db, userId, accountId || null, Number(payload.amount ?? row.amount), String(payload.transaction_date ?? row.transaction_date));
    if (Object.keys(fx).length > 0) Object.assign(payload, fx);
    else if ('amount_home' in row && (row.amount_home !== null || row.currency !== null)) {
      Object.assign(payload, { currency: null, fx_rate: null, amount_home: null });
    }
  }
  const { error } = await db.from('financial_transactions').update(payload).eq('id', id).eq('user_id', userId);
  return error ? error.message : null;
}

// ── Meal logs ───────────────────────────────────────────────────────────────────

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export interface MealLogInput {
  date?: unknown;
  time?: unknown;
  meal_type?: unknown;
  notes?: unknown;
  protocol_id?: unknown;
  is_restaurant_meal?: unknown;
  restaurant_name?: unknown;
  restaurant_address?: unknown;
  restaurant_city?: unknown;
  restaurant_state?: unknown;
  restaurant_country?: unknown;
  restaurant_website?: unknown;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/** Creates one meal log. A restaurant meal never carries a protocol (as the meal form does). */
export async function createMealLog(
  db: SupabaseClient,
  userId: string,
  input: MealLogInput,
  options: CreateOptions = {},
): Promise<CreateResult<Record<string, unknown>>> {
  if (typeof input.date !== 'string' || !DATE_RE.test(input.date)) return fail(400, 'date must be YYYY-MM-DD');
  if (typeof input.time !== 'string' || !TIME_RE.test(input.time)) return fail(400, 'time must be HH:MM');
  const mealType = input.meal_type ?? null;
  if (mealType !== null && !MEAL_TYPES.some((t) => t === mealType)) {
    return fail(400, `meal_type must be one of ${MEAL_TYPES.join(', ')}`);
  }
  const isRestaurant = input.is_restaurant_meal === true;
  const protocolId = isRestaurant ? null : trimmed(input.protocol_id);
  if (protocolId) {
    const ref = await checkOwned(db, userId, 'protocols', protocolId);
    if (ref.failed) return fail(500, 'Could not save the meal');
    if (!ref.allowed) return fail(400, invalidReferenceMessage(['protocol_id']));
  }

  const { data, error } = await db
    .from('meal_logs')
    .insert({
      ...(options.id ? { id: options.id } : {}),
      user_id: userId,
      date: input.date,
      time: input.time,
      protocol_id: protocolId,
      meal_type: mealType,
      notes: trimmed(input.notes),
      is_restaurant_meal: isRestaurant,
      restaurant_name: isRestaurant ? trimmed(input.restaurant_name) : null,
      restaurant_address: isRestaurant ? trimmed(input.restaurant_address) : null,
      restaurant_city: isRestaurant ? trimmed(input.restaurant_city) : null,
      restaurant_state: isRestaurant ? trimmed(input.restaurant_state) : null,
      restaurant_country: isRestaurant ? trimmed(input.restaurant_country) : null,
      restaurant_website: isRestaurant ? trimmed(input.restaurant_website) : null,
    })
    .select('*')
    .maybeSingle();
  if (error) return fail(500, error.message);
  if (!data) return fail(500, 'Saving the meal returned no row.');
  return { ok: true, value: data as Record<string, unknown> };
}

// ── Workout logs ────────────────────────────────────────────────────────────────

export interface WorkoutLogInput {
  template_id?: unknown;
  name?: unknown;
  date?: unknown;
  started_at?: unknown;
  finished_at?: unknown;
  duration_min?: unknown;
  notes?: unknown;
  purpose?: unknown;
  overall_feeling?: unknown;
  warmup_notes?: unknown;
  cooldown_notes?: unknown;
  exercises?: unknown;
}

/**
 * Creates one workout log and its exercises, and bumps the use counts of the user's template
 * and of the exercises it references. Returns the log with its exercises.
 */
export async function createWorkoutLog(
  db: SupabaseClient,
  userId: string,
  input: WorkoutLogInput,
  options: CreateOptions = {},
): Promise<CreateResult<Record<string, unknown>>> {
  const { template_id, name, date, started_at, finished_at, duration_min, notes, purpose, overall_feeling, warmup_notes, cooldown_notes } = input;
  const exerciseList: unknown[] = Array.isArray(input.exercises) ? input.exercises : [];
  const idsOf = (key: 'exercise_id' | 'equipment_id') =>
    exerciseList.map((ex) => (ex && typeof ex === 'object' ? (ex as Record<string, unknown>)[key] : null));

  // A log points at a workout template and, per exercise, at an exercise and a piece of
  // equipment. Each id is kept only when the user may reference it: their own record, or one
  // that is public under its table's rule (lib/auth/ownership). Anything else is saved as
  // "no link" rather than refused: every row also carries its own name, and a workout copied
  // from a public one can still hold its author's ids, which must not stop it being logged.
  const [templateRef, exerciseRefs, equipmentRefs] = await Promise.all([
    checkOwned(db, userId, 'workout_templates', template_id, { allowPublic: true }),
    ownedIds(db, userId, 'exercises', idsOf('exercise_id'), { allowPublic: true }),
    ownedIds(db, userId, 'equipment', idsOf('equipment_id'), { allowPublic: true }),
  ]);
  if (templateRef.failed || exerciseRefs.failed || equipmentRefs.failed) {
    return fail(500, 'Could not save the workout');
  }
  const templateId = templateRef.allowed ? (template_id as string) : null;

  // From the user's own template: bump use_count and use its name when none was given.
  let logName = typeof name === 'string' ? name : '';
  if (templateId) {
    const { data: tmpl } = await db
      .from('workout_templates')
      .select('name, use_count')
      .eq('id', templateId)
      .eq('user_id', userId)
      .maybeSingle();
    if (tmpl) {
      if (!logName) logName = tmpl.name;
      await db
        .from('workout_templates')
        .update({ use_count: tmpl.use_count + 1 })
        .eq('id', templateId)
        .eq('user_id', userId);
    }
  }
  if (!logName?.trim()) return fail(400, 'name is required');

  const { data: log, error } = await db
    .from('workout_logs')
    .insert({
      ...(options.id ? { id: options.id } : {}),
      user_id: userId,
      template_id: templateId,
      name: logName.trim(),
      date: (date as string | undefined) ?? new Date().toISOString().split('T')[0],
      started_at: started_at ?? null,
      finished_at: finished_at ?? null,
      duration_min: duration_min ? Number(duration_min) : null,
      notes: notes ?? null,
      purpose: Array.isArray(purpose) ? purpose : [],
      overall_feeling: overall_feeling ? Number(overall_feeling) : null,
      warmup_notes: warmup_notes ?? null,
      cooldown_notes: cooldown_notes ?? null,
    })
    .select()
    .maybeSingle();
  if (error) return fail(500, error.message);
  if (!log) return fail(500, 'Saving the workout returned no row.');
  const logId = (log as { id: string }).id;

  if (exerciseList.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = exerciseList.map((ex: any, i: number) => ({
      log_id: logId,
      name: ex.name,
      exercise_id: exerciseRefs.has(ex.exercise_id) ? ex.exercise_id : null,
      sets_completed: ex.sets_completed ?? null,
      reps_completed: ex.reps_completed ?? null,
      weight_lbs: ex.weight_lbs ? Number(ex.weight_lbs) : null,
      duration_sec: ex.duration_sec ? Number(ex.duration_sec) : null,
      rest_sec: ex.rest_sec ?? 60,
      sort_order: i,
      notes: ex.notes ?? null,
      equipment_id: equipmentRefs.has(ex.equipment_id) ? ex.equipment_id : null,
      is_circuit: ex.is_circuit ?? false,
      is_negative: ex.is_negative ?? false,
      is_isometric: ex.is_isometric ?? false,
      to_failure: ex.to_failure ?? false,
      is_superset: ex.is_superset ?? false,
      superset_group: ex.superset_group ?? null,
      is_balance: ex.is_balance ?? false,
      is_unilateral: ex.is_unilateral ?? false,
      percent_of_max: ex.percent_of_max ?? null,
      rpe: ex.rpe ?? null,
      tempo: ex.tempo || null,
      distance_miles: ex.distance_miles ?? null,
      hold_sec: ex.hold_sec ?? null,
      phase: ex.phase || null,
      side: ex.side || null,
      feeling: ex.feeling ? Number(ex.feeling) : null,
      is_bodyweight: ex.is_bodyweight ?? false,
      is_timed: ex.is_timed ?? false,
      per_side: ex.per_side ?? false,
    }));

    await db.from('workout_log_exercises').insert(rows);

    // Bump use_count on the referenced exercises. Only ids that passed the check above are
    // left in `rows`, so no other user's private exercise is read or counted.
    const exerciseIds = [...new Set(rows.map((r) => r.exercise_id).filter(Boolean) as string[])];
    for (const eid of exerciseIds) {
      const { data: exRow } = await db.from('exercises').select('use_count').eq('id', eid).maybeSingle();
      if (exRow) {
        await db.from('exercises').update({ use_count: (exRow.use_count || 0) + 1 }).eq('id', eid);
      }
    }
  }

  const { data: full } = await db
    .from('workout_logs')
    .select('*, workout_log_exercises(*)')
    .eq('id', logId)
    .maybeSingle();
  return { ok: true, value: (full ?? log) as Record<string, unknown> };
}
