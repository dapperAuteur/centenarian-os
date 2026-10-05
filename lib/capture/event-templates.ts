// lib/capture/event-templates.ts
// Helpers for writing Google Calendar events that CentenarianOS can read (the event builder at
// /dashboard/settings/calendar/event-builder, the example .ics file and the cheat sheet):
//
//   buildEventTitle(draft)        a title in the capture-token grammar of lib/capture/parse-tokens.ts
//   describeCapture(parsed, unit) what the sync reads out of a title, as short lines for people
//   buildGoogleCalendarLink(ev)   a "create event" link that opens Google Calendar prefilled
//   buildIcs(events, base)        an iCalendar (RFC 5545) file of example events
//   EXAMPLE_EVENTS                one example per kind, English and Spanish
//
// Pure: no I/O, no clock, no user settings (tests/unit/event-templates.test.ts). The imports keep
// their ".ts" extension because this file also runs under `node --test --experimental-strip-types`.
//
// What the sync does with a title TODAY (lib/calendar/google-sync.ts, phase 4.2): every event
// becomes a planner task named after the title without its tokens, and the parsed data is stored
// on the sync row. Expense, income, trip, meal and workout RECORDS are not created yet (plan 59,
// phase 4.4). Copy built from these helpers must say so.

import type { ParsedCapture } from './parse-tokens.ts';
import {
  DISTANCE_UNITS,
  MEAL_WORDS,
  MODE_WORDS,
  TOKEN_ALIASES,
  TRIP_DURATION_UNITS,
  TRIP_MODES,
  type CaptureKind,
  type MealType,
  type TripMode,
} from './tokens.ts';

export type DistanceUnit = 'mi' | 'km';
export type TitleLanguage = 'en' | 'es';

/** Same factor as lib/capture/tokens.ts and kmToMiles() in lib/geo/distance.ts. */
const MILES_PER_KM = 0.621371;

export const CAPTURE_KINDS: readonly CaptureKind[] = ['expense', 'income', 'trip', 'meal', 'workout', 'task'];

export const KIND_LABELS: Record<CaptureKind, string> = {
  expense: 'Expense',
  income: 'Income',
  trip: 'Trip',
  meal: 'Meal',
  workout: 'Workout',
  task: 'Task',
};

/** The `#tag` written for each kind: TOKEN_ALIASES[kind][0] is English, [1] Spanish. */
export function kindTag(kind: CaptureKind, lang: TitleLanguage): string {
  const aliases = TOKEN_ALIASES[kind];
  return `#${lang === 'es' && aliases[1] ? aliases[1] : aliases[0]}`;
}

/** The word written after `mode:`. Every value here is a MODE_WORDS key or a TRIP_MODES value. */
const MODE_TITLE_WORD: Record<TitleLanguage, Partial<Record<TripMode, string>>> = {
  en: {},
  es: { car: 'coche', bike: 'bici', walk: 'caminar', run: 'correr', plane: 'avion', train: 'tren' },
};

export function modeWord(mode: TripMode, lang: TitleLanguage): string {
  return MODE_TITLE_WORD[lang][mode] ?? mode;
}

/** Every value here is a MEAL_WORDS key. */
const MEAL_TITLE_WORD: Record<TitleLanguage, Record<MealType, string>> = {
  en: { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' },
  es: { breakfast: 'Desayuno', lunch: 'Almuerzo', dinner: 'Cena', snack: 'Merienda' },
};

export function mealWord(meal: MealType, lang: TitleLanguage): string {
  return MEAL_TITLE_WORD[lang][meal];
}

export interface EventDraft {
  kind: CaptureKind;
  lang: TitleLanguage;
  /** The words of the title: the vendor, the payer, where to, what you ate or did. */
  what: string;
  /** Expense and income, in the account's currency, as typed ("12.40", "12,40"). */
  amount?: string;
  /** Trips, as typed. */
  distance?: string;
  distanceUnit?: DistanceUnit;
  /** Trips. Left out: only a bare mode word in `what` ("Drive to Tucson") names the mode. */
  mode?: TripMode;
  /** Meals. Left out: the event's start time decides. */
  mealType?: MealType;
  /** Written into the title when set ("45min"). */
  durationMin?: number;
}

/** "12.4", "12,40", "$12.40" -> "12.40"; null when it is not a positive amount. */
export function normalizeAmount(value: string | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/^\$\s*/, '');
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(cleaned)) return null;
  const number = Number(cleaned.replace(',', '.'));
  return number > 0 ? number.toFixed(2) : null;
}

/** "12.5", "12,5" -> "12.5"; null when it is not a positive number. Trailing zeros are dropped. */
export function normalizeDistance(value: string | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(cleaned)) return null;
  const number = Number(cleaned.replace(',', '.'));
  return number > 0 ? String(Math.round(number * 10) / 10) : null;
}

/** "45min", "90min"; "" for no duration. Never a bare "m": on a trip that means meters. */
export function durationText(minutes: number | undefined): string {
  if (minutes === undefined || !Number.isFinite(minutes) || minutes <= 0) return '';
  return `${Math.round(minutes)}min`;
}

/**
 * A title in the capture-token grammar. Missing data is left out (the live preview then shows
 * the parser's warning), so the builder never invents an amount or a distance.
 *   expense  "Groceries Corner Market #expense $42.18"
 *   income   "Client payment Acme Studio #income $1500.00"
 *   trip     "To the trailhead #trip 7.8mi mode:bike 45min"
 *   meal     "Lunch Corner Cafe #meal"
 *   workout  "Strength session #workout 45min"
 *   task     "Call the plumber #task"
 */
export function buildEventTitle(draft: EventDraft): string {
  const parts: string[] = [];
  const what = draft.what.trim().replace(/\s+/g, ' ');

  if (draft.kind === 'meal' && draft.mealType) parts.push(mealWord(draft.mealType, draft.lang));
  if (what) parts.push(what);
  parts.push(kindTag(draft.kind, draft.lang));

  if (draft.kind === 'expense' || draft.kind === 'income') {
    const amount = normalizeAmount(draft.amount);
    if (amount) parts.push(`$${amount}`);
  }
  if (draft.kind === 'trip') {
    const distance = normalizeDistance(draft.distance);
    if (distance) parts.push(`${distance}${draft.distanceUnit ?? 'mi'}`);
    if (draft.mode) parts.push(`mode:${modeWord(draft.mode, draft.lang)}`);
  }
  const duration = durationText(draft.durationMin);
  if (duration) parts.push(duration);

  return parts.join(' ');
}

// ── What the sync reads ─────────────────────────────────────────────────────────

const WARNING_LINES: Record<string, string> = {
  missing_amount: 'No amount found. Add one such as $12.40.',
  missing_distance: 'No distance found. Add one such as 12mi or 20km.',
  multiple_kinds: 'More than one kind tag. Only the first one counts.',
  unknown_token: 'A #word CentenarianOS does not know. It is removed from the task name and otherwise ignored.',
};

export function warningLine(warning: string): string {
  return WARNING_LINES[warning] ?? warning;
}

const MODE_LABELS: Record<TripMode, string> = {
  bike: 'bike',
  car: 'car',
  bus: 'bus',
  train: 'train',
  plane: 'plane',
  walk: 'walk',
  run: 'run',
  ferry: 'ferry',
  rideshare: 'rideshare',
  other: 'other',
};

function formatMiles(miles: number, unit: DistanceUnit): string {
  if (unit === 'km') {
    const km = Math.round((miles / MILES_PER_KM) * 10) / 10;
    return `about ${km} km (saved as ${miles} mi, rounded to 0.1 mi)`;
  }
  return `${miles} mi`;
}

/**
 * What the sync reads out of a parsed title, one short line per fact, for the live preview and
 * the help copy. `unit` only changes how a distance is shown; the parser always stores miles.
 */
export function describeCapture(parsed: ParsedCapture, unit: DistanceUnit = 'mi'): string[] {
  const lines: string[] = [`Kind: ${KIND_LABELS[parsed.kind].toLowerCase()}`];
  lines.push(`Planner task name: ${parsed.cleanTitle || '(the full title)'}`);
  if (parsed.amountCents !== undefined) lines.push(`Amount: ${(parsed.amountCents / 100).toFixed(2)}`);
  if (parsed.vendor) lines.push(`${parsed.kind === 'income' ? 'From' : 'Vendor'}: ${parsed.vendor}`);
  if (parsed.distanceMiles !== undefined) lines.push(`Distance: ${formatMiles(parsed.distanceMiles, unit)}`);
  if (parsed.kind === 'trip') {
    lines.push(`Mode: ${parsed.mode ? MODE_LABELS[parsed.mode] : 'none in the title'}`);
  }
  if (parsed.mealType) lines.push(`Meal: ${parsed.mealType}`);
  if (parsed.durationMin !== undefined) lines.push(`Duration: ${parsed.durationMin} min`);
  if (parsed.extraTags.length > 0) lines.push(`Ignored tags: ${parsed.extraTags.map((t) => `#${t}`).join(' ')}`);
  return lines;
}

// ── Dates ───────────────────────────────────────────────────────────────────────

export interface EventTiming {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24-hour. Left out for an all-day event. */
  startTime?: string;
  /** Length of a timed event, in minutes (default 30). */
  durationMin?: number;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

/** Wall-clock arithmetic without time zones: Date.UTC is only used as a calendar. */
function wallClock(date: string, time: string | undefined, plusMinutes: number): Date | null {
  const d = DATE_RE.exec(date);
  if (!d) return null;
  const t = time ? TIME_RE.exec(time) : ['', '00', '00'];
  if (!t) return null;
  const ms = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2])) + plusMinutes * 60_000;
  return Number.isNaN(ms) ? null : new Date(ms);
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const hms = (d: Date) => `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00`;

/** YYYY-MM-DD plus `days`. */
export function addDays(date: string, days: number): string {
  const d = wallClock(date, undefined, days * 24 * 60);
  if (!d) return date;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Start and end as local (floating) date-times, "YYYYMMDDTHHMMSS", or for an all-day event the
 * date and the day after, "YYYYMMDD". The end date of an all-day event is exclusive in both
 * iCalendar (RFC 5545, DTEND) and Google's link format.
 */
export function eventRange(timing: EventTiming): { start: string; end: string; allDay: boolean } | null {
  if (!timing.startTime) {
    const start = wallClock(timing.date, undefined, 0);
    const end = wallClock(timing.date, undefined, 24 * 60);
    return start && end ? { start: ymd(start), end: ymd(end), allDay: true } : null;
  }
  const minutes = timing.durationMin && timing.durationMin > 0 ? Math.round(timing.durationMin) : 30;
  const start = wallClock(timing.date, timing.startTime, 0);
  const end = wallClock(timing.date, timing.startTime, minutes);
  return start && end ? { start: `${ymd(start)}T${hms(start)}`, end: `${ymd(end)}T${hms(end)}`, allDay: false } : null;
}

// ── Google Calendar "create event" link ─────────────────────────────────────────

/**
 * Google's prefilled "create event" link. Google does not publish a reference for this URL; the
 * parameters below follow the community reference at
 * https://github.com/InteractionDesignFoundation/add-event-to-calendar-docs/blob/master/services/google.md
 * (base https://calendar.google.com/calendar/render, action=TEMPLATE, text, dates, details,
 * location, ctz; dates as local "YYYYMMDDTHHMMSS/YYYYMMDDTHHMMSS", or "YYYYMMDD/YYYYMMDD" for an
 * all-day event with the end day exclusive). The builder labels the button as unofficial.
 */
export const GOOGLE_EVENT_TEMPLATE_URL = 'https://calendar.google.com/calendar/render';

export interface LinkEvent extends EventTiming {
  title: string;
  details?: string;
  location?: string;
  /** IANA time zone the local times are in (e.g. the browser's). Left out: the user's Google time zone. */
  timeZone?: string;
}

export function buildGoogleCalendarLink(event: LinkEvent): string | null {
  const range = eventRange(event);
  if (!range) return null;
  // encodeURIComponent, not URLSearchParams: a "#" in the title must become %23, and spaces %20.
  const params: [string, string][] = [
    ['action', 'TEMPLATE'],
    ['text', event.title],
    ['dates', `${range.start}/${range.end}`],
  ];
  if (event.details?.trim()) params.push(['details', event.details.trim()]);
  if (event.location?.trim()) params.push(['location', event.location.trim()]);
  if (event.timeZone && !range.allDay) params.push(['ctz', event.timeZone]);
  // The "/" between start and end is left as written, as in the reference's examples.
  const query = params
    .map(([k, v]) => `${k}=${k === 'dates' ? v.split('/').map(encodeURIComponent).join('/') : encodeURIComponent(v)}`)
    .join('&');
  return `${GOOGLE_EVENT_TEMPLATE_URL}?${query}`;
}

// ── Examples ────────────────────────────────────────────────────────────────────

export interface ExampleEvent {
  kind: CaptureKind;
  /** Days after the sample week's Monday. */
  dayOffset: number;
  startTime: string;
  durationMin: number;
  en: EventDraft;
  es: EventDraft;
  location?: string;
  /** Why this title works, for the cheat sheet and the .ics description. */
  note: string;
}

export const EXAMPLE_EVENTS: readonly ExampleEvent[] = [
  {
    kind: 'expense',
    dayOffset: 0,
    startTime: '10:00',
    durationMin: 30,
    en: { kind: 'expense', lang: 'en', what: 'Groceries Corner Market', amount: '42.18' },
    es: { kind: 'expense', lang: 'es', what: 'Compras Mercado Central', amount: '42.18' },
    location: 'Corner Market',
    note: 'An expense needs an amount. Write it with a $ sign so no other number is mistaken for it.',
  },
  {
    kind: 'income',
    dayOffset: 0,
    startTime: '15:00',
    durationMin: 30,
    en: { kind: 'income', lang: 'en', what: 'Client payment Acme Studio', amount: '1500' },
    es: { kind: 'income', lang: 'es', what: 'Pago de cliente Acme Studio', amount: '1500' },
    note: 'Income works like an expense: the words are who paid, the $ amount is how much.',
  },
  {
    kind: 'trip',
    dayOffset: 1,
    startTime: '07:30',
    durationMin: 45,
    en: { kind: 'trip', lang: 'en', what: 'To the trailhead', distance: '7.8', distanceUnit: 'mi', mode: 'bike' },
    es: { kind: 'trip', lang: 'es', what: 'Al parque', distance: '12.5', distanceUnit: 'km', mode: 'bike' },
    location: 'Riverside Trailhead',
    note: 'A trip needs a distance in mi or km (km is converted to miles). mode: is optional; without it a word like Drive or bici in the title counts.',
  },
  {
    kind: 'meal',
    dayOffset: 2,
    startTime: '12:30',
    durationMin: 45,
    en: { kind: 'meal', lang: 'en', what: 'Corner Cafe', mealType: 'lunch' },
    es: { kind: 'meal', lang: 'es', what: 'Café de la Esquina', mealType: 'lunch' },
    location: 'Corner Cafe',
    note: 'Lunch, Dinner, Almuerzo, Cena and the like set the meal. Without one, the start time decides.',
  },
  {
    kind: 'workout',
    dayOffset: 3,
    startTime: '18:00',
    durationMin: 45,
    en: { kind: 'workout', lang: 'en', what: 'Strength session', durationMin: 45 },
    es: { kind: 'workout', lang: 'es', what: 'Sesión de fuerza', durationMin: 45 },
    location: 'Neighborhood gym',
    note: 'A duration such as 45min or 1h is read from the title, not from the event length.',
  },
  {
    kind: 'task',
    dayOffset: 4,
    startTime: '09:00',
    durationMin: 30,
    en: { kind: 'task', lang: 'en', what: 'Call the plumber' },
    es: { kind: 'task', lang: 'es', what: 'Llamar al plomero' },
    note: '#task is optional: an event without any kind tag already becomes a planner task.',
  },
];

/**
 * Monday of the week the static example file (public/templates/calendar-event-examples.ics) is
 * dated in. The sync only reads 30 days back to 180 days ahead, so the builder page also offers
 * a download dated from the coming Monday.
 */
export const SAMPLE_WEEK_START = '2027-01-04';

export function exampleTitle(example: ExampleEvent, lang: TitleLanguage): string {
  return buildEventTitle(lang === 'es' ? example.es : example.en);
}

// ── iCalendar ───────────────────────────────────────────────────────────────────

/** RFC 5545 §3.3.11 TEXT escaping. */
export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** RFC 5545 §3.1: lines longer than 75 octets are folded with CRLF + a space. */
export function foldIcsLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Never split a UTF-8 sequence: back up while the next byte is a continuation byte.
    while (end < bytes.length && end > start && (bytes[end] & 0xc0) === 0x80) end -= 1;
    chunks.push(decoder.decode(bytes.slice(start, end)));
    start = end;
    limit = 74; // a continuation line starts with one space
  }
  return chunks.join('\r\n ');
}

export interface IcsEvent extends EventTiming {
  uid: string;
  title: string;
  description?: string;
  location?: string;
}

/**
 * An iCalendar file. Times are floating (no TZID), so each event lands at the same clock time in
 * whatever time zone the importing calendar uses. DTSTAMP must be UTC; it is passed in so the
 * output is reproducible.
 */
export function buildIcs(events: readonly IcsEvent[], opts: { calendarName: string; dtstamp: string }): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CentenarianOS//Calendar event examples//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(opts.calendarName)}`,
  ];
  for (const event of events) {
    const range = eventRange(event);
    if (!range) continue;
    lines.push('BEGIN:VEVENT', `UID:${event.uid}`, `DTSTAMP:${opts.dtstamp}`);
    if (range.allDay) lines.push(`DTSTART;VALUE=DATE:${range.start}`, `DTEND;VALUE=DATE:${range.end}`);
    else lines.push(`DTSTART:${range.start}`, `DTEND:${range.end}`);
    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

/** Fixed DTSTAMP for the example file, so regenerating it gives the same bytes. */
export const EXAMPLE_DTSTAMP = '20261005T000000Z';

/** Prefix of every example event title, so the examples are easy to spot and delete. */
export const EXAMPLE_PREFIX = 'Example:';

/**
 * The example events as an .ics file: an English and a Spanish version of each example, the
 * Spanish one an hour later. Titles start with "Example:" (the parser keeps that word in the
 * task name, so the tokens still work).
 */
export function buildExampleIcs(weekStart: string, dtstamp: string = EXAMPLE_DTSTAMP): string {
  const events: IcsEvent[] = [];
  for (const example of EXAMPLE_EVENTS) {
    for (const lang of ['en', 'es'] as const) {
      const [h, m] = example.startTime.split(':').map(Number);
      const startTime = lang === 'es' ? `${pad((h + 1) % 24)}:${pad(m)}` : example.startTime;
      events.push({
        uid: `example-${example.kind}-${lang}-${weekStart}@centenarianos.com`,
        title: `${EXAMPLE_PREFIX} ${exampleTitle(example, lang)}`,
        date: addDays(weekStart, example.dayOffset),
        startTime,
        durationMin: example.durationMin,
        location: example.location,
        description: `${EXAMPLE_PREFIX} ${KIND_LABELS[example.kind]} (${lang === 'es' ? 'Spanish' : 'English'}). ${example.note} Delete this event when you are done testing.`,
      });
    }
  }
  return buildIcs(events, { calendarName: 'CentenarianOS examples', dtstamp });
}

// ── Cheat sheet ─────────────────────────────────────────────────────────────────

const codeList = (list: readonly string[]) => list.map((w) => `\`${w}\``).join(', ');

const KIND_NEEDS: Record<CaptureKind, string> = {
  expense: 'an amount: `$12.40`, `12.40`, `12,40`',
  income: 'an amount, as for an expense',
  trip: 'a distance: `115mi`, `12.5 km`; optional `mode:bike`',
  meal: 'nothing; a meal word or the start time sets the meal',
  workout: 'nothing; add a duration such as `45min`',
  task: 'nothing; a title with no tag is a task too',
};

const SHEET_WARNINGS = ['missing_amount', 'missing_distance', 'multiple_kinds', 'unknown_token'] as const;

/**
 * The one-page cheat sheet (public/templates/calendar-event-cheat-sheet.md), built from the same
 * examples and word lists the parser uses, so it cannot drift from what the sync reads
 * (tests/unit/event-templates.test.ts compares the file with this output).
 */
export function buildCheatSheetMarkdown(): string {
  const out: string[] = [
    '# Calendar event cheat sheet: titles CentenarianOS can read',
    '',
    'Add a `#tag` and a few details to a Google Calendar event title. When the event syncs into CentenarianOS ' +
      '(Settings > Calendar Sync), the title is read. English and Spanish words both work, whatever your language setting.',
    '',
    '**What happens today:** every synced event becomes a planner task named after the title without its tags. ' +
      'The details (amount, distance, mode, meal, duration) are read and saved with the synced event. ' +
      'Turning them into an expense, income, trip, meal or workout record is coming; it is not built yet.',
    '',
    '## Copy-paste titles',
    '',
    '| Kind | English | Spanish |',
    '|---|---|---|',
  ];
  for (const example of EXAMPLE_EVENTS) {
    out.push(`| ${KIND_LABELS[example.kind]} | \`${exampleTitle(example, 'en')}\` | \`${exampleTitle(example, 'es')}\` |`);
  }
  out.push('', '## The tags', '', '| Kind | Tags | Needs |', '|---|---|---|');
  for (const kind of CAPTURE_KINDS) {
    out.push(`| ${KIND_LABELS[kind]} | ${codeList(TOKEN_ALIASES[kind].map((a) => `#${a}`))} | ${KIND_NEEDS[kind]} |`);
  }
  out.push(
    '',
    '## Details',
    '',
    '- **Amount** (expense, income): a `$` amount wins. Without `$`, a number with cents counts; a whole number counts only when it is the only number in the title, and never one that looks like a year (1900-2100). The `$` is only a marker: the amount is not converted between currencies.',
    `- **Distance** (trips): a number with ${codeList(Object.keys(DISTANCE_UNITS))}. Write it attached (\`12km\`) or with a space (\`12 km\`). Kilometers are converted to miles and stored rounded to 0.1 mi.`,
    `- **Mode** (trips): \`mode:word\` with one of ${codeList(Object.keys(MODE_WORDS))}, or one of ${codeList(TRIP_MODES)}. Without \`mode:\`, one of the words in the first list anywhere in the title counts ("Drive to Tucson"); with neither, the title names no mode.`,
    `- **Meal** (meals): ${codeList(Object.keys(MEAL_WORDS))}, as a word in the title or as a tag (\`#lunch\`). Without one, the start time decides: 05:00-10:29 breakfast, 10:30-14:29 lunch, 17:00-21:29 dinner, any other time snack.`,
    `- **Duration** (any tagged title): a number with ${codeList(Object.keys(TRIP_DURATION_UNITS))}, for example \`45min\`, \`1h\`, \`1h 30min\`. A bare \`m\` (\`90m\`) works too, except on trips, where it would mean meters.`,
    '- **Other `#words`** are removed from the task name and flagged as unknown. A title with two different kind tags uses the first one.',
    '',
    '## Location',
    '',
    "Put the place in the event's Location field, not in the title. Today CentenarianOS adds it to the planner task's description. " +
      'Proposed, not built: RideWitUS will use event locations to suggest trips to and from your activities, ' +
      'only for calendars you choose to share with it.',
    '',
    '## When a title is flagged',
    '',
    'The task is still created. Its description says what to check, and the account card on Settings > Calendar Sync counts it as flagged.',
    '',
  );
  for (const warning of SHEET_WARNINGS) out.push(`- ${warningLine(warning)}`);
  out.push(
    '',
    'Build and check a title, or open it straight in Google Calendar: Settings > Calendar Sync > Event builder (/dashboard/settings/calendar/event-builder).',
    '',
  );
  return out.join('\n');
}
