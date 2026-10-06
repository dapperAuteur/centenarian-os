// lib/equipment/depreciation-settings.ts
// Pure helpers between the asset_depreciation row (migration 214), the item it
// belongs to, and lib/equipment/depreciation.ts: validating a save, and turning
// a row + item + uses into a depreciation input and report.

import {
  DEPRECIATION_METHODS,
  checkInput,
  costPerUse,
  countUses,
  isIsoDate,
  round2,
  summarize,
  todayUtc,
  workShare,
  workShareAmount,
  yearlySchedule,
  type DepreciationInput,
  type DepreciationMethod,
  type DepreciationSummary,
  type ScheduleRow,
  type UseCounts,
  type UseEvent,
} from './depreciation.ts';

export type AssetKind = 'equipment' | 'vehicle';

/** The asset_depreciation columns the app reads and writes. */
export interface DepreciationSettings {
  cost_basis: number | null;
  in_service_date: string | null;
  method: DepreciationMethod;
  life_years: number | null;
  life_units: number | null;
  salvage_value: number;
  db_factor: number;
  used_for_work: boolean;
  work_share_override: number | null;
  manual_uses: number;
  manual_work_uses: number;
  replacement_cost: number | null;
  replacement_date: string | null;
  notes: string | null;
}

export const DEFAULT_SETTINGS: DepreciationSettings = {
  cost_basis: null,
  in_service_date: null,
  method: 'straight_line',
  life_years: null,
  life_units: null,
  salvage_value: 0,
  db_factor: 2,
  used_for_work: false,
  work_share_override: null,
  manual_uses: 0,
  manual_work_uses: 0,
  replacement_cost: null,
  replacement_date: null,
  notes: null,
};

export const SETTINGS_COLUMNS =
  'id, equipment_id, vehicle_id, cost_basis, in_service_date, method, life_years, life_units, salvage_value, ' +
  'db_factor, used_for_work, work_share_override, manual_uses, manual_work_uses, replacement_cost, ' +
  'replacement_date, notes';

/** What the item itself knows (equipment has a price and date; vehicles don't). */
export interface ItemBasics {
  purchase_price?: number | string | null;
  purchase_date?: string | null;
  created_at?: string | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** A row from the database (numbers may arrive as strings) to settings. */
export function normalizeSettings(row: Record<string, unknown> | null | undefined): DepreciationSettings {
  if (!row) return { ...DEFAULT_SETTINGS };
  const method = DEPRECIATION_METHODS.includes(row.method as DepreciationMethod)
    ? (row.method as DepreciationMethod)
    : 'straight_line';
  return {
    cost_basis: num(row.cost_basis),
    in_service_date: isIsoDate(row.in_service_date) ? row.in_service_date : null,
    method,
    life_years: num(row.life_years),
    life_units: num(row.life_units),
    salvage_value: num(row.salvage_value) ?? 0,
    db_factor: num(row.db_factor) ?? 2,
    used_for_work: row.used_for_work === true,
    work_share_override: num(row.work_share_override),
    manual_uses: num(row.manual_uses) ?? 0,
    manual_work_uses: num(row.manual_work_uses) ?? 0,
    replacement_cost: num(row.replacement_cost),
    replacement_date: isIsoDate(row.replacement_date) ? row.replacement_date : null,
    notes: typeof row.notes === 'string' && row.notes.trim() ? row.notes.trim() : null,
  };
}

export type ParseResult =
  | { ok: true; values: Partial<DepreciationSettings> }
  | { ok: false; error: string };

/** Validate a save request body. Only the fields present are returned. */
export function parseSettingsBody(body: Record<string, unknown>): ParseResult {
  const values: Partial<DepreciationSettings> = {};
  const money = (key: 'cost_basis' | 'replacement_cost' | 'salvage_value', nullable: boolean): string | null => {
    if (!(key in body)) return null;
    const n = num(body[key]);
    if (n === null) {
      if (!nullable) return `${key} must be a number`;
      (values as Record<string, unknown>)[key] = null;
      return null;
    }
    if (n < 0) return `${key} can't be negative`;
    (values as Record<string, unknown>)[key] = round2(n);
    return null;
  };
  const positive = (key: 'life_years' | 'life_units' | 'db_factor', nullable: boolean): string | null => {
    if (!(key in body)) return null;
    const n = num(body[key]);
    if (n === null) {
      if (!nullable) return `${key} must be a number`;
      (values as Record<string, unknown>)[key] = null;
      return null;
    }
    if (n <= 0) return `${key} must be above 0`;
    (values as Record<string, unknown>)[key] = n;
    return null;
  };
  const count = (key: 'manual_uses' | 'manual_work_uses'): string | null => {
    if (!(key in body)) return null;
    const n = num(body[key]) ?? 0;
    if (n < 0) return `${key} can't be negative`;
    values[key] = n;
    return null;
  };
  const date = (key: 'in_service_date' | 'replacement_date'): string | null => {
    if (!(key in body)) return null;
    const v = body[key];
    if (v === null || v === '') {
      values[key] = null;
      return null;
    }
    if (!isIsoDate(v)) return `${key} must be a date (YYYY-MM-DD)`;
    values[key] = v;
    return null;
  };

  const errors = [
    money('cost_basis', true),
    money('replacement_cost', true),
    money('salvage_value', false),
    positive('life_years', true),
    positive('life_units', true),
    positive('db_factor', false),
    count('manual_uses'),
    count('manual_work_uses'),
    date('in_service_date'),
    date('replacement_date'),
  ].filter(Boolean);
  if (errors.length) return { ok: false, error: errors[0] as string };

  if ('method' in body) {
    if (!DEPRECIATION_METHODS.includes(body.method as DepreciationMethod)) {
      return { ok: false, error: 'method must be straight_line, declining_balance or units_of_use' };
    }
    values.method = body.method as DepreciationMethod;
  }
  if ('used_for_work' in body) values.used_for_work = body.used_for_work === true;
  if ('work_share_override' in body) {
    const n = num(body.work_share_override);
    if (n !== null && (n < 0 || n > 100)) return { ok: false, error: 'work_share_override must be 0 to 100' };
    values.work_share_override = n;
  }
  if ('notes' in body) {
    values.notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 2000) : null;
  }
  return { ok: true, values };
}

/** Cost and in-service date after the row's overrides and the item's own fields. */
export function resolveBasis(settings: DepreciationSettings, item: ItemBasics): { cost: number | null; inService: string | null } {
  const cost = settings.cost_basis ?? num(item.purchase_price);
  const createdDay = typeof item.created_at === 'string' ? item.created_at.slice(0, 10) : null;
  const inService =
    settings.in_service_date ??
    (isIsoDate(item.purchase_date) ? item.purchase_date : null) ??
    (isIsoDate(createdDay) ? createdDay : null);
  return { cost, inService };
}

export interface DepreciationReport {
  configured: boolean;
  /** Why no schedule could be made (missing cost, life...), or null. */
  needs: string | null;
  cost: number | null;
  inServiceDate: string | null;
  summary: DepreciationSummary | null;
  schedule: ScheduleRow[];
  uses: UseCounts;
  usesThisYear: UseCounts;
  workShare: number | null;
  workShareThisYear: number | null;
  costPerUse: number | null;
  /** This calendar year's depreciation to date x this year's work share. */
  workDepreciationThisYear: number;
}

/**
 * Everything the Depreciation and Work use sections show. `linkedUses` are the
 * uses found in the app (activity links or trip miles); the row's manual uses
 * are added on top, undated.
 */
export function buildReport(
  row: Record<string, unknown> | null,
  item: ItemBasics,
  linkedUses: UseEvent[],
  asOf: string = todayUtc(),
): DepreciationReport {
  const settings = normalizeSettings(row);
  const manualWork = Math.min(settings.manual_work_uses, settings.manual_uses);
  const uses: UseEvent[] = [...linkedUses];
  if (manualWork > 0) uses.push({ date: null, units: manualWork, work: true });
  if (settings.manual_uses - manualWork > 0) uses.push({ date: null, units: settings.manual_uses - manualWork });

  const { cost, inService } = resolveBasis(settings, item);
  const input: DepreciationInput = {
    cost: cost ?? 0,
    salvage: settings.salvage_value,
    inServiceDate: inService ?? '',
    method: settings.method,
    lifeYears: settings.life_years,
    lifeUnits: settings.life_units,
    dbFactor: settings.db_factor,
    uses,
    asOf,
  };
  const needs = checkInput(input);
  const summary = needs ? null : summarize(input);

  const year = asOf.slice(0, 4);
  const all = countUses(uses);
  // Undated (manual) uses have no year; this year's share uses dated uses only.
  const thisYear = countUses(uses, `${year}-01-01`, `${Number(year) + 1}-01-01`);
  const share = workShare(all, settings.work_share_override);
  const shareThisYear = workShare(thisYear.all > 0 ? thisYear : all, settings.work_share_override);

  return {
    configured: !!row,
    needs,
    cost,
    inServiceDate: inService,
    summary,
    schedule: needs ? [] : yearlySchedule(input),
    uses: all,
    usesThisYear: thisYear,
    workShare: share,
    workShareThisYear: shareThisYear,
    costPerUse: summary ? costPerUse(summary, all.all) : null,
    workDepreciationThisYear: summary ? workShareAmount(summary.thisYearToDate, shareThisYear) : 0,
  };
}

/** Savings-goal link for "Save for replacement" (same query the savings page reads). */
export function replacementGoalHref(
  kind: AssetKind,
  itemId: string,
  itemName: string,
  settings: Pick<DepreciationSettings, 'replacement_cost' | 'replacement_date'>,
): string {
  const params = new URLSearchParams({
    new: '1',
    kind,
    name: `Replace ${itemName}`,
  });
  if (kind === 'equipment') params.set('equipment_id', itemId);
  if (settings.replacement_cost !== null) params.set('target', String(settings.replacement_cost));
  if (settings.replacement_date) params.set('date', settings.replacement_date);
  return `/dashboard/finance/savings?${params.toString()}`;
}
