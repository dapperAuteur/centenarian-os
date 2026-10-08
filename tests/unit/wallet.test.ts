// tests/unit/wallet.test.ts
// Unit tests for the Wallet (plans/66 Part 2, W1): the credit limit rule shared with the Debt page,
// the Wallet's formulas (lib/finance/wallet/logic.ts), its loader against the in-memory fake
// (lib/finance/wallet/server.ts), and business pages (lib/finance/brands/*).
// Run: npm run test:unit
//
// Every account, amount, name and id here is SYNTHETIC. Nothing touches a database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creditLimitFor, latestStatementLimit } from '../../lib/finance/debt/credit-limit.ts';
import { buildDebtSummary } from '../../lib/finance/debt/overview.ts';
import type { DebtAccountRow, StatementRow } from '../../lib/finance/debt/overview.ts';

// ── Credit limit rule ────────────────────────────────────────────────────────

test('creditLimitFor: the account limit wins over the statement', () => {
  const r = creditLimitFor({ id: 'a1', credit_limit: '8000' }, [{ account_id: 'a1', period_end: '2026-09-28', credit_limit: 9000 }]);
  assert.deepEqual(r, { limit: 8000, source: 'account' });
});

test('creditLimitFor: the latest statement that prints a limit is the fallback', () => {
  const statements = [
    { account_id: 'a1', period_end: '2026-07-28', credit_limit: 5000 },
    { account_id: 'a1', period_end: '2026-08-28', credit_limit: 6000 },
    // The newest statement printed no limit: the one before it still counts.
    { account_id: 'a1', period_end: '2026-09-28', credit_limit: null },
    // Another account's statement never counts.
    { account_id: 'b2', period_end: '2026-10-01', credit_limit: 99000 },
  ];
  assert.deepEqual(creditLimitFor({ id: 'a1', credit_limit: null }, statements), { limit: 6000, source: 'statement' });
  assert.equal(latestStatementLimit('a1', statements), 6000);
});

test('creditLimitFor: zero, blank and missing limits mean no limit', () => {
  assert.deepEqual(creditLimitFor({ id: 'a1', credit_limit: 0 }), { limit: null, source: null });
  assert.deepEqual(creditLimitFor({ id: 'a1', credit_limit: '' }, [{ account_id: 'a1', period_end: '2026-09-28', credit_limit: 0 }]), {
    limit: null,
    source: null,
  });
  assert.deepEqual(creditLimitFor({ id: 'a1' }), { limit: null, source: null });
});

test('buildDebtSummary: the Debt page uses the statement limit when the account has none', () => {
  const card: DebtAccountRow = { id: 'c1', name: 'Test Card', account_type: 'credit_card', credit_limit: null, opening_balance: 500 };
  const statement: StatementRow = {
    id: 's1',
    account_id: 'c1',
    period_start: '2026-08-29',
    period_end: '2026-09-28',
    new_balance: 500,
    minimum_payment: 35,
    due_date: '2026-10-25',
    interest_charged: 0,
    aprs: [],
    promos: [],
    credit_limit: 2500,
  };
  const d = buildDebtSummary(card, [statement], [], '2026-10-05');
  assert.equal(d.creditLimit, 2500);
  assert.equal(d.creditLimitSource, 'statement');
  const own = buildDebtSummary({ ...card, credit_limit: 3000 }, [statement], [], '2026-10-05');
  assert.equal(own.creditLimit, 3000);
  assert.equal(own.creditLimitSource, 'account');
  const none = buildDebtSummary(card, [], [], '2026-10-05');
  assert.equal(none.creditLimit, null);
  assert.equal(none.creditLimitSource, null);
});
