'use client';

// app/dashboard/settings/calendar/event-builder/page.tsx
// Settings → Calendar Sync → Event builder. Helps people write Google Calendar event titles that
// CentenarianOS can read: pick a kind, fill a few fields, see the exact title and what the real
// parser (lib/capture/parse-tokens.ts) reads from it, then copy the title or open Google's
// prefilled "create event" form. Also offers the examples as an .ics file and the cheat sheet.
//
// Says what the sync does (lib/calendar/google-sync.ts, lib/capture/calendar-records.ts): a planner
// task per event, plus a transaction, meal log or workout log for a tagged title. #trip makes no
// trip: travel is moving to RideWitUS, so the details are only saved (plan 59, phase 4.4).
// No writes anywhere. Reads GET /api/travel/settings (the user's distance unit), and for the
// account picker GET /api/calendar/google (each Google account's ticked finance accounts) and
// GET /api/finance/accounts (their names, last four digits and nicknames). The picker adds "@1234" or
// "@nickname" to an #expense / #income title (lib/capture/calendar-accounts.ts).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  MapPin,
  Wand2,
} from 'lucide-react';
import { parseCaptureTitle } from '@/lib/capture/parse-tokens';
import { TRIP_MODES, type CaptureKind, type MealType, type TripMode } from '@/lib/capture/tokens';
import {
  CAPTURE_KINDS,
  EXAMPLE_EVENTS,
  KIND_LABELS,
  addDays,
  buildEventTitle,
  buildExampleIcs,
  buildGoogleCalendarLink,
  describeCapture,
  exampleTitle,
  warningLine,
  type DistanceUnit,
  type ExampleEvent,
  type TitleLanguage,
} from '@/lib/capture/event-templates';
import { formatTime, useClockFormat } from '@/lib/hooks/useClockFormat';
import { accountRefFor, readAccountChoice } from '@/lib/capture/calendar-accounts';

interface BuilderConnection {
  id: string;
  account_email: string | null;
  settings: Record<string, unknown> | null;
}

interface BuilderFinanceAccount {
  id: string;
  name: string;
  institution_name?: string | null;
  last_four?: string | null;
  /** Migration 218; missing before it. */
  nickname?: string | null;
  currency?: string | null;
}

const CHEAT_SHEET_URL = '/dashboard/settings/calendar/event-builder/cheat-sheet';
const SETTINGS_URL = '/dashboard/settings/calendar';
const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
/** The sync schedules all-day events at 09:00 (lib/calendar/event-fields.ts ALL_DAY_TIME). */
const ALL_DAY_TIME = '09:00';

const WHAT_LABEL: Record<CaptureKind, { label: string; placeholder: string }> = {
  expense: { label: 'What or where (vendor)', placeholder: 'Lunch at Corner Cafe' },
  income: { label: 'Who paid, or what for', placeholder: 'Client payment Acme Studio' },
  trip: { label: 'Where to', placeholder: 'To the trailhead' },
  meal: { label: 'What or where you ate', placeholder: 'Corner Cafe' },
  workout: { label: 'What you did', placeholder: 'Strength session' },
  task: { label: 'What to do', placeholder: 'Call the plumber' },
};

const RESULT: Record<CaptureKind, string> = {
  expense: 'Plus an expense transaction in the account ticked in Calendar Sync (the default, or the @account), linked to the task.',
  income: 'Plus an income transaction in the account ticked in Calendar Sync (the default, or the @account), linked to the task.',
  trip: "No trip is created: the trip details are saved and will go to RideWitUS.",
  meal: 'Plus a meal log for that date and time.',
  workout: 'Plus a workout log, linked to the task.',
  task: 'A task is all this kind makes.',
};

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The coming Monday (or today, when today is Monday), as YYYY-MM-DD. */
function nextMonday(today: Date): string {
  const offset = (8 - today.getDay()) % 7;
  return addDays(localDate(today), offset);
}

function clockLabel(hhmm: string, clockFormat: '12h' | '24h'): string {
  const [h, m] = hhmm.split(':').map(Number);
  return formatTime(new Date(2000, 0, 1, h, m), clockFormat);
}

const inputClass =
  'w-full min-h-11 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500';
const labelClass = 'block text-sm font-medium text-gray-800 mb-1';

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-11 px-4 rounded-lg text-sm font-medium border transition ${
            value === option.value
              ? 'bg-sky-700 border-sky-700 text-white'
              : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function CalendarEventBuilderPage() {
  const clockFormat = useClockFormat();
  const [kind, setKind] = useState<CaptureKind>('expense');
  const [lang, setLang] = useState<TitleLanguage>('en');
  const [what, setWhat] = useState('');
  const [amount, setAmount] = useState('');
  const [distance, setDistance] = useState('');
  const [unit, setUnit] = useState<DistanceUnit>('mi');
  const [mode, setMode] = useState<TripMode | ''>('');
  const [mealType, setMealType] = useState<MealType | ''>('');
  const [duration, setDuration] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(() => localDate(new Date()));
  const [allDay, setAllDay] = useState(false);
  const [time, setTime] = useState('12:00');
  const [eventLength, setEventLength] = useState('30');
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [connections, setConnections] = useState<BuilderConnection[]>([]);
  const [financeAccounts, setFinanceAccounts] = useState<BuilderFinanceAccount[]>([]);
  const [connectionId, setConnectionId] = useState('');
  const [accountRef, setAccountRef] = useState('');

  // The Google accounts and their ticked finance accounts, for the account picker. Failing
  // quietly is fine: the picker then offers only the default account.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/calendar/google', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : null)),
      fetch('/api/finance/accounts', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([google, finance]: [{ connections?: BuilderConnection[] } | null, unknown]) => {
        if (cancelled) return;
        const list = Array.isArray(google?.connections) ? google.connections : [];
        setConnections(list);
        setConnectionId((current) => current || list[0]?.id || '');
        setFinanceAccounts(Array.isArray(finance) ? (finance as BuilderFinanceAccount[]) : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const accountOptions = useMemo(() => {
    const connection = connections.find((c) => c.id === connectionId);
    if (!connection) return [];
    const choice = readAccountChoice(connection.settings);
    const owned = financeAccounts.map((a) => ({ id: a.id, last_four: a.last_four, nickname: a.nickname }));
    return choice.allowedIds.flatMap((id) => {
      const account = financeAccounts.find((a) => a.id.toLowerCase() === id);
      if (!account) return [];
      const parts = [account.name, account.institution_name, account.last_four ? `…${account.last_four}` : null];
      return [
        {
          id,
          ref: accountRefFor(id, choice, owned),
          isDefault: choice.defaultId === id,
          label: `${parts.filter(Boolean).join(' · ')}${account.currency ? ` (${account.currency})` : ''}`,
        },
      ];
    });
  }, [connections, connectionId, financeAccounts]);
  const defaultOption = accountOptions.find((o) => o.isDefault);

  // Start the distance toggle on the user's travel setting (Travel → Settings), when there is one.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/travel/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { settings?: { distance_unit?: string } | null } | null) => {
        const saved = body?.settings?.distance_unit;
        if (!cancelled && (saved === 'km' || saved === 'mi')) setUnit(saved);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const durationMin = duration.trim() ? Number(duration) : undefined;
  const title = useMemo(
    () =>
      buildEventTitle({
        kind,
        lang,
        what,
        amount,
        distance,
        distanceUnit: unit,
        mode: mode || undefined,
        mealType: mealType || undefined,
        durationMin: durationMin !== undefined && Number.isFinite(durationMin) ? durationMin : undefined,
        account: accountRef || undefined,
      }),
    [kind, lang, what, amount, distance, unit, mode, mealType, durationMin, accountRef],
  );
  const startTime = allDay ? ALL_DAY_TIME : time;
  const parsed = useMemo(() => parseCaptureTitle(title, { startTime }), [title, startTime]);
  const readLines = describeCapture(parsed, unit);

  const timeZone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
  const googleLink = buildGoogleCalendarLink({
    title,
    date,
    startTime: allDay ? undefined : time,
    durationMin: Number(eventLength) || 30,
    location,
    details: 'Made with the CentenarianOS event builder.',
    timeZone,
  });

  async function copy(text: string, key: string) {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000);
    } catch {
      setCopyError('Copying is blocked in this browser. Select the title and copy it by hand.');
    }
  }

  function loadExample(example: ExampleEvent) {
    const draft = lang === 'es' ? example.es : example.en;
    setKind(example.kind);
    setWhat(draft.what);
    setAmount(draft.amount ?? '');
    setAccountRef(draft.account ?? '');
    setDistance(draft.distance ?? '');
    if (draft.distanceUnit) setUnit(draft.distanceUnit);
    setMode(draft.mode ?? '');
    setMealType(draft.mealType ?? '');
    setDuration(draft.durationMin ? String(draft.durationMin) : '');
    setLocation(example.location ?? '');
    setAllDay(false);
    setTime(example.startTime);
    setEventLength(String(example.durationMin));
  }

  function downloadExamples() {
    const ics = buildExampleIcs(nextMonday(new Date()), `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`);
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'centenarianos-calendar-examples.ics';
    a.click();
    URL.revokeObjectURL(url);
  }

  const whatField = WHAT_LABEL[kind];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div>
        <Link
          href={SETTINGS_URL}
          className="min-h-11 inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-800"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to Calendar Sync
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Wand2 className="w-7 h-7 text-fuchsia-600" aria-hidden="true" />
          Calendar event builder
        </h1>
        <p className="text-gray-600 mt-1">
          Write Google Calendar events CentenarianOS can read. Fill in a few fields, then copy the title or open the
          event in Google Calendar.
        </p>
      </div>

      <section aria-labelledby="today-heading" className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-gray-800">
        <h2 id="today-heading" className="font-semibold text-gray-900">
          What happens when an event syncs
        </h2>
        <p className="mt-1">
          Every event on a calendar you sync becomes a planner task, named after the title without its tags. A tagged
          title also creates a record linked to that task: #expense and #income a transaction (in the default account
          ticked in Calendar Sync, or the ticked account an @1234 or @nickname names), #meal a meal log, #workout a workout log. #trip events stay tasks: the trip details are saved
          and will go to RideWitUS. A title with missing details (an #expense with no amount) creates only the task and
          is flagged. A record follows later changes to its event until you edit it in CentenarianOS; cancelling an
          event never deletes a transaction.
        </p>
      </section>

      {/* Builder */}
      <section aria-labelledby="builder-heading" className="bg-white border border-gray-200 rounded-2xl p-5 space-y-5">
        <h2 id="builder-heading" className="font-semibold text-gray-900 text-lg">
          Build a title
        </h2>

        <div>
          <p className={labelClass}>
            Kind
          </p>
          <Segmented
            label="Kind"
            options={CAPTURE_KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))}
            value={kind}
            onChange={setKind}
          />
        </div>

        <div>
          <p className={labelClass}>Title language</p>
          <Segmented
            label="Title language"
            options={[
              { value: 'en', label: 'English tags' },
              { value: 'es', label: 'Spanish tags' },
            ]}
            value={lang}
            onChange={setLang}
          />
          <p className="text-xs text-gray-600 mt-1">Both always work, whatever your language setting.</p>
        </div>

        <div>
          <label htmlFor="eb-what" className={labelClass}>
            {whatField.label}
          </label>
          <input
            id="eb-what"
            className={inputClass}
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            placeholder={whatField.placeholder}
          />
        </div>

        {(kind === 'expense' || kind === 'income') && (
          <div>
            <label htmlFor="eb-amount" className={labelClass}>
              Amount
            </label>
            <input
              id="eb-amount"
              className={inputClass}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="12.40"
              aria-describedby="eb-amount-help"
            />
            <p id="eb-amount-help" className="text-xs text-gray-600 mt-1">
              Written as $12.40 so no other number in the title is mistaken for it. The $ is only a marker; the amount is
              not converted between currencies.
            </p>
          </div>
        )}

        {(kind === 'expense' || kind === 'income') && (
          <div className="space-y-3">
            {connections.length > 1 && (
              <div>
                <label htmlFor="eb-connection" className={labelClass}>
                  Google account the event goes in
                </label>
                <select
                  id="eb-connection"
                  className={inputClass}
                  value={connectionId}
                  onChange={(e) => {
                    setConnectionId(e.target.value);
                    setAccountRef('');
                  }}
                >
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.account_email ?? 'Google account'}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="eb-account" className={labelClass}>
                Account
              </label>
              <select
                id="eb-account"
                className={inputClass}
                value={accountRef}
                onChange={(e) => setAccountRef(e.target.value)}
                aria-describedby="eb-account-help"
              >
                <option value="">
                  {defaultOption ? `Default: ${defaultOption.label}` : 'Default account (none chosen)'}
                </option>
                {accountOptions.map((o) =>
                  o.ref ? (
                    <option key={o.id} value={o.ref}>
                      {o.label} (@{o.ref})
                    </option>
                  ) : (
                    <option key={o.id} value={`needs-${o.id}`} disabled>
                      {o.label} (give it a nickname on Finance → Accounts)
                    </option>
                  ),
                )}
              </select>
              <p id="eb-account-help" className="text-xs text-gray-600 mt-1">
                Only the accounts ticked for this Google account in{' '}
                <Link href={SETTINGS_URL} className="text-sky-800 underline">
                  Calendar Sync
                </Link>{' '}
                are listed. Choosing one adds @ and its nickname (set on Finance → Accounts) or last four digits to the
                title; the default needs nothing.
              </p>
            </div>
          </div>
        )}

        {kind === 'trip' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="eb-distance" className={labelClass}>
                  Distance
                </label>
                <input
                  id="eb-distance"
                  className={inputClass}
                  inputMode="decimal"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder={unit === 'km' ? '12.5' : '7.8'}
                />
              </div>
              <div>
                <p className={labelClass}>Unit</p>
                <Segmented
                  label="Distance unit"
                  options={[
                    { value: 'mi', label: 'Miles (mi)' },
                    { value: 'km', label: 'Kilometers (km)' },
                  ]}
                  value={unit}
                  onChange={setUnit}
                />
              </div>
            </div>
            <div>
              <label htmlFor="eb-mode" className={labelClass}>
                Mode
              </label>
              <select
                id="eb-mode"
                className={inputClass}
                value={mode}
                onChange={(e) => setMode(e.target.value as TripMode | '')}
              >
                <option value="">Not in the title</option>
                {TRIP_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {kind === 'meal' && (
          <div>
            <label htmlFor="eb-meal" className={labelClass}>
              Meal
            </label>
            <select
              id="eb-meal"
              className={inputClass}
              value={mealType}
              onChange={(e) => setMealType(e.target.value as MealType | '')}
            >
              <option value="">From the start time</option>
              {MEAL_TYPES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="eb-duration" className={labelClass}>
            Duration in the title, minutes (optional)
          </label>
          <input
            id="eb-duration"
            className={inputClass}
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="45"
          />
        </div>

        <div>
          <label htmlFor="eb-location" className={`${labelClass} flex items-center gap-1`}>
            <MapPin className="w-4 h-4" aria-hidden="true" />
            Location (optional)
          </label>
          <input
            id="eb-location"
            className={inputClass}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Corner Cafe, 12 Main St"
            aria-describedby="eb-location-help"
          />
          <p id="eb-location-help" className="text-xs text-gray-600 mt-1">
            Goes in the event&apos;s Location field, not the title. It is added to the task description, and it is what
            RideWitUS uses: for a calendar you share with RideWitUS (Calendar Sync, off by default), events with a
            location are sent so it can suggest trips to and from them. Events without a location are never sent.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="eb-date" className={labelClass}>
              Date
            </label>
            <input id="eb-date" type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="eb-time" className={labelClass}>
              Start time
            </label>
            <input
              id="eb-time"
              type="time"
              className={inputClass}
              value={time}
              disabled={allDay}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="eb-length" className={labelClass}>
              Event length, minutes
            </label>
            <input
              id="eb-length"
              className={inputClass}
              inputMode="numeric"
              value={eventLength}
              disabled={allDay}
              onChange={(e) => setEventLength(e.target.value.replace(/[^\d]/g, ''))}
            />
          </div>
        </div>
        <label htmlFor="eb-allday" className="min-h-11 inline-flex items-center gap-2 text-sm text-gray-800">
          <input
            id="eb-allday"
            type="checkbox"
            className="w-5 h-5"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          All-day event (the planner task is scheduled at {clockLabel(ALL_DAY_TIME, clockFormat)})
        </label>
      </section>

      {/* Result */}
      <section aria-labelledby="result-heading" className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <h2 id="result-heading" className="font-semibold text-gray-900 text-lg">
          Your title
        </h2>
        <p className="font-mono text-base bg-gray-50 border border-gray-200 rounded-lg p-3 break-words" aria-live="polite">
          {title}
        </p>

        <div aria-live="polite">
          <h3 className="text-sm font-semibold text-gray-900">CentenarianOS will read this as</h3>
          <ul className="mt-1 text-sm text-gray-700 list-disc pl-5 space-y-0.5">
            {readLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-gray-700">
            Creates: a planner task named &quot;{parsed.cleanTitle || title}&quot;.{' '}
            {parsed.warnings.length > 0 ? 'Only the task, until the title is fixed.' : RESULT[parsed.kind]}
          </p>
          {parsed.warnings.length > 0 && (
            <div role="alert" className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
              <p className="font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                This title would be flagged
              </p>
              <ul className="mt-1 list-disc pl-5">
                {parsed.warnings.map((w) => (
                  <li key={w}>{warningLine(w)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => copy(title, 'builder')}
            className="min-h-11 inline-flex items-center justify-center gap-1.5 px-4 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition"
          >
            {copied === 'builder' ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
            {copied === 'builder' ? 'Copied' : 'Copy title'}
          </button>
          {googleLink && (
            <a
              href={googleLink}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 inline-flex items-center justify-center gap-1.5 px-4 text-sm font-medium text-sky-800 bg-white border border-sky-300 hover:bg-sky-50 rounded-lg transition"
            >
              <CalendarPlus className="w-4 h-4" aria-hidden="true" />
              Open in Google Calendar
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </div>
        <p className="text-xs text-gray-600">
          Open in Google Calendar uses Google&apos;s prefilled event link. Google does not publish a reference for it, so
          if the form opens empty, copy the title instead. Check which calendar the event is saved to: only calendars you
          switched on in Calendar Sync are read. Nothing is saved until you press Save in Google.
        </p>
        <p role="status" className="text-sm text-gray-700">
          {copyError ?? ''}
        </p>
      </section>

      {/* Examples */}
      <section aria-labelledby="examples-heading" className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <h2 id="examples-heading" className="font-semibold text-gray-900 text-lg">
          Examples
        </h2>
        <ul role="list" className="divide-y divide-gray-100">
          {EXAMPLE_EVENTS.map((example) => {
            const exampleText = exampleTitle(example, lang);
            const key = `example-${example.kind}`;
            return (
              <li key={example.kind} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-700">
                    {KIND_LABELS[example.kind]} · {clockLabel(example.startTime, clockFormat)}
                  </p>
                  <p className="font-mono text-sm text-gray-900 break-words">{exampleText}</p>
                  <p className="text-xs text-gray-600">{example.note}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => loadExample(example)}
                    className="min-h-11 px-3 text-sm font-medium text-sky-800 bg-white border border-sky-300 hover:bg-sky-50 rounded-lg transition"
                  >
                    Use<span className="sr-only"> the {KIND_LABELS[example.kind]} example</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(exampleText, key)}
                    aria-label={`Copy the ${KIND_LABELS[example.kind]} example title`}
                    className="min-h-11 min-w-11 flex items-center justify-center text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition"
                  >
                    {copied === key ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Templates */}
      <section aria-labelledby="templates-heading" className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
        <h2 id="templates-heading" className="font-semibold text-gray-900 text-lg">
          Templates
        </h2>
        <p className="text-sm text-gray-700">
          The examples file holds every example above, in English and Spanish, dated in the coming week and titled
          &quot;Example: …&quot;. Import it into a separate test calendar, not your main one: in Google Calendar on a
          computer, create a new calendar, then go to Settings → Import &amp; export, choose the file and pick the test
          calendar. Switch that calendar on in Calendar Sync, press Sync now, and check the planner. Delete the test
          calendar when you are done. The one-page cheat sheet lists copy-paste titles in English and Spanish and every
          word the sync reads; print it or keep it next to your calendar.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={downloadExamples}
            className="min-h-11 inline-flex items-center justify-center gap-1.5 px-4 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Download examples (.ics)
          </button>
          <Link
            href={CHEAT_SHEET_URL}
            className="min-h-11 inline-flex items-center justify-center gap-1.5 px-4 text-sm font-medium text-sky-800 bg-white border border-sky-300 hover:bg-sky-50 rounded-lg transition"
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
            Printable cheat sheet
          </Link>
        </div>
      </section>
    </div>
  );
}
