// tests/unit/transfer-detect.test.ts
// Unit tests for transfer tracking in lib/finance/transfers/: the detector
// that suggests which rows are two sides of one transfer, the pairing rules
// the link route enforces, and the helpers that keep reports working on a
// database that doesn't have the transfer columns yet.
// Run: npm run test:unit
//   (node --test --experimental-strip-types tests/unit/*.test.ts)
//
// Every account and transaction here is made up. Nothing touches a database:
// the "queries" are plain objects and functions.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  namesAccount,
  suggestTransferPairs,
  transferCandidatesFor,
  TRANSFER_WINDOW_DAYS,
} from '../../lib/finance/transfers/detect.ts';
import type { DetectAccount, DetectRow } from '../../lib/finance/transfers/detect.ts';
import {
  accountLabel,
  checkPair,
  kindForDestination,
  moneyFlow,
  toCents,
  transferEditConflict,
} from '../../lib/finance/transfers/pairing.ts';
import {
  countsTowardTotals,
  excludingTransfers,
  isMissingColumn,
  missingTransferColumn,
  withOptionalKind,
  withoutTransfers,
} from '../../lib/finance/transfers/schema.ts';

// ── Fixtures ──────────────────────────────────────────────────────────────

const CHECKING: DetectAccount = {
  id: 'acct-checking',
  account_type: 'checking',
  name: 'Everyday Checking',
  institution_name: 'Harbor Credit Union',
  last_four: '1111',
};
// Same name and institution as CHECKING on purpose: only the last four differs.
const CHECKING_TWO: DetectAccount = { ...CHECKING, id: 'acct-checking-2', last_four: '2222' };
const SAVINGS: DetectAccount = {
  id: 'acct-savings',
  account_type: 'savings',
  name: 'Share Savings',
  institution_name: 'Harbor Credit Union',
  last_four: '5345',
};
const CARD_A: DetectAccount = {
  id: 'acct-card-a',
  account_type: 'credit_card',
  name: 'Rewards Card',
  institution_name: 'Summit Bank',
  last_four: '7001',
};
const CARD_B: DetectAccount = { ...CARD_A, id: 'acct-card-b', name: 'Travel Card', last_four: '7002' };
const CARD_C: DetectAccount = { ...CARD_A, id: 'acct-card-c', name: 'Store Card', last_four: '7003' };
const LOAN: DetectAccount = {
  id: 'acct-loan',
  account_type: 'loan',
  name: 'Car Loan',
  institution_name: 'Harbor Credit Union',
  last_four: '0089',
};

const ALL_ACCOUNTS = [CHECKING, CHECKING_TWO, SAVINGS, CARD_A, CARD_B, CARD_C, LOAN];

let nextId = 0;
/** A row with defaults; `dollars` becomes cents. */
function row(
  fields: Partial<DetectRow> & { account_id: string | null; type: 'expense' | 'income'; dollars: number },
): DetectRow {
  nextId += 1;
  const { dollars, ...rest } = fields;
  return {
    id: `tx-${String(nextId).padStart(3, '0')}`,
    date: '2026-03-02',
    amountCents: Math.round(dollars * 100),
    description: null,
    vendor: null,
    ...rest,
  };
}

// ── suggestTransferPairs: the three kinds ─────────────────────────────────

test('asset to asset: an outflow and an inflow of the same amount are a transfer', () => {
  const out = row({ account_id: CHECKING.id, type: 'expense', dollars: 500, description: 'ONLINE TRANSFER TO SAV' });
  const into = row({ account_id: SAVINGS.id, type: 'income', dollars: 500, date: '2026-03-03', description: 'TRANSFER FROM CHK' });

  const { pairs, oneSided } = suggestTransferPairs([into, out], ALL_ACCOUNTS);

  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].fromId, out.id);
  assert.equal(pairs[0].toId, into.id);
  assert.equal(pairs[0].kind, 'transfer');
  assert.equal(pairs[0].confidence, 'high');
  assert.equal(pairs[0].daysApart, 1);
  assert.deepEqual(oneSided, []);
});

test('asset to credit card: an income row on a card is a card payment', () => {
  const out = row({ account_id: CHECKING.id, type: 'expense', dollars: 123.45, description: 'SUMMIT BANK AUTOPAY' });
  const paid = row({ account_id: CARD_A.id, type: 'income', dollars: 123.45, description: 'PAYMENT THANK YOU' });

  const { pairs } = suggestTransferPairs([out, paid], ALL_ACCOUNTS);

  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].fromId, out.id);
  assert.equal(pairs[0].toId, paid.id);
  assert.equal(pairs[0].kind, 'card_payment');
  assert.equal(pairs[0].confidence, 'high');
});

test('asset to loan: an income row on a loan is a loan payment', () => {
  const out = row({ account_id: CHECKING.id, type: 'expense', dollars: 177, description: 'Transfer To Loan 0089' });
  const paid = row({ account_id: LOAN.id, type: 'income', dollars: 177, description: 'PAYMENT' });

  const { pairs, oneSided } = suggestTransferPairs([out, paid], ALL_ACCOUNTS);

  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].kind, 'loan_payment');
  assert.equal(pairs[0].confidence, 'high');
  // It found its other side, so it is not also listed as one-sided.
  assert.deepEqual(oneSided, []);
});

// ── One-to-one assignment and collisions ──────────────────────────────────

test('round-amount collision: three card payments and a loan transfer of $300 on one day', () => {
  const payA = row({ account_id: CHECKING.id, type: 'expense', dollars: 300, description: 'SUMMIT BANK ONLINE PAYMENT' });
  const payB = row({ account_id: CHECKING.id, type: 'expense', dollars: 300, description: 'SUMMIT BANK ONLINE PAYMENT' });
  const payC = row({ account_id: CHECKING.id, type: 'expense', dollars: 300, description: 'SUMMIT BANK ONLINE PAYMENT' });
  const loanTransfer = row({ account_id: CHECKING.id, type: 'expense', dollars: 300, description: 'Transfer To Loan 0089' });
  const onCardA = row({ account_id: CARD_A.id, type: 'income', dollars: 300, description: 'PAYMENT THANK YOU' });
  const onCardB = row({ account_id: CARD_B.id, type: 'income', dollars: 300, description: 'PAYMENT THANK YOU' });
  const onCardC = row({ account_id: CARD_C.id, type: 'income', dollars: 300, description: 'PAYMENT THANK YOU' });
  const rows = [loanTransfer, payA, payB, payC, onCardA, onCardB, onCardC];

  const { pairs, oneSided } = suggestTransferPairs(rows, ALL_ACCOUNTS);

  // Three pairs, every row used at most once.
  assert.equal(pairs.length, 3);
  const usedIds = pairs.flatMap((p) => [p.fromId, p.toId]);
  assert.equal(new Set(usedIds).size, 6);

  // The card payments pair with the cards; the loan transfer does not take one.
  assert.deepEqual(pairs.map((p) => p.fromId).sort(), [payA.id, payB.id, payC.id].sort());
  assert.deepEqual(pairs.map((p) => p.toId).sort(), [onCardA.id, onCardB.id, onCardC.id].sort());
  assert.ok(pairs.every((p) => p.kind === 'card_payment'));

  // Which payment went to which card can't be known: nothing is safe to link without a person.
  assert.ok(pairs.every((p) => p.confidence === 'low'));
  assert.ok(pairs.every((p) => p.fromCandidates === 3 && p.toCandidates === 4));
  assert.ok(pairs.every((p) => p.reasons.some((r) => r.includes('could be the other side'))));

  // The loan transfer is left over and offered as a payment to the loan it names.
  assert.deepEqual(oneSided, [
    {
      rowId: loanTransfer.id,
      kind: 'loan_payment',
      toAccountId: LOAN.id,
      reasons: oneSided[0].reasons,
    },
  ]);
});

test('one row with three candidates is low confidence even with a hint', () => {
  const out = row({ account_id: CHECKING.id, type: 'expense', dollars: 300, description: 'ONLINE PAYMENT' });
  const incomes = [CARD_A, CARD_B, CARD_C].map((card) =>
    row({ account_id: card.id, type: 'income', dollars: 300, description: 'PAYMENT THANK YOU' }),
  );

  const { pairs } = suggestTransferPairs([out, ...incomes], ALL_ACCOUNTS);

  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].fromCandidates, 3);
  assert.equal(pairs[0].confidence, 'low');
});

test('the closest date wins when nothing else tells two candidates apart', () => {
  const out = row({ account_id: CHECKING.id, type: 'expense', dollars: 80, date: '2026-03-10', description: 'TRANSFER' });
  const far = row({ account_id: SAVINGS.id, type: 'income', dollars: 80, date: '2026-03-14', description: 'TRANSFER' });
  const near = row({ account_id: SAVINGS.id, type: 'income', dollars: 80, date: '2026-03-11', description: 'TRANSFER' });

  const { pairs } = suggestTransferPairs([out, far, near], ALL_ACCOUNTS);

  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].toId, near.id);
  assert.equal(pairs[0].confidence, 'low');
});

test('the result does not depend on the order of the rows', () => {
  const rows = [
    row({ account_id: CHECKING.id, type: 'expense', dollars: 50, description: 'TRANSFER' }),
    row({ account_id: CHECKING.id, type: 'expense', dollars: 50, description: 'TRANSFER' }),
    row({ account_id: SAVINGS.id, type: 'income', dollars: 50, description: 'TRANSFER' }),
    row({ account_id: SAVINGS.id, type: 'income', dollars: 50, description: 'TRANSFER' }),
  ];
  const forward = suggestTransferPairs(rows, ALL_ACCOUNTS);
  const backward = suggestTransferPairs([...rows].reverse(), ALL_ACCOUNTS);
  assert.deepEqual(forward, backward);
  assert.equal(forward.pairs.length, 2);
});

// ── Confidence ────────────────────────────────────────────────────────────

test('high confidence needs a hint: a lone candidate with plain descriptions stays low', () => {
  const plainOut = row({ account_id: CHECKING.id, type: 'expense', dollars: 42, description: 'WITHDRAWAL' });
  const plainIn = row({ account_id: SAVINGS.id, type: 'income', dollars: 42, description: 'DEPOSIT' });
  const plain = suggestTransferPairs([plainOut, plainIn], ALL_ACCOUNTS);
  assert.equal(plain.pairs.length, 1);
  assert.equal(plain.pairs[0].confidence, 'low');
  assert.ok(plain.pairs[0].reasons.includes('Nothing in the descriptions says this is a transfer'));

  // The same two rows, with transfer wording on one side only.
  const hinted = suggestTransferPairs(
    [{ ...plainOut, description: 'ACCT XFER' }, plainIn],
    ALL_ACCOUNTS,
  );
  assert.equal(hinted.pairs[0].confidence, 'high');
  assert.ok(hinted.pairs[0].reasons.includes('The wording looks like a transfer'));
});

test('the vendor counts as wording when the description is empty', () => {
  const out = row({ account_id: CHECKING.id, type: 'expense', dollars: 42, vendor: 'Zelle' });
  const into = row({ account_id: CHECKING_TWO.id, type: 'income', dollars: 42 });
  assert.equal(suggestTransferPairs([out, into], ALL_ACCOUNTS).pairs[0].confidence, 'high');
});

test('wording that contradicts the kind is not a hint', () => {
  // "Loan" wording, but the only same-amount income is on a credit card.
  const out = row({ account_id: CHECKING.id, type: 'expense', dollars: 90, description: 'MORTGAGE SERVICING' });
  const onCard = row({ account_id: CARD_A.id, type: 'income', dollars: 90, description: 'CREDIT' });
  const { pairs } = suggestTransferPairs([out, onCard], [CHECKING, CARD_A]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].confidence, 'low');
});

test('insurance wording is not a transfer hint', () => {
  const out = row({ account_id: CHECKING.id, type: 'expense', dollars: 61, description: 'ACME INSURANCE PREMIUM' });
  const into = row({ account_id: SAVINGS.id, type: 'income', dollars: 61, description: 'DEPOSIT' });
  const { pairs, oneSided } = suggestTransferPairs([out, into], ALL_ACCOUNTS);
  assert.equal(pairs[0].confidence, 'low');
  assert.deepEqual(oneSided, []);
});

// ── Naming the other account ──────────────────────────────────────────────

test('a description that names the other account by last four is a hint on its own', () => {
  const out = row({ account_id: CHECKING.id, type: 'expense', dollars: 250, description: 'ACH DEBIT XXXXXX5345' });
  const into = row({ account_id: SAVINGS.id, type: 'income', dollars: 250, description: 'ACH CREDIT' });

  const { pairs } = suggestTransferPairs([out, into], ALL_ACCOUNTS);

  assert.equal(pairs[0].confidence, 'high');
  assert.ok(pairs[0].reasons.includes('A description mentions Harbor Credit Union Share Savings ••5345'));
});

test('the last four picks the right account when two accounts have the same name', () => {
  // Two checking accounts with identical names; the description names ••2222.
  const out = row({ account_id: SAVINGS.id, type: 'expense', dollars: 75, description: 'WITHDRAWAL TO 2222' });
  const wrong = row({ account_id: CHECKING.id, type: 'income', dollars: 75, description: 'DEPOSIT' });
  const right = row({ account_id: CHECKING_TWO.id, type: 'income', dollars: 75, description: 'DEPOSIT' });

  const { pairs } = suggestTransferPairs([out, wrong, right], ALL_ACCOUNTS);

  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].toId, right.id);
  // Two candidates, so a person still confirms it.
  assert.equal(pairs[0].confidence, 'low');
});

test('namesAccount: whole runs of digits only', () => {
  assert.equal(namesAccount('ONLINE TRANSFER TO SAV ...5345', SAVINGS), true);
  assert.equal(namesAccount('XFER x5345 REF 99', SAVINGS), true);
  // A longer number that ends in the last four is some other number.
  assert.equal(namesAccount('REF 20265345', SAVINGS), false);
  assert.equal(namesAccount('NO NUMBERS HERE', SAVINGS), false);
  assert.equal(namesAccount(null, SAVINGS), false);
  // A share or loan number kept in the account's name.
  const share: DetectAccount = { ...SAVINGS, name: 'Membership Share 0001', last_four: null };
  assert.equal(namesAccount('TRANSFER TO SHARE 0001', share), true);
  assert.equal(namesAccount('TRANSFER TO SHARE 0002', share), false);
  // Short numbers in a name are too common to mean anything.
  const short: DetectAccount = { ...SAVINGS, name: 'Savings 01', last_four: null };
  assert.equal(namesAccount('PAYMENT 01 OF 12', short), false);
  // A last four padded by a CHAR(4) column still matches.
  assert.equal(namesAccount('TO 5345', { ...SAVINGS, last_four: '5345 ' }), true);
});

// ── One-sided payments ────────────────────────────────────────────────────

test('one-sided loan payment: no row on the loan, and the description names it', () => {
  const payments = ['2026-01-05', '2026-02-05', '2026-03-05'].map((date) =>
    row({ account_id: CHECKING.id, type: 'expense', dollars: 177, date, description: 'Transfer To Loan 0089' }),
  );

  const { pairs, oneSided } = suggestTransferPairs(payments, ALL_ACCOUNTS);

  assert.deepEqual(pairs, []);
  assert.equal(oneSided.length, 3);
  assert.ok(oneSided.every((item) => item.kind === 'loan_payment' && item.toAccountId === LOAN.id));
  // Newest first.
  assert.deepEqual(oneSided.map((item) => item.rowId), [payments[2].id, payments[1].id, payments[0].id]);
  assert.ok(oneSided[0].reasons.includes('The description mentions Harbor Credit Union Car Loan ••0089'));
});

test('one-sided: the destination is left open when the description does not name it', () => {
  const out = row({ account_id: CHECKING.id, type: 'expense', dollars: 177, description: 'AUTO LOAN PMT' });
  const { oneSided } = suggestTransferPairs([out], ALL_ACCOUNTS);
  assert.equal(oneSided.length, 1);
  assert.equal(oneSided[0].kind, 'loan_payment');
  assert.equal(oneSided[0].toAccountId, null);
});

test('one-sided: card payment wording with no row on any card', () => {
  const out = row({ account_id: CHECKING.id, type: 'expense', dollars: 64, description: 'CARD PAYMENT 7002' });
  const { oneSided } = suggestTransferPairs([out], ALL_ACCOUNTS);
  assert.deepEqual(oneSided.map((item) => [item.kind, item.toAccountId]), [['card_payment', CARD_B.id]]);
});

test('one-sided: nothing is offered without an account of that kind, or for income rows', () => {
  const loanWording = row({ account_id: CHECKING.id, type: 'expense', dollars: 177, description: 'Transfer To Loan 0089' });
  // No loan account at all: there is nowhere to record the payment.
  assert.deepEqual(suggestTransferPairs([loanWording], [CHECKING, SAVINGS, CARD_A]).oneSided, []);
  // Money coming in is never offered as "a payment to".
  const incoming = row({ account_id: CHECKING.id, type: 'income', dollars: 177, description: 'LOAN PROCEEDS' });
  assert.deepEqual(suggestTransferPairs([incoming], ALL_ACCOUNTS).oneSided, []);
  // Plain transfer wording is not a strong enough hint for a one-sided suggestion.
  const plainTransfer = row({ account_id: CHECKING.id, type: 'expense', dollars: 20, description: 'ZELLE TO SAM EXAMPLE' });
  assert.deepEqual(suggestTransferPairs([plainTransfer], ALL_ACCOUNTS).oneSided, []);
});

// ── Rows that are never paired ────────────────────────────────────────────

test('rows already in a transfer are ignored', () => {
  const out = row({ account_id: CHECKING.id, type: 'expense', dollars: 500, description: 'TRANSFER' });
  const grouped = row({
    account_id: SAVINGS.id, type: 'income', dollars: 500, description: 'TRANSFER', transfer_group_id: 'group-1',
  });
  const groupedLoanPayment = row({
    account_id: CHECKING.id, type: 'expense', dollars: 177, description: 'Transfer To Loan 0089', transfer_group_id: 'group-2',
  });

  const { pairs, oneSided } = suggestTransferPairs([out, grouped, groupedLoanPayment], ALL_ACCOUNTS);

  assert.deepEqual(pairs, []);
  assert.deepEqual(oneSided, []);
});

test('rows on the same account are never paired', () => {
  // A purchase and its refund: same amount, opposite direction, same account.
  const purchase = row({ account_id: CHECKING.id, type: 'expense', dollars: 35, description: 'TRANSFER' });
  const refund = row({ account_id: CHECKING.id, type: 'income', dollars: 35, description: 'TRANSFER' });
  assert.deepEqual(suggestTransferPairs([purchase, refund], ALL_ACCOUNTS).pairs, []);
  assert.deepEqual(transferCandidatesFor(purchase.id, [purchase, refund], ALL_ACCOUNTS), []);
});

test('never paired: no account, unknown account, different cents, same direction, outside the window', () => {
  const out = row({ account_id: CHECKING.id, type: 'expense', dollars: 100, description: 'TRANSFER' });
  const noAccount = row({ account_id: null, type: 'income', dollars: 100, description: 'TRANSFER' });
  const unknownAccount = row({ account_id: 'acct-deleted', type: 'income', dollars: 100, description: 'TRANSFER' });
  const oneCentOff = row({ account_id: SAVINGS.id, type: 'income', dollars: 100.01, description: 'TRANSFER' });
  const sameDirection = row({ account_id: SAVINGS.id, type: 'expense', dollars: 100, description: 'TRANSFER' });
  const tooLate = row({
    account_id: SAVINGS.id, type: 'income', dollars: 100, date: '2026-03-08', description: 'TRANSFER',
  });

  const rows = [out, noAccount, unknownAccount, oneCentOff, sameDirection, tooLate];
  assert.deepEqual(suggestTransferPairs(rows, ALL_ACCOUNTS).pairs, []);

  // The window is inclusive: exactly five days apart still pairs.
  assert.equal(TRANSFER_WINDOW_DAYS, 5);
  const justInTime = { ...tooLate, id: 'tx-edge', date: '2026-03-07' };
  assert.equal(suggestTransferPairs([out, justInTime], ALL_ACCOUNTS).pairs.length, 1);
  // And it can be narrowed.
  assert.deepEqual(suggestTransferPairs([out, justInTime], ALL_ACCOUNTS, { windowDays: 2 }).pairs, []);
});

test('a card charge that equals a deposit is not suggested, but can be picked by hand', () => {
  // Expense on a card (what is owed goes up) and income on checking: a cash
  // advance looks like this, and so does an unrelated purchase and paycheck.
  const charge = row({ account_id: CARD_A.id, type: 'expense', dollars: 200, description: 'CASH ADVANCE' });
  const deposit = row({ account_id: CHECKING.id, type: 'income', dollars: 200, description: 'DEPOSIT' });

  assert.deepEqual(suggestTransferPairs([charge, deposit], ALL_ACCOUNTS).pairs, []);

  const candidates = transferCandidatesFor(deposit.id, [charge, deposit], ALL_ACCOUNTS);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].rowId, charge.id);
  assert.equal(candidates[0].fromId, charge.id);
  assert.equal(candidates[0].toId, deposit.id);
  assert.equal(candidates[0].kind, 'transfer');
});

test('transferCandidatesFor lists every possible other side, strongest first', () => {
  const out = row({ account_id: CHECKING.id, type: 'expense', dollars: 300, description: 'ONLINE PAYMENT' });
  const plain = row({ account_id: SAVINGS.id, type: 'income', dollars: 300, description: 'DEPOSIT' });
  const onCard = row({ account_id: CARD_A.id, type: 'income', dollars: 300, description: 'PAYMENT THANK YOU' });
  const unrelated = row({ account_id: CARD_B.id, type: 'income', dollars: 301, description: 'PAYMENT THANK YOU' });

  const candidates = transferCandidatesFor(out.id, [out, plain, onCard, unrelated], ALL_ACCOUNTS);

  assert.deepEqual(candidates.map((c) => c.rowId), [onCard.id, plain.id]);
  assert.deepEqual(candidates.map((c) => c.kind), ['card_payment', 'transfer']);
});

// ── Pairing rules (what the link route enforces) ──────────────────────────

const ACCOUNT_TYPES = new Map(ALL_ACCOUNTS.map((a) => [a.id, a.account_type]));

test('checkPair: the expense row is the from side and the destination gives the kind', () => {
  const expense = { id: 'a', account_id: CHECKING.id, amountCents: 5000, type: 'expense' as const };
  const toSavings = { id: 'b', account_id: SAVINGS.id, amountCents: 5000, type: 'income' as const };
  const toCard = { ...toSavings, account_id: CARD_A.id };
  const toLoan = { ...toSavings, account_id: LOAN.id };

  assert.deepEqual(checkPair(expense, toSavings, ACCOUNT_TYPES), { ok: true, fromId: 'a', toId: 'b', kind: 'transfer' });
  // The order the two rows are given in does not matter.
  assert.deepEqual(checkPair(toCard, expense, ACCOUNT_TYPES), { ok: true, fromId: 'a', toId: 'b', kind: 'card_payment' });
  assert.deepEqual(checkPair(expense, toLoan, ACCOUNT_TYPES), { ok: true, fromId: 'a', toId: 'b', kind: 'loan_payment' });
});

test('checkPair: refuses rows that cannot be two sides of one transfer', () => {
  const expense = { id: 'a', account_id: CHECKING.id, amountCents: 5000, type: 'expense' as const };
  const income = { id: 'b', account_id: SAVINGS.id, amountCents: 5000, type: 'income' as const };
  const refused = (a: typeof expense | typeof income, b: typeof expense | typeof income): string => {
    const result = checkPair(a, b, ACCOUNT_TYPES);
    assert.equal(result.ok, false);
    return result.ok ? '' : result.error;
  };

  assert.match(refused(expense, { ...income, id: 'a' }), /two different transactions/);
  assert.match(refused(expense, { ...income, account_id: null as unknown as string }), /need an account/);
  assert.match(refused(expense, { ...income, account_id: 'acct-deleted' }), /need an account/);
  assert.match(refused(expense, { ...income, account_id: CHECKING.id }), /same account/);
  assert.match(refused(expense, { ...income, amountCents: 5001 }), /amounts are different/);
  assert.match(refused(expense, { ...income, type: 'expense' as never }), /Both transactions are expenses/);
  assert.match(refused({ ...expense, type: 'income' as never }, income), /Both transactions are income/);
});

test('moneyFlow and kindForDestination follow the account type', () => {
  assert.equal(moneyFlow('expense', 'checking'), 'outflow');
  assert.equal(moneyFlow('income', 'savings'), 'inflow');
  assert.equal(moneyFlow('income', 'credit_card'), 'payment');
  assert.equal(moneyFlow('income', 'loan'), 'payment');
  assert.equal(moneyFlow('expense', 'credit_card'), 'charge');
  assert.equal(kindForDestination('credit_card'), 'card_payment');
  assert.equal(kindForDestination('loan'), 'loan_payment');
  assert.equal(kindForDestination('cash'), 'transfer');
  assert.equal(kindForDestination(null), 'transfer');
});

test('accountLabel tells accounts with the same name apart', () => {
  assert.equal(accountLabel(CHECKING), 'Harbor Credit Union Everyday Checking ••1111');
  assert.equal(accountLabel(CHECKING_TWO), 'Harbor Credit Union Everyday Checking ••2222');
  assert.notEqual(accountLabel(CHECKING), accountLabel(CHECKING_TWO));
  // The institution is not repeated when the name already starts with it.
  assert.equal(
    accountLabel({ name: 'Harbor Credit Union Share', institution_name: 'Harbor Credit Union', last_four: '0001' }),
    'Harbor Credit Union Share ••0001',
  );
  assert.equal(accountLabel({ name: 'Wallet', institution_name: null, last_four: null }), 'Wallet');
  assert.equal(accountLabel(null), 'an account that was removed');
});

test('transferEditConflict: amount and type are locked on one side, the rest is free', () => {
  const current = { amount: 300, type: 'expense' };
  // Nothing sent, or the same values sent back (the inline edit form always sends both).
  assert.equal(transferEditConflict(current, {}), null);
  assert.equal(transferEditConflict(current, { amount: 300, type: 'expense' }), null);
  assert.equal(transferEditConflict(current, { amount: '300.00' }), null);
  assert.equal(transferEditConflict({ amount: '300.00', type: 'expense' }, { amount: 300 }), null);

  assert.match(transferEditConflict(current, { amount: 299.99 }) ?? '', /its amount can't be changed/);
  assert.match(transferEditConflict(current, { type: 'income' }) ?? '', /its type can't be changed/);
  assert.match(transferEditConflict(current, { amount: 1, type: 'income' }) ?? '', /amount and type/);
});

test('toCents rounds to whole cents and ignores the sign', () => {
  assert.equal(toCents(12.34), 1234);
  assert.equal(toCents('12.34'), 1234);
  assert.equal(toCents(-12.34), 1234);
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(toCents(1.005), 100);
});

// ── A database without the transfer columns yet ───────────────────────────

const MISSING_GROUP = { code: '42703', message: 'column financial_transactions.transfer_group_id does not exist' };
const MISSING_KIND = {
  code: 'PGRST204',
  message: "Could not find the 'transfer_kind' column of 'financial_transactions' in the schema cache",
};

test('missingTransferColumn recognizes only the two transfer columns', () => {
  assert.equal(missingTransferColumn(MISSING_GROUP), 'transfer_group_id');
  assert.equal(missingTransferColumn(MISSING_KIND), 'transfer_kind');
  assert.equal(
    missingTransferColumn({ code: 'PGRST204', message: "Could not find the 'transfer_group_id' column" }),
    'transfer_group_id',
  );
  // Some other missing column is a real bug and must not be swallowed.
  assert.equal(missingTransferColumn({ code: '42703', message: 'column financial_transactions.date does not exist' }), null);
  // The right column name with an unrelated error code is not a missing column.
  assert.equal(missingTransferColumn({ code: '23514', message: 'violates check constraint on transfer_kind' }), null);
  assert.equal(missingTransferColumn(null), null);
  assert.equal(missingTransferColumn(undefined), null);
});

test('isMissingColumn matches one named column, for the import filter on the transactions list', () => {
  const missingBatch = { code: '42703', message: 'column financial_transactions.import_batch_id does not exist' };
  assert.equal(isMissingColumn(missingBatch, 'import_batch_id'), true);
  // The same error is not about the transfer columns, and the other way round.
  assert.equal(isMissingColumn(missingBatch, 'transfer_group_id'), false);
  assert.equal(missingTransferColumn(missingBatch), null);
  assert.equal(isMissingColumn(MISSING_GROUP, 'import_batch_id'), false);
  // A bad id (22P02) or a timeout is not a missing column.
  assert.equal(isMissingColumn({ code: '22P02', message: 'invalid input syntax for type uuid: "import_batch_id"' }, 'import_batch_id'), false);
  assert.equal(isMissingColumn({ code: '57014', message: 'canceling statement due to statement timeout' }, 'import_batch_id'), false);
  assert.equal(isMissingColumn(null, 'import_batch_id'), false);
});

/** A stand-in for a Supabase query: records the filters put on it. */
class FakeQuery {
  filters: string[];
  constructor(filters: string[] = []) {
    this.filters = filters;
  }
  or(filter: string): FakeQuery {
    return new FakeQuery([...this.filters, `or(${filter})`]);
  }
  is(column: string, value: null): FakeQuery {
    return new FakeQuery([...this.filters, `${column} is ${value}`]);
  }
}

test('withoutTransfers adds both filters, or only the source filter before migration 202', () => {
  assert.deepEqual(withoutTransfers(new FakeQuery(), true).filters, [
    'or(source.is.null,source.neq.transfer)',
    'transfer_group_id is null',
  ]);
  assert.deepEqual(withoutTransfers(new FakeQuery(), false).filters, ['or(source.is.null,source.neq.transfer)']);
});

test('excludingTransfers runs once when the column exists', async () => {
  const calls: boolean[] = [];
  const result = await excludingTransfers(async (groupColumnExists) => {
    calls.push(groupColumnExists);
    return { data: [{ amount: 5 }], error: null };
  });
  assert.deepEqual(calls, [true]);
  assert.deepEqual(result.data, [{ amount: 5 }]);
});

test('excludingTransfers runs again without the filter when transfer_group_id is missing', async () => {
  const calls: boolean[] = [];
  const result = await excludingTransfers(async (groupColumnExists) => {
    calls.push(groupColumnExists);
    return groupColumnExists
      ? { data: null, error: MISSING_GROUP }
      : { data: [{ amount: 5 }, { amount: 7 }], error: null };
  });
  assert.deepEqual(calls, [true, false]);
  assert.equal(result.error, null);
  assert.equal(result.data?.length, 2);
});

test('excludingTransfers passes every other error through without retrying', async () => {
  const calls: boolean[] = [];
  const failure = { code: '57014', message: 'canceling statement due to statement timeout' };
  const result = await excludingTransfers(async (groupColumnExists) => {
    calls.push(groupColumnExists);
    return { data: null, error: failure };
  });
  assert.deepEqual(calls, [true]);
  assert.equal(result.error, failure);
});

test('withOptionalKind drops only transfer_kind, and only when that column is missing', async () => {
  const calls: boolean[] = [];
  const between = await withOptionalKind(async (kindColumnExists) => {
    calls.push(kindColumnExists);
    return kindColumnExists ? { data: null, error: MISSING_KIND } : { data: ['saved'], error: null };
  });
  assert.deepEqual(calls, [true, false]);
  assert.deepEqual(between.data, ['saved']);

  // Without transfer_group_id nothing can be saved: the error comes back as is.
  const before: boolean[] = [];
  const failed = await withOptionalKind(async (kindColumnExists) => {
    before.push(kindColumnExists);
    return { data: null, error: MISSING_GROUP };
  });
  assert.deepEqual(before, [true]);
  assert.equal(missingTransferColumn(failed.error), 'transfer_group_id');
});

test('countsTowardTotals leaves out linked rows and rows the transfer feature wrote', () => {
  assert.equal(countsTowardTotals({ source: 'manual', transfer_group_id: null }), true);
  // An imported row that was linked keeps its source and still stops counting.
  assert.equal(countsTowardTotals({ source: 'csv_import', transfer_group_id: 'group-1' }), false);
  assert.equal(countsTowardTotals({ source: 'transfer', transfer_group_id: null }), false);
  // A row read from a database that has no transfer_group_id column yet.
  assert.equal(countsTowardTotals({ source: 'bank_sync' }), true);
  assert.equal(countsTowardTotals({ source: null }), true);
});
