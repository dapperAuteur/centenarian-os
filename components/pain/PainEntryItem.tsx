'use client';

// components/pain/PainEntryItem.tsx
// One pain entry in a list (today's entries on the pain form, every entry on the history
// page): its time, intensity, locations, sensations, activities and notes, with Edit
// (inline, using PainEntryFields) and Delete. Saves go through lib/pain/client.ts, which
// queues them when offline.

import { useState } from 'react';
import { Pencil, Trash2, Loader2, CloudOff } from 'lucide-react';
import PainEntryFields from '@/components/pain/PainEntryFields';
import { formatTime } from '@/lib/hooks/useClockFormat';
import { intensityBadgeClass } from '@/lib/pain/options';
import {
  deletePainEntry,
  formFromEntry,
  timeUnknown,
  updatePainEntry,
  type DayState,
  type PainFormState,
} from '@/lib/pain/client';
import { activitiesFromText, type PainEntry } from '@/lib/pain/logic';

interface Props {
  entry: PainEntry;
  clockFormat: '12h' | '24h';
  /** Saved offline and not sent yet: shown, but not editable until it syncs. */
  pending?: boolean;
  onUpdated: (entry: PainEntry, days: DayState[] | null) => void;
  onDeleted: (id: string, day: DayState | null) => void;
}

export default function PainEntryItem({ entry, clockFormat, pending = false, onUpdated, onDeleted }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PainFormState | null>(null);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState('');
  const [queuedNote, setQueuedNote] = useState('');

  const unknownTime = timeUnknown(entry);
  const timeLabel = unknownTime ? 'Time not recorded' : formatTime(entry.occurred_at, clockFormat);
  const idPrefix = `pain-edit-${entry.id}`;

  function startEdit() {
    setForm(formFromEntry(entry));
    setError('');
    setEditing(true);
  }

  async function save() {
    if (!form) return;
    setBusy('save');
    setError('');
    try {
      const timeChanged = form.time !== formFromEntry(entry).time;
      const result = await updatePainEntry(entry.id, form, timeChanged);
      if (result.queued) {
        setQueuedNote('Saved offline. The change is sent when you reconnect.');
        onUpdated(
          {
            ...entry,
            intensity: form.intensity,
            locations: form.locations,
            sensations: form.sensations,
            activities: activitiesFromText(form.activities),
            notes: form.notes.trim() || null,
          },
          null,
        );
      } else {
        setQueuedNote('');
        onUpdated(result.entry, result.days);
      }
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the change.');
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm(`Delete the ${unknownTime ? '' : `${timeLabel} `}pain entry (${entry.intensity}/10)?`)) return;
    setBusy('delete');
    setError('');
    try {
      const result = await deletePainEntry(entry.id);
      onDeleted(entry.id, result.queued ? null : result.day);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the entry.');
      setBusy(null);
    }
  }

  return (
    <li className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
      {editing && form ? (
        <div>
          <PainEntryFields value={form} onChange={setForm} idPrefix={idPrefix} compact />
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy !== null}
              className="min-h-11 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {busy === 'save' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Save changes
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy !== null}
              className="min-h-11 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{timeLabel}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${intensityBadgeClass(entry.intensity)}`}>
              {entry.intensity}/10
            </span>
            {pending && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                <CloudOff className="w-3 h-3" aria-hidden="true" /> Waiting to sync
              </span>
            )}
            {entry.source === 'daily_log' && (
              <span className="text-xs text-gray-600">From the daily log</span>
            )}
            <div className="ml-auto flex gap-1">
              <button
                type="button"
                onClick={startEdit}
                disabled={pending || busy !== null}
                aria-label={`Edit the ${timeLabel} entry`}
                className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 transition"
              >
                <Pencil className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={pending || busy !== null}
                aria-label={`Delete the ${timeLabel} entry`}
                className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 transition"
              >
                {busy === 'delete' ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {(entry.locations.length > 0 || entry.sensations.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {entry.locations.map((loc) => (
                <span key={`l-${loc}`} className="px-2 py-0.5 bg-fuchsia-100 text-fuchsia-800 rounded-full text-xs">
                  {loc}
                </span>
              ))}
              {entry.sensations.map((s) => (
                <span key={`s-${s}`} className="px-2 py-0.5 bg-sky-100 text-sky-800 rounded-full text-xs">
                  {s}
                </span>
              ))}
            </div>
          )}
          {entry.activities.length > 0 && (
            <p className="mt-2 text-sm text-gray-700">
              <span className="text-gray-600">Activities: </span>
              {entry.activities.join(', ')}
            </p>
          )}
          {entry.notes && <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{entry.notes}</p>}
          {queuedNote && (
            <p role="status" className="mt-2 text-xs text-gray-600">
              {queuedNote}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
