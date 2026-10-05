// tests/unit/event-templates.test.ts
// Run: npm run test:unit
//
// Covers lib/capture/event-templates.ts: titles built for each kind read back through the real
// parser, the Google "create event" link, the .ics writer (escaping, folding, dates) read back
// through lib/calendar/ics-parser.ts, and that the files in public/templates match the generator.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCaptureTitle } from '../../lib/capture/parse-tokens.ts';
import { parseIcs } from '../../lib/calendar/ics-parser.ts';
import {
  CAPTURE_KINDS,
  EXAMPLE_EVENTS,
  EXAMPLE_PREFIX,
  SAMPLE_WEEK_START,
  addDays,
  buildCheatSheetMarkdown,
  buildEventTitle,
  buildExampleIcs,
  buildGoogleCalendarLink,
  buildIcs,
  describeCapture,
  escapeIcsText,
  eventRange,
  exampleTitle,
  foldIcsLine,
  normalizeAmount,
  normalizeDistance,
} from '../../lib/capture/event-templates.ts';

// ─── Titles ───────────────────────────────────────────────────────────────────

test('every example title, English and Spanish, parses to its kind with no warnings', () => {
  assert.deepEqual(
    EXAMPLE_EVENTS.map((e) => e.kind),
    [...CAPTURE_KINDS],
  );
  for (const example of EXAMPLE_EVENTS) {
    for (const lang of ['en', 'es'] as const) {
      const title = exampleTitle(example, lang);
      for (const t of [title, `${EXAMPLE_PREFIX} ${title}`]) {
        const parsed = parseCaptureTitle(t, { startTime: example.startTime });
        assert.equal(parsed.kind, example.kind, t);
        assert.deepEqual(parsed.warnings, [], t);
      }
    }
  }
});

test('expense title carries a $ amount the parser reads', () => {
  const title = buildEventTitle({ kind: 'expense', lang: 'en', what: 'Lunch at Corner Cafe', amount: '12,4' });
  assert.equal(title, 'Lunch at Corner Cafe #expense $12.40');
  const parsed = parseCaptureTitle(title);
  assert.equal(parsed.amountCents, 1240);
  assert.equal(parsed.vendor, 'Corner Cafe');
});

test('income in Spanish uses #ingreso', () => {
  const title = buildEventTitle({ kind: 'income', lang: 'es', what: 'Pago', amount: '$1500' });
  assert.equal(title, 'Pago #ingreso $1500.00');
  assert.equal(parseCaptureTitle(title).amountCents, 150000);
});

test('trip in km is converted to miles; mode word in Spanish is read', () => {
  const title = buildEventTitle({
    kind: 'trip',
    lang: 'es',
    what: 'Al trabajo',
    distance: '20',
    distanceUnit: 'km',
    mode: 'car',
    durationMin: 30,
  });
  assert.equal(title, 'Al trabajo #viaje 20km mode:coche 30min');
  const parsed = parseCaptureTitle(title);
  assert.equal(parsed.distanceMiles, 12.4);
  assert.equal(parsed.mode, 'car');
  assert.equal(parsed.durationMin, 30);
  assert.equal(parsed.cleanTitle, 'Al trabajo');
});

test('every trip mode written by the builder is read back, in both languages', () => {
  for (const mode of ['bike', 'car', 'bus', 'train', 'plane', 'walk', 'run', 'ferry', 'rideshare', 'other'] as const) {
    for (const lang of ['en', 'es'] as const) {
      const title = buildEventTitle({ kind: 'trip', lang, what: 'Out', distance: '3', distanceUnit: 'mi', mode });
      assert.equal(parseCaptureTitle(title).mode, mode, title);
    }
  }
});

test('meal type picked in the builder wins over the start time', () => {
  const title = buildEventTitle({ kind: 'meal', lang: 'en', what: 'Salmon', mealType: 'dinner' });
  assert.equal(title, 'Dinner Salmon #meal');
  assert.equal(parseCaptureTitle(title, { startTime: '08:00' }).mealType, 'dinner');
});

test('missing data is left out, so the parser warns instead of the builder guessing', () => {
  assert.equal(buildEventTitle({ kind: 'expense', lang: 'en', what: 'Coffee', amount: 'abc' }), 'Coffee #expense');
  assert.deepEqual(parseCaptureTitle('Coffee #expense').warnings, ['missing_amount']);
  assert.equal(buildEventTitle({ kind: 'trip', lang: 'en', what: 'Ride', distance: '' }), 'Ride #trip');
  assert.deepEqual(parseCaptureTitle('Ride #trip').warnings, ['missing_distance']);
});

test('normalizers', () => {
  assert.equal(normalizeAmount('8,50'), '8.50');
  assert.equal(normalizeAmount('$ 3'), '3.00');
  assert.equal(normalizeAmount('0'), null);
  assert.equal(normalizeAmount('1.234'), null);
  assert.equal(normalizeDistance('12,55'), '12.6');
  assert.equal(normalizeDistance('-3'), null);
});

test('describeCapture shows km with the stored miles', () => {
  const lines = describeCapture(parseCaptureTitle('Ride #trip 10km'), 'km');
  assert.ok(lines.includes('Distance: about 10 km (saved as 6.2 mi, rounded to 0.1 mi)'), lines.join('\n'));
  assert.ok(lines.includes('Mode: none in the title'));
});

// ─── Dates and the Google link ────────────────────────────────────────────────

test('eventRange rolls over midnight and the year; all-day ends the next day', () => {
  assert.deepEqual(eventRange({ date: '2026-12-31', startTime: '23:30', durationMin: 45 }), {
    start: '20261231T233000',
    end: '20270101T001500',
    allDay: false,
  });
  assert.deepEqual(eventRange({ date: '2028-02-28' }), { start: '20280228', end: '20280229', allDay: true });
  assert.equal(eventRange({ date: '2026-13-01x' }), null);
  assert.equal(addDays('2027-01-04', 4), '2027-01-08');
});

test('Google link: encoded title (# as %23), local dates, location, time zone', () => {
  const link = buildGoogleCalendarLink({
    title: 'Lunch Corner Cafe #meal',
    date: '2027-01-06',
    startTime: '12:30',
    durationMin: 45,
    location: 'Corner Cafe, Main St',
    details: 'Made with the CentenarianOS event builder',
    timeZone: 'America/Phoenix',
  });
  assert.equal(
    link,
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      '&text=Lunch%20Corner%20Cafe%20%23meal' +
      '&dates=20270106T123000/20270106T131500' +
      '&details=Made%20with%20the%20CentenarianOS%20event%20builder' +
      '&location=Corner%20Cafe%2C%20Main%20St' +
      '&ctz=America%2FPhoenix',
  );
  const url = new URL(link!);
  assert.equal(url.searchParams.get('text'), 'Lunch Corner Cafe #meal');
  assert.equal(url.hash, '');
});

test('Google link: all-day has no ctz and no empty params', () => {
  assert.equal(
    buildGoogleCalendarLink({ title: 'Trip', date: '2027-01-04', location: '  ', timeZone: 'UTC' }),
    'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Trip&dates=20270104/20270105',
  );
});

// ─── iCalendar ────────────────────────────────────────────────────────────────

test('escapeIcsText and foldIcsLine follow RFC 5545', () => {
  assert.equal(escapeIcsText('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  const long = `SUMMARY:${'é'.repeat(60)}`;
  const folded = foldIcsLine(long);
  for (const line of folded.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75);
  assert.equal(folded.replace(/\r\n /g, ''), long);
});

test('buildIcs round-trips through the app\'s own .ics parser', () => {
  const ics = buildIcs(
    [
      { uid: 'a@x', title: 'Ride #trip 12km, mode:bike', date: '2027-01-04', startTime: '07:30', durationMin: 60, location: 'Park; north gate' },
      { uid: 'b@x', title: 'Holiday', date: '2027-01-05' },
    ],
    { calendarName: 'Test', dtstamp: '20261005T000000Z' },
  );
  assert.ok(ics.endsWith('\r\n'));
  const events = parseIcs(ics);
  assert.equal(events.length, 2);
  assert.equal(events[0].summary, 'Ride #trip 12km, mode:bike');
  assert.equal(events[0].dtstart, '2027-01-04');
  assert.equal(events[0].dtstart_time, '07:30');
  assert.equal(events[0].location, 'Park; north gate');
  assert.equal(events[1].is_all_day, true);
});

test('example .ics: one English and one Spanish event per kind, titled "Example: …", in the sample week', () => {
  const events = parseIcs(buildExampleIcs(SAMPLE_WEEK_START));
  assert.equal(events.length, EXAMPLE_EVENTS.length * 2);
  for (const event of events) {
    assert.ok(event.summary.startsWith(`${EXAMPLE_PREFIX} `), event.summary);
    assert.ok(event.dtstart >= SAMPLE_WEEK_START && event.dtstart <= addDays(SAMPLE_WEEK_START, 6));
  }
  assert.equal(new Set(events.map((e) => e.uid)).size, events.length);
});

// ─── Generated files stay in sync ─────────────────────────────────────────────

const templates = join(import.meta.dirname, '..', '..', 'public', 'templates');
const regenerate = 'run: node --experimental-strip-types scripts/generate-calendar-event-templates.ts';

test('public/templates/calendar-event-examples.ics matches the generator', () => {
  assert.equal(readFileSync(join(templates, 'calendar-event-examples.ics'), 'utf8'), buildExampleIcs(SAMPLE_WEEK_START), regenerate);
});

test('public/templates/calendar-event-cheat-sheet.md matches the generator and lists every example', () => {
  const sheet = readFileSync(join(templates, 'calendar-event-cheat-sheet.md'), 'utf8');
  assert.equal(sheet, buildCheatSheetMarkdown(), regenerate);
  for (const example of EXAMPLE_EVENTS) {
    assert.ok(sheet.includes(exampleTitle(example, 'en')));
    assert.ok(sheet.includes(exampleTitle(example, 'es')));
  }
  assert.match(sheet, /not built yet/);
});
