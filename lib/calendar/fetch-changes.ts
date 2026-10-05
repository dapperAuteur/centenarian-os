// lib/calendar/fetch-changes.ts
// Reads every changed event of one calendar from Google: an incremental sync from the stored
// sync token, or a full sync over a fixed window when there is no token (first run) or Google
// rejects it with 410 Gone. The page fetcher is passed in, so tests drive it with a fake
// (tests/unit/google-sync.test.ts).
//
// Google's rules, from https://developers.google.com/workspace/calendar/api/guides/sync and
// https://developers.google.com/workspace/calendar/api/v3/reference/events/list :
//   - A full sync pages through events.list; the LAST page carries nextSyncToken.
//   - An incremental sync sends only syncToken (timeMin/timeMax may not be combined with it).
//   - "Sometimes sync tokens are invalidated by the server ... the server will respond to an
//     incremental request with a response code 410. This should trigger a full wipe of the
//     client's store and a new full sync." This app does not wipe anything: the planner tasks are
//     the user's, and the full re-read is idempotent (unchanged etags are skipped), so the
//     "wipe" is clearing the token.
//
// Relative imports keep ".ts" for node --test.

import { isSyncTokenGone, type EventsPage, type GoogleEvent, type ListEventsParams } from '../google/calendar-client.ts';
import { fullSyncWindow } from './event-fields.ts';

/** A stop for a nextPageToken that never ends: 40 pages of 250 = 10,000 events per calendar per run. */
export const MAX_EVENT_PAGES = 40;
export const EVENT_PAGE_SIZE = 250;

export type ListPage = (params: ListEventsParams) => Promise<EventsPage>;

export interface FetchChangesOptions {
  syncToken: string | null;
  /** Milliseconds since the epoch, for the full-sync window. */
  now: number;
  /** Stop paging after this time (ms since the epoch). The events read so far are returned with complete=false. */
  deadline?: number;
  /** Clock for the deadline check. Defaults to Date.now. */
  clock?: () => number;
}

export interface FetchChangesResult {
  events: GoogleEvent[];
  /** The token to store for next time. Null when the run did not reach the last page. */
  nextSyncToken: string | null;
  /** The calendar's time zone as events.list reported it. */
  timeZone: string | null;
  /** True when this was a full-window read (no token, or the token was rejected). */
  fullSync: boolean;
  /** True when Google answered 410 to the stored token and a full read was done instead. */
  tokenReset: boolean;
  /** False when paging stopped early (deadline or page limit); do not store a token then. */
  complete: boolean;
}

async function readAll(
  listPage: ListPage,
  base: ListEventsParams,
  deadline: number | undefined,
  clock: () => number,
): Promise<Omit<FetchChangesResult, 'fullSync' | 'tokenReset'>> {
  const events: GoogleEvent[] = [];
  let timeZone: string | null = null;
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_EVENT_PAGES; page += 1) {
    if (page > 0 && deadline !== undefined && clock() >= deadline) {
      return { events, nextSyncToken: null, timeZone, complete: false };
    }
    const result = await listPage({ ...base, pageToken, maxResults: EVENT_PAGE_SIZE });
    events.push(...result.items);
    timeZone = result.timeZone ?? timeZone;
    if (!result.nextPageToken) {
      return { events, nextSyncToken: result.nextSyncToken, timeZone, complete: true };
    }
    pageToken = result.nextPageToken;
  }
  return { events, nextSyncToken: null, timeZone, complete: false };
}

/**
 * Every event that changed since the stored sync token (or, without one, every event in the
 * window 30 days back to 180 days ahead). A 410 on the token triggers one full read.
 * Any other error is thrown to the caller.
 */
export async function fetchCalendarChanges(
  listPage: ListPage,
  options: FetchChangesOptions,
): Promise<FetchChangesResult> {
  const clock = options.clock ?? Date.now;
  const fullParams = (): ListEventsParams => fullSyncWindow(options.now);

  if (options.syncToken) {
    try {
      const result = await readAll(listPage, { syncToken: options.syncToken }, options.deadline, clock);
      return { ...result, fullSync: false, tokenReset: false };
    } catch (err) {
      if (!isSyncTokenGone(err)) throw err;
      const result = await readAll(listPage, fullParams(), options.deadline, clock);
      return { ...result, fullSync: true, tokenReset: true };
    }
  }

  const result = await readAll(listPage, fullParams(), options.deadline, clock);
  return { ...result, fullSync: true, tokenReset: false };
}
