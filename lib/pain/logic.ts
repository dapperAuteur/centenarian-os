// lib/pain/logic.ts
// Rules for pain entries (plans/63 section D): checking what the form sends, and turning a
// day's entries into the daily_logs.pain_* summary that the correlation engine, AI reports
// and charts read.
//
// SUMMARY RULES (summarizeDay)
//   pain_intensity   the day's highest entry, kept within daily_logs' 1-10 check
//                    (an entry of 0 counts as 1: both mean "no discomfort")
//   pain_locations   every location of the day, oldest entry first, each once
//   pain_sensations  same rule
//   pain_activities  same rule (an activity typed twice with different capitals counts once;
//                    the first spelling is kept)
//   pain_notes       every entry's notes, oldest first, separated by a blank line; the same
//                    note written twice is kept once. Concatenated rather than "latest" so no
//                    note is lost from the day's record.
//   Empty lists are stored as NULL, as the old form did. A day with no entries clears all five.
//
// BACKFILL (planBackfill) mirrors the INSERT in supabase/migrations/222_pain_entries.sql so its
// skip rules can be tested here: one entry per daily_logs day with pain_intensity set, at
// 12:00 UTC, source 'daily_log', skipped when the user already has any entry on that date.
//
// No imports on purpose: runs in client components, API routes and under
// `node --test --experimental-strip-types` (tests/unit/pain-entries.test.ts).

export const PAIN_SOURCES = ['app', 'daily_log'] as const;
export type PainSource = (typeof PAIN_SOURCES)[number];

/** A pain_entries row as the API returns it. */
export interface PainEntry {
  id: string;
  user_id?: string;
  occurred_at: string;
  local_date: string;
  intensity: number;
  locations: string[];
  sensations: string[];
  activities: string[];
  notes: string | null;
  source: PainSource | string;
  created_at?: string;
  updated_at?: string;
}

/** The fields the form writes. */
export interface PainEntryInput {
  occurred_at: string;
  local_date: string;
  intensity: number;
  locations: string[];
  sensations: string[];
  activities: string[];
  notes: string | null;
}

/** The five daily_logs columns that hold a day's pain summary. */
export interface DaySummary {
  pain_intensity: number | null;
  pain_locations: string[] | null;
  pain_sensations: string[] | null;
  pain_activities: string[] | null;
  pain_notes: string | null;
}

export const EMPTY_SUMMARY: DaySummary = {
  pain_intensity: null,
  pain_locations: null,
  pain_sensations: null,
  pain_activities: null,
  pain_notes: null,
};

export class PainRuleError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const LIMITS = {
  listItems: 40,
  labelLength: 80,
  activityLength: 200,
  notesLength: 5000,
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAY_MS = 86_400_000;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** A real calendar date in YYYY-MM-DD form. */
export function isDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** Trimmed, non-empty, each value once (case-insensitive), first spelling kept. */
export function cleanList(value: unknown, field: string, maxLength: number): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new PainRuleError(`${field} must be a list.`);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') throw new PainRuleError(`${field} must be a list of text.`);
    const text = item.trim();
    if (!text) continue;
    if (text.length > maxLength) throw new PainRuleError(`Each ${field} entry must be ${maxLength} characters or fewer.`);
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  if (out.length > LIMITS.listItems) throw new PainRuleError(`${field} can hold up to ${LIMITS.listItems} items.`);
  return out;
}

/** The form's "one per line" activities box → a list. */
export function activitiesFromText(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter(Boolean);
}

export function parseIntensity(value: unknown): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 10) {
    throw new PainRuleError('Intensity must be a whole number from 0 to 10.');
  }
  return n;
}

function parseNotes(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw new PainRuleError('Notes must be text.');
  const text = value.trim();
  if (text.length > LIMITS.notesLength) throw new PainRuleError(`Notes must be ${LIMITS.notesLength} characters or fewer.`);
  return text || null;
}

/** UTC calendar date of an instant, YYYY-MM-DD. */
function utcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * occurred_at must be a real instant, at most a day in the future (clock and time zone
 * slack). local_date is the person's own calendar date for it, so it can differ from the
 * UTC date by at most one day (time zones run from UTC-12 to UTC+14). When local_date is
 * missing, the UTC date is used.
 */
export function parseWhen(occurredAt: unknown, localDate: unknown, nowMs: number): { occurred_at: string; local_date: string } {
  if (typeof occurredAt !== 'string' || !occurredAt.trim()) throw new PainRuleError('Choose when the pain happened.');
  const ms = Date.parse(occurredAt);
  if (!Number.isFinite(ms)) throw new PainRuleError('The time is not a valid date and time.');
  if (ms > nowMs + DAY_MS) throw new PainRuleError('The time cannot be more than a day in the future.');
  if (ms < Date.UTC(1900, 0, 1)) throw new PainRuleError('The time is too far in the past.');
  const utc = utcDate(ms);
  if (localDate == null || localDate === '') return { occurred_at: new Date(ms).toISOString(), local_date: utc };
  if (!isDateString(localDate)) throw new PainRuleError('The date must look like YYYY-MM-DD.');
  const gap = Math.abs(Date.parse(`${localDate}T00:00:00Z`) - Date.parse(`${utc}T00:00:00Z`));
  if (gap > DAY_MS) throw new PainRuleError('The date does not match the time.');
  return { occurred_at: new Date(ms).toISOString(), local_date: localDate };
}

/** A complete entry from the form. Throws PainRuleError with a message for the screen. */
export function parseEntryInput(body: Record<string, unknown>, nowMs: number): PainEntryInput {
  const when = parseWhen(body.occurred_at, body.local_date, nowMs);
  return {
    ...when,
    intensity: parseIntensity(body.intensity),
    locations: cleanList(body.locations, 'Locations', LIMITS.labelLength),
    sensations: cleanList(body.sensations, 'Sensations', LIMITS.labelLength),
    activities: cleanList(body.activities, 'Activities', LIMITS.activityLength),
    notes: parseNotes(body.notes),
  };
}

/**
 * An edit: only the fields that were sent. Changing the time needs occurred_at; the
 * local_date sent with it (or the UTC date) moves the entry to that day.
 */
export function parseEntryPatch(body: Record<string, unknown>, nowMs: number): Partial<PainEntryInput> {
  const patch: Partial<PainEntryInput> = {};
  if (body.occurred_at !== undefined) Object.assign(patch, parseWhen(body.occurred_at, body.local_date, nowMs));
  else if (body.local_date !== undefined) throw new PainRuleError('Send the time along with the date.');
  if (body.intensity !== undefined) patch.intensity = parseIntensity(body.intensity);
  if (body.locations !== undefined) patch.locations = cleanList(body.locations, 'Locations', LIMITS.labelLength);
  if (body.sensations !== undefined) patch.sensations = cleanList(body.sensations, 'Sensations', LIMITS.labelLength);
  if (body.activities !== undefined) patch.activities = cleanList(body.activities, 'Activities', LIMITS.activityLength);
  if (body.notes !== undefined) patch.notes = parseNotes(body.notes);
  if (Object.keys(patch).length === 0) throw new PainRuleError('Nothing to change.');
  return patch;
}

type SummaryEntry = Pick<PainEntry, 'occurred_at' | 'intensity' | 'locations' | 'sensations' | 'activities' | 'notes'> & {
  id?: string;
  created_at?: string;
};

function chronological(entries: SummaryEntry[]): SummaryEntry[] {
  return [...entries].sort((a, b) => {
    const at = Date.parse(a.occurred_at) - Date.parse(b.occurred_at);
    if (at !== 0) return at;
    const created = Date.parse(a.created_at ?? '') - Date.parse(b.created_at ?? '');
    if (Number.isFinite(created) && created !== 0) return created;
    return String(a.id ?? '').localeCompare(String(b.id ?? ''));
  });
}

function union(lists: (string[] | null | undefined)[]): string[] | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list ?? []) {
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (!text) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(text);
    }
  }
  return out.length > 0 ? out : null;
}

/** The daily_logs.pain_* summary for one day's entries. See the rules at the top. */
export function summarizeDay(entries: SummaryEntry[]): DaySummary {
  if (entries.length === 0) return { ...EMPTY_SUMMARY };
  const ordered = chronological(entries);
  const highest = Math.max(...ordered.map((e) => Number(e.intensity) || 0));
  const notes: string[] = [];
  for (const entry of ordered) {
    const text = (entry.notes ?? '').trim();
    if (text && !notes.includes(text)) notes.push(text);
  }
  return {
    pain_intensity: Math.min(10, Math.max(1, highest)),
    pain_locations: union(ordered.map((e) => e.locations)),
    pain_sensations: union(ordered.map((e) => e.sensations)),
    pain_activities: union(ordered.map((e) => e.activities)),
    pain_notes: notes.length > 0 ? notes.join('\n\n') : null,
  };
}

/** True when the summary has no pain data at all. */
export function isEmptySummary(summary: DaySummary): boolean {
  return (
    summary.pain_intensity == null &&
    summary.pain_locations == null &&
    summary.pain_sensations == null &&
    summary.pain_activities == null &&
    summary.pain_notes == null
  );
}

/** daily_logs.pain_* jsonb → a clean list (arrays as-is, a lone string as one item). */
export function jsonList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

/** 12:00 UTC on a date: the time a backfilled entry gets (daily_logs has no time of day). */
export function backfillTime(date: string): string {
  return `${date}T12:00:00.000Z`;
}

export interface DailyLogPainRow {
  id?: string;
  user_id: string;
  date: string;
  pain_intensity: number | null;
  pain_locations: unknown;
  pain_sensations: unknown;
  pain_activities: unknown;
  pain_notes: string | null;
}

/**
 * The entries migration 222 copies from daily_logs, given what pain_entries already holds.
 * Mirrors the SQL: only days with pain_intensity set, skipped when that user already has an
 * entry on that date (from an earlier backfill or from the app).
 */
export function planBackfill(
  dailyLogs: DailyLogPainRow[],
  existing: Pick<PainEntry, 'user_id' | 'local_date'>[],
): (PainEntryInput & { user_id: string; source: 'daily_log' })[] {
  const taken = new Set(existing.map((e) => `${e.user_id}|${e.local_date}`));
  const out: (PainEntryInput & { user_id: string; source: 'daily_log' })[] = [];
  for (const log of dailyLogs) {
    if (log.pain_intensity == null) continue;
    const key = `${log.user_id}|${log.date}`;
    if (taken.has(key)) continue;
    taken.add(key);
    const notes = (log.pain_notes ?? '').trim();
    out.push({
      user_id: log.user_id,
      occurred_at: backfillTime(log.date),
      local_date: log.date,
      intensity: Math.min(10, Math.max(0, log.pain_intensity)),
      locations: jsonList(log.pain_locations),
      sensations: jsonList(log.pain_sensations),
      activities: jsonList(log.pain_activities),
      notes: notes || null,
      source: 'daily_log',
    });
  }
  return out;
}

/** Entries grouped by local_date, newest day first, each day's entries newest first. */
export function groupByDay<T extends Pick<PainEntry, 'local_date' | 'occurred_at' | 'intensity'>>(
  entries: T[],
): { date: string; entries: T[]; highest: number }[] {
  const days = new Map<string, T[]>();
  for (const entry of entries) {
    const list = days.get(entry.local_date) ?? [];
    list.push(entry);
    days.set(entry.local_date, list);
  }
  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, list]) => ({
      date,
      entries: [...list].sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at)),
      highest: Math.max(...list.map((e) => e.intensity)),
    }));
}
