'use client';

// components/pain/PainEntryFields.tsx
// The fields of one pain entry: when, intensity, locations, sensations, aggravating
// activities and notes. Controlled; used by the pain form (new entries) and by
// PainEntryItem (editing an entry inline on the form and history pages).

import { BODY_LOCATIONS, INTENSITY_SCALE, SENSATIONS } from '@/lib/pain/options';
import type { PainFormState } from '@/lib/pain/client';

interface Props {
  value: PainFormState;
  onChange: (next: PainFormState) => void;
  /** Makes the input ids unique when several forms are on one page. */
  idPrefix: string;
  /** Shows a "Now" button next to the time. */
  onUseNow?: () => void;
  compact?: boolean;
}

function intensityClass(n: number, selected: boolean): string {
  if (selected) {
    if (n >= 8) return 'bg-red-600 text-white font-bold shadow-md';
    if (n >= 4) return 'bg-amber-700 text-white font-bold shadow-md';
    return 'bg-lime-700 text-white font-bold shadow-md';
  }
  if (n >= 8) return 'bg-red-100 text-red-800 hover:bg-red-200';
  if (n >= 4) return 'bg-amber-100 text-amber-800 hover:bg-amber-200';
  return 'bg-lime-100 text-lime-800 hover:bg-lime-200';
}

function toggle(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export default function PainEntryFields({ value, onChange, idPrefix, onUseNow, compact = false }: Props) {
  const set = <K extends keyof PainFormState>(key: K, next: PainFormState[K]) => onChange({ ...value, [key]: next });
  const legend = compact ? 'text-sm font-semibold text-gray-900 mb-2' : 'text-lg font-bold text-gray-900 mb-3';
  const chip = 'min-h-11 px-4 py-2 rounded-full text-sm font-medium border-2 transition';
  // Locations saved before the list changed still show, so editing never drops them.
  const extraLocations = value.locations.filter((loc) => !(BODY_LOCATIONS as readonly string[]).includes(loc));
  const extraSensations = value.sensations.filter((s) => !(SENSATIONS as readonly string[]).includes(s));

  return (
    <div className={compact ? 'space-y-5' : 'space-y-8'}>
      <div>
        <label htmlFor={`${idPrefix}-time`} className={`block ${legend}`}>
          When
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id={`${idPrefix}-time`}
            type="datetime-local"
            value={value.time}
            onChange={(e) => set('time', e.target.value)}
            required
            className="min-h-11 w-full sm:w-auto px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
          />
          {onUseNow && (
            <button
              type="button"
              onClick={onUseNow}
              className="min-h-11 px-4 py-2 text-sm font-medium text-sky-700 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 transition"
            >
              Now
            </button>
          )}
        </div>
      </div>

      <fieldset>
        <legend className={legend}>Physical discomfort (1-10)</legend>
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
          {INTENSITY_SCALE.map((n) => {
            const selected = value.intensity === n;
            return (
              <button
                key={n}
                type="button"
                aria-pressed={selected}
                aria-label={`Intensity ${n} of 10`}
                onClick={() => set('intensity', n)}
                className={`min-h-11 min-w-11 rounded-lg text-sm transition ${intensityClass(n, selected)}`}
              >
                {n}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-600 mt-2">1 = no discomfort; 10 = acute, debilitating pain</p>
      </fieldset>

      <fieldset>
        <legend className={legend}>Affected locations</legend>
        <div className="flex flex-wrap gap-2">
          {[...BODY_LOCATIONS, ...extraLocations].map((loc) => {
            const selected = value.locations.includes(loc);
            return (
              <button
                key={loc}
                type="button"
                aria-pressed={selected}
                onClick={() => set('locations', toggle(value.locations, loc))}
                className={`${chip} ${
                  selected
                    ? 'bg-fuchsia-600 text-white border-fuchsia-600 shadow'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-fuchsia-400'
                }`}
              >
                {loc}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className={legend}>Sensation type</legend>
        <div className="flex flex-wrap gap-2">
          {[...SENSATIONS, ...extraSensations].map((s) => {
            const selected = value.sensations.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={selected}
                onClick={() => set('sensations', toggle(value.sensations, s))}
                className={`${chip} ${
                  selected
                    ? 'bg-sky-600 text-white border-sky-600 shadow'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-sky-400'
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${idPrefix}-activities`} className={`block ${legend}`}>
          Aggravating activities <span className="font-normal text-sm text-gray-600">(one per line)</span>
        </label>
        <textarea
          id={`${idPrefix}-activities`}
          value={value.activities}
          onChange={(e) => set('activities', e.target.value)}
          rows={compact ? 2 : 3}
          placeholder={'Morning workout (TRX Pulls)\nSitting with tablet (90 min)'}
          className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-notes`} className={`block ${legend}`}>
          Notes
        </label>
        <textarea
          id={`${idPrefix}-notes`}
          value={value.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={compact ? 2 : 3}
          placeholder={
            value.intensity >= 4
              ? 'Pain started after 90 mins sitting.'
              : 'Optional notes on physical state or recovery quality.'
          }
          className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
        />
      </div>
    </div>
  );
}
