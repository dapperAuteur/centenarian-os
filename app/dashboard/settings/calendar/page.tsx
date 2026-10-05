'use client';

// app/dashboard/settings/calendar/page.tsx
// Settings → Google Calendar. Connect one or more Google accounts (read-only), choose which of
// each account's calendars sync, sync now (per account or all), see when each account last
// synced and what the run did, reconnect when Google stops accepting an authorization, and
// disconnect an account. One-way: Google → CentenarianOS. Events become planner tasks under
// "Google Calendar: <calendar name>"; a daily sync runs as well.
//
// Data: GET/DELETE /api/calendar/google, GET/PATCH /api/calendar/google/calendars,
// POST /api/calendar/google/sync. GET /api/calendar/google re-checks each account with Google
// (at most every 5 minutes), so an account whose access was removed at Google shows
// "Needs reconnecting" on load. The OAuth round trip (/api/calendar/google/connect → Google →
// /callback) comes back here with ?connected=google&connection_id=<id> or ?error=<code>.

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Unlink,
  X,
} from 'lucide-react';
import { formatTime, useClockFormat } from '@/lib/hooks/useClockFormat';

const PAGE_PATH = '/dashboard/settings/calendar';
const CONNECT_URL = '/api/calendar/google/connect';
const STATUS_URL = '/api/calendar/google';
const CALENDARS_URL = '/api/calendar/google/calendars';
const SYNC_URL = '/api/calendar/google/sync';
// Where Google's OAuth guide sends users to remove an app's access themselves
// (https://developers.google.com/identity/protocols/oauth2/web-server, "Token revocation").
const GOOGLE_PERMISSIONS_URL = 'https://myaccount.google.com/permissions';

type ClockFormat = '12h' | '24h';

interface SyncCounts {
  created: number;
  updated: number;
  archived: number;
  flagged: number;
  unchanged: number;
}

interface SyncSummary {
  connection_id: string;
  status: 'ok' | 'partial' | 'needs_reauth' | 'error' | 'skipped';
  counts: SyncCounts;
  calendars_synced: number;
  calendars_total: number;
  errors: string[];
  finished_at: string;
}

interface SyncCalendar {
  id: string;
  calendar_id: string;
  summary: string | null;
  time_zone: string | null;
  color: string | null;
  enabled: boolean;
  last_synced_at: string | null;
  last_error: string | null;
}

interface Connection {
  id: string;
  account_email: string | null;
  status: 'active' | 'needs_reauth' | 'disconnected';
  last_error: string | null;
  last_synced_at: string | null;
  last_sync_summary: SyncSummary | null;
  calendars: SyncCalendar[];
}

interface StatusResponse {
  configured: boolean;
  connections: Connection[];
}

interface Flash {
  kind: 'success' | 'warning' | 'error';
  text: string;
}

/** What each ?error=<code> from the connect and callback routes means, in plain words. */
const CONNECT_ERRORS: Record<string, string> = {
  access_denied: 'You cancelled on the Google screen, so nothing was connected.',
  missing_code: 'Google did not send an authorization code. Try connecting again.',
  not_signed_in: 'Your CentenarianOS session ended before Google sent you back. Sign in and try again.',
  invalid_state: 'The connection request expired or was not started in this browser. Try connecting again.',
  not_configured: 'Google Calendar is not set up on this site yet: the Google OAuth client is missing.',
  encryption_not_configured: 'Google Calendar is not set up on this site yet: the token encryption key is missing.',
  state_secret_missing: 'Google Calendar is not set up on this site yet: the request-signing secret is missing.',
  migration_missing:
    'Google Calendar is not set up on this site yet: database migrations 204 and 205 must both be applied.',
  code_rejected: 'Google rejected the authorization code (it works once and expires quickly). Try connecting again.',
  calendar_scope_not_granted:
    'Calendar access was not granted. Try again and leave the calendar permission ticked on the Google screen.',
  no_refresh_token:
    'Google did not return a refresh token, so the connection could not be saved. Try connecting again.',
  account_lookup_failed: 'Google granted access, but the account email could not be read. Try connecting again.',
  google_error: 'Google returned an error. Try again in a minute.',
  token_unreadable: 'The saved Google tokens could not be read. Disconnect and connect again.',
  internal: 'Something went wrong while connecting. Try again.',
};

const connectErrorText = (code: string) =>
  CONNECT_ERRORS[code] ?? `Google Calendar could not be connected (${code}). Try again.`;

const OFFLINE_TEXT = 'Could not reach the server. Check your connection and try again.';

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const errorText = (body: Record<string, unknown> | null, fallback: string) =>
  typeof body?.error === 'string' ? body.error : fallback;

/** "Oct 4, 6:02 AM" (or "Oct 4, 06:02" in 24h) in the user's clock format. */
function formatWhen(iso: string, clockFormat: ClockFormat): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${formatTime(d, clockFormat)}`;
}

const STATUS_TEXT: Record<SyncSummary['status'], string> = {
  ok: 'finished',
  partial: 'finished with problems',
  needs_reauth: 'stopped: reconnect needed',
  error: 'failed',
  skipped: 'skipped',
};

function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-fuchsia-600" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

// ── One connected Google account ────────────────────────────────────────────────

interface AccountCardProps {
  connection: Connection;
  configured: boolean;
  clockFormat: ClockFormat;
  /** Fetch this account's calendar list from Google once on mount (fresh connection). */
  autoRefresh: boolean;
  syncing: boolean;
  /** The result of a sync run in this page session, if any. */
  latestResult: SyncSummary | null;
  onSync: (connectionId: string) => void;
  onReload: () => Promise<unknown>;
  onRemoved: (connectionId: string, flash: Flash) => void;
}

function AccountCard({
  connection,
  configured,
  clockFormat,
  autoRefresh,
  syncing,
  latestResult,
  onSync,
  onReload,
  onRemoved,
}: AccountCardProps) {
  const [calendars, setCalendars] = useState<SyncCalendar[]>(connection.calendars);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<{ text: string; canForce: boolean } | null>(null);

  const listRequested = useRef(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  const needsReauth = connection.status === 'needs_reauth';
  const label = connection.account_email ?? 'Google account (email not shared)';
  const headingId = `account-${connection.id}-heading`;

  // Keep the checklist in step with reloads of the page data (e.g. after a sync).
  useEffect(() => {
    setCalendars(connection.calendars);
  }, [connection.calendars]);

  const refreshCalendars = useCallback(async () => {
    setRefreshing(true);
    setCalendarError(null);
    try {
      const res = await fetch(`${CALENDARS_URL}?connection_id=${encodeURIComponent(connection.id)}`, {
        cache: 'no-store',
      });
      const body = await readJson(res);
      if (!res.ok) {
        setCalendarError(errorText(body, 'Could not load your calendars from Google.'));
        // Google refused the saved authorization: reload so the card shows "Reconnect".
        if (body?.code === 'needs_reauth') await onReload();
        return;
      }
      setCalendars((body?.calendars as SyncCalendar[] | undefined) ?? []);
    } catch {
      setCalendarError(OFFLINE_TEXT);
    } finally {
      setRefreshing(false);
    }
  }, [connection.id, onReload]);

  useEffect(() => {
    if (listRequested.current) return;
    if (configured && connection.status === 'active' && (autoRefresh || connection.calendars.length === 0)) {
      listRequested.current = true;
      void refreshCalendars();
    }
  }, [autoRefresh, configured, connection.status, connection.calendars.length, refreshCalendars]);

  // Move focus to the confirmation when it opens, so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  const toggleCalendar = async (calendar: SyncCalendar, enabled: boolean) => {
    const setEnabled = (value: boolean) =>
      setCalendars((prev) =>
        prev.map((c) => (c.calendar_id === calendar.calendar_id ? { ...c, enabled: value } : c)),
      );
    setCalendarError(null);
    setSaving((prev) => new Set(prev).add(calendar.calendar_id));
    setEnabled(enabled);
    try {
      const res = await fetch(CALENDARS_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connection.id, calendar_id: calendar.calendar_id, enabled }),
      });
      if (!res.ok) {
        setEnabled(!enabled);
        setCalendarError(errorText(await readJson(res), 'That change could not be saved.'));
      }
    } catch {
      setEnabled(!enabled);
      setCalendarError('Could not reach the server, so that change was not saved.');
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(calendar.calendar_id);
        return next;
      });
    }
  };

  const disconnect = async (force: boolean) => {
    setDisconnecting(true);
    setDisconnectError(null);
    try {
      const query = `connection_id=${encodeURIComponent(connection.id)}${force ? '&force=1' : ''}`;
      const res = await fetch(`${STATUS_URL}?${query}`, { method: 'DELETE' });
      const body = await readJson(res);
      if (!res.ok) {
        setDisconnectError({
          text: errorText(body, 'This Google account could not be disconnected.'),
          canForce: body?.can_force === true,
        });
        return;
      }
      onRemoved(
        connection.id,
        typeof body?.warning === 'string'
          ? { kind: 'warning', text: body.warning }
          : {
              kind: 'success',
              text:
                body?.already_revoked === true
                  ? `${label} is disconnected. Access had already been removed at Google.`
                  : `${label} is disconnected, and Google confirmed that access was removed.`,
            },
      );
    } catch {
      setDisconnectError({ text: OFFLINE_TEXT, canForce: false });
    } finally {
      setDisconnecting(false);
    }
  };

  const enabledCount = calendars.filter((c) => c.enabled).length;
  const result = latestResult ?? connection.last_sync_summary;
  const canSync = configured && !needsReauth && enabledCount > 0;

  return (
    <section aria-labelledby={headingId} className="border border-gray-200 rounded-2xl p-5 bg-white space-y-5">
      {/* Account header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h2 id={headingId} className="font-semibold text-gray-900 break-all">
            {label}
          </h2>
          <p className="mt-2">
            {needsReauth ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-full text-xs font-medium">
                <AlertCircle className="w-3 h-3" aria-hidden="true" />
                Needs reconnecting
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-800 border border-green-200 rounded-full text-xs font-medium">
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                Connected
              </span>
            )}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            {connection.last_synced_at
              ? `Last synced ${formatWhen(connection.last_synced_at, clockFormat)}`
              : 'Not synced yet'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => onSync(connection.id)}
            disabled={!canSync || syncing}
            aria-label={`Sync now: ${label}`}
            className="min-h-11 inline-flex items-center justify-center gap-1.5 px-4 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition disabled:opacity-60 w-full sm:w-auto"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
            )}
            {syncing ? 'Syncing' : 'Sync now'}
          </button>
          {!confirming && (
            <button
              type="button"
              onClick={() => {
                setDisconnectError(null);
                setConfirming(true);
              }}
              aria-label={`Disconnect ${label}`}
              className="min-h-11 inline-flex items-center justify-center gap-1.5 px-4 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition w-full sm:w-auto"
            >
              <Unlink className="w-4 h-4" aria-hidden="true" />
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Last run */}
      {result && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-800 space-y-1" aria-live="polite">
          <p>
            <span className="font-medium">Last run {STATUS_TEXT[result.status] ?? result.status}</span>
            {result.finished_at && <> ({formatWhen(result.finished_at, clockFormat)})</>}:{' '}
            {result.counts.created} created · {result.counts.updated} updated · {result.counts.archived} archived ·{' '}
            {result.counts.flagged} flagged
          </p>
          {result.errors.length > 0 && (
            <ul role="alert" className="list-disc pl-5 text-red-800 space-y-0.5">
              {result.errors.map((error, i) => (
                <li key={i} className="break-words">
                  {error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {needsReauth && (
        <div role="alert" className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm space-y-3">
          <p className="font-medium">
            Google no longer accepts the saved authorization for this account (for example, access was removed
            in your Google Account), so its calendars cannot sync until you reconnect. Your calendar choices are
            kept.
          </p>
          {configured && (
            <a
              href={`${CONNECT_URL}?connection_id=${encodeURIComponent(connection.id)}`}
              className="min-h-11 inline-flex items-center justify-center gap-1.5 px-4 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition w-full sm:w-auto"
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              Reconnect
              <span className="sr-only"> {label}</span>
            </a>
          )}
        </div>
      )}

      {confirming && (
        <div
          ref={confirmRef}
          tabIndex={-1}
          role="group"
          aria-labelledby={`${headingId}-disconnect`}
          className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3 outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <h3 id={`${headingId}-disconnect`} className="font-semibold text-red-900 break-all">
            Disconnect {label}?
          </h3>
          <p className="text-sm text-red-900">
            CentenarianOS will ask Google to remove its access to this account, then delete the saved connection
            and this account&apos;s calendar choices. Tasks already created stay in your planner. Your other
            Google accounts stay connected. Nothing in Google Calendar changes.
          </p>

          {disconnectError && (
            <p role="alert" className="text-sm font-medium text-red-900 break-words">
              {disconnectError.text}
              {disconnectError.canForce && (
                <>
                  {' '}
                  You can remove the saved connection anyway and then remove this app in your{' '}
                  <a href={GOOGLE_PERMISSIONS_URL} target="_blank" rel="noopener noreferrer" className="underline">
                    Google Account permissions
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  .
                </>
              )}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => disconnect(false)}
              disabled={disconnecting}
              className="min-h-11 inline-flex items-center justify-center gap-1.5 px-4 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition disabled:opacity-60"
            >
              {disconnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Unlink className="w-4 h-4" aria-hidden="true" />
              )}
              {disconnecting ? 'Disconnecting' : disconnectError ? 'Try again' : 'Yes, disconnect'}
            </button>
            {disconnectError?.canForce && (
              <button
                type="button"
                onClick={() => disconnect(true)}
                disabled={disconnecting}
                className="min-h-11 inline-flex items-center justify-center px-4 text-sm font-medium text-red-800 bg-white border border-red-300 hover:bg-red-100 rounded-lg transition disabled:opacity-60"
              >
                Remove anyway
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setDisconnectError(null);
              }}
              disabled={disconnecting}
              className="min-h-11 inline-flex items-center justify-center px-4 text-sm font-medium text-gray-800 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Calendar checklist */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-medium text-gray-900">Calendars to sync</h3>
            <p className="text-sm text-gray-600 mt-0.5" aria-live="polite">
              {calendars.length === 0
                ? 'No calendars loaded yet.'
                : `${enabledCount} of ${calendars.length} switched on.`}
            </p>
          </div>
          <button
            type="button"
            onClick={refreshCalendars}
            disabled={refreshing || needsReauth || !configured}
            className="min-h-11 inline-flex items-center justify-center gap-1.5 px-4 text-sm font-medium text-sky-800 bg-sky-50 hover:bg-sky-100 rounded-lg transition disabled:opacity-60 w-full sm:w-auto"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
            )}
            {refreshing ? 'Loading from Google' : 'Refresh list from Google'}
          </button>
        </div>

        {calendarError && (
          <p role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm font-medium">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            {calendarError}
          </p>
        )}

        {calendars.length > 0 ? (
          <fieldset>
            <legend className="sr-only">Choose the calendars to sync from {label}</legend>
            <ul className="divide-y divide-gray-100">
              {calendars.map((calendar) => {
                const inputId = `calendar-${calendar.id}`;
                const isSaving = saving.has(calendar.calendar_id);
                return (
                  <li key={calendar.id}>
                    <label htmlFor={inputId} className="min-h-11 flex items-center gap-3 py-2 cursor-pointer">
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={calendar.enabled}
                        disabled={isSaving}
                        onChange={(e) => toggleCalendar(calendar, e.target.checked)}
                        className="h-5 w-5 shrink-0 accent-sky-700 cursor-pointer"
                      />
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                        style={{ backgroundColor: calendar.color ?? '#9ca3af' }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-gray-900 break-words">
                          {calendar.summary ?? calendar.calendar_id}
                        </span>
                        <span className="block text-xs text-gray-600">
                          {[
                            calendar.time_zone,
                            calendar.enabled && calendar.last_synced_at
                              ? `synced ${formatWhen(calendar.last_synced_at, clockFormat)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        {calendar.enabled && calendar.last_error && (
                          <span className="block text-xs text-red-800 break-words">{calendar.last_error}</span>
                        )}
                      </span>
                      {isSaving && (
                        <span role="status" className="shrink-0">
                          <Loader2 className="w-4 h-4 animate-spin text-gray-500" aria-hidden="true" />
                          <span className="sr-only">Saving</span>
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ) : (
          !refreshing && (
            <p className="text-sm text-gray-600">
              {needsReauth
                ? 'Reconnect to load your calendars.'
                : 'Press "Refresh list from Google" to load the calendars on this account.'}
            </p>
          )
        )}

        <p className="text-xs text-gray-600">
          A calendar you switch on is read from scratch on the next sync (30 days back to 180 days ahead), then
          only its changes.
        </p>
      </div>
    </section>
  );
}

// ── The page ────────────────────────────────────────────────────────────────────

function CalendarSettings() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clockFormat = useClockFormat();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [justConnectedId, setJustConnectedId] = useState<string | null>(null);

  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [syncingAll, setSyncingAll] = useState(false);
  const [results, setResults] = useState<Record<string, SyncSummary>>({});
  const [syncError, setSyncError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<StatusResponse | null> => {
    setLoadError(null);
    try {
      const res = await fetch(STATUS_URL, { cache: 'no-store' });
      const body = await readJson(res);
      if (!res.ok) {
        setStatus(null);
        setLoadError(
          res.status === 401
            ? 'Your session has ended. Sign in again.'
            : errorText(body, 'Could not load your Google Calendar connections.'),
        );
        return null;
      }
      const data = body as unknown as StatusResponse;
      setStatus({ configured: data.configured, connections: data.connections ?? [] });
      return data;
    } catch {
      setLoadError(OFFLINE_TEXT);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // The OAuth round trip lands here with ?connected=google or ?error=<code>. Show it once,
  // then drop the query so a reload does not show it again.
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (!connected && !error) return;
    if (connected) {
      setJustConnectedId(searchParams.get('connection_id'));
      setFlash({
        kind: 'success',
        text: 'Google account connected. Choose the calendars to sync below, then press Sync now.',
      });
    } else if (error) {
      setFlash({ kind: 'error', text: connectErrorText(error) });
    }
    router.replace(PAGE_PATH);
  }, [searchParams, router]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Sync one account, or every active account when `connectionId` is null. */
  const runSync = useCallback(
    async (connectionId: string | null) => {
      const ids = connectionId
        ? [connectionId]
        : (status?.connections ?? []).filter((c) => c.status === 'active').map((c) => c.id);
      if (ids.length === 0) return;
      setSyncError(null);
      if (!connectionId) setSyncingAll(true);
      setSyncingIds((prev) => new Set([...prev, ...ids]));
      try {
        const res = await fetch(SYNC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(connectionId ? { connection_id: connectionId } : {}),
        });
        const body = await readJson(res);
        if (!res.ok) {
          setSyncError(errorText(body, 'The sync could not run.'));
          return;
        }
        const list = (body?.results as SyncSummary[] | undefined) ?? [];
        setResults((prev) => {
          const next = { ...prev };
          for (const r of list) next[r.connection_id] = r;
          return next;
        });
        // Last-synced times, per-calendar state and any needs_reauth come from the server.
        await load();
      } catch {
        setSyncError(OFFLINE_TEXT);
      } finally {
        setSyncingIds((prev) => {
          const next = new Set(prev);
          for (const id of ids) next.delete(id);
          return next;
        });
        if (!connectionId) setSyncingAll(false);
      }
    },
    [status, load],
  );

  const onRemoved = useCallback((connectionId: string, message: Flash) => {
    setStatus((prev) =>
      prev ? { ...prev, connections: prev.connections.filter((c) => c.id !== connectionId) } : prev,
    );
    setFlash(message);
  }, []);

  if (loading) return <Spinner label="Loading your Google Calendar connections" />;

  const connections = status?.connections ?? [];
  const configured = status?.configured ?? false;
  const activeCount = connections.filter((c) => c.status === 'active').length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-fuchsia-600" aria-hidden="true" />
            Google Calendar
          </h1>
          <p className="text-gray-600 mt-1">
            Connect one or more Google accounts and choose which calendars become planner tasks.
          </p>
        </div>
        {activeCount > 1 && configured && (
          <button
            type="button"
            onClick={() => runSync(null)}
            disabled={syncingAll}
            className="min-h-11 inline-flex items-center justify-center gap-1.5 px-4 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition disabled:opacity-60 w-full sm:w-auto"
          >
            {syncingAll ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
            )}
            {syncingAll ? 'Syncing all' : 'Sync all'}
          </button>
        )}
      </div>

      {/* Flash message from the OAuth round trip or from disconnecting */}
      {flash && (
        <div
          role={flash.kind === 'success' ? 'status' : 'alert'}
          className={`flex items-start gap-2 pl-4 pr-1 py-1 rounded-xl text-sm font-medium border ${
            flash.kind === 'success'
              ? 'bg-green-50 text-green-800 border-green-200'
              : flash.kind === 'warning'
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {flash.kind === 'success' ? (
            <CheckCircle2 className="w-4 h-4 mt-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-3.5 shrink-0" aria-hidden="true" />
          )}
          <p className="flex-1 py-2.5 break-words">{flash.text}</p>
          <button
            type="button"
            onClick={() => setFlash(null)}
            aria-label="Dismiss message"
            className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-black/5 transition"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {syncError && (
        <p role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm font-medium">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          {syncError}
        </p>
      )}

      {/* What this does */}
      <section aria-labelledby="calendar-how-heading" className="bg-sky-50 border border-sky-200 rounded-2xl p-5">
        <h2 id="calendar-how-heading" className="font-semibold text-gray-900 flex items-center gap-2">
          Google
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
          <span className="sr-only">to</span>
          CentenarianOS, one way
        </h2>
        <ul className="mt-2 space-y-1 text-sm text-gray-700 list-disc pl-5">
          <li>
            Read-only: CentenarianOS never creates, changes or deletes anything in your Google Calendar.
          </li>
          <li>
            Each event on a switched-on calendar becomes a planner task under &quot;Google Calendar: &lt;calendar
            name&gt;&quot;. Moved events move their task; cancelled events archive it. Tasks you tick off stay
            ticked.
          </li>
          <li>
            Everything syncs once a day automatically. Press Sync now any time to sync straight away.
          </li>
          <li>For now only planner tasks are created; #expense, #trip and other tags are read but not yet turned into records.</li>
        </ul>
      </section>

      {/* The connections could not be loaded (not signed in, offline, or the site is not set up) */}
      {loadError && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-5 text-sm space-y-3">
          <p className="flex items-start gap-2 font-medium">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="min-h-11 inline-flex items-center gap-1.5 px-4 text-sm font-medium text-red-800 bg-white border border-red-300 hover:bg-red-100 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      )}

      {status && !configured && (
        <p role="alert" className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm">
          {connections.length > 0
            ? 'The Google setup on this site is incomplete, so the connections cannot be used or renewed right now. The site owner has to finish it.'
            : 'Google Calendar is not available on this site yet. The site owner still has to finish the Google setup; once that is done, a Connect button appears here.'}
        </p>
      )}

      {/* Connected accounts */}
      {connections.map((connection) => (
        <AccountCard
          key={connection.id}
          connection={connection}
          configured={configured}
          clockFormat={clockFormat}
          autoRefresh={connection.id === justConnectedId}
          syncing={syncingIds.has(connection.id)}
          latestResult={results[connection.id] ?? null}
          onSync={runSync}
          onReload={load}
          onRemoved={onRemoved}
        />
      ))}

      {/* Connect (another) account */}
      {status && configured && (
        <section aria-labelledby="calendar-connect-heading" className="border border-dashed border-gray-300 rounded-2xl p-5 bg-white">
          <h2 id="calendar-connect-heading" className="font-semibold text-gray-900">
            {connections.length === 0 ? 'Not connected' : 'Add another Google account'}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {connections.length === 0
              ? 'You will be sent to Google to choose an account and approve read-only calendar access, then brought back here.'
              : 'For example a work account next to a personal one. Google asks which account to use; each account keeps its own calendar choices.'}
          </p>
          <a
            href={CONNECT_URL}
            className="mt-4 min-h-11 inline-flex items-center justify-center gap-1.5 px-4 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition w-full sm:w-auto"
          >
            {connections.length === 0 ? (
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Plus className="w-4 h-4" aria-hidden="true" />
            )}
            {connections.length === 0 ? 'Connect Google Calendar' : 'Connect another Google account'}
          </a>
        </section>
      )}
    </div>
  );
}

export default function CalendarSettingsPage() {
  return (
    <Suspense fallback={<Spinner label="Loading" />}>
      <CalendarSettings />
    </Suspense>
  );
}
