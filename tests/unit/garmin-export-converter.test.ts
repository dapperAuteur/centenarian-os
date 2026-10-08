// tests/unit/garmin-export-converter.test.ts
// Unit tests for scripts/garmin-export-to-centos.mjs: Garmin account export -> the CSV files the
// CentenarianOS importers read. The generated files are read back with the importers' own code
// (parseGarminActivitiesCsv, cleanDayValues, workoutIdentity) so a format drift fails here.
// Run: npm run test:unit
//
// Every value here is SYNTHETIC. No database, no network, no real export.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  HEALTH_COLUMNS,
  HEALTH_MAX_ROWS,
  TRIP_COLUMNS,
  WORKOUT_COLUMNS,
  WORKOUT_MAX_ROWS,
  buildHealthRows,
  buildTripRows,
  buildWorkoutRows,
  bloodPressureDate,
  chunkByGroup,
  convertExport,
  csvCell,
  exportCaloriesToKcal,
  findDiConnect,
  formatDuration,
  gramsToLbs,
  localStartFromWallClockMs,
  parseArgs,
  pickDailyWeights,
  prepareActivities,
  readExport,
  sleepMetrics,
  summaryText,
  titleCase,
  toCsv,
  udsMetrics,
  writeOutputs,
} from '../../scripts/garmin-export-to-centos.mjs';
import { parseGarminActivitiesCsv, splitCsvLine } from '../../lib/fitness-import/garmin-trips.ts';
import { cleanDayValues, hasMetric, isIsoDate } from '../../lib/fitness-import/daily-metrics.ts';
import { workoutIdentity } from '../../lib/fitness-import/workouts.ts';

// ---------------------------------------------------------------------------------------------
// Synthetic fixtures
// ---------------------------------------------------------------------------------------------

/** Local wall clock as epoch ms, the way Garmin's startTimeLocal stores it. */
const wall = (y: number, mo: number, d: number, h: number, mi: number, s = 0) => Date.UTC(y, mo - 1, d, h, mi, s);

function uds(date: string, extra: Record<string, unknown> = {}) {
  return {
    calendarDate: date,
    version: 1,
    totalSteps: 8000,
    currentDayRestingHeartRate: 50,
    restingHeartRate: 53, // Garmin's 7-day average: must NOT be used
    activeKilocalories: 400.4,
    moderateIntensityMinutes: 20,
    vigorousIntensityMinutes: 10,
    allDayStress: { aggregatorList: [{ type: 'AWAKE', averageStressLevel: 40 }, { type: 'TOTAL', averageStressLevel: 30 }] },
    bodyBattery: { chargedValue: 109, bodyBatteryStatList: [{ bodyBatteryStatType: 'LOWEST', statsValue: 10 }, { bodyBatteryStatType: 'HIGHEST', statsValue: 90 }] },
    averageSpo2Value: 97, // UDS SpO2: not used (sleep SpO2 is)
    ...extra,
  };
}

function night(date: string, extra: Record<string, unknown> = {}) {
  return {
    calendarDate: date,
    deepSleepSeconds: 3600,
    lightSleepSeconds: 14400,
    remSleepSeconds: 3960, // 21,960 s = 6.1 h
    awakeSleepSeconds: 1800, // excluded
    sleepScores: { overallScore: 80 },
    spo2SleepSummary: { averageSPO2: 95.456, averageHR: 58 }, // averageHR must NOT become resting_hr
    ...extra,
  };
}

function weighIn(localStamp: string, grams: number, version: number) {
  return { version, metaData: { calendarDate: localStamp }, weight: { weight: grams, sourceType: 'MANUAL', timestampGMT: '2025-01-02T03:30:00.0' } };
}

function activity(type: string, start: number, extra: Record<string, unknown> = {}) {
  return {
    activityId: start,
    name: 'Synthetic',
    activityType: type,
    startTimeLocal: start,
    beginTimestamp: start + 4 * 3600 * 1000,
    duration: 3723000, // ms -> 01:02:03
    movingDuration: 3600000,
    elapsedDuration: 3900000,
    distance: 160934.4, // cm -> 1.00 mi
    elevationGain: 3048, // cm -> 100 ft
    calories: 419, // -> 100 kcal
    avgHr: 120.4,
    maxHr: 150,
    steps: 1500,
    favorite: false,
    ...extra,
  };
}

/** The metrics import page's parser: split on every comma, strip outer quotes. */
function parseLikeMetricsPage(text: string) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const values = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return { row, cells: values.length, headers: headers.length };
  });
}

// ---------------------------------------------------------------------------------------------
// Units and formatting
// ---------------------------------------------------------------------------------------------

test('units: durations are ms, distances cm, calories /4.19, start is the local wall clock', () => {
  assert.equal(formatDuration(3723000), '01:02:03');
  assert.equal(formatDuration(1499), '00:00:01');
  assert.equal(formatDuration(0), '');
  assert.equal(formatDuration(undefined), '');
  assert.equal(exportCaloriesToKcal(419), 100);
  assert.equal(exportCaloriesToKcal(0), null);
  assert.equal(localStartFromWallClockMs(wall(2025, 6, 8, 17, 20, 53)), '2025-06-08 17:20:53');
  assert.equal(gramsToLbs(88450), 195);
  assert.equal(gramsToLbs(453.592 * 150.255), 150.26);
  assert.equal(titleCase('LATERAL_RAISE'), 'Lateral Raise');
});

test('csvCell quotes commas and quotes and flattens line breaks', () => {
  assert.equal(csvCell('Ride, easy'), '"Ride, easy"');
  assert.equal(csvCell('The "loop"'), '"The ""loop"""');
  assert.equal(csvCell('a\nb'), 'a b');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(0), '0');
});

// ---------------------------------------------------------------------------------------------
// Daily health metrics
// ---------------------------------------------------------------------------------------------

test('udsMetrics: day RHR not the 7-day average, TOTAL stress, Body Battery HIGHEST, intensity minutes', () => {
  assert.deepEqual(udsMetrics(uds('2025-01-01')), {
    steps: 8000,
    resting_hr: 50,
    active_calories: 400,
    activity_min: 30,
    stress_score: 30,
    recovery_score: 90,
  });
});

test('udsMetrics: unknown stays blank, a real zero of intensity minutes is kept', () => {
  const m = udsMetrics(uds('2025-01-01', {
    totalSteps: 0,
    currentDayRestingHeartRate: undefined,
    activeKilocalories: 0,
    moderateIntensityMinutes: 0,
    vigorousIntensityMinutes: 0,
    allDayStress: { aggregatorList: [{ type: 'TOTAL', averageStressLevel: -1 }] },
    bodyBattery: undefined,
  }));
  assert.deepEqual(m, { activity_min: 0 });
  assert.deepEqual(udsMetrics({ calendarDate: '2006-01-01', allDayStress: { aggregatorList: [] } }), {});
});

test('sleepMetrics: deep + light + REM to 0.1 h, score 0 is blank, sleep SpO2, never sleep HR', () => {
  assert.deepEqual(sleepMetrics(night('2025-01-01')), { sleep_hours: 6.1, sleep_score: 80, spo2_pct: 95.46 });
  assert.deepEqual(sleepMetrics(night('2025-01-01', { deepSleepSeconds: 0, lightSleepSeconds: 0, remSleepSeconds: 0, sleepScores: { overallScore: 0 } })), { spo2_pct: 95.46 });
});

test('pickDailyWeights: local calendar day, latest version wins, grams to pounds', () => {
  const skipped: { reason: string; count: number }[] = [];
  const { weights, weighIns } = pickDailyWeights([
    weighIn('2025-01-01T21:30:00.0', 90000, 5), // GMT stamp is the next day: the local day counts
    weighIn('2025-01-01T07:00:00.0', 88450, 9), // edited last
    weighIn('2025-01-03T07:00:00.0', 80000, 1),
    { version: 2, metaData: { calendarDate: 'garbage' }, weight: { weight: 80000 } },
    { version: 3, metaData: { calendarDate: '2025-01-04T07:00:00.0' } }, // not a weigh-in
  ], skipped);
  assert.equal(weighIns, 3);
  assert.deepEqual([...weights], [['2025-01-01', 195], ['2025-01-03', gramsToLbs(80000)]]);
  assert.equal(skipped[0].count, 1);
});

test('bloodPressureDate reads the [y, m, d, h, min, ...] array, not epoch ms', () => {
  assert.equal(bloodPressureDate({ metaData: { calendarDate: [2024, 3, 9, 8, 15] } }), '2024-03-09');
  assert.equal(bloodPressureDate({ metaData: { calendarDate: '2024-03-09T08:15:00.0' } }), '2024-03-09');
  assert.equal(bloodPressureDate({ metaData: { calendarDate: 1709972100000 } }), null);
});

test('buildHealthRows merges sources by local date, one row per day, junk days skipped', () => {
  const { rows, skipped, stats } = buildHealthRows({
    uds: [uds('2025-01-02'), uds('2025-01-01'), { calendarDate: '2006-01-01', version: 1 }],
    sleep: [night('2025-01-01'), night('2025-01-02', { sleepScores: { overallScore: 0 } })],
    bio: [weighIn('2025-01-02T07:00:00.0', 88450, 1), weighIn('2025-01-05T07:00:00.0', 88450, 1)],
  });
  assert.deepEqual(rows.map((r) => r.logged_date), ['2025-01-01', '2025-01-02', '2025-01-05']);
  assert.equal(rows[0].sleep_hours, 6.1);
  assert.equal(rows[0].resting_hr, 50);
  assert.equal(rows[1].weight_lbs, 195);
  assert.equal(rows[1].sleep_score, undefined);
  assert.deepEqual(rows[2], { logged_date: '2025-01-05', weight_lbs: 195 });
  assert.equal(stats.udsDays, 2);
  assert.equal(stats.fieldDays.weight_lbs, 2);
  const junk = skipped.find((s) => s.reason.startsWith('daily summaries with no metrics'));
  assert.equal(junk?.count, 1);
  assert.deepEqual(junk?.examples, ['2006-01-01']);
});

test('buildHealthRows: a date repeated in the export becomes one row (latest version)', () => {
  const { rows } = buildHealthRows({ uds: [uds('2025-01-01', { version: 1, totalSteps: 100 }), uds('2025-01-01', { version: 2, totalSteps: 200 })] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].steps, 200);
});

test('buildHealthRows --since filters every source before counting', () => {
  const { rows, skipped, stats } = buildHealthRows(
    { uds: [uds('2025-01-01'), uds('2025-02-01')], sleep: [night('2025-01-01')], bio: [weighIn('2025-01-01T07:00:00.0', 88450, 1)] },
    { since: '2025-01-15' },
  );
  assert.deepEqual(rows.map((r) => r.logged_date), ['2025-02-01']);
  assert.equal(stats.weighIns, 0);
  assert.equal(stats.sleepDays, 0);
  assert.equal(skipped.find((s) => s.reason.startsWith('days before --since'))?.count, 1);
});

test('buildHealthRows --with-notes: water and blood pressure as comma-free notes, never a notes-only row', () => {
  const data = {
    uds: [uds('2025-01-01')],
    hydration: [
      { calendarDate: '2025-01-01', hydrationSource: 'GARMIN_GCM', valueInML: 1500 },
      { calendarDate: '2025-01-01', hydrationSource: 'GARMIN_GCM', valueInML: -250 },
      { calendarDate: '2025-01-01', hydrationSource: 'GARMIN_ACTIVITY', valueInML: 0, estimatedSweatLossInML: 700 },
      { calendarDate: '2025-01-09', hydrationSource: 'GARMIN_GCM', valueInML: 500 }, // no metrics that day
    ],
    bloodPressure: [{ metaData: { calendarDate: [2025, 1, 1, 8, 0] }, bloodPressure: { systolic: 118, diastolic: 76, pulse: 60, notes: 'after coffee, seated' } }],
  };
  const plain = buildHealthRows(data);
  assert.equal(plain.rows[0].notes, undefined);
  assert.ok(plain.skipped.some((s) => s.reason.startsWith('water-intake days not written') && s.count === 2));

  const { rows, skipped, stats } = buildHealthRows(data, { withNotes: true });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].notes, 'Water 1.3 L; BP 118/76 pulse 60');
  assert.equal(stats.waterDays, 1);
  assert.ok(skipped.some((s) => s.reason.startsWith('note days with no metric') && s.count === 1));
});

test('health CSV survives the metrics page parser: every row has a date and a metric, blanks not zeros', () => {
  const { rows } = buildHealthRows({ uds: [uds('2025-01-01', { currentDayRestingHeartRate: undefined })], sleep: [night('2025-01-01')] });
  const text = toCsv(HEALTH_COLUMNS, rows);
  assert.equal(text.split('\n')[0], 'logged_date,resting_hr,steps,sleep_hours,activity_min,sleep_score,spo2_pct,active_calories,stress_score,recovery_score,weight_lbs,notes');
  for (const { row, cells, headers } of parseLikeMetricsPage(text)) {
    assert.equal(cells, headers);
    assert.ok(isIsoDate(row.logged_date));
    assert.equal(row.resting_hr, '');
    const values = cleanDayValues(Object.fromEntries(Object.entries(row).filter(([, v]) => v !== '')));
    assert.ok(hasMetric(values));
    assert.equal(values.sleep_hours, 6.1);
    assert.equal(values.recovery_score, 90);
  }
});

// ---------------------------------------------------------------------------------------------
// Activities: trips
// ---------------------------------------------------------------------------------------------

test('prepareActivities splits trip and workout types, drops a repeated start second, sorts by start', () => {
  const t1 = wall(2025, 3, 1, 7, 0, 5);
  const { trips, workouts, skipped } = prepareActivities([
    activity('strength_training', wall(2025, 3, 1, 6, 0)),
    activity('cycling', t1),
    activity('cycling', t1, { activityId: 999 }), // one recording listed twice
    activity('hiking', wall(2025, 3, 2, 9, 0)),
    activity('yoga', undefined as unknown as number),
  ]);
  assert.deepEqual(trips.map((t) => t.act.activityType), ['cycling', 'hiking']);
  assert.deepEqual(workouts.map((w) => w.act.activityType), ['strength_training']);
  assert.equal(skipped.find((s) => s.reason.startsWith('activities listed twice'))?.count, 1);
  assert.equal(skipped.find((s) => s.reason.startsWith('activities without a local start'))?.count, 1);
});

test('trips CSV reads back through the Travel importer parser with the right units and keys', () => {
  const { trips } = prepareActivities([
    activity('cycling', wall(2025, 3, 1, 7, 0, 5), { name: 'Ride, easy', favorite: true }),
    activity('indoor_cycling', wall(2025, 3, 2, 7, 0), { distance: 0, elevationGain: undefined, steps: 0 }),
    activity('treadmill_running', wall(2025, 3, 3, 7, 0)),
    activity('walking', wall(2025, 3, 4, 7, 0)),
    activity('running', wall(2025, 3, 5, 7, 0)),
    activity('hiking', wall(2025, 3, 6, 7, 0)),
  ]);
  const rows = buildTripRows(trips);
  assert.equal(rows[0].Time, '01:02:03');
  assert.equal(rows[0]['Moving Time'], '01:00:00');
  assert.equal(rows[0]['Total Ascent'], 100);
  assert.equal(rows[0].Favorite, 'true');
  assert.equal(rows[1].Distance, '');
  assert.equal(rows[1]['Total Ascent'], '');

  const parsed = parseGarminActivitiesCsv(toCsv(TRIP_COLUMNS, rows));
  assert.equal(parsed.unsupported, 0);
  assert.equal(parsed.invalid.length, 0);
  assert.deepEqual(parsed.activities.map((a) => a.mode), ['bike', 'bike', 'run', 'walk', 'run', 'walk']);
  const ride = parsed.activities[0];
  assert.equal(ride.title, 'Ride, easy');
  assert.equal(ride.key, 'garmin:start:2025-03-01 07:00:05');
  assert.equal(ride.distance_miles, 1);
  assert.equal(ride.duration_min, 62);
  assert.equal(ride.calories, 100);
  assert.equal(ride.avgHR, 120);
  assert.equal(parsed.activities[1].distance_miles, null);
  assert.equal(parsed.activities[5].purpose, 'leisure');
});

// ---------------------------------------------------------------------------------------------
// Activities: workouts
// ---------------------------------------------------------------------------------------------

test('workouts: a name reused on one day gets its start time, so the importer keeps both', () => {
  const { workouts } = prepareActivities([
    activity('strength_training', wall(2025, 3, 1, 6, 5), { name: 'Strength', workoutFeel: 75 }),
    activity('strength_training', wall(2025, 3, 1, 18, 30), { name: 'strength ' }),
    activity('strength_training', wall(2025, 3, 2, 6, 5), { name: 'Strength' }),
    activity('hiit', wall(2025, 3, 2, 7, 0), { name: '', duration: 20000 }),
    activity('golf', wall(2025, 3, 3, 9, 0), { name: 'Golf, nine holes', calories: 0 }),
  ]);
  const { rows, stats, skipped } = buildWorkoutRows(workouts);
  assert.deepEqual(rows.map((r) => r.name), ['Strength (06:05)', 'strength (18:30)', 'Strength', 'HIIT', 'Golf, nine holes']);
  assert.equal(stats.renamed, 2);
  assert.equal(new Set(rows.map((r) => workoutIdentity(String(r.name), String(r.date)))).size, rows.length);
  assert.equal(rows[0].duration_min, 62);
  assert.equal(rows[0].purpose, 'Strength');
  assert.equal(rows[0].overall_feeling, 4);
  assert.equal(rows[3].duration_min, ''); // 20 s rounds to 0 minutes: blank, never 0
  assert.equal(rows[4].purpose, '');
  for (const r of rows) assert.ok(!String(r.notes).includes(','));
  assert.equal(skipped.find((s) => s.reason.startsWith('workouts shorter than 30 seconds'))?.count, 1);

  // The file as the Data Hub reads it: quoted names keep their commas, durations are whole minutes.
  const lines = toCsv(WORKOUT_COLUMNS, rows).trim().split('\n');
  const header = splitCsvLine(lines[0]);
  const golf = splitCsvLine(lines[5]);
  assert.equal(golf[header.indexOf('name')], 'Golf, nine holes');
  for (const line of lines.slice(1)) {
    const duration = splitCsvLine(line)[header.indexOf('duration_min')];
    assert.ok(duration === '' || /^\d+$/.test(duration));
  }
});

test('workouts --exercises: named sets become exercise rows with per-set reps, pounds and seconds', () => {
  const { workouts } = prepareActivities([
    activity('strength_training', wall(2025, 3, 1, 6, 5), {
      name: 'Strength',
      summarizedExerciseSets: [
        { category: 'LATERAL_RAISE', sets: 3, reps: 31, maxWeight: 16000, duration: 95000 },
        { category: 'UNKNOWN', sets: 1, reps: 10 },
        { category: 'PLANK', sets: 0, reps: 0, maxWeight: 0, duration: 60000 },
      ],
    }),
  ]);
  const { rows, stats, skipped } = buildWorkoutRows(workouts, { exercises: true });
  assert.equal(rows.length, 3);
  assert.equal(rows[0].exercise_name, '');
  assert.deepEqual(rows[1], {
    date: '2025-03-01', name: 'Strength', exercise_name: 'Lateral Raise',
    sets_completed: 3, reps_completed: 10, weight_lbs: 35.3, duration_sec: 95,
  });
  assert.equal(rows[2].sets_completed, '');
  assert.equal(rows[2].reps_completed, '');
  assert.equal(rows[2].weight_lbs, '');
  assert.equal(stats.exerciseRows, 2);
  assert.equal(skipped.find((s) => s.reason.startsWith('exercise sets with no named exercise'))?.count, 1);
});

test('chunkByGroup never cuts a workout in two and stays under the cap', () => {
  const rows = [];
  for (let w = 0; w < 30; w++) for (let e = 0; e < 4; e++) rows.push({ name: `W${w}`, date: '2025-01-01', e });
  const chunks = chunkByGroup(rows, 50, (r: { name: string; date: string }) => `${r.name}::${r.date}`);
  assert.equal(chunks.flat().length, rows.length);
  for (const c of chunks) assert.ok(c.length <= 50);
  const owner = new Map<string, number>();
  chunks.forEach((c, i) => c.forEach((r: { name: string }) => {
    assert.ok(!owner.has(r.name) || owner.get(r.name) === i);
    owner.set(r.name, i);
  }));
  assert.throws(() => chunkByGroup(rows.slice(0, 8), 3, () => 'one'));
});

// ---------------------------------------------------------------------------------------------
// Whole export
// ---------------------------------------------------------------------------------------------

test('convertExport: health files hold at most 365 days, named by their range', () => {
  const days = [];
  const start = Date.UTC(2024, 0, 1);
  for (let i = 0; i < 400; i++) days.push(uds(new Date(start + i * 86400000).toISOString().slice(0, 10)));
  const { files, summary } = convertExport({ uds: days, activities: [] });
  const health = files.filter((f: { kind: string }) => f.kind === 'health');
  assert.deepEqual(health.map((f: { rows: unknown[] }) => f.rows.length), [HEALTH_MAX_ROWS, 35]);
  assert.equal(health[0].name, 'health-metrics-01-of-02_2024-01-01_to_2024-12-30.csv');
  assert.equal(summary.health.days, 400);
  assert.equal(files.some((f: { kind: string }) => f.kind === 'trips'), false);
});

test('convertExport: workout files split under the 1,000-row cap at workout boundaries', () => {
  const acts = [];
  for (let i = 0; i < 300; i++) {
    acts.push(activity('strength_training', wall(2024, 1, 1, 6, 0) + i * 86400000, {
      name: 'Strength',
      summarizedExerciseSets: [1, 2, 3].map(() => ({ category: 'SQUAT', sets: 3, reps: 30 })),
    }));
  }
  const { files } = convertExport({ activities: acts }, { exercises: true });
  const wk = files.filter((f: { kind: string }) => f.kind === 'workouts');
  assert.equal(wk.length, 2);
  assert.deepEqual(wk.map((f: { name: string }) => f.name), ['workouts-with-exercises-01-of-02.csv', 'workouts-with-exercises-02-of-02.csv']);
  for (const f of wk) assert.ok(f.rows.length <= WORKOUT_MAX_ROWS && f.rows.length % 4 === 0);
});

test('reads an export folder by file pattern and writes the files, replacing only its own output', () => {
  const root = mkdtempSync(join(tmpdir(), 'garmin-conv-test-'));
  try {
    const di = join(root, 'export', 'DI_CONNECT');
    mkdirSync(join(di, 'DI-Connect-Aggregator'), { recursive: true });
    mkdirSync(join(di, 'DI-Connect-Wellness'), { recursive: true });
    mkdirSync(join(di, 'DI-Connect-Fitness'), { recursive: true });
    writeFileSync(join(di, 'DI-Connect-Aggregator', 'UDSFile_2025-01-01_2025-04-10.json'), JSON.stringify([uds('2025-01-01'), uds('2025-01-02')]));
    writeFileSync(join(di, 'DI-Connect-Wellness', '2025-01-01_2025-04-10_1_sleepData.json'), JSON.stringify([night('2025-01-02')]));
    writeFileSync(join(di, 'DI-Connect-Wellness', '1_userBioMetrics.json'), JSON.stringify([weighIn('2025-01-02T07:00:00.0', 88450, 1)]));
    writeFileSync(join(di, 'DI-Connect-Fitness', 'someone_7_summarizedActivities.json'), JSON.stringify([{
      summarizedActivitiesExport: [activity('walking', wall(2025, 1, 2, 12, 0)), activity('yoga', wall(2025, 1, 2, 19, 0))],
    }]));

    const found = findDiConnect(join(root, 'export'));
    assert.equal(found, di);
    assert.equal(findDiConnect(di), di);
    const { data, fileCounts } = readExport(found as string);
    assert.deepEqual(fileCounts, { uds: 1, hydration: 0, sleep: 1, bio: 1, bloodPressure: 0, activities: 1 });

    const out = join(root, 'out');
    mkdirSync(out);
    writeFileSync(join(out, 'health-metrics-09-of-09_old.csv'), 'stale');
    writeFileSync(join(out, 'keep-me.txt'), 'mine');
    const { files, summary } = convertExport(data);
    writeOutputs(out, files, summaryText(summary, { fileCounts }));
    assert.deepEqual(readdirSync(out).sort(), [
      'health-metrics-01-of-01_2025-01-01_to_2025-01-02.csv',
      'keep-me.txt',
      'summary.txt',
      'trips-garmin-activities.csv',
      'workouts.csv',
    ]);
    const health = readFileSync(join(out, 'health-metrics-01-of-01_2025-01-01_to_2025-01-02.csv'), 'utf8').trim().split('\n');
    assert.equal(health.length, 3);
    assert.equal(health[2], '2025-01-02,50,8000,6.1,30,80,95.46,400,30,90,195,');
    const summaryFile = readFileSync(join(out, 'summary.txt'), 'utf8');
    assert.match(summaryFile, /HEALTH METRICS: 2 days, 2025-01-01 to 2025-01-02/);
    assert.match(summaryFile, /TRIPS: 1 activities/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('parseArgs: input, --out, --since date check, flags', () => {
  assert.deepEqual(parseArgs(['exp', '--out', 'o', '--since', '2026-02-25', '--exercises', '--with-notes']), {
    input: 'exp', out: 'o', since: '2026-02-25', exercises: true, withNotes: true, help: false,
  });
  assert.throws(() => parseArgs([]));
  assert.throws(() => parseArgs(['exp', '--since', '2026-02-30']));
  assert.throws(() => parseArgs(['exp', '--bogus']));
});
