// tests/unit/calendar-accounts.test.ts
// Run: npm run test:unit
//
// Several finance accounts per Google Calendar connection (lib/capture/calendar-accounts.ts):
// the "@account" title token, ticked/default resolution, the legacy single default, flags for
// unknown, unticked and ambiguous references, the PATCH merge rules, and the ownership checks the
// sync runs (loadCalendarAccounts) and the records that follow. No network, no database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FakeDb } from './fake-supabase.ts';
import { parseCaptureTitle } from '../../lib/capture/parse-tokens.ts';
import {
  accountRefFor,
  lastFourOf,
  mergeAccountSettings,
  normalizeNickname,
  pruneAccountSettings,
  readAccountChoice,
  resolveEventAccount,
  type OwnedAccount,
} from '../../lib/capture/calendar-accounts.ts';
import {
  EMPTY_RECORD_STATE,
  accountForEvent,
  loadCalendarAccounts,
  syncEventRecord,
  type SyncRecordInput,
} from '../../lib/capture/calendar-records.ts';
import { eventToTaskFields, type EventTaskFields } from '../../lib/calendar/event-fields.ts';
import { buildEventTitle } from '../../lib/capture/event-templates.ts';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CHECKING = '11111111-1111-4111-8111-111111111111';
const VISA = '22222222-2222-4222-8222-222222222222';
const SAVINGS = '33333333-3333-4333-8333-333333333333';
const TWIN = '44444444-4444-4444-8444-444444444444'; // shares VISA's last four
const NOT_MINE = '99999999-9999-4999-8999-999999999999';
const TASK = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const RECORD_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const OWNED: OwnedAccount[] = [
  { id: CHECKING, last_four: '1234' },
  { id: VISA, last_four: '9876' },
  { id: SAVINGS, last_four: '5555' },
  { id: TWIN, last_four: '9876' },
];

// ── The title token ─────────────────────────────────────────────────────────────

test('parse: "@" + last four or a nickname on a money title becomes accountRef and leaves the title', () => {
  const parsed = parseCaptureTitle('Lunch Chipotle #expense $12.40 @1234');
  assert.equal(parsed.accountRef, '1234');
  assert.equal(parsed.cleanTitle, 'Lunch Chipotle');
  assert.equal(parsed.vendor, 'Chipotle');
  assert.equal(parsed.amountCents, 1240);
  assert.deepEqual(parsed.warnings, []);
  assert.equal(parseCaptureTitle('Client invoice #income $500 @Visa').accountRef, 'visa');
  assert.equal(parseCaptureTitle('Gas @chase-2 #gasto 40.00').accountRef, 'chase-2');
  assert.equal(parseCaptureTitle('Coffee #expense $4 (@1234)').accountRef, '1234');
});

test('parse: no "@" leaves accountRef out; the same reference twice is one', () => {
  assert.equal('accountRef' in parseCaptureTitle('Lunch Chipotle #expense $12.40'), false);
  const twice = parseCaptureTitle('Coffee @1234 #expense $4 @1234');
  assert.equal(twice.accountRef, '1234');
  assert.deepEqual(twice.warnings, []);
});

test('parse: two different references are flagged as multiple_accounts, with no accountRef', () => {
  const parsed = parseCaptureTitle('Coffee #expense $4 @1234 @visa');
  assert.equal(parsed.accountRef, undefined);
  assert.deepEqual(parsed.warnings, ['multiple_accounts']);
});

test('parse: "@word" right after a meal word is still the vendor, unless it is four digits', () => {
  const nobu = parseCaptureTitle('Dinner @Nobu #expense $90 @1234');
  assert.equal(nobu.vendor, 'Nobu');
  assert.equal(nobu.accountRef, '1234');
  const digits = parseCaptureTitle('Lunch @1234 #expense $9');
  assert.equal(digits.accountRef, '1234');
  assert.equal(digits.amountCents, 900);
});

test('parse: "@" is only read on #expense and #income titles', () => {
  for (const title of ['Meet @Sam #task', 'Dinner #meal @home', 'Run @park #workout 30min', 'Ride #trip 5mi @1234']) {
    const parsed = parseCaptureTitle(title);
    assert.equal(parsed.accountRef, undefined, title);
    assert.ok(parsed.cleanTitle.includes('@'), title);
  }
});

test('parse: a bare "@" or an email-like word is not an account', () => {
  assert.equal(parseCaptureTitle('Dinner @ Nobu #expense $90').accountRef, undefined);
  assert.equal(parseCaptureTitle('Pay a@b.com #expense $5').accountRef, undefined);
});

// ── Settings: legacy and new shape ──────────────────────────────────────────────

test('readAccountChoice: the old single default reads as allowed = [default]', () => {
  assert.deepEqual(readAccountChoice({ default_account_id: VISA }), {
    allowedIds: [VISA],
    defaultId: VISA,
    nicknames: {},
  });
  assert.deepEqual(readAccountChoice(null), { allowedIds: [], defaultId: null, nicknames: {} });
  assert.deepEqual(readAccountChoice({ default_account_id: null, default_tag: 'X' }).allowedIds, []);
});

test('readAccountChoice: list, default and nicknames; junk ignored; the default is always ticked', () => {
  const choice = readAccountChoice({
    allowed_account_ids: [CHECKING, 'nope', CHECKING.toUpperCase(), VISA],
    default_account_id: SAVINGS,
    account_nicknames: { [VISA]: 'Visa', [CHECKING]: '1234', bad: 'x' },
  });
  assert.deepEqual(choice.allowedIds, [CHECKING, VISA, SAVINGS]);
  assert.equal(choice.defaultId, SAVINGS);
  assert.deepEqual(choice.nicknames, { [VISA]: 'visa' });
});

test('normalizeNickname and lastFourOf', () => {
  assert.equal(normalizeNickname(' @Visa '), 'visa');
  assert.equal(normalizeNickname('1234'), null); // would look like last four
  assert.equal(normalizeNickname('a'.repeat(21)), null);
  assert.equal(normalizeNickname('has space'), null);
  assert.equal(lastFourOf({ last_four: '1234' }), '1234');
  assert.equal(lastFourOf({ last_four: '****5678' }), '5678');
  assert.equal(lastFourOf({ last_four: '12' }), null);
  assert.equal(lastFourOf({ last_four: null }), null);
});

// ── Resolution ──────────────────────────────────────────────────────────────────

const CHOICE = readAccountChoice({
  allowed_account_ids: [CHECKING, VISA],
  default_account_id: CHECKING,
  account_nicknames: { [VISA]: 'visa', [SAVINGS]: 'rainy' },
});

test('resolve: no "@" uses the default', () => {
  assert.deepEqual(resolveEventAccount(undefined, CHOICE, OWNED), { ok: true, accountId: CHECKING });
  const noDefault = readAccountChoice({ allowed_account_ids: [CHECKING] });
  assert.deepEqual(resolveEventAccount(undefined, noDefault, OWNED), { ok: true, accountId: null });
});

test('resolve: a ticked account by last four or by nickname', () => {
  assert.deepEqual(resolveEventAccount('1234', CHOICE, OWNED), { ok: true, accountId: CHECKING });
  assert.deepEqual(resolveEventAccount('visa', CHOICE, OWNED), { ok: true, accountId: VISA });
  assert.deepEqual(resolveEventAccount('VISA', CHOICE, OWNED), { ok: true, accountId: VISA });
});

test('resolve: an unticked account is flagged, never used', () => {
  for (const ref of ['5555', 'rainy']) {
    const result = resolveEventAccount(ref, CHOICE, OWNED);
    assert.equal(result.ok, false, ref);
    assert.ok(!result.ok && result.review.includes('not ticked'), ref);
  }
});

test('resolve: an unknown reference is flagged', () => {
  const result = resolveEventAccount('0000', CHOICE, OWNED);
  assert.ok(!result.ok && result.review.startsWith('No account matches @0000'));
  assert.equal(resolveEventAccount('amex', CHOICE, OWNED).ok, false);
});

test('resolve: two ticked accounts with the same last four are ambiguous; a nickname settles it', () => {
  const both = readAccountChoice({ allowed_account_ids: [VISA, TWIN] });
  const result = resolveEventAccount('9876', both, OWNED);
  assert.ok(!result.ok && result.review.includes('more than one'));
  // Only one of the twins ticked: not ambiguous.
  assert.deepEqual(resolveEventAccount('9876', readAccountChoice({ allowed_account_ids: [VISA] }), OWNED), {
    ok: true,
    accountId: VISA,
  });
  const named = readAccountChoice({ allowed_account_ids: [VISA, TWIN], account_nicknames: { [TWIN]: 'twin' } });
  assert.deepEqual(resolveEventAccount('twin', named, OWNED), { ok: true, accountId: TWIN });
});

test('resolve: an account the user does not own never matches, even if ticked or default', () => {
  const choice = readAccountChoice({ allowed_account_ids: [NOT_MINE], default_account_id: NOT_MINE });
  assert.deepEqual(resolveEventAccount(undefined, choice, OWNED), { ok: true, accountId: null });
  assert.equal(resolveEventAccount('4321', choice, OWNED).ok, false);
});

test('accountRefFor: nickname first, else a unique last four, else null', () => {
  assert.equal(accountRefFor(VISA, CHOICE, OWNED), 'visa');
  assert.equal(accountRefFor(CHECKING, CHOICE, OWNED), '1234');
  const twins = readAccountChoice({ allowed_account_ids: [VISA, TWIN] });
  assert.equal(accountRefFor(VISA, twins, OWNED), null);
  assert.equal(accountRefFor(NOT_MINE, CHOICE, OWNED), null);
});

test('the event builder writes the token and the parser reads it back', () => {
  const title = buildEventTitle({ kind: 'expense', lang: 'en', what: 'Lunch Chipotle', amount: '12.4', account: '1234' });
  assert.equal(title, 'Lunch Chipotle #expense $12.40 @1234');
  assert.equal(parseCaptureTitle(title).accountRef, '1234');
  assert.equal(
    buildEventTitle({ kind: 'meal', lang: 'en', what: 'Cafe', account: '1234' }),
    'Cafe #meal',
    'only money kinds carry an account',
  );
});

// ── PATCH merge rules ───────────────────────────────────────────────────────────

test('merge: ticking accounts and choosing a default', () => {
  const result = mergeAccountSettings({}, { allowed_account_ids: [CHECKING, VISA], default_account_id: VISA });
  assert.ok(result.ok);
  assert.deepEqual(result.settings, {
    allowed_account_ids: [CHECKING, VISA],
    default_account_id: VISA,
    account_nicknames: {},
  });
  assert.deepEqual([...result.sentIds].sort(), [CHECKING, VISA].sort());
});

test('merge: the old client sending only default_account_id ticks it and keeps the legacy reading', () => {
  const result = mergeAccountSettings({ default_account_id: CHECKING }, { default_account_id: VISA });
  assert.ok(result.ok);
  assert.deepEqual(result.settings.allowed_account_ids, [CHECKING, VISA]);
  assert.equal(result.settings.default_account_id, VISA);
});

test('merge: unticking the default clears it instead of guessing another', () => {
  const result = mergeAccountSettings(
    { allowed_account_ids: [CHECKING, VISA], default_account_id: CHECKING },
    { allowed_account_ids: [VISA] },
  );
  assert.ok(result.ok);
  assert.equal(result.settings.default_account_id, null);
});

test('merge: a default outside the ticked list sent together with it is refused', () => {
  const result = mergeAccountSettings({}, { allowed_account_ids: [CHECKING], default_account_id: VISA });
  assert.deepEqual(result, { ok: false, error: 'The default account must be one of the ticked accounts.' });
});

test('merge: bad shapes are refused', () => {
  assert.equal(mergeAccountSettings({}, { allowed_account_ids: 'x' }).ok, false);
  assert.equal(mergeAccountSettings({}, { allowed_account_ids: ['nope'] }).ok, false);
  assert.equal(mergeAccountSettings({}, { default_account_id: 'nope' }).ok, false);
  assert.equal(mergeAccountSettings({}, { account_nicknames: [] }).ok, false);
  assert.equal(mergeAccountSettings({}, { account_nicknames: { nope: 'visa' } }).ok, false);
  assert.equal(mergeAccountSettings({}, { account_nicknames: { [VISA]: '9876' } }).ok, false);
});

test('merge: nicknames are merged, removed with null, and unique per connection', () => {
  const first = mergeAccountSettings({}, { account_nicknames: { [VISA]: 'Visa' } });
  assert.ok(first.ok);
  assert.deepEqual(first.settings.account_nicknames, { [VISA]: 'visa' });
  const clash = mergeAccountSettings(first.settings, { account_nicknames: { [TWIN]: 'visa' } });
  assert.equal(clash.ok, false);
  const cleared = mergeAccountSettings(first.settings, { account_nicknames: { [VISA]: null } });
  assert.ok(cleared.ok);
  assert.deepEqual(cleared.settings.account_nicknames, {});
});

test('prune: ids the user no longer owns are dropped', () => {
  const pruned = pruneAccountSettings(
    { allowed_account_ids: [CHECKING, NOT_MINE], default_account_id: NOT_MINE, account_nicknames: { [NOT_MINE]: 'gone' } },
    (id) => id !== NOT_MINE,
  );
  assert.deepEqual(pruned, { allowed_account_ids: [CHECKING], default_account_id: null, account_nicknames: {} });
});

// ── Server side: ownership and records ──────────────────────────────────────────

function newDb(): FakeDb {
  const db = new FakeDb();
  db.seed('financial_accounts', [
    { id: CHECKING, user_id: USER, name: 'Checking', last_four: '1234', currency: 'USD' },
    { id: VISA, user_id: USER, name: 'Visa', last_four: '9876', currency: 'EUR' },
    { id: SAVINGS, user_id: USER, name: 'Savings', last_four: '5555', currency: 'USD' },
    { id: NOT_MINE, user_id: OTHER, name: 'Theirs', last_four: '4321', currency: 'USD' },
  ]);
  return db;
}

function fieldsFor(summary: string): EventTaskFields {
  const fields = eventToTaskFields(
    { id: 'evt', etag: '"1"', status: 'confirmed', summary, start: { dateTime: '2026-10-05T19:30:00Z' } },
    'UTC',
  );
  assert.ok(fields);
  return fields;
}

test("loadCalendarAccounts: another user's account is dropped from ticked, default and nicknames", async () => {
  const db = newDb();
  const context = await loadCalendarAccounts(db as unknown as SupabaseClient, USER, {
    allowed_account_ids: [CHECKING, NOT_MINE],
    default_account_id: NOT_MINE,
    account_nicknames: { [NOT_MINE]: 'theirs', [VISA]: 'visa' },
  });
  assert.deepEqual(context.choice.allowedIds, [CHECKING]);
  assert.equal(context.choice.defaultId, null);
  assert.deepEqual(context.choice.nicknames, { [VISA]: 'visa' });
  assert.deepEqual(context.owned.map((a) => a.id).sort(), [CHECKING, VISA, SAVINGS].sort());
  // Their last four is unknown to this user, not "unticked".
  const result = accountForEvent(fieldsFor('Coffee #expense $4 @4321'), context);
  assert.ok(!result.ok && result.review.startsWith('No account matches'));
});

async function record(db: FakeDb, overrides: Partial<SyncRecordInput> & Pick<SyncRecordInput, 'mode'>) {
  return syncEventRecord(db as unknown as SupabaseClient, {
    userId: USER,
    taskId: TASK,
    fields: null,
    state: EMPTY_RECORD_STATE,
    accountId: null,
    persist: async () => {},
    newId: () => RECORD_ID,
    ...overrides,
  });
}

async function viaSettings(
  db: FakeDb,
  summary: string,
  settings: Record<string, unknown>,
  extra: Partial<SyncRecordInput> = {},
) {
  const fields = fieldsFor(summary);
  const context = await loadCalendarAccounts(db as unknown as SupabaseClient, USER, settings);
  const resolved = accountForEvent(fields, context);
  return record(db, {
    mode: 'create',
    fields,
    accountId: resolved.ok ? resolved.accountId : null,
    accountReview: resolved.ok ? null : resolved.review,
    ...extra,
  });
}

const SETTINGS = {
  allowed_account_ids: [CHECKING, VISA],
  default_account_id: CHECKING,
  account_nicknames: { [VISA]: 'visa' },
};

test('records: "@visa" puts the transaction on the Visa account; no "@" on the default', async () => {
  const db = newDb();
  const out = await viaSettings(db, 'Dinner #expense $40 @visa', SETTINGS);
  assert.equal(out.review, null);
  assert.equal(db.rows('financial_transactions')[0].account_id, VISA);

  const db2 = newDb();
  await viaSettings(db2, 'Dinner #expense $40', SETTINGS);
  assert.equal(db2.rows('financial_transactions')[0].account_id, CHECKING);
});

test('records: the legacy single default still works', async () => {
  const db = newDb();
  await viaSettings(db, 'Dinner #expense $40', { default_account_id: VISA });
  assert.equal(db.rows('financial_transactions')[0].account_id, VISA);
  const db2 = newDb();
  await viaSettings(db2, 'Dinner #expense $40 @9876', { default_account_id: VISA });
  assert.equal(db2.rows('financial_transactions')[0].account_id, VISA);
});

test('records: an unticked or unknown "@" creates no transaction and flags the item', async () => {
  for (const title of ['Dinner #expense $40 @5555', 'Dinner #expense $40 @0000', 'Dinner #expense $40 @amex']) {
    const db = newDb();
    const out = await viaSettings(db, title, SETTINGS);
    assert.ok(out.review?.endsWith('No transaction was created.'), title);
    assert.equal(out.record_id, null, title);
    assert.equal(db.rows('financial_transactions').length, 0, title);
  }
});

test('records: two "@" in one title flag the title; no transaction', async () => {
  const db = newDb();
  assert.equal(fieldsFor('Dinner #expense $40 @visa @1234').parseStatus, 'flagged');
  const out = await viaSettings(db, 'Dinner #expense $40 @visa @1234', SETTINGS);
  assert.equal(out.record_id, null);
  assert.equal(db.rows('financial_transactions').length, 0);
});

test('update: a changed "@" moves an untouched transaction; an edited one is left and flagged', async () => {
  const db = newDb();
  const first = await viaSettings(db, 'Dinner #expense $40 @1234', SETTINGS);
  assert.equal(db.rows('financial_transactions')[0].account_id, CHECKING);
  const moved = await viaSettings(db, 'Dinner #expense $40 @visa', SETTINGS, { mode: 'update', state: first });
  assert.equal(moved.review, null);
  assert.equal(db.rows('financial_transactions')[0].account_id, VISA);

  db.rows('financial_transactions')[0].amount = 41; // edited in CentenarianOS
  const back = await viaSettings(db, 'Dinner #expense $40 @1234', SETTINGS, { mode: 'update', state: moved });
  assert.ok(back.review?.includes('edited in CentenarianOS'));
  assert.equal(db.rows('financial_transactions')[0].account_id, VISA);
});

test('update: an "@" changed to an unticked account leaves the transaction and flags it', async () => {
  const db = newDb();
  const first = await viaSettings(db, 'Dinner #expense $40 @visa', SETTINGS);
  const out = await viaSettings(db, 'Dinner #expense $40 @5555', SETTINGS, { mode: 'update', state: first });
  assert.ok(out.review?.includes('not ticked'));
  assert.ok(out.review?.endsWith('Its transaction was left as it is.'));
  assert.equal(out.record_id, first.record_id);
  assert.equal(db.rows('financial_transactions')[0].account_id, VISA);
});

test('accountReview never blocks a non-money record', async () => {
  const db = newDb();
  const out = await record(db, { mode: 'create', fields: fieldsFor('Dinner salmon #meal'), accountReview: 'x' });
  assert.equal(out.review, null);
  assert.equal(db.rows('meal_logs').length, 1);
});
