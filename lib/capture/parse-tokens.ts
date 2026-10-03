// lib/capture/parse-tokens.ts
// Reads "capture tokens" out of a calendar event title, so the Google Calendar
// sync (and, later, the quick-add field) can turn one line of text into a record:
//
//   "Lunch Chipotle #expense $12.40"  → an expense of 12.40 at Chipotle
//   "Drive to Tucson #trip 115mi"     → a car trip of 115 miles
//   "Dinner salmon #meal"             → a dinner meal log
//   "Call the plumber"                → a plain planner task
//
// Pure: no I/O, no clock, no user settings (tests/unit/parse-tokens.test.ts).
// It never throws. Data it cannot find is reported in `warnings` and the caller
// decides what to do with it (the sync still creates the task and flags it).
//
// Grammar, read one whitespace-separated word at a time. Every #word leaves the title.
//   #kind      A kind tag (TOKEN_ALIASES). The first one sets the kind; a second,
//              different kind is reported as multiple_kinds.
//   #meal word A meal tag (#lunch, #cena) adds the meal type. With no kind tag
//              anywhere in the title it also makes the title a meal.
//   #other     Any other #word goes to extraTags and is reported as
//              unknown_token. "#42" is not a tag.
//   amount     Expense and income only: "$12.40", "12.40", "8,50", "$1,200". A
//              whole number without "$" counts only when it is the one number left.
//   distance   Trips only: "115mi", "115 miles", "185km", "12.5 mi".
//   duration   Any tagged title: "45min", "1h", "1.5h", "45 min", and "90m"
//              except on trips, where a bare "m" would be meters.
//   mode:word  Trips only. Without it, a bare mode word ("Drive", "bici") counts.
//   meal word  Meals only: "Dinner", "almuerzo". Without one, the start time decides.
// A title with no recognized tag is a task, and nothing but its #words is read.
//
// The import below keeps its ".ts" extension because this file also runs under
// `node --test --experimental-strip-types`, which does not guess extensions.
// tsconfig.json permits it with allowImportingTsExtensions.

import {
  DISTANCE_UNITS,
  DURATION_UNITS,
  MEAL_TIME_WINDOWS,
  MEAL_WORDS,
  MODE_WORDS,
  TOKEN_ALIASES,
  TRIP_DURATION_UNITS,
  TRIP_MODES,
  VENDOR_CONNECTORS,
  type CaptureKind,
  type MealType,
  type TripMode,
} from './tokens.ts';

export type CaptureWarning =
  | 'missing_amount'
  | 'missing_distance'
  | 'multiple_kinds'
  | 'unknown_token';

export interface ParsedCapture {
  kind: CaptureKind;
  /** The title without its tags, amount, distance, duration and `mode:word`. */
  cleanTitle: string;
  /** Expense and income. */
  amountCents?: number;
  /**
   * Expense and income: cleanTitle without a leading meal word and the
   * connector after it ("Lunch at Chipotle" → "Chipotle").
   */
  vendor?: string;
  /** Trips: miles, rounded to 1 decimal. Kilometers are converted. */
  distanceMiles?: number;
  /** Trips. Undefined when the title names no mode: the caller applies the user's default. */
  mode?: TripMode;
  /**
   * Meals: from a meal tag, else a bare meal word, else the start time.
   * Other kinds: only from a meal tag ("Chipotle #expense $12.40 #lunch").
   */
  mealType?: MealType;
  /** Any tagged title. */
  durationMin?: number;
  /** The unknown #words, lowercased and without the "#", each once, in title order. */
  extraTags: string[];
  /** Each warning at most once, in the order of the CaptureWarning union. */
  warnings: CaptureWarning[];
}

export interface ParseCaptureOptions {
  /** The event's local start time, 'HH:MM'. Only used to pick a meal type. */
  startTime?: string;
}

const WARNING_ORDER: readonly CaptureWarning[] = [
  'missing_amount',
  'missing_distance',
  'multiple_kinds',
  'unknown_token',
];

const KIND_BY_ALIAS = new Map<string, CaptureKind>();
for (const kind of Object.keys(TOKEN_ALIASES) as CaptureKind[]) {
  for (const alias of TOKEN_ALIASES[kind]) KIND_BY_ALIAS.set(alias, kind);
}

// "#expense", "#Gasto," but not "#42" or "C#".
const TAG = /^#\p{L}/u;

// "12", "12.40", "8,50", "1,200", "1.200,50". A separator followed by exactly
// three digits groups thousands; a last group of any other length is decimals.
const NUMBER = /^(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,](\d+))?$/;

// Four plain digits from 1900 to 2100: "Taxes 2024" names a year, not an amount.
const YEAR_LIKE = /^(?:19\d\d|20\d\d|2100)$/;

interface AmountCandidate {
  cents: number;
  /** First and last word of the amount: they differ for "$ 12.40". */
  from: number;
  to: number;
}

/** Own-property lookup, so a title word like "constructor" never matches Object.prototype. */
function lookup<T>(table: Record<string, T>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

/**
 * A word lowercased, without the punctuation a sentence wraps around it:
 * "Lunch," → "lunch", "($12.40)" → "$12.40". "20%" and "12:30" keep their
 * signs, so they are not mistaken for plain numbers.
 */
function core(word: string): string {
  return word
    .normalize('NFC')
    .toLowerCase()
    .replace(/^[(["'“‘¿¡]+|[)\]"'”’.,;:!?]+$/g, '');
}

function readNumber(text: string): { value: number; decimals: number } | null {
  const match = NUMBER.exec(text);
  if (!match) return null;
  const whole = match[1].replace(/[.,]/g, '');
  const fraction = match[2] ?? '';
  return { value: Number(`${whole}.${fraction || '0'}`), decimals: fraction.length };
}

/**
 * A number with a unit starting at `words[i]`: one word ("115mi") or two
 * ("115 miles"). A one-letter unit must be attached ("90m", "1h"), so that
 * "2 m of cable" is not read as two minutes.
 */
function quantityAt(
  words: string[],
  used: boolean[],
  i: number,
  units: Record<string, number>,
): { amount: number; span: number } | null {
  if (used[i]) return null;
  const word = core(words[i]);

  const attached = /^([\d.,]+)(\p{L}+)$/u.exec(word);
  if (attached) {
    const number = readNumber(attached[1]);
    const perUnit = lookup(units, attached[2]);
    return number && perUnit !== undefined ? { amount: number.value * perUnit, span: 1 } : null;
  }

  const number = readNumber(word);
  const next = i + 1 < words.length && !used[i + 1] ? core(words[i + 1]) : '';
  const perUnit = next.length > 1 ? lookup(units, next) : undefined;
  return number && perUnit !== undefined ? { amount: number.value * perUnit, span: 2 } : null;
}

/**
 * Takes the first quantity measured in `units`, plus any that follow it
 * directly ("1h 30m"), marks those words used and returns the total.
 */
function takeQuantity(
  words: string[],
  used: boolean[],
  units: Record<string, number>,
): number | undefined {
  let total: number | undefined;
  let i = 0;
  while (i < words.length) {
    const found = quantityAt(words, used, i, units);
    if (!found) {
      if (total !== undefined) break;
      i += 1;
      continue;
    }
    total = (total ?? 0) + found.amount;
    for (let j = i; j < i + found.span; j++) used[j] = true;
    i += found.span;
  }
  return total;
}

/**
 * Takes the amount, in cents, and marks its words used. It does not guess from
 * stray numbers:
 *   1. a "$" amount wins ("$12", "$ 12.40");
 *   2. else a number with decimals ("12.40", "8,50");
 *   3. else a whole number, but only when it is the one number left in the
 *      title and does not look like a year. "Lunch #expense 12" is 12.00;
 *      "12 lunch for 2" and "Taxes 2024" have no amount.
 * Within rule 1 or 2 the later number wins.
 */
function takeAmount(words: string[], used: boolean[]): number | undefined {
  let dollar: AmountCandidate | undefined;
  let decimal: AmountCandidate | undefined;
  let whole: AmountCandidate | undefined;
  let numbers = 0;

  for (let i = 0; i < words.length; i++) {
    if (used[i]) continue;
    const word = core(words[i]);
    const signed = word.startsWith('$');
    const digits = signed ? word.slice(1) : word;
    const number = readNumber(digits);
    if (!number) continue;
    numbers += 1;
    if (number.decimals > 2) continue;

    // "$ 12.40": the sign typed as its own word.
    const loneSign = i > 0 && !used[i - 1] && words[i - 1] === '$';
    const candidate = {
      cents: Math.round(number.value * 100),
      from: loneSign ? i - 1 : i,
      to: i,
    };
    if (signed || loneSign) dollar = candidate;
    else if (number.decimals > 0) decimal = candidate;
    else if (!YEAR_LIKE.test(digits)) whole = candidate;
  }

  const amount = dollar ?? decimal ?? (numbers === 1 ? whole : undefined);
  if (!amount) return undefined;
  for (let i = amount.from; i <= amount.to; i++) used[i] = true;
  return amount.cents;
}

/** The first word of `words` found in `table`. */
function firstWord<T>(words: string[], table: Record<string, T>): T | undefined {
  for (const word of words) {
    const hit = lookup(table, core(word));
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/** The value of `mode:word`: a MODE_WORDS word or a TRIP_MODES value. */
function explicitMode(word: string): TripMode | undefined {
  const match = /^mode:(\p{L}+)$/u.exec(core(word));
  if (!match) return undefined;
  return lookup(MODE_WORDS, match[1]) ?? TRIP_MODES.find((mode) => mode === match[1]);
}

function mealTypeAt(startTime: string | undefined): MealType | undefined {
  const match = typeof startTime === 'string' ? /^(\d{1,2}):(\d{2})/.exec(startTime.trim()) : null;
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  const at = hours * 60 + minutes;
  const slot = MEAL_TIME_WINDOWS.find((w) => at >= w.from && at < w.to);
  return slot ? slot.mealType : 'snack';
}

/**
 * cleanTitle without one leading meal word and the connector after it:
 * "Lunch Chipotle", "Lunch at Chipotle" and "Lunch @Chipotle" → "Chipotle".
 * Undefined when nothing is left.
 */
function vendorFrom(cleanTitle: string): string | undefined {
  const words = cleanTitle.split(' ');
  if (lookup(MEAL_WORDS, core(words[0])) !== undefined) {
    words.shift();
    if (words.length > 0 && VENDOR_CONNECTORS.includes(core(words[0]))) words.shift();
    else if (words.length > 0 && /^@./.test(words[0])) words[0] = words[0].slice(1);
  }
  return words.join(' ') || undefined;
}

export function parseCaptureTitle(title: string, opts?: ParseCaptureOptions): ParsedCapture {
  // Google sends no summary for an untitled event, so tolerate a non-string at runtime.
  const text = typeof title === 'string' ? title.trim() : '';
  const words = text ? text.split(/\s+/) : [];
  const warnings = new Set<CaptureWarning>();
  const listWarnings = () => WARNING_ORDER.filter((warning) => warnings.has(warning));

  // Pass 1: the #tags. They all leave the title; `rest` is what remains.
  let kind: CaptureKind | undefined;
  let taggedMeal: MealType | undefined;
  const extraTags: string[] = [];
  const rest: string[] = [];
  for (const word of words) {
    if (!TAG.test(word)) {
      rest.push(word);
      continue;
    }
    const name = core(word.slice(1));
    const tagKind = KIND_BY_ALIAS.get(name);
    const meal = lookup(MEAL_WORDS, name);
    if (tagKind) {
      if (kind === undefined) kind = tagKind;
      else if (tagKind !== kind) warnings.add('multiple_kinds');
    } else if (meal) {
      // A meal tag (#lunch) is a modifier: it adds the meal type. It only decides
      // the kind when no real kind tag is present, wherever it sits in the title.
      if (!taggedMeal) taggedMeal = meal;
    } else {
      warnings.add('unknown_token');
      if (!extraTags.includes(name)) extraTags.push(name);
    }
  }
  if (kind === undefined && taggedMeal) kind = 'meal';

  // No recognized tag: a plain task. Nothing else is read out of the title, and
  // without any #word at all it comes back exactly as typed.
  if (kind === undefined) {
    return {
      kind: 'task',
      cleanTitle: extraTags.length > 0 ? rest.join(' ') : text,
      extraTags,
      warnings: listWarnings(),
    };
  }

  // Pass 2: the data that belongs to the kind. `used` marks the words it consumes.
  const parsed: ParsedCapture = { kind, cleanTitle: '', extraTags, warnings: [] };
  const used = rest.map(() => false);

  if (kind === 'trip') {
    for (let i = 0; i < rest.length; i++) {
      const mode = explicitMode(rest[i]);
      if (!mode) continue;
      used[i] = true;
      if (!parsed.mode) parsed.mode = mode;
    }
    const miles = takeQuantity(rest, used, DISTANCE_UNITS);
    if (miles === undefined) warnings.add('missing_distance');
    else parsed.distanceMiles = Math.round(miles * 10) / 10;
  }

  const durationUnits = kind === 'trip' ? TRIP_DURATION_UNITS : DURATION_UNITS;
  const minutes = takeQuantity(rest, used, durationUnits);
  if (minutes !== undefined) parsed.durationMin = Math.round(minutes);

  if (kind === 'expense' || kind === 'income') {
    const cents = takeAmount(rest, used);
    if (cents === undefined) warnings.add('missing_amount');
    else parsed.amountCents = cents;
  }

  const kept = rest.filter((_, i) => !used[i]);
  parsed.cleanTitle = kept.join(' ');

  // Bare mode and meal words are read but stay in the title ("Drive to Tucson").
  if (kind === 'trip' && !parsed.mode) {
    const mode = firstWord(kept, MODE_WORDS);
    if (mode) parsed.mode = mode;
  }

  // A meal tag sets the meal type on any kind. Only a meal goes on to look for
  // a bare meal word, then at the start time.
  const mealType =
    taggedMeal ??
    (kind === 'meal' ? firstWord(kept, MEAL_WORDS) ?? mealTypeAt(opts?.startTime) : undefined);
  if (mealType) parsed.mealType = mealType;

  if (kind === 'expense' || kind === 'income') {
    const vendor = vendorFrom(parsed.cleanTitle);
    if (vendor) parsed.vendor = vendor;
  }

  parsed.warnings = listWarnings();
  return parsed;
}
