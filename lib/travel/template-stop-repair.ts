// lib/travel/template-stop-repair.ts
// Planning for scripts/repair-trip-template-stops.ts: which saved multi-stop
// trip templates hold stops written by an old, broken writer, and the stops
// they should hold instead (lib/travel/template-stops.ts has the convention).
//
// A template is rebuilt only from the route it was saved from (the route with
// its template_id, created just before the template), and only when its stops
// still match, field for field, what one of the old writers produced from that
// route's legs, each stop allowing its right value too (a repair run that
// stopped part way). Anything else was edited since and is listed for a manual fix.
//
// The old writers, all N legs -> N + 1 stops with an empty last stop:
//   'shifted'  CentOS 2026-03-23 to this fix (79e426c): stop i at leg i's origin
//              with leg i's details, stop 0's details blank. Leg 0's values lost.
//   'early'    CentOS 2026-03-17 to 03-23 (27ac676): the same, but stop i (i >= 1)
//              named after leg i's destination.
//   'original' CentOS before 2026-03-17, and Work.WitUS's writer today: stop i
//              named as in 'early', with leg i's distance, duration, cost,
//              purpose and notes on every stop including stop 0, no vehicle.
//
// Pure: kept free of '@/' imports so node --test can load it
// (tests/unit/trip-template-stops.test.ts).

import {
  legsToTemplateStops,
  sortedStops,
  toNumberOrNull,
  type TemplateLegInput,
  type TemplateStop,
} from './template-stops.ts';

export type StopPattern = 'correct' | 'shifted' | 'early' | 'original';

/** The comparable fields of one stop. */
interface StopValues {
  location_name: string | null;
  mode: string | null;
  vehicle_id: string | null;
  distance_miles: number | null;
  duration_min: number | null;
  cost: number | null;
  purpose: string | null;
  notes: string | null;
}

const BLANK_DETAILS = {
  mode: null,
  vehicle_id: null,
  distance_miles: null,
  duration_min: null,
  cost: null,
  purpose: null,
  notes: null,
} as const;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function details(leg: TemplateLegInput, withVehicle = true): Omit<StopValues, 'location_name'> {
  const minutes = toNumberOrNull(leg.duration_min);
  return {
    mode: text(leg.mode),
    vehicle_id: withVehicle ? text(leg.vehicle_id) : null,
    distance_miles: toNumberOrNull(leg.distance_miles),
    duration_min: minutes === null ? null : Math.round(minutes),
    cost: toNumberOrNull(leg.cost),
    purpose: text(leg.purpose),
    notes: text(leg.notes),
  };
}

/** What the writer named by `pattern` stored for a route of `legs`. */
export function expectedStops(pattern: StopPattern, legs: readonly TemplateLegInput[]): StopValues[] {
  if (legs.length === 0) return [];
  if (pattern === 'correct') {
    return legsToTemplateStops(legs, '').map(({ template_id: _t, stop_order: _o, ...values }) => {
      void _t;
      void _o;
      return values;
    });
  }
  const n = legs.length;
  const stops: StopValues[] = legs.map((leg, i) => {
    const location = pattern === 'shifted' || i === 0 ? text(leg.origin) : text(leg.destination);
    if (pattern === 'original') {
      return { location_name: location, ...details(leg, false), mode: i === 0 ? null : text(leg.mode) };
    }
    // 'shifted' and 'early': stop 0 keeps only the leg's notes.
    if (i === 0) return { location_name: location, ...BLANK_DETAILS, notes: text(leg.notes) };
    return { location_name: location, ...details(leg) };
  });
  stops.push({ location_name: text(legs[n - 1].destination), ...BLANK_DETAILS });
  return stops;
}

function sameNumber(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) < 0.005;
}

function stopValues(stop: TemplateStop): StopValues {
  const minutes = toNumberOrNull(stop.duration_min);
  return {
    location_name: text(stop.location_name),
    mode: text(stop.mode),
    vehicle_id: text(stop.vehicle_id),
    distance_miles: toNumberOrNull(stop.distance_miles),
    duration_min: minutes === null ? null : Math.round(minutes),
    cost: toNumberOrNull(stop.cost),
    purpose: text(stop.purpose),
    notes: text(stop.notes),
  };
}

function sameStop(stop: TemplateStop, e: StopValues): boolean {
  const a = stopValues(stop);
  return a.location_name === e.location_name
    && a.mode === e.mode
    && a.vehicle_id === e.vehicle_id
    && sameNumber(a.distance_miles, e.distance_miles)
    && sameNumber(a.duration_min, e.duration_min)
    && sameNumber(a.cost, e.cost)
    && a.purpose === e.purpose
    && a.notes === e.notes;
}

function sameStops(actual: readonly TemplateStop[], expected: readonly StopValues[]): boolean {
  if (actual.length !== expected.length) return false;
  return actual.every((stop, i) => sameStop(stop, expected[i]));
}

const BROKEN_PATTERNS = ['shifted', 'early', 'original'] as const;
type BrokenPattern = (typeof BROKEN_PATTERNS)[number];

/**
 * Which writer produced `stops` from `legs` (the template's original route, in
 * leg_order), or null when they match none of them: the stops or the route
 * were edited since. 'correct' is checked first; it never also matches a
 * broken pattern, whose last stop has no mode.
 */
export function matchStopPattern(stops: readonly TemplateStop[], legs: readonly TemplateLegInput[]): StopPattern | null {
  if (legs.length === 0) return null;
  const ordered = sortedStops(stops);
  for (const pattern of ['correct', 'shifted', 'early', 'original'] as const) {
    if (sameStops(ordered, expectedStops(pattern, legs))) return pattern;
  }
  return null;
}

/**
 * The broken writer behind a template that a repair run only partly rewrote
 * (the script updates one stop per request, so a run can stop between two):
 * every stop still holds either what that writer stored or its right value,
 * and at least one still holds the broken value. Null when the stops match no
 * writer that way, or match the right values throughout.
 */
export function matchPartlyRepaired(stops: readonly TemplateStop[], legs: readonly TemplateLegInput[]): BrokenPattern | null {
  if (legs.length === 0) return null;
  const ordered = sortedStops(stops);
  const correct = expectedStops('correct', legs);
  if (ordered.length !== correct.length) return null;
  for (const pattern of BROKEN_PATTERNS) {
    const broken = expectedStops(pattern, legs);
    const eachIsEither = ordered.every((stop, i) => sameStop(stop, broken[i]) || sameStop(stop, correct[i]));
    const someStillBroken = ordered.some((stop, i) => !sameStop(stop, correct[i]));
    if (eachIsEither && someStillBroken) return pattern;
  }
  return null;
}

export interface StopUpdate {
  id: string;
  stop_order: number;
  values: StopValues;
}

export interface StopRepairPlan {
  pattern: StopPattern | null;
  /** 'none': already right. 'repair': update `updates`. 'manual': list it for Edit Template. */
  action: 'none' | 'repair' | 'manual';
  reason: string;
  /** One update per existing stop row, by id (rows are updated in place, never deleted). */
  updates: StopUpdate[];
}

export interface PlanOptions {
  /** Also repair stops in the 'original' pattern (also what Work.WitUS writes). Off by default. */
  includeOriginal?: boolean;
}

/** What to do with one template's stops, given its original route's legs. */
export function planStopRepair(
  stops: readonly (TemplateStop & { id: string })[],
  legs: readonly TemplateLegInput[],
  options: PlanOptions = {},
): StopRepairPlan {
  if (legs.length === 0) {
    return { pattern: null, action: 'manual', reason: 'the route it was saved from was not found', updates: [] };
  }
  const exact = matchStopPattern(stops, legs);
  if (exact === 'correct') {
    return { pattern: exact, action: 'none', reason: 'stops already match the route', updates: [] };
  }
  // A run that failed or stopped part way left some stops repaired: finish it.
  const partly = exact === null ? matchPartlyRepaired(stops, legs) : null;
  const pattern = exact ?? partly;
  if (pattern === null) {
    return {
      pattern,
      action: 'manual',
      reason: 'stops or the route were changed after saving, so the right values are not certain',
      updates: [],
    };
  }
  if (pattern === 'original' && !options.includeOriginal) {
    return {
      pattern,
      action: 'manual',
      reason: 'saved by the pre-2026-03-17 writer (also Work.WitUS\'s); rerun with --include-original to repair',
      updates: [],
    };
  }
  const ordered = sortedStops(stops);
  const correct = expectedStops('correct', legs);
  return {
    pattern,
    action: 'repair',
    reason: partly
      ? `stops match the '${pattern}' writer, partly repaired by an earlier run; rebuilt from the route's legs`
      : `stops match the '${pattern}' writer; rebuilt from the route's legs`,
    updates: ordered.map((stop, i) => ({ id: stop.id, stop_order: stop.stop_order ?? i, values: correct[i] })),
  };
}

export interface RouteRef {
  id: string;
  created_at: string;
}

/** How long before the template its route may have been created (same request, normally milliseconds). */
const ORIGINAL_ROUTE_WINDOW_MS = 10 * 60 * 1000;

/**
 * The route a template was saved from: of the routes carrying its template_id,
 * the latest one created at or before the template itself (and no more than 10
 * minutes before). Routes created after it were logged from the template.
 */
export function findOriginalRoute<T extends RouteRef>(routes: readonly T[], templateCreatedAt: string): T | null {
  const tmplTime = Date.parse(templateCreatedAt);
  if (!Number.isFinite(tmplTime)) return null;
  let best: T | null = null;
  let bestTime = -Infinity;
  for (const route of routes) {
    const t = Date.parse(route.created_at);
    if (!Number.isFinite(t) || t > tmplTime || tmplTime - t > ORIGINAL_ROUTE_WINDOW_MS) continue;
    if (t > bestTime) {
      best = route;
      bestTime = t;
    }
  }
  return best;
}
