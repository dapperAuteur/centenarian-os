// tests/unit/trip-template-stops.test.ts
// Run: npm run test:unit
//
// Multi-stop trip templates (lib/travel/template-stops.ts): the stops a route
// is saved as, the legs Quick log reads back, the card totals, and the repair
// planning for templates saved by the old writers (lib/travel/template-stop-repair.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMinutes,
  formatTemplateTotals,
  legVehicleId,
  legsToTemplateStops,
  normalizeTripPurpose,
  singleLegRoundTrip,
  templateFromRoute,
  templateRoundTripFlag,
  templateStopsToLegs,
  templateSummary,
  type TemplateLegInput,
} from '../../lib/travel/template-stops.ts';
import {
  expectedStops,
  findOriginalRoute,
  matchStopPattern,
  planStopRepair,
} from '../../lib/travel/template-stop-repair.ts';

const CAR = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
const BIKE = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002';
const TMPL = 'tttttttt-0000-4000-8000-000000000001';

/** The legs the Add Trip form sends for Home -> Gym with Round trip ticked. */
const ROUND_TRIP: TemplateLegInput[] = [
  { origin: 'Home', destination: 'Gym', mode: 'car', vehicle_id: CAR, distance_miles: 5, duration_min: 12, cost: null, purpose: 'exercise' },
  { origin: 'Gym', destination: 'Home', mode: 'car', vehicle_id: CAR, distance_miles: 5, duration_min: 12, cost: null, purpose: 'exercise' },
];

const THREE_LEGS: TemplateLegInput[] = [
  { origin: 'A', destination: 'B', mode: 'car', vehicle_id: CAR, distance_miles: 3, duration_min: 8, cost: 1.5, purpose: 'errand' },
  { origin: 'B', destination: 'C', mode: 'bike', vehicle_id: BIKE, distance_miles: 4, duration_min: 10, cost: null, purpose: 'errand' },
  { origin: 'C', destination: 'D', mode: 'walk', vehicle_id: null, distance_miles: 0.6, duration_min: 9, cost: null, purpose: 'leisure' },
];

const ONE_LEG: TemplateLegInput[] = [
  { origin: 'Home', destination: 'Office', mode: 'train', vehicle_id: null, distance_miles: '12.5', duration_min: '40', cost: '6.75', purpose: 'commute' },
];

/** The fields a logged leg must carry over unchanged. */
function legValues(legs: readonly TemplateLegInput[]) {
  return legs.map((l) => ({
    origin: l.origin ?? null,
    destination: l.destination ?? null,
    mode: l.mode,
    vehicle_id: l.vehicle_id ?? null,
    distance_miles: l.distance_miles == null ? null : Number(l.distance_miles),
    duration_min: l.duration_min == null ? null : Number(l.duration_min),
    cost: l.cost == null ? null : Number(l.cost),
    purpose: l.purpose ?? null,
  }));
}

function roundTrip(legs: readonly TemplateLegInput[], isRoundTrip: boolean) {
  const stops = legsToTemplateStops(legs, TMPL);
  return templateStopsToLegs(stops, { mode: 'car', purpose: null, is_round_trip: isRoundTrip }).map((l) => ({
    origin: l.origin,
    destination: l.destination,
    mode: l.mode,
    vehicle_id: l.vehicle_id,
    distance_miles: l.distance_miles,
    duration_min: l.duration_min,
    cost: l.cost,
    purpose: l.purpose,
  }));
}

// ─── Save and reload ─────────────────────────────────────────────────────────

test('legsToTemplateStops: N legs give N + 1 stops, stop 0 carries no leg details', () => {
  for (const legs of [ONE_LEG, ROUND_TRIP, THREE_LEGS]) {
    const stops = legsToTemplateStops(legs, TMPL);
    assert.equal(stops.length, legs.length + 1);
    assert.deepEqual(stops.map((s) => s.stop_order), stops.map((_, i) => i));
    assert.ok(stops.every((s) => s.template_id === TMPL));
    const [start] = stops;
    assert.equal(start.location_name, legs[0].origin);
    for (const field of ['mode', 'vehicle_id', 'distance_miles', 'duration_min', 'cost', 'purpose', 'notes'] as const) {
      assert.equal(start[field], null, `stop 0 ${field}`);
    }
  }
});

test('legsToTemplateStops: stop k holds the leg that ends there', () => {
  const stops = legsToTemplateStops(THREE_LEGS, TMPL);
  assert.deepEqual(
    stops.slice(1).map((s) => [s.location_name, s.mode, s.vehicle_id, s.distance_miles, s.duration_min, s.cost, s.purpose]),
    [
      ['B', 'car', CAR, 3, 8, 1.5, 'errand'],
      ['C', 'bike', BIKE, 4, 10, null, 'errand'],
      ['D', 'walk', null, 0.6, 9, null, 'leisure'],
    ],
  );
  // The last stop is never left empty.
  assert.equal(stops[stops.length - 1].distance_miles, 0.6);
});

test('legsToTemplateStops: numeric strings become numbers, minutes are whole', () => {
  const stops = legsToTemplateStops([{ ...ONE_LEG[0], duration_min: '40.4' }], TMPL);
  assert.equal(stops[1].distance_miles, 12.5);
  assert.equal(stops[1].duration_min, 40);
  assert.equal(stops[1].cost, 6.75);
  assert.deepEqual(legsToTemplateStops([], TMPL), []);
});

test('save then Quick log: a one-leg route keeps distance, duration, mode and vehicle', () => {
  assert.deepEqual(roundTrip(ONE_LEG, false), legValues(ONE_LEG));
});

test('save then Quick log: a round trip keeps both legs (10 mi / 24 min, not 5 / 12)', () => {
  const legs = roundTrip(ROUND_TRIP, true);
  assert.deepEqual(legs, legValues(ROUND_TRIP));
  // Its stops end where they start, so no extra return leg is added.
  assert.equal(legs.length, 2);
  assert.equal(legs.reduce((s, l) => s + (l.distance_miles ?? 0), 0), 10);
  assert.equal(legs.reduce((s, l) => s + (l.duration_min ?? 0), 0), 24);
});

test('save then Quick log: a three-leg route keeps every leg (leg 0 included)', () => {
  assert.deepEqual(roundTrip(THREE_LEGS, false), legValues(THREE_LEGS));
});

// ─── Save as reusable template (POST /api/travel/routes) ─────────────────────

/** The trips rows the route stored for `legs`, as the request sent them except where noted. */
function storedRows(legs: readonly TemplateLegInput[], overrides: Record<number, Partial<TemplateLegInput>> = {}) {
  return legs.map((leg, i) => ({ ...leg, trip_category: 'travel', tax_category: 'personal', ...overrides[i] }));
}

/** What Quick log records from a template built by templateFromRoute. */
function quickLog(built: NonNullable<ReturnType<typeof templateFromRoute>>) {
  const legs = templateStopsToLegs(built.stops(TMPL), built.row);
  return {
    legs: legs.length,
    miles: legs.reduce((s, l) => s + (l.distance_miles ?? 0), 0),
    minutes: legs.reduce((s, l) => s + (l.duration_min ?? 0), 0),
  };
}

test('templateFromRoute: a round trip is a multi-stop template that logs both legs (10 mi / 24 min)', () => {
  const built = templateFromRoute(storedRows(ROUND_TRIP), ROUND_TRIP, { name: ' Gym run ', is_round_trip: true, notes: ' ', brand_id: '' });
  assert.ok(built);
  assert.deepEqual(built.row, {
    name: 'Gym run', mode: 'car', vehicle_id: CAR, origin: 'Home', destination: null,
    distance_miles: null, duration_min: null, cost: null, purpose: 'exercise',
    trip_category: 'travel', tax_category: 'personal', notes: null,
    is_round_trip: true, is_multi_stop: true, brand_id: null,
  });
  assert.equal(built.stops(TMPL).length, 3);
  assert.deepEqual(quickLog(built), { legs: 2, miles: 10, minutes: 24 });
});

test('templateFromRoute: stops come from the stored rows, so a distance worked out from coordinates is kept', () => {
  // Add Trip sent coordinates and no distance; the route stored the OSRM result.
  const requested = THREE_LEGS.map((leg, i) => (i === 1 ? { ...leg, distance_miles: null, duration_min: null } : leg));
  const built = templateFromRoute(storedRows(requested, { 1: { distance_miles: 4.2, duration_min: 11 } }), requested, { name: 'Errands' });
  assert.ok(built);
  const stops = built.stops(TMPL);
  assert.equal(stops.length, 4);
  assert.deepEqual(stops.map((st) => st.distance_miles), [null, 3, 4.2, 0.6]);
  assert.deepEqual(stops.map((st) => st.duration_min), [null, 8, 11, 9]);
  assert.equal(built.row.is_round_trip, false);
  assert.deepEqual(quickLog(built), { legs: 3, miles: 7.8, minutes: 28 });
});

test('templateFromRoute then Quick log: a later car leg saved with no vehicle stays without one', () => {
  // Home -> Airport in their own car, a flight, then a rental car with no
  // vehicle picked. The template row takes the first leg's vehicle (CAR), and
  // the rental leg must not log with it: its miles would add to CAR's work
  // miles, IRS mileage and fuel cost on every Quick log.
  const route: TemplateLegInput[] = [
    { origin: 'Home', destination: 'Airport', mode: 'car', vehicle_id: CAR, distance_miles: 20, duration_min: 30, purpose: 'work' },
    { origin: 'Airport', destination: 'DEN', mode: 'plane', vehicle_id: null, distance_miles: 900, duration_min: 150, purpose: 'work' },
    { origin: 'DEN', destination: 'Hotel', mode: 'car', vehicle_id: null, distance_miles: 25, duration_min: 35, purpose: 'work' },
  ];
  const built = templateFromRoute(storedRows(route), route, { name: 'Denver work trip' });
  assert.ok(built);
  assert.equal(built.row.mode, 'car');
  assert.equal(built.row.vehicle_id, CAR);
  const legs = templateStopsToLegs(built.stops(TMPL), built.row);
  assert.deepEqual(
    legs.map((l) => ({ origin: l.origin, destination: l.destination, mode: l.mode, vehicle_id: l.vehicle_id, distance_miles: l.distance_miles })),
    route.map((l) => ({ origin: l.origin, destination: l.destination, mode: l.mode, vehicle_id: l.vehicle_id, distance_miles: l.distance_miles })),
  );
});

test('templateFromRoute: one leg is a single-leg template with its values on the row', () => {
  const requested = [{ ...ONE_LEG[0], distance_miles: null }];
  const built = templateFromRoute(storedRows(requested, { 0: { distance_miles: 12.5 } }), requested, { name: 'Commute', notes: ' Train ' });
  assert.ok(built);
  assert.equal(built.row.is_multi_stop, false);
  assert.equal(built.row.destination, 'Office');
  assert.equal(built.row.distance_miles, 12.5);
  assert.equal(built.row.duration_min, 40);
  assert.equal(built.row.cost, 6.75);
  assert.equal(built.row.notes, 'Train');
  assert.deepEqual(built.stops(TMPL), []);
});

test('templateFromRoute: a one-leg loop with Round trip ticked is not flagged, so it logs once', () => {
  const loop: TemplateLegInput[] = [{ origin: 'Home', destination: 'Home', mode: 'bike', vehicle_id: BIKE, distance_miles: 10, duration_min: 40 }];
  const built = templateFromRoute(storedRows(loop), loop, { name: 'Saturday bike loop', is_round_trip: true });
  assert.ok(built);
  assert.equal(built.row.is_round_trip, false);
  assert.equal(templateSummary(built.row).distance_miles, 10);
});

test('templateFromRoute: categories fall back to the request; no name or no legs saves nothing', () => {
  const stored = [{ ...ONE_LEG[0], trip_category: null, tax_category: null }];
  const built = templateFromRoute(stored, [{ ...ONE_LEG[0], trip_category: 'fitness', tax_category: 'business' }], { name: 'X' });
  assert.equal(built?.row.trip_category, 'fitness');
  assert.equal(built?.row.tax_category, 'business');
  assert.equal(templateFromRoute(storedRows(ONE_LEG), ONE_LEG, { name: '  ' }), null);
  assert.equal(templateFromRoute([], [], { name: 'Empty' }), null);
});

test('templateStopsToLegs: sorts by stop_order and falls back to the template mode and purpose', () => {
  const legs = templateStopsToLegs(
    [
      { stop_order: 2, location_name: 'C', mode: null, distance_miles: 4, duration_min: 10, purpose: null },
      { stop_order: 0, location_name: 'A' },
      { stop_order: 1, location_name: 'B', mode: 'bus', distance_miles: '3.25', duration_min: 8, purpose: 'work' },
    ],
    { mode: 'car', purpose: 'errand', is_round_trip: false },
  );
  assert.deepEqual(
    legs.map((l) => [l.leg_order, l.origin, l.destination, l.mode, l.distance_miles, l.duration_min, l.purpose, l.is_return]),
    [
      [0, 'A', 'B', 'bus', 3.25, 8, 'work', false],
      [1, 'B', 'C', 'car', 4, 10, 'errand', false],
    ],
  );
});

test('templateStopsToLegs: a round-trip template that does not return to the start gets a summed return leg', () => {
  const stops = legsToTemplateStops(THREE_LEGS, TMPL);
  const legs = templateStopsToLegs(stops, { mode: 'car', purpose: null, is_round_trip: true });
  assert.equal(legs.length, 4);
  const ret = legs[3];
  assert.equal(ret.is_return, true);
  assert.equal(ret.leg_order, 3);
  assert.equal(ret.origin, 'D');
  assert.equal(ret.destination, 'A');
  assert.equal(ret.mode, 'walk');
  assert.equal(ret.vehicle_id, null);
  assert.equal(ret.distance_miles, 7.6);
  assert.equal(ret.duration_min, 27);
  assert.equal(ret.cost, 1.5);
  assert.equal(ret.purpose, 'leisure');
});

test('templateStopsToLegs: no return leg when the stops already close the loop (any case or spacing)', () => {
  const legs = templateStopsToLegs(
    [
      { stop_order: 0, location_name: 'Home' },
      { stop_order: 1, location_name: 'Gym', mode: 'car', distance_miles: 5, duration_min: 12 },
      { stop_order: 2, location_name: ' home ', mode: 'car', distance_miles: 5, duration_min: 12 },
    ],
    { mode: 'car', is_round_trip: true },
  );
  assert.equal(legs.length, 2);
  assert.ok(legs.every((l) => !l.is_return));
});

test('templateStopsToLegs: a leg with a mode and no vehicle logs with no vehicle, even with a template vehicle', () => {
  // A leg saved with no vehicle (a rental, a colleague's car) must not log
  // with the template's vehicle: its miles would count as that vehicle's.
  const legs = templateStopsToLegs(
    [
      { stop_order: 0, location_name: 'Home' },
      { stop_order: 1, location_name: 'Gym', mode: 'car', vehicle_id: CAR, distance_miles: 5, duration_min: 12 },
      { stop_order: 2, location_name: 'Office', mode: 'car', vehicle_id: null, distance_miles: 6, duration_min: 15 },
    ],
    { mode: 'car', vehicle_id: CAR, is_round_trip: true },
  );
  assert.deepEqual(legs.map((l) => [l.mode, l.vehicle_id, l.is_return]), [
    ['car', CAR, false],
    ['car', null, false],
    // The return leg takes the last leg's mode and vehicle.
    ['car', null, true],
  ]);
});

test('templateStopsToLegs: only a stop with no mode and no vehicle takes the template mode and vehicle', () => {
  const tmpl = { mode: 'car', vehicle_id: CAR, is_round_trip: false };
  const legs = templateStopsToLegs(
    [
      { stop_order: 0, location_name: 'A' },
      // No mode or vehicle (an old blank stop): the template's mode and vehicle together.
      { stop_order: 1, location_name: 'B', mode: '', vehicle_id: '' },
      // Its own vehicle wins.
      { stop_order: 2, location_name: 'C', mode: 'bike', vehicle_id: BIKE },
      // Another mode with no vehicle: none (a walk is not driven in the car).
      { stop_order: 3, location_name: 'D', mode: 'walk', vehicle_id: null },
    ],
    tmpl,
  );
  assert.deepEqual(legs.map((l) => [l.mode, l.vehicle_id]), [
    ['car', CAR],
    ['bike', BIKE],
    ['walk', null],
  ]);
  // No template vehicle: nothing to fall back to.
  assert.equal(legVehicleId({ mode: null, vehicle_id: null }, { vehicle_id: null }), null);
  // A mode of its own, even the template's: the leg's own (no) vehicle.
  assert.equal(legVehicleId({ mode: 'car', vehicle_id: null }, { vehicle_id: CAR }), null);
  assert.equal(legVehicleId({ mode: ' ', vehicle_id: null }, { vehicle_id: CAR }), CAR);
  assert.equal(legVehicleId({ mode: null, vehicle_id: BIKE }, { vehicle_id: CAR }), BIKE);
});

test('templateStopsToLegs: fewer than two stops log nothing', () => {
  assert.deepEqual(templateStopsToLegs([], { mode: 'car', is_round_trip: true }), []);
  assert.deepEqual(templateStopsToLegs([{ stop_order: 0, location_name: 'A' }], { mode: 'car', is_round_trip: true }), []);
});

test('templateRoundTripFlag: a one-leg loop is not flagged, so Quick log does not count it twice', () => {
  // Round trip ticked on Home -> Home (a bike loop): the form adds no return leg.
  assert.equal(templateRoundTripFlag(true, [{ origin: 'Home', destination: 'home ', distance_miles: 10 }]), false);
  // One-way leg flagged as a round trip (API callers): kept, Quick log doubles it like a round-trip trip.
  assert.equal(templateRoundTripFlag(true, [{ origin: 'Home', destination: 'Office' }]), true);
  // The form added the return leg: kept.
  assert.equal(templateRoundTripFlag(true, ROUND_TRIP), true);
  assert.equal(templateRoundTripFlag(false, ROUND_TRIP), false);
  assert.equal(templateRoundTripFlag(undefined, ONE_LEG), false);
  assert.equal(templateRoundTripFlag(true, [{ origin: null, destination: null }]), true);
});

test('singleLegRoundTrip: a loop saved or edited with Round trip ticked is read as one trip', () => {
  // "Saturday bike loop" saved before templateRoundTripFlag(): Home -> Home, 10 mi, flag set.
  assert.equal(singleLegRoundTrip({ is_round_trip: true, origin: 'Home', destination: 'Home' }), false);
  assert.equal(singleLegRoundTrip({ is_round_trip: true, origin: ' home', destination: 'HOME ' }), false);
  // A one-way template flagged as a round trip still doubles, like a round-trip trip.
  assert.equal(singleLegRoundTrip({ is_round_trip: true, origin: 'Home', destination: 'Office' }), true);
  // No origin: nothing says it is a loop, so the flag is kept (as the writer does).
  assert.equal(singleLegRoundTrip({ is_round_trip: true, origin: null, destination: null }), true);
  assert.equal(singleLegRoundTrip({ is_round_trip: false, origin: 'Home', destination: 'Office' }), false);
  assert.equal(singleLegRoundTrip({ is_round_trip: null, origin: 'Home', destination: 'Office' }), false);
});

test('templateSummary: an old single-leg loop flagged round trip shows its own miles, not double', () => {
  const s = templateSummary({
    is_multi_stop: false, is_round_trip: true, origin: 'Home', destination: 'Home', mode: 'bike', distance_miles: 10, duration_min: 40,
  });
  assert.deepEqual(s, { kind: 'single', stopCount: 2, from: 'Home', to: 'Home', distance_miles: 10, duration_min: 40 });
  assert.equal(formatTemplateTotals(s), '10.0 mi · 40 min');
});

// ─── Purpose ─────────────────────────────────────────────────────────────────

test('normalizeTripPurpose: only values trips.purpose accepts', () => {
  for (const p of ['commute', 'leisure', 'work', 'errand', 'exercise', 'other']) assert.equal(normalizeTripPurpose(p), p);
  assert.equal(normalizeTripPurpose('Commute '), 'commute');
  // The old Edit Template list offered these; trips.purpose rejects them.
  assert.equal(normalizeTripPurpose('fitness'), 'exercise');
  assert.equal(normalizeTripPurpose('business'), 'work');
  assert.equal(normalizeTripPurpose('groceries'), 'other');
  assert.equal(normalizeTripPurpose(''), null);
  assert.equal(normalizeTripPurpose(null), null);
  assert.equal(normalizeTripPurpose(42), null);
});

test('templateStopsToLegs: a legacy stop or template purpose never reaches the insert as is', () => {
  const legs = templateStopsToLegs(
    [
      { stop_order: 0, location_name: 'A' },
      { stop_order: 1, location_name: 'B', purpose: 'fitness' },
      { stop_order: 2, location_name: 'C', purpose: null },
    ],
    { mode: 'bike', purpose: 'business' },
  );
  assert.deepEqual(legs.map((l) => l.purpose), ['exercise', 'work']);
});

// ─── Card totals ─────────────────────────────────────────────────────────────

test('templateSummary: a saved round trip is labelled a round trip with both legs totalled', () => {
  const s = templateSummary({ is_multi_stop: true, is_round_trip: true, mode: 'car', stops: legsToTemplateStops(ROUND_TRIP, TMPL) });
  assert.deepEqual(s, { kind: 'round_trip', stopCount: 3, from: 'Home', to: 'Gym', distance_miles: 10, duration_min: 24 });
  assert.equal(formatTemplateTotals(s), '10.0 mi · 24 min');
});

test('templateSummary: a multi-stop template totals every leg', () => {
  const s = templateSummary({ is_multi_stop: true, is_round_trip: false, mode: 'car', stops: legsToTemplateStops(THREE_LEGS, TMPL) });
  assert.deepEqual(s, { kind: 'multi', stopCount: 4, from: 'A', to: 'D', distance_miles: 7.6, duration_min: 27 });
});

test('templateSummary: a multi-stop round trip that does not close includes the return leg', () => {
  const s = templateSummary({ is_multi_stop: true, is_round_trip: true, mode: 'car', stops: legsToTemplateStops(THREE_LEGS, TMPL) });
  assert.equal(s.kind, 'multi');
  assert.equal(s.distance_miles, 15.2);
  assert.equal(s.duration_min, 54);
});

test('templateSummary: single-leg templates show their saved values, doubled for a round trip', () => {
  const base = { is_multi_stop: false, origin: 'Home', destination: 'Office', mode: 'car', distance_miles: '12.5', duration_min: 30 };
  assert.deepEqual(templateSummary({ ...base, is_round_trip: false }), {
    kind: 'single', stopCount: 2, from: 'Home', to: 'Office', distance_miles: 12.5, duration_min: 30,
  });
  const rt = templateSummary({ ...base, is_round_trip: true });
  assert.equal(rt.kind, 'round_trip');
  assert.equal(rt.distance_miles, 25);
  assert.equal(rt.duration_min, 60);
  const empty = templateSummary({ ...base, distance_miles: null, duration_min: null });
  assert.equal(formatTemplateTotals(empty), '');
});

test('formatMinutes and formatTemplateTotals', () => {
  assert.equal(formatMinutes(24), '24 min');
  assert.equal(formatMinutes(60), '1 h');
  assert.equal(formatMinutes(65), '1 h 5 min');
  assert.equal(formatTemplateTotals({ distance_miles: 3, duration_min: null }), '3.0 mi');
  assert.equal(formatTemplateTotals({ distance_miles: null, duration_min: 90 }), '1 h 30 min');
});

// ─── Repairing templates saved by the old writers ────────────────────────────

/** Stop rows as the database returns them, with ids. */
function asRows(stops: ReturnType<typeof expectedStops>) {
  return stops.map((s, i) => ({ id: `stop-${i}`, stop_order: i, ...s }));
}

test('expectedStops: the old writer moved every leg one stop early and lost leg 0', () => {
  // Worked example from the investigation: A -> B (3 mi) -> C (4 mi).
  const legs: TemplateLegInput[] = [
    { origin: 'A', destination: 'B', mode: 'car', distance_miles: 3, duration_min: 8 },
    { origin: 'B', destination: 'C', mode: 'car', distance_miles: 4, duration_min: 10 },
  ];
  const shifted = expectedStops('shifted', legs);
  assert.deepEqual(shifted.map((s) => [s.location_name, s.distance_miles, s.duration_min]), [
    ['A', null, null],
    ['B', 4, 10],
    ['C', null, null],
  ]);
  // Quick log on those stops recorded 4 / 10 instead of 7 / 18.
  const logged = templateStopsToLegs(asRows(shifted), { mode: 'car' });
  assert.deepEqual(logged.map((l) => l.distance_miles), [4, null]);
});

test('matchStopPattern: recognises the right stops and each old writer, and nothing edited since', () => {
  assert.equal(matchStopPattern(legsToTemplateStops(THREE_LEGS, TMPL), THREE_LEGS), 'correct');
  for (const pattern of ['shifted', 'early', 'original'] as const) {
    assert.equal(matchStopPattern(asRows(expectedStops(pattern, THREE_LEGS)), THREE_LEGS), pattern);
    assert.equal(matchStopPattern(asRows(expectedStops(pattern, ROUND_TRIP)), ROUND_TRIP), pattern);
  }
  // A stop changed in Edit Template after saving matches nothing.
  const edited = asRows(expectedStops('shifted', THREE_LEGS));
  edited[1] = { ...edited[1], distance_miles: 9 };
  assert.equal(matchStopPattern(edited, THREE_LEGS), null);
  // Stored NUMERIC values may come back as strings.
  const asStrings = asRows(expectedStops('shifted', ROUND_TRIP)).map((s) => ({
    ...s,
    distance_miles: s.distance_miles === null ? null : String(s.distance_miles),
  }));
  assert.equal(matchStopPattern(asStrings, ROUND_TRIP), 'shifted');
  assert.equal(matchStopPattern([], []), null);
});

test('planStopRepair: rebuilds shifted stops in place from the route legs', () => {
  const stops = asRows(expectedStops('shifted', ROUND_TRIP));
  const plan = planStopRepair(stops, ROUND_TRIP);
  assert.equal(plan.action, 'repair');
  assert.equal(plan.pattern, 'shifted');
  assert.deepEqual(plan.updates.map((u) => u.id), ['stop-0', 'stop-1', 'stop-2']);
  // The repaired stops now log Home -> Gym 5/12 and Gym -> Home 5/12.
  const repaired = plan.updates.map((u) => ({ stop_order: u.stop_order, ...u.values }));
  assert.deepEqual(roundTripFromStops(repaired), legValues(ROUND_TRIP));
});

function roundTripFromStops(stops: Parameters<typeof templateStopsToLegs>[0]) {
  return templateStopsToLegs(stops, { mode: 'car', is_round_trip: true }).map((l) => ({
    origin: l.origin,
    destination: l.destination,
    mode: l.mode,
    vehicle_id: l.vehicle_id,
    distance_miles: l.distance_miles,
    duration_min: l.duration_min,
    cost: l.cost,
    purpose: l.purpose,
  }));
}

test('planStopRepair: leaves right stops alone and lists edited ones for a manual fix', () => {
  const ok = planStopRepair(legsToTemplateStops(THREE_LEGS, TMPL).map((s, i) => ({ ...s, id: `s${i}` })), THREE_LEGS);
  assert.equal(ok.action, 'none');
  assert.deepEqual(ok.updates, []);

  const edited = asRows(expectedStops('shifted', THREE_LEGS));
  edited.pop();
  const manual = planStopRepair(edited, THREE_LEGS);
  assert.equal(manual.action, 'manual');
  assert.deepEqual(manual.updates, []);

  const noRoute = planStopRepair(asRows(expectedStops('shifted', THREE_LEGS)), []);
  assert.equal(noRoute.action, 'manual');
  assert.match(noRoute.reason, /not found/);
});

test('planStopRepair: the pre-2026-03-17 (and Work.WitUS) pattern is repaired only when asked', () => {
  const stops = asRows(expectedStops('original', THREE_LEGS));
  const listed = planStopRepair(stops, THREE_LEGS);
  assert.equal(listed.action, 'manual');
  assert.equal(listed.pattern, 'original');
  assert.match(listed.reason, /--include-original/);
  const repaired = planStopRepair(stops, THREE_LEGS, { includeOriginal: true });
  assert.equal(repaired.action, 'repair');
  assert.equal(repaired.updates.length, 4);
});

test('findOriginalRoute: the route saved just before the template, not ones logged from it later', () => {
  const created = '2026-05-01T12:00:05.000Z';
  const routes = [
    { id: 'logged-later', created_at: '2026-05-02T08:00:00.000Z' },
    { id: 'original', created_at: '2026-05-01T12:00:04.200Z' },
    { id: 'much-older', created_at: '2026-04-01T12:00:00.000Z' },
  ];
  assert.equal(findOriginalRoute(routes, created)?.id, 'original');
  assert.equal(findOriginalRoute(routes.filter((r) => r.id !== 'original'), created), null);
  assert.equal(findOriginalRoute(routes, 'not a date'), null);
});
