// app/api/equipment/depreciation/summary/route.ts
// Book value and this year's depreciation across the caller's active equipment
// and vehicles that have depreciation settings (migration 214).
//
// GET -> {
//   ready, year,
//   items: [{ kind, id, name, bookValue, accumulated, thisYearToDate, workShare,
//             workDepreciationThisYear, usedForWork, needs }],
//   totals: { bookValue, thisYearToDate, workDepreciationThisYear, configured }
// }
// Before migration 214: { ready: false, error, items: [], totals: zeros }.
// Estimates, not tax advice.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildReport, SETTINGS_COLUMNS } from '@/lib/equipment/depreciation-settings';
import { round2 } from '@/lib/equipment/depreciation';
import {
  DEPRECIATION_NOT_READY,
  isDepreciationMissing,
  loadEquipmentUses,
  loadVehicleMiles,
} from '@/lib/equipment/depreciation-server';

interface SummaryItem {
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

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const year = new Date().getUTCFullYear();
  const empty = { bookValue: 0, thisYearToDate: 0, workDepreciationThisYear: 0, configured: 0 };

  const { data: rows, error } = await supabase
    .from('asset_depreciation')
    .select(SETTINGS_COLUMNS)
    .eq('user_id', user.id);
  if (error) {
    if (isDepreciationMissing(error)) {
      return NextResponse.json({ ready: false, ...DEPRECIATION_NOT_READY, year, items: [], totals: empty });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const settingsRows = (rows ?? []) as unknown as Record<string, unknown>[];
  const equipmentIds = settingsRows.map((r) => r.equipment_id).filter((v): v is string => typeof v === 'string');
  const vehicleIds = settingsRows.map((r) => r.vehicle_id).filter((v): v is string => typeof v === 'string');

  const [equipmentRes, vehicleRes, equipmentUses, vehicleMiles] = await Promise.all([
    equipmentIds.length
      ? supabase
          .from('equipment')
          .select('id, name, purchase_price, purchase_date, created_at, is_active')
          .eq('user_id', user.id)
          .in('id', equipmentIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    vehicleIds.length
      ? supabase.from('vehicles').select('id, nickname, created_at, active').eq('user_id', user.id).in('id', vehicleIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    loadEquipmentUses(supabase, user.id, equipmentIds),
    loadVehicleMiles(supabase, user.id, vehicleIds),
  ]);

  const equipmentById = new Map(((equipmentRes.data ?? []) as Record<string, unknown>[]).map((e) => [String(e.id), e]));
  const vehicleById = new Map(((vehicleRes.data ?? []) as Record<string, unknown>[]).map((v) => [String(v.id), v]));

  const items: SummaryItem[] = [];
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
    empty,
  );

  return NextResponse.json({ ready: true, year, items, totals });
}
