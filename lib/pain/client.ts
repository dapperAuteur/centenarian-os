// lib/pain/client.ts
// Browser side of the pain log: the form's state, turning it into an API body, and the
// calls to /api/engine/pain-entries. Writes go through offlineFetch, so an entry logged
// offline is queued and sent when the connection comes back (like the health metrics form).

import { offlineFetch, isQueuedResponse } from '@/lib/offline/offline-fetch';
import { toLocalDateString } from '@/lib/dates/local';
import { activitiesFromText } from './logic';
import type { PainEntry } from './logic';
import type { DayInfo, DayPoint, DayState } from './server';

export type { DayInfo, DayPoint, DayState };

/** What the entry fields edit. `time` is a datetime-local value in the person's time zone. */
export interface PainFormState {
  time: string;
  intensity: number;
  locations: string[];
  sensations: string[];
  activities: string;
  notes: string;
}

/** A Date as a datetime-local value (YYYY-MM-DDTHH:mm, local time). */
export function toTimeInput(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${toLocalDateString(date)}T${hh}:${mm}`;
}

export function emptyForm(now = new Date()): PainFormState {
  return { time: toTimeInput(now), intensity: 1, locations: [], sensations: [], activities: '', notes: '' };
}

export function formFromEntry(entry: PainEntry): PainFormState {
  return {
    time: toTimeInput(new Date(entry.occurred_at)),
    intensity: entry.intensity,
    locations: [...entry.locations],
    sensations: [...entry.sensations],
    activities: entry.activities.join('\n'),
    notes: entry.notes ?? '',
  };
}

/** The API body for a form. The local date comes from the time the person picked. */
export function bodyFromForm(form: PainFormState) {
  const at = new Date(form.time);
  const valid = !Number.isNaN(at.getTime());
  return {
    occurred_at: valid ? at.toISOString() : form.time,
    local_date: valid ? toLocalDateString(at) : form.time.slice(0, 10),
    intensity: form.intensity,
    locations: form.locations,
    sensations: form.sensations,
    activities: activitiesFromText(form.activities),
    notes: form.notes.trim() || null,
  };
}

export interface EntryListResponse {
  ready: boolean;
  notice?: string;
  entries: PainEntry[];
  days: Record<string, DayInfo>;
  has_more: boolean;
  next_offset: number | null;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.error === 'string') return body.error;
  } catch {
    /* not JSON */
  }
  return res.status === 503 ? 'You are offline and this list has not been loaded before.' : 'Something went wrong. Please try again.';
}

export async function fetchEntries(params: Record<string, string | number | null | undefined>): Promise<EntryListResponse> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') search.set(key, String(value));
  }
  const res = await offlineFetch(`/api/engine/pain-entries?${search.toString()}`);
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function fetchDayPoints(from: string, to: string): Promise<DayPoint[]> {
  const search = new URLSearchParams();
  if (from) search.set('from', from);
  if (to) search.set('to', to);
  const res = await offlineFetch(`/api/engine/pain-entries/days?${search.toString()}`);
  if (!res.ok) return [];
  const body = await res.json();
  return Array.isArray(body.days) ? body.days : [];
}

export type SaveResult =
  | { queued: true }
  | { queued: false; ready: boolean; notice?: string; entry: PainEntry | null; day: DayState };

export async function createPainEntry(form: PainFormState, id: string): Promise<SaveResult> {
  const res = await offlineFetch('/api/engine/pain-entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...bodyFromForm(form) }),
  });
  if (isQueuedResponse(res)) return { queued: true };
  if (!res.ok) throw new Error(await readError(res));
  const body = await res.json();
  return { queued: false, ready: body.ready !== false, notice: body.notice, entry: body.entry ?? null, day: body.day };
}

export type UpdateResult = { queued: true } | { queued: false; entry: PainEntry; days: DayState[] };

/**
 * Saves an edit. The time is only sent when the person changed it, so opening and saving an
 * entry never moves it (a backfilled entry's 12:00 UTC can be another local date far east).
 */
export async function updatePainEntry(id: string, form: PainFormState, timeChanged: boolean): Promise<UpdateResult> {
  const body: Partial<ReturnType<typeof bodyFromForm>> = bodyFromForm(form);
  if (!timeChanged) {
    delete body.occurred_at;
    delete body.local_date;
  }
  const res = await offlineFetch(`/api/engine/pain-entries/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (isQueuedResponse(res)) return { queued: true };
  if (!res.ok) throw new Error(await readError(res));
  return { queued: false, ...(await res.json()) };
}

export type DeleteResult = { queued: true } | { queued: false; day: DayState };

export async function deletePainEntry(id: string): Promise<DeleteResult> {
  const res = await offlineFetch(`/api/engine/pain-entries/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (isQueuedResponse(res)) return { queued: true };
  if (!res.ok) throw new Error(await readError(res));
  return { queued: false, ...(await res.json()) };
}

/** An id for a new entry, made in the browser so an offline replay cannot save it twice. */
export function newEntryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Fallback for old browsers: a random v4 UUID from Math.random.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** True for an entry copied from daily_logs whose time of day was never recorded. */
export function timeUnknown(entry: Pick<PainEntry, 'source' | 'occurred_at' | 'local_date'>): boolean {
  return entry.source === 'daily_log' && Date.parse(entry.occurred_at) === Date.parse(`${entry.local_date}T12:00:00Z`);
}

/** The entry an offline save will create, shown until it syncs. */
export function pendingEntry(id: string, form: PainFormState): PainEntry {
  const body = bodyFromForm(form);
  return { id, ...body, source: 'app' };
}
