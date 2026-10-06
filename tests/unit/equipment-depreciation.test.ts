// tests/unit/equipment-depreciation.test.ts
// Unit tests for equipment and vehicle depreciation (lib/equipment/depreciation.ts
// and lib/equipment/depreciation-settings.ts): straight line, declining balance,
// units of use, the salvage floor, schedules by year and month, book value,
// cost per use, work share and the settings parser.
// Run: npm run test:unit
//
// Every amount, date and id here is made up. Nothing touches a database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  accumulatedAt,
  accumulatedThrough,
  addYears,
  checkInput,
  costPerUse,
  countUses,
  decliningBalanceYears,
  fullyDepreciatedOn,
  monthlySchedule,
  round2,
  summarize,
  workShare,
  workShareAmount,
  yearlySchedule,
  type DepreciationInput,
} from '../../lib/equipment/depreciation.ts';
import {
  buildReport,
  normalizeSettings,
  parseSettingsBody,
  replacementGoalHref,
  resolveBasis,
} from '../../lib/equipment/depreciation-settings.ts';

const sl: DepreciationInput = {
  cost: 1000,
  salvage: 100,
  inServiceDate: '2024-01-01',
  method: 'straight_line',
  lifeYears: 3,
  lifeUnits: null,
};

test('straight line: even calendar years, ends at salvage', () => {
  const rows = yearlySchedule(sl);
  assert.deepEqual(rows.map((r) => r.period), ['2024', '2025', '2026', '2027']);
  assert.deepEqual(rows.map((r) => r.depreciation), [300, 300, 300, 0]);
  assert.equal(rows[2].bookValue, 100);
  assert.equal(fullyDepreciatedOn(sl), '2027-01-01');
});

test('straight line: mid-year start prorates by day and still totals the depreciable amount', () => {
  const input = { ...sl, inServiceDate: '2024-07-01' };
  const rows = yearlySchedule(input);
  assert.equal(rows[0].depreciation, round2((300 * 184) / 365));
  const total = rows.reduce((s, r) => s + r.depreciation, 0);
  assert.equal(round2(total), 900);
  assert.equal(rows[rows.length - 1].bookValue, 100);
});

test('nothing depreciates before the in-service date', () => {
  assert.equal(accumulatedAt(sl, '2023-06-01'), 0);
  assert.equal(accumulatedAt(sl, '2024-01-01'), 0);
  assert.ok(accumulatedThrough(sl, '2024-01-01') > 0);
});

test('salvage floor: book value never drops below salvage; salvage above cost means no depreciation', () => {
  assert.equal(round2(1000 - accumulatedAt(sl, '2040-01-01')), 100);
  const high = { ...sl, salvage: 1500 };
  assert.equal(accumulatedAt(high, '2030-01-01'), 0);
  assert.equal(summarize({ ...high, asOf: '2026-10-05' })?.bookValue, 1000);
});

test('double declining balance switches to straight line and lands on salvage', () => {
  const ddb: DepreciationInput = { ...sl, method: 'declining_balance', lifeYears: 5 };
  const years = decliningBalanceYears(ddb).map(round2);
  assert.deepEqual(years, [400, 240, 144, 86.4, 29.6]);
  const rows = yearlySchedule(ddb);
  assert.deepEqual(rows.slice(0, 5).map((r) => r.depreciation), [400, 240, 144, 86.4, 29.6]);
  assert.equal(rows[4].bookValue, 100);
});

test('declining balance with a fractional life finishes on the end-of-life date', () => {
  const input: DepreciationInput = { ...sl, method: 'declining_balance', lifeYears: 2.5, dbFactor: 1.5 };
  const end = fullyDepreciatedOn(input) as string;
  assert.equal(end, '2026-07-03');
  assert.equal(round2(accumulatedAt(input, end)), 900);
  assert.deepEqual(decliningBalanceYears(input).map(round2), [600, 240, 60]);
  assert.ok(accumulatedAt(input, '2026-04-01') < 900);
});

test('units of use: rate per use, capped at the depreciable amount, undated uses count on the as-of date', () => {
  const shoes: DepreciationInput = {
    cost: 150,
    salvage: 0,
    inServiceDate: '2026-01-10',
    method: 'units_of_use',
    lifeYears: null,
    lifeUnits: 300,
    asOf: '2026-10-05',
    uses: [
      { date: '2026-02-01', units: 60 },
      { date: '2026-05-01', units: 90, work: true },
      { date: null, units: 30 },
    ],
  };
  const s = summarize(shoes)!;
  assert.equal(s.ratePerUnit, 0.5);
  assert.equal(s.accumulated, 90);
  assert.equal(s.bookValue, 60);
  assert.equal(costPerUse(s, 180), 0.5);
  assert.equal(accumulatedThrough({ ...shoes, uses: [{ date: '2026-03-01', units: 9999 }] }, '2026-12-31'), 150);
  // Uses before the in-service date don't count.
  assert.equal(accumulatedThrough({ ...shoes, uses: [{ date: '2025-12-01', units: 10 }] }, '2026-12-31'), 0);
  assert.deepEqual(yearlySchedule(shoes).map((r) => r.depreciation), [90]);
});

test('monthly schedule sums to the yearly figure', () => {
  const months = monthlySchedule(sl, '2025-01', '2025-12');
  assert.equal(months.length, 12);
  assert.equal(round2(months.reduce((s, r) => s + r.depreciation, 0)), 300);
  assert.equal(months[11].bookValue, 400);
});

test('summary: book value today, this year to date and scheduled', () => {
  const s = summarize({ ...sl, asOf: '2025-07-01' })!;
  assert.equal(s.thisYearScheduled, 300);
  assert.equal(s.thisYearToDate, round2((300 * 182) / 365));
  assert.equal(s.bookValue, round2(1000 - s.accumulated));
});

test('checkInput explains what is missing', () => {
  assert.match(checkInput({ ...sl, cost: 0 }) ?? '', /cost/);
  assert.match(checkInput({ ...sl, lifeYears: null }) ?? '', /life in years/);
  assert.match(checkInput({ ...sl, method: 'units_of_use' }) ?? '', /expected number of uses/);
  assert.match(checkInput({ ...sl, inServiceDate: '' }) ?? '', /in-service/);
  assert.equal(checkInput(sl), null);
});

test('addYears keeps 29 February sensible', () => {
  assert.equal(addYears('2024-02-29', 1), '2025-02-28');
  assert.equal(addYears('2024-02-29', 4), '2028-02-29');
});

test('uses, work share, override and work-share amount', () => {
  const uses = [
    { date: '2026-01-05', units: 1, work: true },
    { date: '2026-02-05', units: 1 },
    { date: '2025-12-05', units: 1, work: true },
    { date: null, units: 1, work: true },
  ];
  assert.deepEqual(countUses(uses), { all: 4, work: 3 });
  assert.deepEqual(countUses(uses, '2026-01-01', '2027-01-01'), { all: 2, work: 1 });
  assert.equal(workShare({ all: 4, work: 3 }, null), 0.75);
  assert.equal(workShare({ all: 0, work: 0 }, null), null);
  assert.equal(workShare({ all: 4, work: 3 }, 40), 0.4);
  assert.equal(workShareAmount(300, 0.75), 225);
  assert.equal(workShareAmount(300, null), 0);
  assert.equal(costPerUse(summarize({ ...sl, asOf: '2027-06-01' })!, 0), null);
  assert.equal(costPerUse(summarize({ ...sl, asOf: '2027-06-01' })!, 90), 10);
});

test('parseSettingsBody validates and keeps only fields sent', () => {
  const ok = parseSettingsBody({ method: 'declining_balance', life_years: '4', salvage_value: '25.555', used_for_work: true });
  assert.deepEqual(ok, { ok: true, values: { method: 'declining_balance', life_years: 4, salvage_value: 25.56, used_for_work: true } });
  assert.equal(parseSettingsBody({ method: 'macrs' }).ok, false);
  assert.equal(parseSettingsBody({ life_years: 0 }).ok, false);
  assert.equal(parseSettingsBody({ salvage_value: -1 }).ok, false);
  assert.equal(parseSettingsBody({ work_share_override: 120 }).ok, false);
  assert.equal(parseSettingsBody({ in_service_date: '2026-02-30' }).ok, false);
  assert.deepEqual(parseSettingsBody({ cost_basis: '', replacement_date: '' }), {
    ok: true,
    values: { cost_basis: null, replacement_date: null },
  });
});

test('resolveBasis falls back to the item price and purchase date, then created day', () => {
  const s = normalizeSettings(null);
  assert.deepEqual(resolveBasis(s, { purchase_price: '899.00', purchase_date: '2025-03-01' }), { cost: 899, inService: '2025-03-01' });
  assert.deepEqual(resolveBasis({ ...s, cost_basis: 5000 }, { created_at: '2024-06-15T10:00:00Z' }), { cost: 5000, inService: '2024-06-15' });
});

test('buildReport: work share this year, cost per use, work depreciation, manual uses', () => {
  const row = { method: 'straight_line', life_years: '3', salvage_value: '100', used_for_work: true, manual_uses: 2, manual_work_uses: 1 };
  const report = buildReport(
    row,
    { purchase_price: 1000, purchase_date: '2024-01-01' },
    [
      { date: '2025-03-01', units: 1, work: true },
      { date: '2025-04-01', units: 1, work: true },
      { date: '2025-05-01', units: 1 },
      { date: '2024-05-01', units: 1 },
    ],
    '2025-12-31',
  );
  assert.equal(report.needs, null);
  assert.deepEqual(report.uses, { all: 6, work: 3 });
  assert.deepEqual(report.usesThisYear, { all: 3, work: 2 });
  assert.equal(report.workShare, 0.5);
  assert.equal(round2(report.workShareThisYear!), 0.67);
  assert.equal(report.workDepreciationThisYear, round2(300 * (2 / 3)));
  assert.equal(report.costPerUse, round2(600 / 6));
  const empty = buildReport(null, { purchase_price: 50 }, [], '2025-12-31');
  assert.equal(empty.configured, false);
  assert.match(empty.needs ?? '', /in-service|life/);
});

test('replacementGoalHref prefills the savings goal form', () => {
  const href = replacementGoalHref('equipment', 'eq-1', 'Road bike', { replacement_cost: 1800, replacement_date: '2029-04-01' });
  const q = new URLSearchParams(href.split('?')[1]);
  assert.equal(q.get('new'), '1');
  assert.equal(q.get('kind'), 'equipment');
  assert.equal(q.get('equipment_id'), 'eq-1');
  assert.equal(q.get('target'), '1800');
  assert.equal(q.get('date'), '2029-04-01');
  assert.equal(q.get('name'), 'Replace Road bike');
  const v = new URLSearchParams(replacementGoalHref('vehicle', 'v-1', 'Car', { replacement_cost: null, replacement_date: null }).split('?')[1]);
  assert.equal(v.get('equipment_id'), null);
  assert.equal(v.get('kind'), 'vehicle');
});
