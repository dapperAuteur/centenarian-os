'use client';

// components/settings/CalendarRideWitUSSharing.tsx
// The two RideWitUS switches for one synced calendar (migration 216, RideWitUS PRD §6.5a):
//   Share with RideWitUS  off by default. On: this calendar's events that have a location go to
//                         RideWitUS, which suggests trips to and from them.
//   Hide titles           off by default. On: RideWitUS gets "Event" instead of the title.
// Saves through PATCH /api/calendar/google/calendars. Before migration 216 is applied the
// switches are shown disabled with a note.

import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

const CALENDARS_URL = '/api/calendar/google/calendars';

export interface SharingCalendar {
  id: string;
  calendar_id: string;
  summary: string | null;
  share_with_ridewitus?: boolean;
  hide_titles_for_ridewitus?: boolean;
  ridewitus_available?: boolean;
}

interface Props {
  connectionId: string;
  calendar: SharingCalendar;
  /** Called with the saved row so the parent list stays in step. */
  onSaved: (calendar: SharingCalendar) => void;
}

type Field = 'share_with_ridewitus' | 'hide_titles_for_ridewitus';

export default function CalendarRideWitUSSharing({ connectionId, calendar, onSaved }: Props) {
  const [saving, setSaving] = useState<Field | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<{ share: boolean; hide: boolean } | null>(null);

  const available = calendar.ridewitus_available !== false;
  const share = local?.share ?? calendar.share_with_ridewitus === true;
  const hide = local?.hide ?? calendar.hide_titles_for_ridewitus === true;
  const name = calendar.summary ?? 'this calendar';
  const shareId = `ridewitus-share-${calendar.id}`;
  const hideId = `ridewitus-hide-${calendar.id}`;
  const helpId = `ridewitus-help-${calendar.id}`;

  const save = async (field: Field, value: boolean) => {
    const previous = { share, hide };
    setError(null);
    setSaving(field);
    setLocal(field === 'share_with_ridewitus' ? { share: value, hide } : { share, hide: value });
    try {
      const res = await fetch(CALENDARS_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connectionId, calendar_id: calendar.calendar_id, [field]: value }),
      });
      let body: Record<string, unknown> | null = null;
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        body = null;
      }
      if (!res.ok) {
        setLocal(previous);
        setError(typeof body?.error === 'string' ? body.error : 'That change could not be saved.');
        return;
      }
      const saved = body?.calendar as SharingCalendar | undefined;
      setLocal(null);
      if (saved) onSaved(saved);
    } catch {
      setLocal(previous);
      setError('Could not reach the server, so that change was not saved.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="ml-8 mb-2 space-y-1">
      <div className="flex flex-col sm:flex-row sm:items-center gap-x-6">
        <label htmlFor={shareId} className="min-h-11 flex items-center gap-2 cursor-pointer text-sm text-gray-800">
          <input
            id={shareId}
            type="checkbox"
            checked={share}
            disabled={!available || saving !== null}
            onChange={(e) => save('share_with_ridewitus', e.target.checked)}
            aria-describedby={helpId}
            className="h-5 w-5 shrink-0 accent-sky-700 cursor-pointer disabled:cursor-not-allowed"
          />
          Share with RideWitUS
          {saving === 'share_with_ridewitus' && (
            <span role="status">
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" aria-hidden="true" />
              <span className="sr-only">Saving</span>
            </span>
          )}
        </label>
        <label
          htmlFor={hideId}
          className={`min-h-11 flex items-center gap-2 text-sm ${share ? 'cursor-pointer text-gray-800' : 'text-gray-600'}`}
        >
          <input
            id={hideId}
            type="checkbox"
            checked={hide}
            disabled={!available || !share || saving !== null}
            onChange={(e) => save('hide_titles_for_ridewitus', e.target.checked)}
            className="h-5 w-5 shrink-0 accent-sky-700 cursor-pointer disabled:cursor-not-allowed"
          />
          Hide titles (send &quot;Event&quot;)
          {saving === 'hide_titles_for_ridewitus' && (
            <span role="status">
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" aria-hidden="true" />
              <span className="sr-only">Saving</span>
            </span>
          )}
        </label>
      </div>
      <p id={helpId} className="text-xs text-gray-600">
        {!available
          ? 'Sharing with RideWitUS is not available on this site yet.'
          : share
            ? `Events on ${name} that have a location go to RideWitUS${hide ? ', titled "Event"' : ''}.`
            : `Nothing from ${name} goes to RideWitUS.`}
      </p>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-xs text-red-800">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
