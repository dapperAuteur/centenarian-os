// lib/travel/template-stops.ts
// How a multi-stop trip template's stops map to and from route legs.
//
// The one convention every reader and writer shares: stop 0 is the start and
// carries no leg details. Stop k (k >= 1) is where leg k-1 ends, and it carries
// that leg's mode, vehicle, distance, duration, cost and purpose ("distance from
// the previous stop"). So a route of N legs is a template of N + 1 stops.
//
//   writer: "Save as reusable template" in POST /api/travel/routes -> legsToTemplateStops()
//   readers: Quick log (POST /api/travel/templates) -> templateStopsToLegs();
//            Add Trip's "Load from template" and Edit Template map stops 1:1 onto
//            their own stop rows, which use the same convention.
//
// Before this module the writer put leg k's details on stop k (one stop early),
// dropped leg 0's details and left the last stop empty, so every round-trip and
// multi-stop template lost its distance and time.
//
// Kept free of '@/' imports so node --test can load it (tests/unit/trip-template-stops.test.ts).

/** The values trips.purpose accepts (CHECK in supabase/migrations/052_travel_schema.sql). */
export const TRIP_PURPOSES = ['commute', 'leisure', 'work', 'errand', 'exercise', 'other'] as const;
export type TripPurpose = (typeof TRIP_PURPOSES)[number];

/** Values the old Edit Template purpose list offered, which trips.purpose rejects. */
const LEGACY_PURPOSES: Readonly<Record<string, TripPurpose>> = {
  fitness: 'exercise',
  business: 'work',
};

/**
 * A template purpose as trips.purpose accepts it. Blank gives null; the old
 * Edit Template values 'fitness' and 'business' become 'exercise' and 'work';
 * anything else unknown becomes 'other' rather than failing the insert.
 */
export function normalizeTripPurpose(value: unknown): TripPurpose | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if ((TRIP_PURPOSES as readonly string[]).includes(v)) return v as TripPurpose;
  return LEGACY_PURPOSES[v] ?? 'other';
}

/** A finite number from a number or numeric string (PostgREST may send NUMERIC as either); else null. */
export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Whole minutes (trips.duration_min and trip_template_stops.duration_min are INT). */
function toMinutesOrNull(value: unknown): number | null {
  const n = toNumberOrNull(value);
  return n === null ? null : Math.round(n);
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim() ? value : null;
}

/** One leg of a route as it was saved (a trips row, or a request leg). */
export interface TemplateLegInput {
  origin?: string | null;
  destination?: string | null;
  mode?: string | null;
  vehicle_id?: string | null;
  distance_miles?: number | string | null;
  duration_min?: number | string | null;
  cost?: number | string | null;
  purpose?: string | null;
  notes?: string | null;
}

/** A trip_template_stops row to insert. */
export interface TemplateStopRow {
  template_id: string;
  stop_order: number;
  location_name: string | null;
  mode: string | null;
  vehicle_id: string | null;
  distance_miles: number | null;
  duration_min: number | null;
  cost: number | null;
  purpose: string | null;
  notes: string | null;
}

/**
 * The stops for a template saved from a route of `legs` (N legs -> N + 1 stops).
 * Pass the legs as they were stored (the created trips rows), so a distance or
 * duration the server worked out is saved too.
 */
export function legsToTemplateStops(legs: readonly TemplateLegInput[], templateId: string): TemplateStopRow[] {
  if (legs.length === 0) return [];
  const start: TemplateStopRow = {
    template_id: templateId,
    stop_order: 0,
    location_name: textOrNull(legs[0].origin),
    mode: null,
    vehicle_id: null,
    distance_miles: null,
    duration_min: null,
    cost: null,
    purpose: null,
    notes: null,
  };
  return [
    start,
    ...legs.map((leg, i) => ({
      template_id: templateId,
      stop_order: i + 1,
      location_name: textOrNull(leg.destination),
      mode: textOrNull(leg.mode),
      vehicle_id: textOrNull(leg.vehicle_id),
      distance_miles: toNumberOrNull(leg.distance_miles),
      duration_min: toMinutesOrNull(leg.duration_min),
      cost: toNumberOrNull(leg.cost),
      purpose: textOrNull(leg.purpose),
      notes: textOrNull(leg.notes),
    })),
  ];
}

/**
 * The is_round_trip flag for a template saved from a route of `legs`. The Add
 * Trip form adds the return leg itself, so a multi-leg template keeps the flag
 * as given. A single leg that already ends where it starts (a loop) is the
 * whole trip: flagging it would make Quick log count its distance twice.
 */
export function templateRoundTripFlag(isRoundTrip: unknown, legs: readonly TemplateLegInput[]): boolean {
  if (isRoundTrip !== true) return false;
  if (legs.length !== 1) return true;
  const leg = legs[0];
  return !(textOrNull(leg.origin) !== null && sameLocation(leg.origin, leg.destination));
}

/** A trip_template_stops row as read back. */
export interface TemplateStop {
  stop_order?: number | null;
  location_name?: string | null;
  mode?: string | null;
  vehicle_id?: string | null;
  distance_miles?: number | string | null;
  duration_min?: number | string | null;
  cost?: number | string | null;
  purpose?: string | null;
  notes?: string | null;
}

/** The template-level values a leg falls back to. */
export interface TemplateDefaults {
  mode?: string | null;
  purpose?: string | null;
  is_round_trip?: boolean | null;
}

/** One leg to log from a template. */
export interface TemplateLeg {
  leg_order: number;
  origin: string | null;
  destination: string | null;
  mode: string;
  vehicle_id: string | null;
  distance_miles: number | null;
  duration_min: number | null;
  cost: number | null;
  purpose: TripPurpose | null;
  /** Added because a round-trip template's stops do not end where they start. */
  is_return: boolean;
}

/** Stops in stop_order (a copy; the input is left as it is). */
export function sortedStops<T extends TemplateStop>(stops: readonly T[]): T[] {
  return stops.slice().sort((a, b) => (a.stop_order ?? 0) - (b.stop_order ?? 0));
}

function sameLocation(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
  return norm(a) === norm(b);
}

/** Sum of the non-null values, or null when there are none (or they sum to 0). */
function sumOrNull(values: readonly (number | null)[]): number | null {
  let total = 0;
  let any = false;
  for (const v of values) {
    if (v === null) continue;
    total += v;
    any = true;
  }
  if (!any || total === 0) return null;
  return Math.round(total * 100) / 100;
}

/**
 * The legs a multi-stop template logs: leg i runs from stop i to stop i + 1 and
 * takes its details from stop i + 1 (mode falls back to the template's mode,
 * purpose to the template's purpose). A round-trip template whose last stop is
 * not its first gets a return leg with the outbound distance, duration and cost
 * summed, the same rule the Add Trip form uses.
 */
export function templateStopsToLegs(stops: readonly TemplateStop[], tmpl: TemplateDefaults): TemplateLeg[] {
  const ordered = sortedStops(stops);
  const legs: TemplateLeg[] = [];
  for (let i = 0; i < ordered.length - 1; i++) {
    const from = ordered[i];
    const to = ordered[i + 1];
    legs.push({
      leg_order: i,
      origin: textOrNull(from.location_name),
      destination: textOrNull(to.location_name),
      mode: textOrNull(to.mode) ?? textOrNull(tmpl.mode) ?? 'car',
      vehicle_id: textOrNull(to.vehicle_id),
      distance_miles: toNumberOrNull(to.distance_miles),
      duration_min: toMinutesOrNull(to.duration_min),
      cost: toNumberOrNull(to.cost),
      purpose: normalizeTripPurpose(to.purpose) ?? normalizeTripPurpose(tmpl.purpose),
      is_return: false,
    });
  }

  if (tmpl.is_round_trip && legs.length > 0) {
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    if (!sameLocation(first.location_name, last.location_name)) {
      const lastLeg = legs[legs.length - 1];
      legs.push({
        leg_order: legs.length,
        origin: textOrNull(last.location_name),
        destination: textOrNull(first.location_name),
        mode: lastLeg.mode,
        vehicle_id: lastLeg.vehicle_id,
        distance_miles: sumOrNull(legs.map((l) => l.distance_miles)),
        duration_min: sumOrNull(legs.map((l) => l.duration_min)),
        cost: sumOrNull(legs.map((l) => l.cost)),
        purpose: lastLeg.purpose,
        is_return: true,
      });
    }
  }
  return legs;
}

// ─── What a template card shows ─────────────────────────────────────────────

/** The template fields the summary reads. */
export interface TemplateForSummary extends TemplateDefaults {
  is_multi_stop?: boolean | null;
  origin?: string | null;
  destination?: string | null;
  distance_miles?: number | string | null;
  duration_min?: number | string | null;
  stops?: readonly TemplateStop[] | null;
}

export interface TemplateSummary {
  /** 'round_trip': there and back (A -> B -> A); 'multi': more stops; 'single': one leg. */
  kind: 'single' | 'round_trip' | 'multi';
  /** Number of stops including the start (multi-stop templates), else 2. */
  stopCount: number;
  /** Where it starts, and the far end (B of A -> B -> A, the destination of a single leg). */
  from: string | null;
  to: string | null;
  /** Total of what a Quick log records, or null when nothing is saved. */
  distance_miles: number | null;
  duration_min: number | null;
}

/**
 * Totals and shape for a template card. Multi-stop: the sum of the legs Quick
 * log would create (return leg included). Single leg: the saved values, doubled
 * for a round trip, as the trip list shows a round-trip trip.
 */
export function templateSummary(tmpl: TemplateForSummary): TemplateSummary {
  if (tmpl.is_multi_stop) {
    const ordered = sortedStops(tmpl.stops ?? []);
    const legs = templateStopsToLegs(ordered, tmpl);
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const closes = ordered.length >= 2 && sameLocation(first?.location_name, last?.location_name);
    const thereAndBack = (ordered.length === 3 && closes) || (ordered.length === 2 && !!tmpl.is_round_trip);
    return {
      kind: thereAndBack ? 'round_trip' : 'multi',
      stopCount: ordered.length,
      from: textOrNull(first?.location_name),
      to: textOrNull(ordered.length === 3 && closes ? ordered[1]?.location_name : last?.location_name),
      distance_miles: sumOrNull(legs.map((l) => l.distance_miles)),
      duration_min: sumOrNull(legs.map((l) => l.duration_min)),
    };
  }
  const factor = tmpl.is_round_trip ? 2 : 1;
  const dist = toNumberOrNull(tmpl.distance_miles);
  const dur = toMinutesOrNull(tmpl.duration_min);
  return {
    kind: tmpl.is_round_trip ? 'round_trip' : 'single',
    stopCount: 2,
    from: textOrNull(tmpl.origin),
    to: textOrNull(tmpl.destination),
    distance_miles: dist === null ? null : Math.round(dist * factor * 100) / 100,
    duration_min: dur === null ? null : dur * factor,
  };
}

/** "24 min", "1 h 5 min", "2 h". */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** "10.0 mi · 24 min", "10.0 mi", "24 min", or '' when the template saved neither. */
export function formatTemplateTotals(summary: Pick<TemplateSummary, 'distance_miles' | 'duration_min'>): string {
  const parts: string[] = [];
  if (summary.distance_miles !== null) parts.push(`${summary.distance_miles.toFixed(1)} mi`);
  if (summary.duration_min !== null) parts.push(formatMinutes(summary.duration_min));
  return parts.join(' · ');
}
