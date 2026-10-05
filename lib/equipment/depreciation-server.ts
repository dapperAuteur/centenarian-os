// lib/equipment/depreciation-server.ts
// Database reads for equipment and vehicle depreciation (migration 214).
// Every query is scoped to the signed-in user's own rows (user-session client,
// RLS on, plus an explicit user_id filter).
//
// USES
//   Equipment: activity_links between the item and a planner task (synced
//   Google Calendar events are planner tasks), a workout, a trip or a focus
//   session. One link = one use, dated by the linked record. A link whose
//   relationship is 'work' is a work use. activity_links is shared and is not
//   changed: 'equipment' and 'task' are already allowed types.
//   Vehicles: miles from the vehicle's trips. purpose 'work' or tax_category
//   'business' = work miles.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { UseEvent } from './depreciation.ts';
import type { AssetKind } from './depreciation-settings.ts';
import { SETTINGS_COLUMNS } from './depreciation-settings.ts';

type DbErrorLike = { code?: string; message?: string } | null | undefined;

export const DEPRECIATION_NOT_READY = {
  error:
    'Depreciation needs a database update first: run migration 214 (supabase/migrations/214_asset_depreciation.sql). Nothing was changed.',
  code: 'asset_depreciation_not_migrated',
} as const;

/** True when the error says asset_depreciation doesn't exist yet. */
export function isDepreciationMissing(error: DbErrorLike): boolean {
  if (!error) return false;
  if (error.code !== '42P01' && error.code !== 'PGRST205') return false;
  return (error.message ?? '').includes('asset_depreciation');
}

/** Relationship value the app writes on a work-use link. */
export const WORK_RELATIONSHIP = 'work';
/** Relationship value the app writes on a personal-use link. */
export const USE_RELATIONSHIP = 'used';

/** Linked types that count as a use, and how to date each. */
// byUser: the table has a user_id column. tasks has none (owned through milestone -> goal ->
// roadmap), so tasks rely on RLS, which the user-session client always applies.
const USE_TABLES: Record<string, { table: string; column: string; byUser: boolean }> = {
  task: { table: 'tasks', column: 'date', byUser: false },
  workout: { table: 'workout_logs', column: 'date', byUser: true },
  trip: { table: 'trips', column: 'date', byUser: true },
  focus_session: { table: 'focus_sessions', column: 'start_time', byUser: true },
};

interface LinkRow {
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  relationship: string | null;
}

export function isWorkRelationship(value: string | null | undefined): boolean {
  return (value ?? '').trim().toLowerCase() === WORK_RELATIONSHIP;
}

/** Uses for each equipment id (all of them when ids is omitted). */
export async function loadEquipmentUses(
  supabase: SupabaseClient,
  userId: string,
  ids?: string[],
): Promise<Map<string, UseEvent[]>> {
  const out = new Map<string, UseEvent[]>();
  if (ids && ids.length === 0) return out;
  const useTypes = Object.keys(USE_TABLES).join(',');
  let query = supabase
    .from('activity_links')
    .select('source_type, source_id, target_type, target_id, relationship')
    .eq('user_id', userId);
  if (ids && ids.length === 1) {
    const id = ids[0];
    query = query.or(
      `and(source_type.eq.equipment,source_id.eq.${id},target_type.in.(${useTypes})),` +
        `and(target_type.eq.equipment,target_id.eq.${id},source_type.in.(${useTypes}))`,
    );
  } else {
    query = query.or(
      `and(source_type.eq.equipment,target_type.in.(${useTypes})),and(target_type.eq.equipment,source_type.in.(${useTypes}))`,
    );
  }
  const { data } = await query;
  const wanted = ids ? new Set(ids) : null;

  const pairs: { equipmentId: string; type: string; otherId: string; work: boolean }[] = [];
  for (const link of (data ?? []) as LinkRow[]) {
    const equipFirst = link.source_type === 'equipment';
    const equipmentId = equipFirst ? link.source_id : link.target_id;
    const type = equipFirst ? link.target_type : link.source_type;
    const otherId = equipFirst ? link.target_id : link.source_id;
    if (wanted && !wanted.has(equipmentId)) continue;
    if (!USE_TABLES[type]) continue;
    pairs.push({ equipmentId, type, otherId, work: isWorkRelationship(link.relationship) });
  }

  // Date each linked record (one query per type, in chunks).
  const dates = new Map<string, string | null>();
  for (const [type, { table, column, byUser }] of Object.entries(USE_TABLES)) {
    const idsOfType = Array.from(new Set(pairs.filter((p) => p.type === type).map((p) => p.otherId)));
    for (let i = 0; i < idsOfType.length; i += 200) {
      const chunk = idsOfType.slice(i, i + 200);
      let rowsQuery = supabase.from(table).select(`id, ${column}`).in('id', chunk);
      if (byUser) rowsQuery = rowsQuery.eq('user_id', userId);
      const { data: rows } = await rowsQuery;
      for (const row of (rows ?? []) as unknown as Record<string, unknown>[]) {
        const raw = row[column];
        dates.set(`${type}:${row.id}`, typeof raw === 'string' ? raw.slice(0, 10) : null);
      }
    }
  }

  for (const p of pairs) {
    const key = `${p.type}:${p.otherId}`;
    // A record the caller can't read (deleted, not theirs) is not a use.
    if (!dates.has(key)) continue;
    const list = out.get(p.equipmentId) ?? [];
    list.push({ date: dates.get(key) ?? null, units: 1, work: p.work });
    out.set(p.equipmentId, list);
  }
  return out;
}

/** Trip miles for each vehicle id. */
export async function loadVehicleMiles(
  supabase: SupabaseClient,
  userId: string,
  ids: string[],
): Promise<Map<string, UseEvent[]>> {
  const out = new Map<string, UseEvent[]>();
  if (ids.length === 0) return out;
  const { data } = await supabase
    .from('trips')
    .select('vehicle_id, date, distance_miles, purpose, tax_category')
    .eq('user_id', userId)
    .in('vehicle_id', ids);
  for (const trip of (data ?? []) as Record<string, unknown>[]) {
    const miles = Number(trip.distance_miles) || 0;
    if (miles <= 0) continue;
    const id = String(trip.vehicle_id);
    const list = out.get(id) ?? [];
    list.push({
      date: typeof trip.date === 'string' ? trip.date : null,
      units: miles,
      work: trip.purpose === 'work' || trip.tax_category === 'business',
    });
    out.set(id, list);
  }
  return out;
}

export interface LoadedItem {
  kind: AssetKind;
  id: string;
  name: string;
  purchase_price: number | string | null;
  purchase_date: string | null;
  created_at: string | null;
  current_value: number | string | null;
  is_active: boolean;
}

/** The item itself, or null when it isn't the caller's. */
export async function loadItem(
  supabase: SupabaseClient,
  userId: string,
  kind: AssetKind,
  id: string,
): Promise<LoadedItem | null> {
  if (kind === 'equipment') {
    const { data } = await supabase
      .from('equipment')
      .select('id, name, purchase_price, purchase_date, created_at, current_value, is_active')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    return data ? { kind, ...(data as Omit<LoadedItem, 'kind'>) } : null;
  }
  const { data } = await supabase
    .from('vehicles')
    .select('id, nickname, created_at, active')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return null;
  const v = data as { id: string; nickname: string; created_at: string | null; active: boolean };
  return {
    kind,
    id: v.id,
    name: v.nickname,
    purchase_price: null,
    purchase_date: null,
    created_at: v.created_at,
    current_value: null,
    is_active: v.active,
  };
}

/** The settings row for one item: { row } (null if none yet) or { missing: true } before migration 214. */
export async function loadSettingsRow(
  supabase: SupabaseClient,
  userId: string,
  kind: AssetKind,
  id: string,
): Promise<{ row: Record<string, unknown> | null; missing: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('asset_depreciation')
    .select(SETTINGS_COLUMNS)
    .eq('user_id', userId)
    .eq(kind === 'equipment' ? 'equipment_id' : 'vehicle_id', id)
    .maybeSingle();
  if (error) {
    if (isDepreciationMissing(error)) return { row: null, missing: true };
    return { row: null, missing: false, error: error.message };
  }
  return { row: (data as Record<string, unknown> | null) ?? null, missing: false };
}
