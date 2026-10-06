// tests/unit/ridewitus-vendors.test.ts
// The read-only vendor API for RideWitUS (lib/integrations/ridewitus/vendors.ts):
// scoping to one user, vendors only, no coordinates, search, pagination,
// recent prices, and the create-vendor deep link.
// Run: npm run test:unit
//
// Every vendor, price and id is made up. Nothing touches a database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createVendorUrl,
  getVendor,
  likePattern,
  listVendors,
  loadPrices,
  parseLimit,
  parseOffset,
  parseSince,
} from '../../lib/integrations/ridewitus/vendors.ts';
import { FakeDb } from './fake-supabase.ts';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const SHELL = 'aaaaaaaa-0000-4000-8000-000000000001';
const BIKE_SHOP = 'aaaaaaaa-0000-4000-8000-000000000002';
const THEIR_SHOP = 'aaaaaaaa-0000-4000-8000-000000000003';
const MY_CUSTOMER = 'aaaaaaaa-0000-4000-8000-000000000004';
const MY_CAT = 'cccccccc-0000-4000-8000-000000000001';
const THEIR_CAT = 'cccccccc-0000-4000-8000-000000000002';

function seed(): FakeDb {
  const db = new FakeDb();
  db.seed('user_contacts', [
    { id: SHELL, user_id: ME, name: 'Shell Station', contact_type: 'vendor', phone: '555-0100', website: null, home_city: 'Austin', home_state: 'TX', default_category_id: MY_CAT },
    { id: BIKE_SHOP, user_id: ME, name: 'Bike_Shop 100%', contact_type: 'vendor', company_name: 'Spokes LLC', website: 'https://spokes.example', default_category_id: THEIR_CAT },
    { id: MY_CUSTOMER, user_id: ME, name: 'A Customer', contact_type: 'customer' },
    { id: THEIR_SHOP, user_id: OTHER, name: 'Their Shop', contact_type: 'vendor' },
  ]);
  db.seed('contact_locations', [
    { id: 'l1', contact_id: SHELL, label: 'Main St', address: '1 Main St', lat: 30.1, lng: -97.7, is_default: true, sort_order: 0 },
    { id: 'l2', contact_id: THEIR_SHOP, label: 'Secret', address: 'their address', lat: 1, lng: 2, sort_order: 0 },
  ]);
  db.seed('budget_categories', [
    { id: MY_CAT, user_id: ME, name: 'Auto: Fuel' },
    { id: THEIR_CAT, user_id: OTHER, name: 'Their category' },
  ]);
  db.seed('item_prices', [
    { user_id: ME, vendor_contact_id: SHELL, item_name: 'Regular gas', price: 3.19, unit: 'gal', unit_price: 3.19, recorded_date: '2026-09-30', source: 'scan' },
    { user_id: ME, vendor_contact_id: SHELL, item_name: 'Regular gas', price: 3.09, unit: 'gal', unit_price: 3.09, recorded_date: '2026-01-02', source: 'scan' },
    { user_id: OTHER, vendor_contact_id: SHELL, item_name: 'Leaked price', price: 1, recorded_date: '2026-09-30', source: 'manual' },
  ]);
  return db;
}

test('listVendors returns only this user\'s vendors, by name, with no coordinates', async () => {
  const db = seed();
  const page = await listVendors(db, ME);
  assert.deepEqual(page.vendors.map((v) => v.name), ['Bike_Shop 100%', 'Shell Station']);
  assert.equal(page.next_offset, null);
  const shell = page.vendors.find((v) => v.id === SHELL)!;
  assert.equal(shell.city, 'Austin, TX');
  assert.equal(shell.phone, '555-0100');
  assert.equal(shell.category, 'Auto: Fuel');
  assert.deepEqual(shell.locations, [{ id: 'l1', label: 'Main St', address: '1 Main St', is_default: true }]);
  assert.equal('recent_prices' in shell, false, 'prices only when asked for');
  const json = JSON.stringify(page);
  for (const leak of ['lat', 'lng', 'Their Shop', 'their address', 'Their category', 'A Customer']) {
    assert.equal(json.includes(leak), false, `response must not contain ${leak}`);
  }
});

test('a category id that belongs to someone else is not resolved', async () => {
  const page = await listVendors(seed(), ME);
  assert.equal(page.vendors.find((v) => v.id === BIKE_SHOP)!.category, null);
});

test('the other user sees only their own vendor', async () => {
  const page = await listVendors(seed(), OTHER);
  assert.deepEqual(page.vendors.map((v) => v.id), [THEIR_SHOP]);
});

test('search is case-insensitive and treats % and _ literally', async () => {
  const db = seed();
  assert.deepEqual((await listVendors(db, ME, { q: 'shell' })).vendors.map((v) => v.id), [SHELL]);
  assert.deepEqual((await listVendors(db, ME, { q: '100%' })).vendors.map((v) => v.id), [BIKE_SHOP]);
  assert.deepEqual((await listVendors(db, ME, { q: '_' })).vendors.map((v) => v.id), [BIKE_SHOP]);
  assert.deepEqual((await listVendors(db, ME, { q: 'their' })).vendors, []);
  assert.equal(likePattern('  '), null);
  assert.equal(likePattern('a%b_c\\'), '%a\\%b\\_c\\\\%');
});

test('pagination: next_offset walks the list and ends with null', async () => {
  const db = seed();
  const first = await listVendors(db, ME, { limit: 1 });
  assert.deepEqual(first.vendors.map((v) => v.id), [BIKE_SHOP]);
  assert.equal(first.next_offset, 1);
  const second = await listVendors(db, ME, { limit: 1, offset: first.next_offset! });
  assert.deepEqual(second.vendors.map((v) => v.id), [SHELL]);
  assert.equal(second.next_offset, null);
});

test('recent prices: own rows only, since a date, newest first', async () => {
  const db = seed();
  const page = await listVendors(db, ME, { pricesSince: '2026-06-01' });
  const shell = page.vendors.find((v) => v.id === SHELL)!;
  assert.deepEqual(shell.recent_prices, [
    { item_name: 'Regular gas', price: 3.19, unit: 'gal', unit_price: 3.19, recorded_date: '2026-09-30', source: 'scan' },
  ]);
  assert.deepEqual(page.vendors.find((v) => v.id === BIKE_SHOP)!.recent_prices, []);
  const all = await loadPrices(db, ME, [SHELL], '2025-01-01');
  assert.deepEqual(all.get(SHELL)!.map((p) => p.recorded_date), ['2026-09-30', '2026-01-02']);
  const capped = await loadPrices(db, ME, [SHELL], '2025-01-01', 1);
  assert.equal(capped.get(SHELL)!.length, 1);
});

test('getVendor: own vendor found; someone else\'s, a customer, and junk ids are all null', async () => {
  const db = seed();
  assert.equal((await getVendor(db, ME, SHELL))?.name, 'Shell Station');
  assert.equal(await getVendor(db, ME, THEIR_SHOP), null);
  assert.equal(await getVendor(db, ME, MY_CUSTOMER), null);
  assert.equal(await getVendor(db, ME, 'not-a-uuid'), null);
  assert.equal((await getVendor(db, ME, SHELL, '2026-01-01'))?.recent_prices?.length, 2);
});

test('a failed read throws VendorLookupError rather than returning an empty list', async () => {
  const db = seed();
  db.missingTables = ['user_contacts'];
  await assert.rejects(() => listVendors(db, ME), { name: 'VendorLookupError' });
});

test('query parsing and the create-vendor deep link', () => {
  assert.equal(parseLimit(null), 50);
  assert.equal(parseLimit('0'), 50);
  assert.equal(parseLimit('999'), 200);
  assert.equal(parseLimit('25'), 25);
  assert.equal(parseOffset('-3'), 0);
  assert.equal(parseOffset('40'), 40);
  assert.equal(parseSince('2026-05-01', new Date('2026-10-05T00:00:00Z')), '2026-05-01');
  assert.equal(parseSince('2026-05-01T10:00:00Z', new Date('2026-10-05T00:00:00Z')), '2026-05-01');
  assert.equal(parseSince('junk', new Date('2026-10-05T00:00:00Z')), '2026-04-08');
  assert.equal(
    createVendorUrl('https://centos.example', 'Joe\'s Garage'),
    'https://centos.example/dashboard/contacts/new?type=vendor&name=Joe%27s+Garage',
  );
  assert.equal(createVendorUrl('https://centos.example', null), 'https://centos.example/dashboard/contacts/new?type=vendor');
});
