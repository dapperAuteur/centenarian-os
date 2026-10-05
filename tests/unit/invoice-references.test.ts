// tests/unit/invoice-references.test.ts
// Run: npm run test:unit
//
// referencesIn() (lib/auth/ownership.ts) and the invoice reference fields
// (lib/finance/invoice-references.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { referencesIn } from '../../lib/auth/ownership.ts';
import { INVOICE_REFERENCE_FIELDS, invoiceReferences } from '../../lib/finance/invoice-references.ts';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';

test('referencesIn: only fields the body has, with the prefix and allowPublic carried over', () => {
  const fields = [
    { field: 'vehicle_id', table: 'vehicles', allowPublic: true },
    { field: 'brand_id', table: 'user_brands' },
  ];
  assert.deepEqual(referencesIn({ vehicle_id: A, other: 1 }, fields, 'legs.'), [
    { field: 'legs.vehicle_id', table: 'vehicles', id: A, allowPublic: true },
  ]);
  assert.deepEqual(referencesIn({ brand_id: null }, fields), [
    { field: 'brand_id', table: 'user_brands', id: null, allowPublic: undefined },
  ]);
});

test('referencesIn: non-objects, arrays and inherited keys carry nothing', () => {
  const fields = [{ field: 'brand_id', table: 'user_brands' }];
  for (const bad of [null, undefined, 'x', 7, [A]]) assert.deepEqual(referencesIn(bad, fields), []);
  assert.deepEqual(referencesIn(Object.create({ brand_id: A }), fields), []);
});

test('invoice references: contact, account, brand, category and job, all owner-only', () => {
  assert.deepEqual(
    INVOICE_REFERENCE_FIELDS.map((f) => [f.field, f.table]),
    [
      ['contact_id', 'user_contacts'],
      ['account_id', 'financial_accounts'],
      ['brand_id', 'user_brands'],
      ['category_id', 'budget_categories'],
      ['job_id', 'contractor_jobs'],
    ],
  );
  assert.equal(INVOICE_REFERENCE_FIELDS.some((f) => f.allowPublic), false);
  const refs = invoiceReferences({ account_id: A, category_id: '', notes: 'x' });
  assert.deepEqual(refs.map((r) => r.field), ['account_id', 'category_id']);
});
