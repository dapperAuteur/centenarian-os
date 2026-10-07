// tests/unit/pain-entries.test.ts
// Unit tests for pain entries (lib/pain/): several entries a day, the daily_logs.pain_*
// summary recomputed after every add / edit / delete, the once-only backfill from
// daily_logs (migration 222), ownership, the history filters (including the Hand and Foot
// locations and the Numbness sensation), and the fallback before migration 222.
// Run: npm run test:unit
//
// Every user, date and note here is SYNTHETIC. Nothing touches a database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PainRuleError,
  activitiesFromText,
  groupByDay,
  parseEntryInput,
  parseEntryPatch,
  parseWhen,
  planBackfill,
  summarizeDay,
} from '../../lib/pain/logic.ts';
import type { DailyLogPainRow, PainEntryInput } from '../../lib/pain/logic.ts';
import {
  BODY_LOCATIONS,
  SENSATIONS,
  locationFilterOptions,
  resolveLocationFilter,
} from '../../lib/pain/options.ts';
import {
  NOT_READY_NOTICE,
  createEntry,
  deleteEntry,
  listDayPoints,
  listEntries,
  recomputeDaySummary,
  updateEntry,
} from '../../lib/pain/server.ts';
import { FakeDb, FakeQuery } from './fake-supabase.ts';
import type { FakeResult, Row } from './fake-supabase.ts';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '99999999-9999-4999-8999-999999999999';
const NOW = Date.parse('2026-10-07T20:00:00.000Z');

/**
 * The shared fake plus what pain entries use: array contains / overlaps (PostgREST cs / ov)
 * and more than one order() (occurred_at, then id).
 */
class PainQuery extends FakeQuery {
  orders: { column: string; ascending: boolean }[] = [];

  contains(column: string, values: string[]): this {
    return this.where(column, (v) => Array.isArray(v) && values.every((x) => v.includes(x)));
  }

  overlaps(column: string, values: string[]): this {
    return this.where(column, (v) => Array.isArray(v) && values.some((x) => v.includes(x)));
  }

  order(column: string, options: { ascending?: boolean } = {}): this {
    this.orders.push({ column, ascending: options.ascending !== false });
    return this;
  }

  run(): FakeResult {
    if (this.op === 'select' && this.orders.length > 0) {
      const rows = this.db.tables[this.table] ?? [];
      rows.sort((a, b) => {
        for (const { column, ascending } of this.orders) {
          const x = String(a[column] ?? '');
          const y = String(b[column] ?? '');
          if (x !== y) return (x < y ? -1 : 1) * (ascending ? 1 : -1);
        }
        return 0;
      });
    }
    return super.run();
  }
}

class PainDb extends FakeDb {
  from(table: string): PainQuery {
    return new PainQuery(this, table);
  }
}

const asDb = (fake: FakeDb) => fake as unknown as SupabaseClient;

function entry(overrides: Partial<PainEntryInput> = {}): PainEntryInput {
  return {
    occurred_at: '2026-10-07T13:00:00.000Z',
    local_date: '2026-10-07',
    intensity: 3,
    locations: [],
    sensations: [],
    activities: [],
    notes: null,
    ...overrides,
  };
}

function dailyLog(db: FakeDb, userId: string, date: string): Row | undefined {
  return db.rows('daily_logs').find((row) => row.user_id === userId && row.date === date);
}

// ── Options: Hands, Feet, Numbness ───────────────────────────────────────────

test('the form offers Left/Right Hand, Left/Right Foot and the Numbness sensation', () => {
  for (const loc of ['Left Hand', 'Right Hand', 'Left Foot', 'Right Foot']) {
    assert.ok((BODY_LOCATIONS as readonly string[]).includes(loc), loc);
  }
  assert.ok((SENSATIONS as readonly string[]).includes('Numbness'));
  // The existing choices keep their spelling, so saved entries still match the filters.
  assert.ok((BODY_LOCATIONS as readonly string[]).includes('Lower Back (L5/S1)'));
  assert.equal(new Set(BODY_LOCATIONS).size, BODY_LOCATIONS.length);
});

test('the location filter has every location plus an either-side choice for each pair', () => {
  const options = locationFilterOptions();
  const hand = options.find((o) => o.label === 'Hand (left or right)');
  const foot = options.find((o) => o.label === 'Foot (left or right)');
  assert.deepEqual(hand?.matches, ['Left Hand', 'Right Hand']);
  assert.deepEqual(foot?.matches, ['Left Foot', 'Right Foot']);
  assert.ok(options.some((o) => o.value === 'Left Hand'));
  // Only one side exists for the knee and the hamstring, so no pair for them.
  assert.ok(!options.some((o) => o.label.startsWith('Knee')));
  assert.deepEqual(resolveLocationFilter(hand!.value), ['Left Hand', 'Right Hand']);
  assert.deepEqual(resolveLocationFilter('Right Foot'), ['Right Foot']);
  assert.equal(resolveLocationFilter('  '), null);
});

// ── Input rules ──────────────────────────────────────────────────────────────

test('an entry is cleaned: trimmed lists, each value once, blank notes become null', () => {
  const input = parseEntryInput(
    {
      occurred_at: '2026-10-07T13:05:00.000Z',
      local_date: '2026-10-07',
      intensity: 6,
      locations: [' Left Hand ', 'left hand', 'Right Foot', ''],
      sensations: ['Numbness'],
      activities: activitiesFromText('Typing\n\n  Cold walk  \ntyping'),
      notes: '   ',
    },
    NOW,
  );
  assert.deepEqual(input.locations, ['Left Hand', 'Right Foot']);
  assert.deepEqual(input.sensations, ['Numbness']);
  assert.deepEqual(input.activities, ['Typing', 'Cold walk']);
  assert.equal(input.notes, null);
});

test('intensity must be a whole number from 0 to 10', () => {
  for (const bad of [-1, 11, 2.5, 'x', null]) {
    assert.throws(() => parseEntryInput({ ...entry(), intensity: bad }, NOW), PainRuleError, String(bad));
  }
  assert.equal(parseEntryInput({ ...entry(), intensity: 0 }, NOW).intensity, 0);
  assert.equal(parseEntryInput({ ...entry(), intensity: '10' }, NOW).intensity, 10);
});

test('the date must be the person\'s own date for the time, at most a day from UTC', () => {
  // 21:30 in New York on Oct 7 is 01:30 UTC on Oct 8: the local date stays Oct 7.
  assert.deepEqual(parseWhen('2026-10-08T01:30:00.000Z', '2026-10-07', NOW), {
    occurred_at: '2026-10-08T01:30:00.000Z',
    local_date: '2026-10-07',
  });
  assert.throws(() => parseWhen('2026-10-08T01:30:00.000Z', '2026-10-05', NOW), /does not match/);
  assert.throws(() => parseWhen('2026-10-07T13:00:00.000Z', '2026-13-01', NOW), /YYYY-MM-DD/);
  assert.throws(() => parseWhen('2026-10-10T13:00:00.000Z', '2026-10-10', NOW), /future/);
  assert.throws(() => parseWhen('yesterday', '2026-10-07', NOW), /not a valid/);
  // No local date sent: the UTC date is used.
  assert.equal(parseWhen('2026-10-07T13:00:00.000Z', undefined, NOW).local_date, '2026-10-07');
});

test('an edit keeps only the fields sent, and a date needs its time', () => {
  assert.deepEqual(parseEntryPatch({ intensity: 4 }, NOW), { intensity: 4 });
  assert.throws(() => parseEntryPatch({ local_date: '2026-10-06' }, NOW), /time along with the date/);
  assert.throws(() => parseEntryPatch({}, NOW), /Nothing to change/);
});

// ── Summary rules ────────────────────────────────────────────────────────────

test('the day summary: highest intensity, union of lists in logged order, notes oldest first', () => {
  const summary = summarizeDay([
    {
      occurred_at: '2026-10-07T18:00:00.000Z',
      intensity: 7,
      locations: ['Right Foot', 'Left Hand'],
      sensations: ['Numbness'],
      activities: ['Long drive'],
      notes: 'Worse after the drive.',
    },
    {
      occurred_at: '2026-10-07T09:00:00.000Z',
      intensity: 3,
      locations: ['Left Hand', 'Neck'],
      sensations: ['Tightness', 'numbness'],
      activities: ['Typing', 'long drive'],
      notes: 'Woke up stiff.',
    },
    {
      occurred_at: '2026-10-07T12:00:00.000Z',
      intensity: 5,
      locations: [],
      sensations: [],
      activities: [],
      notes: 'Woke up stiff.',
    },
  ]);
  assert.deepEqual(summary, {
    pain_intensity: 7,
    pain_locations: ['Left Hand', 'Neck', 'Right Foot'],
    pain_sensations: ['Tightness', 'numbness'],
    pain_activities: ['Typing', 'long drive'],
    pain_notes: 'Woke up stiff.\n\nWorse after the drive.',
  });
});

test('the day summary stores empty lists as null and keeps intensity within daily_logs 1-10', () => {
  const summary = summarizeDay([
    { occurred_at: '2026-10-07T09:00:00.000Z', intensity: 0, locations: [], sensations: [], activities: [], notes: null },
  ]);
  assert.deepEqual(summary, {
    pain_intensity: 1,
    pain_locations: null,
    pain_sensations: null,
    pain_activities: null,
    pain_notes: null,
  });
  assert.equal(summarizeDay([]).pain_intensity, null);
});

// ── Several entries a day, kept in step with daily_logs ─────────────────────

test('every save adds an entry; the second one on a day no longer overwrites the first', async () => {
  const db = new PainDb();
  const first = await createEntry(asDb(db), USER, entry({ intensity: 2, locations: ['Neck'], occurred_at: '2026-10-07T09:00:00.000Z' }));
  const second = await createEntry(asDb(db), USER, entry({ intensity: 6, locations: ['Left Hand'], sensations: ['Numbness'] }));

  assert.equal(first.ready, true);
  assert.equal(second.ready, true);
  assert.equal(db.rows('pain_entries').length, 2);
  assert.ok(db.rows('pain_entries').every((row) => row.source === 'app' && row.user_id === USER));

  const log = dailyLog(db, USER, '2026-10-07');
  assert.equal(db.rows('daily_logs').length, 1, 'one daily_logs row per day');
  assert.equal(log?.pain_intensity, 6);
  assert.deepEqual(log?.pain_locations, ['Neck', 'Left Hand']);
  assert.deepEqual(log?.pain_sensations, ['Numbness']);
  assert.equal(second.value.day.daily_log_id, log?.id);
  assert.equal(first.value.day.daily_log_id, log?.id);
});

test('the summary update leaves the day\'s other daily_logs fields alone', async () => {
  const db = new PainDb();
  db.seed('daily_logs', [{ user_id: USER, date: '2026-10-07', energy_rating: 4, biggest_win: 'Shipped it' }]);
  await createEntry(asDb(db), USER, entry({ intensity: 5 }));
  const log = dailyLog(db, USER, '2026-10-07');
  assert.equal(log?.energy_rating, 4);
  assert.equal(log?.biggest_win, 'Shipped it');
  assert.equal(log?.pain_intensity, 5);
  assert.equal(db.rows('daily_logs').length, 1);
});

test('editing an entry recomputes the day; moving it recomputes both days', async () => {
  const db = new PainDb();
  const a = await createEntry(asDb(db), USER, entry({ intensity: 8, occurred_at: '2026-10-07T09:00:00.000Z' }));
  await createEntry(asDb(db), USER, entry({ intensity: 3 }));
  assert.equal(dailyLog(db, USER, '2026-10-07')?.pain_intensity, 8);

  await updateEntry(asDb(db), USER, a.value.entry!.id, { intensity: 2 });
  assert.equal(dailyLog(db, USER, '2026-10-07')?.pain_intensity, 3);

  const moved = await updateEntry(asDb(db), USER, a.value.entry!.id, {
    occurred_at: '2026-10-06T22:00:00.000Z',
    local_date: '2026-10-06',
  });
  assert.deepEqual(moved.days.map((d) => d.date).sort(), ['2026-10-06', '2026-10-07']);
  assert.equal(dailyLog(db, USER, '2026-10-06')?.pain_intensity, 2);
  assert.equal(dailyLog(db, USER, '2026-10-07')?.pain_intensity, 3);
});

test('deleting the last entry clears the day\'s pain columns but keeps the daily_logs row', async () => {
  const db = new PainDb();
  db.seed('daily_logs', [{ user_id: USER, date: '2026-10-07', energy_rating: 3 }]);
  const a = await createEntry(asDb(db), USER, entry({ intensity: 6, notes: 'Sore' }));
  const b = await createEntry(asDb(db), USER, entry({ intensity: 4 }));

  await deleteEntry(asDb(db), USER, a.value.entry!.id);
  let log = dailyLog(db, USER, '2026-10-07');
  assert.equal(log?.pain_intensity, 4);
  assert.equal(log?.pain_notes, null);

  await deleteEntry(asDb(db), USER, b.value.entry!.id);
  log = dailyLog(db, USER, '2026-10-07');
  assert.ok(log, 'the row stays: it holds the debrief');
  assert.equal(log?.energy_rating, 3);
  assert.equal(log?.pain_intensity, null);
  assert.equal(log?.pain_locations, null);
});

test('recomputing a day with no entries and no daily log creates nothing', async () => {
  const db = new PainDb();
  const day = await recomputeDaySummary(asDb(db), USER, '2026-10-01');
  assert.equal(day.daily_log_id, null);
  assert.equal(db.rows('daily_logs').length, 0);
});

test('an offline replay with the same id returns the entry saved the first time', async () => {
  const db = new PainDb();
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  // The fake has no primary-key check, so stand in for Postgres: a second row with this id fails.
  db.rejectInsert = (table, row) =>
    table === 'pain_entries' && db.rows('pain_entries').some((r) => r.id === row.id)
      ? { code: '23505', message: 'duplicate key value violates unique constraint "pain_entries_pkey"' }
      : null;
  const first = await createEntry(asDb(db), USER, entry({ intensity: 5 }), id);
  const replay = await createEntry(asDb(db), USER, entry({ intensity: 5 }), id);
  assert.equal(first.value.entry?.id, id);
  assert.equal(replay.value.entry?.id, id);
  assert.equal(db.rows('pain_entries').length, 1);
  await assert.rejects(() => createEntry(asDb(db), USER, entry(), 'not-a-uuid'), PainRuleError);
});

// ── Ownership ───────────────────────────────────────────────────────────────

test('another person\'s entry reads as not found and is never changed', async () => {
  const db = new PainDb();
  const theirs = await createEntry(asDb(db), OTHER, entry({ intensity: 9, notes: 'Private' }));
  const id = theirs.value.entry!.id;

  await assert.rejects(() => updateEntry(asDb(db), USER, id, { intensity: 1 }), (err: unknown) => {
    assert.ok(err instanceof PainRuleError);
    assert.equal(err.status, 404);
    return true;
  });
  await assert.rejects(() => deleteEntry(asDb(db), USER, id), (err: unknown) => {
    assert.ok(err instanceof PainRuleError);
    assert.equal(err.status, 404);
    return true;
  });
  assert.equal(db.rows('pain_entries')[0].intensity, 9);
  assert.equal(dailyLog(db, OTHER, '2026-10-07')?.pain_intensity, 9);
  assert.equal(dailyLog(db, USER, '2026-10-07'), undefined);

  const page = await listEntries(asDb(db), USER, {});
  assert.equal(page.value.entries.length, 0);
  // Every query is scoped to the signed-in user, not only RLS.
  await assert.rejects(() => updateEntry(asDb(db), USER, 'nope', { intensity: 1 }), PainRuleError);
});

// ── History: filters and paging past 200 ────────────────────────────────────

test('the history lists every entry newest first, pages past 200, and filters', async () => {
  const db = new PainDb();
  const rows: Row[] = [];
  // 260 entries over 130 days, two a day.
  for (let d = 0; d < 130; d++) {
    const date = new Date(Date.UTC(2026, 5, 1) + d * 86_400_000).toISOString().slice(0, 10);
    rows.push(
      { user_id: USER, local_date: date, occurred_at: `${date}T09:00:00.000Z`, intensity: d % 10, locations: d % 3 === 0 ? ['Left Hand'] : ['Neck'], sensations: [], activities: [], notes: null, source: 'app' },
      { user_id: USER, local_date: date, occurred_at: `${date}T19:00:00.000Z`, intensity: 10 - (d % 10), locations: d % 5 === 0 ? ['Right Foot'] : [], sensations: ['Numbness'], activities: [], notes: d === 7 ? 'Tingling after the run' : null, source: 'app' },
    );
  }
  db.seed('pain_entries', rows);

  const seen: string[] = [];
  let offset: number | null = 0;
  let pages = 0;
  while (offset !== null) {
    const page = await listEntries(asDb(db), USER, { offset, limit: 100 });
    seen.push(...page.value.entries.map((e) => e.occurred_at));
    offset = page.value.next_offset;
    pages += 1;
  }
  assert.equal(pages, 3);
  assert.equal(seen.length, 260);
  assert.deepEqual(seen, [...seen].sort().reverse(), 'newest first');

  const handOnly = await listEntries(asDb(db), USER, { locations: ['Left Hand'], limit: 200 });
  assert.ok(handOnly.value.entries.every((e) => e.locations.includes('Left Hand')));
  assert.equal(handOnly.value.entries.length, 44);

  const eitherSide = await listEntries(asDb(db), USER, { locations: resolveLocationFilter('either:Hand'), limit: 200 });
  assert.equal(eitherSide.value.entries.length, 44);
  const feet = await listEntries(asDb(db), USER, { locations: resolveLocationFilter('either:Foot'), limit: 200 });
  assert.equal(feet.value.entries.length, 26);

  const range = await listEntries(asDb(db), USER, { from: '2026-06-03', to: '2026-06-04', minIntensity: 7, maxIntensity: 9 });
  assert.ok(range.value.entries.every((e) => e.intensity >= 7 && e.intensity <= 9));
  assert.ok(range.value.entries.every((e) => e.local_date >= '2026-06-03' && e.local_date <= '2026-06-04'));
  assert.equal(range.value.entries.length, 2);

  const search = await listEntries(asDb(db), USER, { q: 'tingling' });
  assert.equal(search.value.entries.length, 1);
});

test('each day on a page carries its daily summary (the day\'s highest), grouped newest first', async () => {
  const db = new PainDb();
  await createEntry(asDb(db), USER, entry({ intensity: 2, occurred_at: '2026-10-06T09:00:00.000Z', local_date: '2026-10-06' }));
  await createEntry(asDb(db), USER, entry({ intensity: 7, occurred_at: '2026-10-06T18:00:00.000Z', local_date: '2026-10-06', locations: ['Left Foot'] }));
  await createEntry(asDb(db), USER, entry({ intensity: 4 }));

  // Filtered to the low entry, the day still shows its real highest (7) from daily_logs.
  const page = await listEntries(asDb(db), USER, { maxIntensity: 2 });
  assert.equal(page.value.entries.length, 1);
  assert.equal(page.value.days['2026-10-06'].pain_intensity, 7);

  const all = await listEntries(asDb(db), USER, {});
  const groups = groupByDay(all.value.entries);
  assert.deepEqual(groups.map((g) => [g.date, g.entries.length, g.highest]), [
    ['2026-10-07', 1, 4],
    ['2026-10-06', 2, 7],
  ]);
  assert.equal(groups[1].entries[0].intensity, 7, 'newest entry first within a day');

  const points = await listDayPoints(asDb(db), USER, {});
  assert.deepEqual(points.map((p) => [p.date, p.pain_intensity]), [
    ['2026-10-06', 7],
    ['2026-10-07', 4],
  ]);
});

// ── Backfill (migration 222) ────────────────────────────────────────────────

const LOGS: DailyLogPainRow[] = [
  { user_id: USER, date: '2026-09-01', pain_intensity: 4, pain_locations: ['Neck', ' '], pain_sensations: ['Tightness'], pain_activities: null, pain_notes: ' Desk day ' },
  { user_id: USER, date: '2026-09-02', pain_intensity: null, pain_locations: null, pain_sensations: null, pain_activities: null, pain_notes: 'Energy only' },
  { user_id: USER, date: '2026-09-03', pain_intensity: 2, pain_locations: 'Right Knee', pain_sensations: null, pain_activities: [], pain_notes: '' },
  { user_id: OTHER, date: '2026-09-01', pain_intensity: 6, pain_locations: [], pain_sensations: [], pain_activities: ['Run'], pain_notes: null },
];

test('the backfill copies each day with pain data once, at 12:00 UTC, marked daily_log', () => {
  const planned = planBackfill(LOGS, []);
  assert.equal(planned.length, 3, 'the day with no intensity is not copied');
  assert.deepEqual(planned[0], {
    user_id: USER,
    occurred_at: '2026-09-01T12:00:00.000Z',
    local_date: '2026-09-01',
    intensity: 4,
    locations: ['Neck'],
    sensations: ['Tightness'],
    activities: [],
    notes: 'Desk day',
    source: 'daily_log',
  });
  assert.deepEqual(planned[1].locations, ['Right Knee'], 'a lone jsonb string becomes one item');
  assert.equal(planned[1].notes, null);
});

test('the backfill is idempotent: a second run copies nothing, and days with app entries are skipped', () => {
  const first = planBackfill(LOGS, []);
  const again = planBackfill(LOGS, first);
  assert.equal(again.length, 0);

  // The app already logged entries on Sep 3 (for example after a re-run), so that day is left alone.
  const withAppEntry = planBackfill(LOGS, [{ user_id: USER, local_date: '2026-09-03' }]);
  assert.deepEqual(withAppEntry.map((e) => `${e.user_id}|${e.local_date}`), [
    `${USER}|2026-09-01`,
    `${OTHER}|2026-09-01`,
  ]);
  // A duplicate daily_logs row (should not exist: UNIQUE user_id, date) is still copied once.
  assert.equal(planBackfill([LOGS[0], LOGS[0]], []).length, 1);
});

test('the backfilled day summarizes back to the same daily_logs values', () => {
  const [copied] = planBackfill([LOGS[0]], []);
  assert.deepEqual(summarizeDay([copied]), {
    pain_intensity: 4,
    pain_locations: ['Neck'],
    pain_sensations: ['Tightness'],
    pain_activities: null,
    pain_notes: 'Desk day',
  });
});

test('migration 222 is additive, re-runnable and guards the backfill the same way', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/222_pain_entries.sql', import.meta.url), 'utf8');
  const code = sql.replace(/--.*$/gm, '');
  assert.match(code, /CREATE TABLE IF NOT EXISTS public\.pain_entries/);
  assert.match(code, /CREATE INDEX IF NOT EXISTS idx_pain_entries_user_occurred\s+ON public\.pain_entries \(user_id, occurred_at DESC\)/);
  assert.match(code, /CREATE UNIQUE INDEX IF NOT EXISTS pain_entries_backfill_once[\s\S]*WHERE source = 'daily_log'/);
  assert.match(code, /FOR ALL USING \(auth\.uid\(\) = user_id\) WITH CHECK \(auth\.uid\(\) = user_id\)/);
  assert.match(code, /WHERE dl\.pain_intensity IS NOT NULL\s+AND NOT EXISTS \(\s*SELECT 1 FROM public\.pain_entries pe\s+WHERE pe\.user_id = dl\.user_id AND pe\.local_date = dl\.date/);
  assert.match(code, /ON CONFLICT \(user_id, local_date\) WHERE source = 'daily_log' DO NOTHING/);
  assert.match(code, /\(dl\.date::timestamp \+ TIME '12:00'\) AT TIME ZONE 'UTC'/);
  assert.match(code, /BEGIN;[\s\S]*COMMIT;/);
  assert.doesNotMatch(code, /\bDROP\s+(TABLE|COLUMN)\b|\bRENAME\b|ALTER TABLE public\.daily_logs/i);
});

// ── Before migration 222 ────────────────────────────────────────────────────

function notMigrated(): PainDb {
  const db = new PainDb();
  db.missingTables = ['pain_entries'];
  return db;
}

test('before migration 222 a save keeps the old one-per-day record and says so', async () => {
  const db = notMigrated();
  const first = await createEntry(asDb(db), USER, entry({ intensity: 3, locations: ['Neck'] }));
  const second = await createEntry(asDb(db), USER, entry({ intensity: 5, locations: ['Left Hand'], notes: 'Later' }));
  assert.equal(first.ready, false);
  assert.equal(second.ready, false);
  if (!second.ready) assert.equal(second.notice, NOT_READY_NOTICE);
  assert.match(NOT_READY_NOTICE, /Run migration 222 first/);

  assert.equal(db.rows('daily_logs').length, 1);
  const log = dailyLog(db, USER, '2026-10-07');
  assert.equal(log?.pain_intensity, 5);
  assert.deepEqual(log?.pain_locations, ['Left Hand'], 'the old behavior: the later save replaces the day');
  assert.equal(second.value.entry?.id, `day-${log?.id}`);
});

test('before migration 222 the history lists days, and edit / clear work on them', async () => {
  const db = notMigrated();
  db.seed('daily_logs', [
    { user_id: USER, date: '2026-10-05', pain_intensity: 6, pain_locations: ['Right Foot'], pain_sensations: ['Numbness'], pain_activities: null, pain_notes: null },
    { user_id: USER, date: '2026-10-06', pain_intensity: 2, pain_locations: ['Neck'], pain_sensations: null, pain_activities: null, pain_notes: 'ok' },
    { user_id: USER, date: '2026-10-07', energy_rating: 4, pain_intensity: null },
    { user_id: OTHER, date: '2026-10-06', pain_intensity: 9, pain_locations: ['Neck'] },
  ]);
  const page = await listEntries(asDb(db), USER, {});
  assert.equal(page.ready, false);
  assert.deepEqual(page.value.entries.map((e) => [e.local_date, e.intensity]), [
    ['2026-10-06', 2],
    ['2026-10-05', 6],
  ]);
  const feet = await listEntries(asDb(db), USER, { locations: resolveLocationFilter('either:Foot') });
  assert.equal(feet.value.entries.length, 1);

  const target = page.value.entries[1];
  await updateEntry(asDb(db), USER, target.id, { intensity: 7 });
  assert.equal(dailyLog(db, USER, '2026-10-05')?.pain_intensity, 7);
  await deleteEntry(asDb(db), USER, target.id);
  assert.equal(dailyLog(db, USER, '2026-10-05')?.pain_intensity, null);

  // Someone else's day: not found.
  const theirs = db.rows('daily_logs').find((row) => row.user_id === OTHER)!;
  await assert.rejects(() => deleteEntry(asDb(db), USER, `day-${theirs.id}`), PainRuleError);
  assert.equal(theirs.pain_intensity, 9);
});
