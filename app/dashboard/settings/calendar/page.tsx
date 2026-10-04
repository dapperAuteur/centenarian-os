'use client';

// app/dashboard/settings/calendar/page.tsx
// Settings → Google Calendar. Connect a Google account (read-only), choose which of its
// calendars will sync, reconnect when Google stops accepting the saved authorization, and
// disconnect. One-way: Google → CentenarianOS. Syncing events is a later update; this
// page only manages the connection and the calendar choices.
//
// Data: GET/DELETE /api/calendar/google, GET/PATCH /api/calendar/google/calendars.
// The OAuth round trip (/api/calendar/google/connect → Google → /callback) comes back
// here with ?connected=google or ?error=<code>.

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Unlink,
  X,
} from 'lucide-react';

const PAGE_PATH = '/dashboard/settings/calendar';
const CONNECT_URL = '/api/calendar/google/connect';
const STATUS_URL = '/api/calendar/google';
const CALENDARS_URL = '/api/calendar/google/calendars';
// Where Google's OAuth guide sends users to remove an app's access themselves
// (https://developers.google.com/identity/protocols/oauth2/web-server, "Token revocation").
const GOOGLE_PERMISSIONS_URL = 'https://myaccount.google.com/permissions';

interface Connection {
  id: string;
  account_email: string | null;
  status: 'active' | 'needs_reauth' | 'disconnected';
  last_error: string | null;
}

interface SyncCalendar {
  id: string;
  calendar_id: string;
  summary: string | null;
  time_zone: string | null;
  color: string | null;
  enabled: boolean;
}

interface StatusResponse {
  configured: boolean;
  connection: Connection | null;
  calendars: SyncCalendar[];
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
  migration_missing: 'Google Calendar is not set up on this site yet: database migration 204 has not been applied.',
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

function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-fuchsia-600" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function CalendarSettings() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);

  const [calendars, setCalendars] = useState<SyncCalendar[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<{ text: string; canForce: boolean } | null>(null);

  const justConnected = useRef(false);
  const listRequested = useRef(false);
  const confirmRef = useRef<HTMLDivElement>(null);

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
            : errorText(body, 'Could not load your Google Calendar connection.'),
        );
        return null;
      }
      const data = body as unknown as StatusResponse;
      setStatus(data);
      setCalendars(data.calendars ?? []);
      return data;
    } catch {
      setLoadError(OFFLINE_TEXT);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /** Asks Google for the account's calendars and shows the saved result. */
  const refreshCalendars = useCallback(async () => {
    setRefreshing(true);
    setCalendarError(null);
    try {
      const res = await fetch(CALENDARS_URL, { cache: 'no-store' });
      const body = await readJson(res);
      if (!res.ok) {
        setCalendarError(errorText(body, 'Could not load your calendars from Google.'));
        // Google refused the saved authorization: reload so the page shows "Reconnect".
        if (body?.code === 'needs_reauth') await load();
        return;
      }
      setCalendars((body?.calendars as SyncCalendar[] | undefined) ?? []);
    } catch {
      setCalendarError(OFFLINE_TEXT);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // The OAuth round trip lands here with ?connected=google or ?error=<code>. Show it once,
  // then drop the query so a reload does not show it again.
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (!connected && !error) return;
    if (connected) {
      justConnected.current = true;
      setFlash({ kind: 'success', text: 'Google Calendar is connected. Choose the calendars to sync below.' });
    } else if (error) {
      setFlash({ kind: 'error', text: connectErrorText(error) });
    }
    router.replace(PAGE_PATH);
  }, [searchParams, router]);

  // Load the connection. Fetch the calendar list from Google once when there is nothing
  // saved yet (a fresh connection), so the checklist is not empty on first view.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await load();
      if (cancelled || !data || listRequested.current) return;
      const ready = data.configured && data.connection?.status === 'active';
      if (ready && (justConnected.current || data.calendars.length === 0)) {
        listRequested.current = true;
        await refreshCalendars();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, refreshCalendars]);

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
        body: JSON.stringify({ calendar_id: calendar.calendar_id, enabled }),
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
      const res = await fetch(force ? `${STATUS_URL}?force=1` : STATUS_URL, { method: 'DELETE' });
      const body = await readJson(res);
      if (!res.ok) {
        setDisconnectError({
          text: errorText(body, 'Google Calendar could not be disconnected.'),
          canForce: body?.can_force === true,
        });
        return;
      }
      setConfirming(false);
      setCalendars([]);
      setCalendarError(null);
      listRequested.current = false;
      setStatus((prev) => (prev ? { ...prev, connection: null, calendars: [] } : prev));
      if (typeof body?.warning === 'string') {
        setFlash({ kind: 'warning', text: body.warning });
      } else {
        setFlash({
          kind: 'success',
          text:
            body?.already_revoked === true
              ? 'Google Calendar is disconnected. Access had already been removed at Google.'
              : 'Google Calendar is disconnected, and Google confirmed that access was removed.',
        });
      }
    } catch {
      setDisconnectError({ text: OFFLINE_TEXT, canForce: false });
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) return <Spinner label="Loading your Google Calendar connection" />;

  const connection = status?.connection ?? null;
  const configured = status?.configured ?? false;
  const needsReauth = connection?.status === 'needs_reauth';
  const enabledCount = calendars.filter((c) => c.enabled).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarDays className="w-7 h-7 text-fuchsia-600" aria-hidden="true" />
          Google Calendar
        </h1>
        <p className="text-gray-600 mt-1">
          Connect your Google account and choose which calendars CentenarianOS may read.
        </p>
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

      {/* What this does and does not do */}
      <section aria-labelledby="calendar-how-heading" className="bg-sky-50 border border-sky-200 rounded-2xl p-5">
        <h2 id="calendar-how-heading" className="font-semibold text-gray-900 flex items-center gap-2">
          Google
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
          <span className="sr-only">to</span>
          CentenarianOS, one way
        </h2>
        <ul className="mt-2 space-y-1 text-sm text-gray-700 list-disc pl-5">
          <li>
            CentenarianOS asks Google for read-only access. Nothing is written to Google: it never creates,
            changes or deletes anything in your Google Calendar.
          </li>
          <li>
            Syncing events arrives in the next update. For now you can connect your account and choose which
            calendars will sync; no events are imported yet.
          </li>
        </ul>
      </section>

      {/* The connection could not be loaded (not signed in, offline, or the site is not set up) */}
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
              load();
            }}
            className="min-h-11 inline-flex items-center gap-1.5 px-4 text-sm font-medium text-red-800 bg-white border border-red-300 hover:bg-red-100 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      )}

      {/* Not connected */}
      {status && !connection && (
        <section aria-labelledby="calendar-connect-heading" className="border border-gray-200 rounded-2xl p-5 bg-white">
          <h2 id="calendar-connect-heading" className="font-semibold text-gray-900">
            Not connected
          </h2>
          {configured ? (
            <>
              <p className="text-sm text-gray-600 mt-1">
                You will be sent to Google to choose an account and approve read-only calendar access, then
                brought back here.
              </p>
              <a
                href={CONNECT_URL}
                className="mt-4 min-h-11 inline-flex items-center justify-center gap-1.5 px-4 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition w-full sm:w-auto"
              >
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
                Connect Google Calendar
              </a>
            </>
          ) : (
            <p className="text-sm text-gray-600 mt-1">
              Google Calendar is not available on this site yet. The site owner still has to finish the Google
              setup; once that is done, a Connect button appears here.
            </p>
          )}
        </section>
      )}

      {/* Connected */}
      {status && connection && (
        <>
          <section aria-labelledby="calendar-account-heading" className="border border-gray-200 rounded-2xl p-5 bg-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <h2 id="calendar-account-heading" className="font-semibold text-gray-900">
                  Connected account
                </h2>
                <p className="text-sm text-gray-700 mt-1 break-all">
                  {connection.account_email ?? 'Google account (email not shared)'}
                </p>
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
              </div>

              {!confirming && (
                <button
                  type="button"
                  onClick={() => {
                    setDisconnectError(null);
                    setConfirming(true);
                  }}
                  className="min-h-11 inline-flex items-center justify-center gap-1.5 px-4 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition w-full sm:w-auto"
                >
                  <Unlink className="w-4 h-4" aria-hidden="true" />
                  Disconnect
                </button>
              )}
            </div>

            {needsReauth && (
              <div role="alert" className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm space-y-3">
                <p className="font-medium">
                  Google no longer accepts the saved authorization, so CentenarianOS cannot read your calendars
                  until you reconnect. Your calendar choices are kept.
                </p>
                {configured && (
                  <a
                    href={CONNECT_URL}
                    className="min-h-11 inline-flex items-center justify-center gap-1.5 px-4 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition w-full sm:w-auto"
                  >
                    <ExternalLink className="w-4 h-4" aria-hidden="true" />
                    Reconnect
                  </a>
                )}
              </div>
            )}

            {!configured && (
              <p role="alert" className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm">
                The Google setup on this site is incomplete, so the connection cannot be used or renewed right
                now. The site owner has to finish it.
              </p>
            )}

            {confirming && (
              <div
                ref={confirmRef}
                tabIndex={-1}
                role="group"
                aria-labelledby="calendar-disconnect-heading"
                className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3 outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <h3 id="calendar-disconnect-heading" className="font-semibold text-red-900">
                  Disconnect Google Calendar?
                </h3>
                <p className="text-sm text-red-900">
                  CentenarianOS will ask Google to remove its access, then delete the saved connection and your
                  calendar choices. Nothing in your Google Calendar changes.
                </p>

                {disconnectError && (
                  <p role="alert" className="text-sm font-medium text-red-900 break-words">
                    {disconnectError.text}
                    {disconnectError.canForce && (
                      <>
                        {' '}
                        You can remove the saved connection anyway and then remove this app in your{' '}
                        <a
                          href={GOOGLE_PERMISSIONS_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
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
          </section>

          {/* Calendar checklist */}
          <section aria-labelledby="calendar-list-heading" className="border border-gray-200 rounded-2xl p-5 bg-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 id="calendar-list-heading" className="font-semibold text-gray-900">
                  Calendars to sync
                </h2>
                <p className="text-sm text-gray-600 mt-1" aria-live="polite">
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
                <legend className="sr-only">Choose the calendars to sync</legend>
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
                            {calendar.time_zone && (
                              <span className="block text-xs text-gray-600">{calendar.time_zone}</span>
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
              Switching a calendar on only marks it for syncing. Events from it start arriving once event
              syncing ships.
            </p>
          </section>
        </>
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
