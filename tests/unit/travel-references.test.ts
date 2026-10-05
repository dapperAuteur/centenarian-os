// tests/unit/travel-references.test.ts
// Run: npm run test:unit
//
// The foreign ids a travel request may carry (lib/travel/references.ts), the
// fields a travel PATCH may never set, and the vehicle embed filter.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAVEL_PROTECTED_FIELDS,
  routeLegReferences,
  travelReferences,
  visibleVehicle,
  withVisibleVehicle,
} from '../../lib/travel/references.ts';
import { withoutFields } from '../../lib/auth/ownership.ts';

const ME = '11111111-1111-4111-8111-111111111111';
const THEM = '22222222-2222-4222-8222-222222222222';
const V = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';

test('travelReferences: only the fields present, each pointed at its table', () => {
  assert.deepEqual(travelReferences({ mode: 'car' }), []);
  assert.deepEqual(travelReferences({ vehicle_id: V, job_id: null, notes: 'x' }), [
    { field: 'vehicle_id', table: 'vehicles', id: V, allowPublic: true },
    { field: 'job_id', table: 'contractor_jobs', id: null, allowPublic: undefined },
  ]);
  const all = travelReferences({ vehicle_id: 1, job_id: 2, brand_id: 3, finance_category_id: 4 });
  assert.deepEqual(all.map((r) => [r.field, r.table]), [
    ['vehicle_id', 'vehicles'],
    ['job_id', 'contractor_jobs'],
    ['brand_id', 'user_brands'],
    ['finance_category_id', 'budget_categories'],
  ]);
  // Only a vehicle may be a shared (public) row; jobs, brands and categories are owner-only.
  assert.deepEqual(all.filter((r) => r.allowPublic).map((r) => r.field), ['vehicle_id']);
});

test('travelReferences: non-objects carry nothing', () => {
  for (const bad of [null, undefined, 'x', 7]) assert.deepEqual(travelReferences(bad), []);
});

test('routeLegReferences: every leg, named legs.<field>', () => {
  const refs = routeLegReferences([{ vehicle_id: V }, { finance_category_id: V, brand_id: V }, null]);
  assert.deepEqual(refs.map((r) => r.field), ['legs.vehicle_id', 'legs.brand_id', 'legs.finance_category_id']);
  assert.deepEqual(routeLegReferences('nope'), []);
});

test('a travel PATCH body loses the owner and server-maintained links', () => {
  const body = {
    id: V, user_id: THEM, transaction_id: V, route_id: V, leg_order: 0,
    gallons_remaining: 9, fifo_cost: 1, cost_source: 'fifo', created_at: 'x', updated_at: 'y',
    cost: 12, notes: 'kept',
  };
  assert.deepEqual(withoutFields(body, TRAVEL_PROTECTED_FIELDS), { cost: 12, notes: 'kept' });
});

test('visibleVehicle: own or system vehicle shown without the check columns; anyone else\'s hidden', () => {
  assert.deepEqual(
    visibleVehicle({ id: V, nickname: 'Mine', type: 'car', user_id: ME, is_system: false }, ME),
    { id: V, nickname: 'Mine', type: 'car' },
  );
  assert.deepEqual(
    visibleVehicle([{ id: V, nickname: 'Bus', type: 'bus', user_id: null, is_system: true }], ME),
    { id: V, nickname: 'Bus', type: 'bus' },
  );
  assert.equal(visibleVehicle({ id: V, nickname: 'Theirs', type: 'car', user_id: THEM, is_system: false }, ME), null);
  assert.equal(visibleVehicle(null, ME), null);
  assert.equal(visibleVehicle({ id: V, user_id: ME }, ''), null);
});

test('withVisibleVehicle replaces only the embed', () => {
  const row = { id: 'trip', cost: 5, vehicles: { id: V, nickname: 'Theirs', type: 'car', user_id: THEM } };
  assert.deepEqual(withVisibleVehicle(row, ME), { id: 'trip', cost: 5, vehicles: null });
});
