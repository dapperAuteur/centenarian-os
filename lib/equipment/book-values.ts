// lib/equipment/book-values.ts
// Book value and this year's depreciation for every active equipment item and vehicle that has
// depreciation settings (migration 214). Used by GET /api/equipment/depreciation/summary and by
// the Wallet (lib/finance/wallet), so both show the same book values.
//
// Pass the user-session client: equipment uses come from activity_links to planner tasks, and
// tasks have no user_id column (they rely on RLS). Every other query is also scoped by user_id.
// Estimates, not tax advice.

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildReport, SETTINGS_COLUMNS } from './depreciation-settings.ts';
import { round2 } from './depreciation.ts';
import { DEPRECIATION_NOT_READY, isDepreciationMissing, loadEquipmentUses, loadVehicleMiles } from './depreciation-server.ts';

export interface BookValueItem {
  kind: 'equipment' | 'vehicle';
  id: string;
  name: string;
  bookValue: number | null;
  accumulated: number | null;
  thisYearToDate: number | null;
  workShare: number | null;
  workDepreciationThisYear: number;
  usedForWork: boolean;
  needs: string | null;
}

export interface BookValueTotals {
  bookValue: number;
  thisYearToDate: number;
  workDepreciationThisYear: number;
  configured: number;
}

export type BookValueSummary =
  | { ready: true; year: number; items: BookValueItem[]; totals: BookValueTotals }
  | { ready: false; year: number; items: []; totals: BookValueTotals; error: string; code: string };

const EMPTY_TOTALS: BookValueTotals = { bookValue: 0, thisYearToDate: 0, workDepreciationThisYear: 0, configured: 0 };

/** The summary; throws only on an unexpected database error (its message). */
export async function loadBookValues(supabase: SupabaseClient, userId: string, year = new Date().getUTCFullYear()): Promise<BookValueSummary> {
  const { data: rows, error } = await supabase.from('asset_depreciation').select(SETTINGS_COLUMNS).eq('user_id', userId);
  if (error) {
    if (isDepreciationMissing(error)) return { ready: false, ...DEPRECIATION_NOT_READY, year, items: [], totals: { ...EMPTY_TOTALS } };
    throw new Error(error.message);
  }

  const settingsRows = (rows ?? []) as unknown as Record<string, unknown>[];
  const equipmentIds = settingsRows.map((r) => r.equipment_id).filter((v): v is string => typeof v === 'string');
  const vehicleIds = settingsRows.map((r) => r.vehicle_id).filter((v): v is string => typeof v === 'string');

  const [equipmentRes, vehicleRes, equipmentUses, vehicleMiles] = await Promise.all([
    equipmentIds.length
      ? supabase
          .from('equipment')
          .select('id, name, purchase_price, purchase_date, created_at, is_active')
          .eq('user_id', userId)
          .in('id', equipmentIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    vehicleIds.length
      ? supabase.from('vehicles').select('id, nickname, created_at, active').eq('user_id', userId).in('id', vehicleIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    loadEquipmentUses(supabase, userId, equipmentIds),
    loadVehicleMiles(supabase, userId, vehicleIds),
  ]);

  const equipmentById = new Map(((equipmentRes.data ?? []) as Record<string, unknown>[]).map((e) => [String(e.id), e]));
  const vehicleById = new Map(((vehicleRes.data ?? []) as Record<string, unknown>[]).map((v) => [String(v.id), v]));

  const items: BookValueItem[] = [];
  for (const row of settingsRows) {
    const isEquipment = typeof row.equipment_id === 'string';
    const id = String(isEquipment ? row.equipment_id : row.vehicle_id);
    const item = isEquipment ? equipmentById.get(id) : vehicleById.get(id);
    if (!item) continue;
    const active = isEquipment ? item.is_active !== false : item.active !== false;
    if (!active) continue;
    const report = buildReport(
      row,
      {
        purchase_price: (item.purchase_price as number | string | null) ?? null,
        purchase_date: (item.purchase_date as string | null) ?? null,
        created_at: (item.created_at as string | null) ?? null,
      },
      (isEquipment ? equipmentUses.get(id) : vehicleMiles.get(id)) ?? [],
    );
    items.push({
      kind: isEquipment ? 'equipment' : 'vehicle',
      id,
      name: String(isEquipment ? item.name : item.nickname),
      bookValue: report.summary?.bookValue ?? null,
      accumulated: report.summary?.accumulated ?? null,
      thisYearToDate: report.summary?.thisYearToDate ?? null,
      workShare: report.workShareThisYear,
      workDepreciationThisYear: report.workDepreciationThisYear,
      usedForWork: row.used_for_work === true,
      needs: report.needs,
    });
  }

  const totals = items.reduce(
    (t, i) => ({
      bookValue: round2(t.bookValue + (i.bookValue ?? 0)),
      thisYearToDate: round2(t.thisYearToDate + (i.thisYearToDate ?? 0)),
      workDepreciationThisYear: round2(t.workDepreciationThisYear + (i.usedForWork ? i.workDepreciationThisYear : 0)),
      configured: t.configured + (i.needs ? 0 : 1),
    }),
    { ...EMPTY_TOTALS },
  );

  return { ready: true, year, items, totals };
}

/** Book values by item id, for the Wallet (items whose book value can't be worked out are left out). */
export function bookValueMaps(summary: BookValueSummary): { equipment: Map<string, number>; vehicles: Map<string, number> } | null {
  if (!summary.ready) return null;
  const equipment = new Map<string, number>();
  const vehicles = new Map<string, number>();
  for (const item of summary.items) {
    if (item.bookValue === null) continue;
    (item.kind === 'equipment' ? equipment : vehicles).set(item.id, item.bookValue);
  }
  return { equipment, vehicles };
}
