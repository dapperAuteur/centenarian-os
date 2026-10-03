// tests/unit/parse-tokens.test.ts
// Run: npm run test:unit
//   (node --test --experimental-strip-types tests/unit/*.test.ts)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCaptureTitle } from '../../lib/capture/parse-tokens.ts';
import {
  MEAL_WORDS,
  MODE_WORDS,
  TOKEN_ALIASES,
  TRIP_MODES,
  type CaptureKind,
} from '../../lib/capture/tokens.ts';

// ─── The three titles the feature was designed around ────────────────────────

test('expense: "Lunch Chipotle #expense $12.40"', () => {
  assert.deepEqual(parseCaptureTitle('Lunch Chipotle #expense $12.40'), {
    kind: 'expense',
    cleanTitle: 'Lunch Chipotle',
    amountCents: 1240,
    vendor: 'Chipotle',
    extraTags: [],
    warnings: [],
  });
});

test('trip: "Drive to Tucson #trip 115mi"', () => {
  assert.deepEqual(parseCaptureTitle('Drive to Tucson #trip 115mi'), {
    kind: 'trip',
    cleanTitle: 'Drive to Tucson',
    distanceMiles: 115,
    mode: 'car',
    extraTags: [],
    warnings: [],
  });
});

test('meal: "Dinner salmon #meal"', () => {
  assert.deepEqual(parseCaptureTitle('Dinner salmon #meal'), {
    kind: 'meal',
    cleanTitle: 'Dinner salmon',
    mealType: 'dinner',
    extraTags: [],
    warnings: [],
  });
});

// ─── Untagged and empty titles ───────────────────────────────────────────────

test('an untagged title is a task and comes back trimmed, otherwise as typed', () => {
  assert.deepEqual(parseCaptureTitle('  Call the plumber  '), {
    kind: 'task',
    cleanTitle: 'Call the plumber',
    extraTags: [],
    warnings: [],
  });
  assert.equal(parseCaptureTitle('Call   the plumber').cleanTitle, 'Call   the plumber');
  // Nothing is read out of an untagged title, even when it looks like data.
  assert.deepEqual(parseCaptureTitle('Drive 115mi to Tucson, lunch $12.40, 45min'), {
    kind: 'task',
    cleanTitle: 'Drive 115mi to Tucson, lunch $12.40, 45min',
    extraTags: [],
    warnings: [],
  });
});

test('an empty or whitespace title is an empty task', () => {
  for (const title of ['', '   ', '\t\n']) {
    assert.deepEqual(
      parseCaptureTitle(title),
      { kind: 'task', cleanTitle: '', extraTags: [], warnings: [] },
      JSON.stringify(title),
    );
  }
});

test('never throws on a missing title or options', () => {
  for (const title of [undefined, null, 42, {}]) {
    assert.deepEqual(
      parseCaptureTitle(title as unknown as string, null as unknown as undefined),
      { kind: 'task', cleanTitle: '', extraTags: [], warnings: [] },
    );
  }
});

// ─── Tags ────────────────────────────────────────────────────────────────────

test('every alias selects its kind, in any letter case', () => {
  for (const kind of Object.keys(TOKEN_ALIASES) as CaptureKind[]) {
    for (const alias of TOKEN_ALIASES[kind]) {
      assert.equal(parseCaptureTitle(`Something #${alias}`).kind, kind, alias);
      assert.equal(parseCaptureTitle(`Something #${alias.toUpperCase()}`).kind, kind, alias);
    }
  }
});

test('uppercase and mixed-case tags', () => {
  assert.deepEqual(parseCaptureTitle('LUNCH CHIPOTLE #EXPENSE $12.40'), {
    kind: 'expense',
    cleanTitle: 'LUNCH CHIPOTLE',
    amountCents: 1240,
    vendor: 'CHIPOTLE',
    extraTags: [],
    warnings: [],
  });
  assert.equal(parseCaptureTitle('Tacos #Gasto 8,50').kind, 'expense');
  assert.equal(parseCaptureTitle('Salmon #CENA').mealType, 'dinner');
});

test('a tag works at the start, in the middle and at the end', () => {
  const expected = {
    kind: 'expense',
    cleanTitle: 'Lunch Chipotle',
    amountCents: 1240,
    vendor: 'Chipotle',
    extraTags: [],
    warnings: [],
  };
  assert.deepEqual(parseCaptureTitle('#expense Lunch Chipotle $12.40'), expected);
  assert.deepEqual(parseCaptureTitle('#expense $12.40 Lunch Chipotle'), expected);
  assert.deepEqual(parseCaptureTitle('Lunch #expense Chipotle $12.40'), expected);
  assert.deepEqual(parseCaptureTitle('Lunch $12.40 #expense Chipotle'), expected);
  assert.deepEqual(parseCaptureTitle('Lunch Chipotle $12.40 #expense'), expected);
});

test('a tag followed by punctuation still counts, and extra whitespace collapses', () => {
  assert.deepEqual(parseCaptureTitle('  Lunch   Chipotle  #expense,   $12.40.  '), {
    kind: 'expense',
    cleanTitle: 'Lunch Chipotle',
    amountCents: 1240,
    vendor: 'Chipotle',
    extraTags: [],
    warnings: [],
  });
});

test('#task is an explicit task; the tag leaves the title', () => {
  assert.deepEqual(parseCaptureTitle('Renew passport #task'), {
    kind: 'task',
    cleanTitle: 'Renew passport',
    extraTags: [],
    warnings: [],
  });
  assert.equal(parseCaptureTitle('Renovar pasaporte #tarea').cleanTitle, 'Renovar pasaporte');
});

test('two different kind tags: the first wins and multiple_kinds is reported', () => {
  assert.deepEqual(parseCaptureTitle('Gas #expense $40 #trip 115mi'), {
    kind: 'expense',
    cleanTitle: 'Gas 115mi',
    amountCents: 4000,
    vendor: 'Gas 115mi',
    extraTags: [],
    warnings: ['multiple_kinds'],
  });
  assert.deepEqual(parseCaptureTitle('Gas #trip 115mi #expense $40'), {
    kind: 'trip',
    cleanTitle: 'Gas $40',
    distanceMiles: 115,
    extraTags: [],
    warnings: ['multiple_kinds'],
  });
  // #meal is a real kind tag, so it conflicts; it does not set a meal type.
  assert.deepEqual(parseCaptureTitle('Salmon #expense $18 #meal'), {
    kind: 'expense',
    cleanTitle: 'Salmon',
    amountCents: 1800,
    vendor: 'Salmon',
    extraTags: [],
    warnings: ['multiple_kinds'],
  });
});

test('the same kind tagged twice is not a conflict', () => {
  assert.deepEqual(parseCaptureTitle('Tacos #expense #gasto $9'), {
    kind: 'expense',
    cleanTitle: 'Tacos',
    amountCents: 900,
    vendor: 'Tacos',
    extraTags: [],
    warnings: [],
  });
});

test('a meal tag after another kind is a modifier: it sets mealType, not a second kind', () => {
  assert.deepEqual(parseCaptureTitle('Chipotle #expense $12.40 #lunch'), {
    kind: 'expense',
    cleanTitle: 'Chipotle',
    amountCents: 1240,
    vendor: 'Chipotle',
    mealType: 'lunch',
    extraTags: [],
    warnings: [],
  });
  assert.deepEqual(parseCaptureTitle('Tacos #gasto 8,50 #cena'), {
    kind: 'expense',
    cleanTitle: 'Tacos',
    amountCents: 850,
    vendor: 'Tacos',
    mealType: 'dinner',
    extraTags: [],
    warnings: [],
  });
  assert.deepEqual(parseCaptureTitle('Protein shake #workout 30min #snack'), {
    kind: 'workout',
    cleanTitle: 'Protein shake',
    durationMin: 30,
    mealType: 'snack',
    extraTags: [],
    warnings: [],
  });
  // With two meal tags, the first one names the meal type.
  assert.equal(parseCaptureTitle('Chipotle #expense $12.40 #lunch #cena').mealType, 'lunch');
});

test('a meal tag alone makes the title a meal', () => {
  const parsed = parseCaptureTitle('Tacos #lunch');
  assert.equal(parsed.kind, 'meal');
  assert.equal(parsed.mealType, 'lunch');
  assert.deepEqual(parsed.warnings, []);
});

test('on a non-meal kind, mealType only comes from a meal tag', () => {
  // Neither the bare word "Lunch" nor the start time sets it.
  const parsed = parseCaptureTitle('Lunch Chipotle #expense $12.40', { startTime: '12:00' });
  assert.equal(parsed.mealType, undefined);
  assert.equal('mealType' in parsed, false);
});

test('an unknown tag leaves the title and the vendor, and is returned in extraTags', () => {
  assert.deepEqual(parseCaptureTitle('Lunch Chipotle #client #expense $12.40'), {
    kind: 'expense',
    cleanTitle: 'Lunch Chipotle',
    amountCents: 1240,
    vendor: 'Chipotle',
    extraTags: ['client'],
    warnings: ['unknown_token'],
  });
  // Lowercased, without "#" or trailing punctuation, each once, in title order.
  assert.deepEqual(parseCaptureTitle('Coffee #Client, #Billable #client #expense $5'), {
    kind: 'expense',
    cleanTitle: 'Coffee',
    amountCents: 500,
    vendor: 'Coffee',
    extraTags: ['client', 'billable'],
    warnings: ['unknown_token'],
  });
});

test('with only unknown tags the title is still a task', () => {
  assert.deepEqual(parseCaptureTitle('  Standup   #teamsync  notes '), {
    kind: 'task',
    cleanTitle: 'Standup notes',
    extraTags: ['teamsync'],
    warnings: ['unknown_token'],
  });
  // Object.prototype members are not vocabulary.
  assert.deepEqual(parseCaptureTitle('Review #constructor'), {
    kind: 'task',
    cleanTitle: 'Review',
    extraTags: ['constructor'],
    warnings: ['unknown_token'],
  });
});

test('a "#" that does not start a word is not a tag', () => {
  for (const title of ['Ticket #42', 'Practice C# scales', 'Room #7 at 3', 'Call re: order#abc']) {
    assert.deepEqual(
      parseCaptureTitle(title),
      { kind: 'task', cleanTitle: title, extraTags: [], warnings: [] },
      title,
    );
  }
});

test('warnings are listed once each, in a fixed order', () => {
  assert.deepEqual(parseCaptureTitle('Thing #foo #trip #expense #bar #meal').warnings, [
    'missing_distance',
    'multiple_kinds',
    'unknown_token',
  ]);
});

// ─── Amounts (expense and income) ────────────────────────────────────────────

test('amount forms', () => {
  const cases: [string, number][] = [
    ['$12.40', 1240],
    ['12.40', 1240],
    ['$12', 1200],
    ['12', 1200],
    ['12,40', 1240],
    ['$8,5', 850],
    ['$0.99', 99],
    ['$1,200', 120000],
    ['$1,200.50', 120050],
    ['1.200,50', 120050],
    ['($12.40)', 1240],
    ['$ 12.40', 1240],
  ];
  for (const [written, cents] of cases) {
    assert.deepEqual(
      parseCaptureTitle(`Groceries #expense ${written}`),
      {
        kind: 'expense',
        cleanTitle: 'Groceries',
        amountCents: cents,
        vendor: 'Groceries',
        extraTags: [],
        warnings: [],
      },
      written,
    );
  }
});

test('income takes an amount and a vendor too', () => {
  assert.deepEqual(parseCaptureTitle('Paycheck Acme #income $2,400'), {
    kind: 'income',
    cleanTitle: 'Paycheck Acme',
    amountCents: 240000,
    vendor: 'Paycheck Acme',
    extraTags: [],
    warnings: [],
  });
});

test('amount: a "$" number wins over every other number', () => {
  assert.deepEqual(parseCaptureTitle('Invoice 4471 #expense $300 net 30'), {
    kind: 'expense',
    cleanTitle: 'Invoice 4471 net 30',
    amountCents: 30000,
    vendor: 'Invoice 4471 net 30',
    extraTags: [],
    warnings: [],
  });
  const amount = (title: string) => parseCaptureTitle(title).amountCents;
  assert.equal(amount('Rent #expense $1,200'), 120000);
  assert.equal(amount('86.20 dinner for 4 #expense $90'), 9000);
  // Even a year-like one: the sign says it is money.
  assert.equal(amount('Taxes #expense $2024'), 202400);
  // Two "$" numbers: the later one.
  assert.equal(amount('$5 tip on $40 dinner #expense'), 4000);
});

test('amount: without "$", a number with decimals wins, the last one', () => {
  const amount = (title: string) => parseCaptureTitle(title).amountCents;
  assert.equal(amount('86.20 dinner for 4 #expense'), 8620);
  assert.equal(amount('Dinner for 4 #gasto 86,20'), 8620);
  assert.equal(amount('Split 10.50 of 21.00 #expense'), 2100);
});

test('amount: a bare whole number counts only when it is the single number left', () => {
  const amount = (title: string) => parseCaptureTitle(title).amountCents;
  assert.equal(amount('Lunch #expense 12'), 1200);
  assert.equal(amount('Rent #expense 1,950'), 195000);
  // A number already read as a duration is no longer in the title.
  assert.equal(amount('Parking 2h #expense 12'), 1200);

  // Two numbers: no guess. Nothing leaves the title.
  assert.deepEqual(parseCaptureTitle('12 lunch for 2 #expense'), {
    kind: 'expense',
    cleanTitle: '12 lunch for 2',
    vendor: '12 lunch for 2',
    extraTags: [],
    warnings: ['missing_amount'],
  });
  for (const title of ['Lunch for 2 #expense 12', 'Gas 3.4567 gal #expense 12']) {
    assert.deepEqual(parseCaptureTitle(title).warnings, ['missing_amount'], title);
    assert.equal(amount(title), undefined, title);
  }
});

test('amount: a bare year-like number (1900-2100) is not an amount', () => {
  assert.deepEqual(parseCaptureTitle('Taxes 2024 #expense'), {
    kind: 'expense',
    cleanTitle: 'Taxes 2024',
    vendor: 'Taxes 2024',
    extraTags: [],
    warnings: ['missing_amount'],
  });
  const amount = (title: string) => parseCaptureTitle(title).amountCents;
  assert.equal(amount('Fee 1899 #expense'), 189900);
  assert.equal(amount('Fee 1900 #expense'), undefined);
  assert.equal(amount('Fee 2100 #expense'), undefined);
  assert.equal(amount('Fee 2101 #expense'), 210100);
});

test('a missing amount keeps the kind and reports missing_amount', () => {
  assert.deepEqual(parseCaptureTitle('Lunch Chipotle #expense'), {
    kind: 'expense',
    cleanTitle: 'Lunch Chipotle',
    vendor: 'Chipotle',
    extraTags: [],
    warnings: ['missing_amount'],
  });
  assert.deepEqual(parseCaptureTitle('#income'), {
    kind: 'income',
    cleanTitle: '',
    extraTags: [],
    warnings: ['missing_amount'],
  });
  // Not money: a time, a percentage, a count with a suffix, four decimals, a negative number.
  for (const title of [
    'Lunch at 12:30 #expense',
    'Tip 20% #expense',
    'Coffee 2x #expense',
    'Gas 3.4567 #expense',
    'Refund -12.40 #expense',
  ]) {
    assert.deepEqual(parseCaptureTitle(title).warnings, ['missing_amount'], title);
  }
});

test('"$0" is an amount of zero, not a missing amount', () => {
  assert.deepEqual(parseCaptureTitle('Free coffee #expense $0'), {
    kind: 'expense',
    cleanTitle: 'Free coffee',
    amountCents: 0,
    vendor: 'Free coffee',
    extraTags: [],
    warnings: [],
  });
});

test('amounts are only read for expenses and income', () => {
  assert.deepEqual(parseCaptureTitle('Salmon $18 #meal'), {
    kind: 'meal',
    cleanTitle: 'Salmon $18',
    extraTags: [],
    warnings: [],
  });
});

// ─── Vendor ──────────────────────────────────────────────────────────────────

test('vendor drops one leading meal word, else it is the whole clean title', () => {
  const vendor = (title: string) => parseCaptureTitle(title).vendor;
  assert.equal(vendor('Lunch Chipotle #expense $12.40'), 'Chipotle');
  assert.equal(vendor('Cena La Parrilla #gasto 30'), 'La Parrilla');
  assert.equal(vendor('Chipotle lunch #expense $12.40'), 'Chipotle lunch');
  assert.equal(vendor('Lunch dinner combo #expense $12.40'), 'dinner combo');
  assert.equal(vendor('Lunch #expense $12.40'), undefined);
  assert.equal(vendor('#expense $12.40'), undefined);
});

test('vendor also drops one connector after the meal word: at, @, en', () => {
  const vendor = (title: string) => parseCaptureTitle(title).vendor;
  assert.equal(vendor('Lunch at Chipotle #expense $12.40'), 'Chipotle');
  assert.equal(vendor('Almuerzo en Chipotle #gasto 8,50'), 'Chipotle');
  assert.equal(vendor('Dinner @ Nobu #expense $90'), 'Nobu');
  assert.equal(vendor('Dinner @Nobu #expense $90'), 'Nobu');
  assert.equal(vendor('LUNCH AT CHIPOTLE #expense $12.40'), 'CHIPOTLE');
  // Only one connector, and only right after a meal word.
  assert.equal(vendor('Lunch at At Home Cafe #expense $9'), 'At Home Cafe');
  assert.equal(vendor('Coffee at Starbucks #expense $5'), 'Coffee at Starbucks');
  assert.equal(vendor('En Fuego #gasto 30'), 'En Fuego');
  assert.equal(vendor('Lunch at #expense $12.40'), undefined);
  // The clean title keeps the connector.
  assert.equal(parseCaptureTitle('Lunch at Chipotle #expense $12.40').cleanTitle, 'Lunch at Chipotle');
});

// ─── Spanish ─────────────────────────────────────────────────────────────────

test('Spanish: "Almuerzo tacos #gasto 8,50"', () => {
  assert.deepEqual(parseCaptureTitle('Almuerzo tacos #gasto 8,50'), {
    kind: 'expense',
    cleanTitle: 'Almuerzo tacos',
    amountCents: 850,
    vendor: 'tacos',
    extraTags: [],
    warnings: [],
  });
});

test('Spanish: "#viaje 30km bici"', () => {
  assert.deepEqual(parseCaptureTitle('#viaje 30km bici'), {
    kind: 'trip',
    cleanTitle: 'bici',
    distanceMiles: 18.6,
    mode: 'bike',
    extraTags: [],
    warnings: [],
  });
});

// ─── Trips: distance and mode ────────────────────────────────────────────────

test('distance forms, in miles', () => {
  const miles = (title: string) => parseCaptureTitle(title).distanceMiles;
  assert.equal(miles('Tucson #trip 115mi'), 115);
  assert.equal(miles('Tucson #trip 115 miles'), 115);
  assert.equal(miles('Tucson #trip 12.5 mi'), 12.5);
  assert.equal(miles('Tucson #trip 1 mile'), 1);
  assert.equal(miles('Tucson #trip 1,200mi'), 1200);
  assert.equal(miles('Tucson #viaje 20 millas'), 20);
  assert.equal(parseCaptureTitle('Tucson #trip 115 miles').cleanTitle, 'Tucson');
});

test('kilometers are converted to miles and rounded to 1 decimal', () => {
  const miles = (title: string) => parseCaptureTitle(title).distanceMiles;
  assert.equal(miles('Phoenix #trip 185km'), 115);
  assert.equal(miles('Phoenix #trip 30km'), 18.6);
  assert.equal(miles('Phoenix #trip 10 km'), 6.2);
  assert.equal(miles('Phoenix #viaje 12,5 km'), 7.8);
  assert.equal(miles('Phoenix #viaje 5 kilómetros'), 3.1);
});

test('a missing distance keeps the kind and reports missing_distance', () => {
  assert.deepEqual(parseCaptureTitle('Drive to Tucson #trip'), {
    kind: 'trip',
    cleanTitle: 'Drive to Tucson',
    mode: 'car',
    extraTags: [],
    warnings: ['missing_distance'],
  });
  // A bare number is not a distance.
  assert.deepEqual(parseCaptureTitle('Tucson 115 #trip'), {
    kind: 'trip',
    cleanTitle: 'Tucson 115',
    extraTags: [],
    warnings: ['missing_distance'],
  });
});

test('distances are only read for trips', () => {
  assert.deepEqual(parseCaptureTitle('Tempo 5km #workout 30min'), {
    kind: 'workout',
    cleanTitle: 'Tempo 5km',
    durationMin: 30,
    extraTags: [],
    warnings: [],
  });
});

test('mode: "mode:word" wins over a bare word and leaves the title', () => {
  assert.deepEqual(parseCaptureTitle('Drive to Tucson #trip 115mi mode:bus'), {
    kind: 'trip',
    cleanTitle: 'Drive to Tucson',
    distanceMiles: 115,
    mode: 'bus',
    extraTags: [],
    warnings: [],
  });
  assert.equal(parseCaptureTitle('Tucson #trip 9mi mode:bike').mode, 'bike');
  assert.equal(parseCaptureTitle('Tucson #trip 9mi MODE:Coche').mode, 'car');
  assert.equal(parseCaptureTitle('Tucson #trip 9mi mode:other').mode, 'other');
});

test('mode: an unrecognized "mode:word" stays in the title and sets nothing', () => {
  assert.deepEqual(parseCaptureTitle('Tucson #trip 9mi mode:scooter'), {
    kind: 'trip',
    cleanTitle: 'Tucson mode:scooter',
    distanceMiles: 9,
    extraTags: [],
    warnings: [],
  });
});

test('mode: every bare mode word is recognized, the first one wins', () => {
  for (const [word, mode] of Object.entries(MODE_WORDS)) {
    assert.equal(parseCaptureTitle(`${word} #trip 3mi`).mode, mode, word);
  }
  assert.equal(parseCaptureTitle('Uber to the train #trip 3mi').mode, 'rideshare');
  assert.equal(parseCaptureTitle('Vuelo en AVIÓN #viaje 900km').mode, 'plane');
  // A bare mode word is taken at face value.
  assert.equal(parseCaptureTitle('Run errands #trip 5mi').mode, 'run');
});

test('mode: left undefined when the title names none', () => {
  assert.deepEqual(parseCaptureTitle('Tucson #trip 115mi'), {
    kind: 'trip',
    cleanTitle: 'Tucson',
    distanceMiles: 115,
    extraTags: [],
    warnings: [],
  });
  // Words that merely contain a mode word, and Object.prototype members, do not count.
  assert.equal(parseCaptureTitle('Business carpet runner constructor #trip 2mi').mode, undefined);
});

test('mode is only read for trips', () => {
  assert.deepEqual(parseCaptureTitle('Bike tune-up mode:bike #expense $60'), {
    kind: 'expense',
    cleanTitle: 'Bike tune-up mode:bike',
    amountCents: 6000,
    vendor: 'Bike tune-up mode:bike',
    extraTags: [],
    warnings: [],
  });
});

test('every mode word maps to a mode the trips table accepts', () => {
  for (const [word, mode] of Object.entries(MODE_WORDS)) {
    assert.ok(TRIP_MODES.includes(mode), word);
    assert.equal(word, word.toLowerCase(), word);
  }
});

test('tag aliases are lowercase, belong to one kind each and are not meal words', () => {
  const aliases = Object.values(TOKEN_ALIASES).flat();
  assert.equal(new Set(aliases).size, aliases.length);
  for (const alias of aliases) {
    assert.equal(alias, alias.toLowerCase(), alias);
    assert.equal(Object.hasOwn(MEAL_WORDS, alias), false, alias);
  }
});

// ─── Meals ───────────────────────────────────────────────────────────────────

test('a meal tag implies the meal kind and its type', () => {
  for (const [word, mealType] of Object.entries(MEAL_WORDS)) {
    assert.deepEqual(
      parseCaptureTitle(`Leftovers #${word}`),
      { kind: 'meal', cleanTitle: 'Leftovers', mealType, extraTags: [], warnings: [] },
      word,
    );
  }
});

test('meal type: a tag beats a bare word, a bare word beats the start time', () => {
  assert.equal(parseCaptureTitle('Dinner leftovers #lunch', { startTime: '08:00' }).mealType, 'lunch');
  assert.equal(parseCaptureTitle('Dinner leftovers #meal #lunch').mealType, 'lunch');
  assert.equal(parseCaptureTitle('Dinner leftovers #meal', { startTime: '08:00' }).mealType, 'dinner');
  assert.equal(parseCaptureTitle('Desayuno huevos #comida', { startTime: '19:00' }).mealType, 'breakfast');
});

test('meal type from the start time, at each boundary', () => {
  const cases: [string, string][] = [
    ['00:00', 'snack'],
    ['04:59', 'snack'],
    ['05:00', 'breakfast'],
    ['10:29', 'breakfast'],
    ['10:30', 'lunch'],
    ['14:29', 'lunch'],
    ['14:30', 'snack'],
    ['16:59', 'snack'],
    ['17:00', 'dinner'],
    ['21:29', 'dinner'],
    ['21:30', 'snack'],
    ['23:59', 'snack'],
    ['7:15', 'breakfast'],
    ['12:00:00', 'lunch'],
  ];
  for (const [startTime, mealType] of cases) {
    assert.deepEqual(
      parseCaptureTitle('Salmon #meal', { startTime }),
      { kind: 'meal', cleanTitle: 'Salmon', mealType, extraTags: [], warnings: [] },
      startTime,
    );
  }
});

test('meal type is undefined with no meal word and no usable start time', () => {
  const expected = { kind: 'meal', cleanTitle: 'Salmon', extraTags: [], warnings: [] };
  assert.deepEqual(parseCaptureTitle('Salmon #meal'), expected);
  assert.deepEqual(parseCaptureTitle('Salmon #meal', {}), expected);
  for (const startTime of ['', 'noon', '24:00', '12:60', '1230']) {
    assert.deepEqual(parseCaptureTitle('Salmon #meal', { startTime }), expected, startTime);
  }
});

// ─── Durations ───────────────────────────────────────────────────────────────

test('duration forms', () => {
  const cases: [string, number][] = [
    ['45min', 45],
    ['1h', 60],
    ['1.5h', 90],
    ['90m', 90],
    ['45 min', 45],
    ['2 hours', 120],
    ['1,5h', 90],
    ['1h 30m', 90],
    ['2 horas', 120],
    ['20 minutos', 20],
  ];
  for (const [written, minutes] of cases) {
    assert.deepEqual(
      parseCaptureTitle(`Leg day #workout ${written}`),
      { kind: 'workout', cleanTitle: 'Leg day', durationMin: minutes, extraTags: [], warnings: [] },
      written,
    );
  }
});

test('"1h30m" written as one word is not read and stays in the title', () => {
  assert.deepEqual(parseCaptureTitle('Leg day #workout 1h30m'), {
    kind: 'workout',
    cleanTitle: 'Leg day 1h30m',
    extraTags: [],
    warnings: [],
  });
});

test('a workout without a duration is still a workout', () => {
  assert.deepEqual(parseCaptureTitle('Leg day #entreno'), {
    kind: 'workout',
    cleanTitle: 'Leg day',
    extraTags: [],
    warnings: [],
  });
});

test('a one-letter unit must be attached to its number', () => {
  assert.deepEqual(parseCaptureTitle('Buy 2 m of cable #task'), {
    kind: 'task',
    cleanTitle: 'Buy 2 m of cable',
    extraTags: [],
    warnings: [],
  });
});

test('on a trip a bare "m" is not minutes', () => {
  assert.deepEqual(parseCaptureTitle('Walk 800m #trip'), {
    kind: 'trip',
    cleanTitle: 'Walk 800m',
    mode: 'walk',
    extraTags: [],
    warnings: ['missing_distance'],
  });
  assert.deepEqual(parseCaptureTitle('Hike #trip 5mi 90m'), {
    kind: 'trip',
    cleanTitle: 'Hike 90m',
    distanceMiles: 5,
    extraTags: [],
    warnings: [],
  });
});

test('a trip still reads every other duration unit', () => {
  const cases: [string, number][] = [
    ['45min', 45],
    ['45 mins', 45],
    ['20 minutos', 20],
    ['2h', 120],
    ['1.5hr', 90],
    ['2 hours', 120],
    ['2 horas', 120],
    ['1h 30min', 90],
  ];
  for (const [written, minutes] of cases) {
    assert.deepEqual(
      parseCaptureTitle(`Hike #trip 5mi ${written}`),
      {
        kind: 'trip',
        cleanTitle: 'Hike',
        distanceMiles: 5,
        durationMin: minutes,
        extraTags: [],
        warnings: [],
      },
      written,
    );
  }
});

test('every other kind keeps the bare "m"', () => {
  assert.equal(parseCaptureTitle('Leg day #workout 90m').durationMin, 90);
  assert.equal(parseCaptureTitle('Deep work #task 90m').durationMin, 90);
  assert.equal(parseCaptureTitle('Parking 90m #expense $6').durationMin, 90);
  assert.equal(parseCaptureTitle('Slow dinner 90m #meal').durationMin, 90);
});

test('a duration is read on any tagged title, next to the kind\'s own data', () => {
  assert.deepEqual(parseCaptureTitle('Drive to Tucson #trip 115mi 2h'), {
    kind: 'trip',
    cleanTitle: 'Drive to Tucson',
    distanceMiles: 115,
    mode: 'car',
    durationMin: 120,
    extraTags: [],
    warnings: [],
  });
  assert.deepEqual(parseCaptureTitle('Parking 2h #expense 12'), {
    kind: 'expense',
    cleanTitle: 'Parking',
    amountCents: 1200,
    vendor: 'Parking',
    durationMin: 120,
    extraTags: [],
    warnings: [],
  });
  assert.deepEqual(parseCaptureTitle('Deep work #task 90m'), {
    kind: 'task',
    cleanTitle: 'Deep work',
    durationMin: 90,
    extraTags: [],
    warnings: [],
  });
});

test('a meal tag before another kind is still a modifier (tag order does not matter)', () => {
  const before = parseCaptureTitle('Chipotle #lunch #expense $12.40');
  const after = parseCaptureTitle('Chipotle #expense $12.40 #lunch');
  assert.equal(before.kind, 'expense');
  assert.equal(before.mealType, 'lunch');
  assert.deepEqual(before.warnings, []);
  assert.deepEqual(before, after);
});

