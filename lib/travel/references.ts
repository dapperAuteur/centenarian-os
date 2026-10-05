// lib/travel/references.ts
// The foreign ids a travel request body may carry, and the fields it may never set.
//
// Trips, route legs, fuel logs and maintenance records accept a vehicle, a
// contractor job, a brand and a finance category from the browser. Each must be
// the caller's own (a vehicle may also be one of the shared public-transport
// vehicles). Check them with checkReferences() from lib/auth/ownership.ts.
//
// Kept free of '@/' imports so node --test can load it (tests/unit/travel-references.test.ts).

import type { Reference } from '../auth/ownership.ts';

/** Body field → the table its id points into. */
const TRAVEL_REFERENCE_FIELDS: ReadonlyArray<{ field: string; table: string; allowPublic?: boolean }> = [
  { field: 'vehicle_id', table: 'vehicles', allowPublic: true },
  { field: 'job_id', table: 'contractor_jobs' },
  { field: 'brand_id', table: 'user_brands' },
  { field: 'finance_category_id', table: 'budget_categories' },
];

/**
 * The references a travel body (or one route leg) carries, for checkReferences().
 * `prefix` names the field in the 400 message, e.g. 'legs.' for route legs.
 * Fields that are absent or blank are skipped by checkReferences itself.
 */
export function travelReferences(body: unknown, prefix = ''): Reference[] {
  if (!body || typeof body !== 'object') return [];
  const record = body as Record<string, unknown>;
  return TRAVEL_REFERENCE_FIELDS
    .filter(({ field }) => Object.prototype.hasOwnProperty.call(record, field))
    .map(({ field, table, allowPublic }) => ({
      field: `${prefix}${field}`,
      table,
      id: record[field],
      allowPublic,
    }));
}

/** References for every leg of a multi-leg route. */
export function routeLegReferences(legs: unknown): Reference[] {
  if (!Array.isArray(legs)) return [];
  return legs.flatMap((leg) => travelReferences(leg, 'legs.'));
}

/**
 * Fields a travel PATCH may never set: the owner, links the server maintains
 * (the generated finance transaction, a leg's route and position), FIFO
 * bookkeeping, and timestamps.
 */
export const TRAVEL_PROTECTED_FIELDS: readonly string[] = [
  'id',
  'user_id',
  'transaction_id',
  'route_id',
  'leg_order',
  'gallons_remaining',
  'fifo_cost',
  'cost_source',
  'created_at',
  'updated_at',
];

/** The columns a travel GET embeds for a vehicle, plus the two the visibility check needs. */
export const VEHICLE_EMBED = 'vehicles(id, nickname, type, user_id, is_system)';

export interface VehicleSummary {
  id: unknown;
  nickname: unknown;
  type: unknown;
}

/**
 * A record's embedded vehicle as the caller may see it: their own vehicle or a
 * shared public-transport vehicle, else null. Routes read with the service-role
 * client, so a vehicle_id stored before the reference checks existed could
 * otherwise show another user's vehicle name.
 */
export function visibleVehicle(vehicle: unknown, userId: string): VehicleSummary | null {
  const v = Array.isArray(vehicle) ? vehicle[0] : vehicle;
  if (!v || typeof v !== 'object' || !userId) return null;
  const row = v as Record<string, unknown>;
  if (row.user_id !== userId && row.is_system !== true) return null;
  return { id: row.id, nickname: row.nickname, type: row.type };
}

/** `row` with its `vehicles` embed replaced by visibleVehicle(). */
export function withVisibleVehicle<T extends Record<string, unknown>>(
  row: T,
  userId: string,
): Omit<T, 'vehicles'> & { vehicles: VehicleSummary | null } {
  return { ...row, vehicles: visibleVehicle(row.vehicles, userId) };
}
