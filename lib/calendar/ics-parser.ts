// lib/calendar/ics-parser.ts
// Pure text parser for iCalendar (.ics) files — no npm dependencies.
// Works in both Node.js and browser environments.

export interface CalendarEvent {
  uid: string;
  summary: string;
  dtstart: string;       // YYYY-MM-DD
  dtstart_time: string | null; // HH:MM or null for all-day events
  dtend: string | null;
  description: string | null;
  location: string | null;
  status: string;        // CONFIRMED | TENTATIVE | CANCELLED | COMPLETED
  is_all_day: boolean;
  rrule: string | null;
}

/** Unfold iCal line folding: CRLF or LF followed by a space/tab is a continuation. */
function unfold(raw: string): string {
  return raw.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

/** Unescape iCal text property values. */
function unescape(val: string): string {
  return val
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

/**
 * Parse a DTSTART or DTEND property value (the part after the colon).
 * Handles:
 *   - DATE-only: YYYYMMDD → is_all_day = true
 *   - DATE-TIME: YYYYMMDDTHHMMSS[Z] → is_all_day = false
 */
function parseDt(value: string): { date: string; time: string | null; is_all_day: boolean } {
  // DATE only: YYYYMMDD
  if (/^\d{8}$/.test(value)) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    return { date: `${y}-${m}-${d}`, time: null, is_all_day: true };
  }

  // DATE-TIME: YYYYMMDDTHHMMSS[Z]
  const dtMatch = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (dtMatch) {
    const [, y, mo, d, h, mi] = dtMatch;
    return {
      date: `${y}-${mo}-${d}`,
      time: `${h}:${mi}`,
      is_all_day: false,
    };
  }

  return { date: '', time: null, is_all_day: true };
}

/** Parse all VEVENT blocks from an .ics file string. */
export function parseIcs(content: string): CalendarEvent[] {
  const unfolded = unfold(content);
  const lines = unfolded.split(/\r?\n/);
  const events: CalendarEvent[] = [];

  let inEvent = false;
  let current: Record<string, string> = {};

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      continue;
    }

    if (line === 'END:VEVENT') {
      inEvent = false;

      const summary = current['SUMMARY']?.trim();
      if (summary) {
        const dtValue = current['DTSTART'] ?? '';
        const { date, time, is_all_day } = parseDt(dtValue);

        const dtendValue = current['DTEND'] ?? '';
        const { date: endDate } = parseDt(dtendValue);

        events.push({
          uid: current['UID'] ?? '',
          summary: unescape(summary),
          dtstart: date,
          dtstart_time: time,
          dtend: endDate || null,
          description: current['DESCRIPTION'] ? unescape(current['DESCRIPTION']) : null,
          location: current['LOCATION'] ? unescape(current['LOCATION']) : null,
          status: (current['STATUS'] ?? 'CONFIRMED').toUpperCase(),
          is_all_day,
          rrule: current['RRULE'] ?? null,
        });
      }

      current = {};
      continue;
    }

    if (!inEvent) continue;

    // Find the first colon — separates property name (+params) from value
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const namePart = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);

    // Strip any parameters (e.g. DTSTART;TZID=... or DTSTART;VALUE=DATE)
    const name = namePart.split(';')[0].toUpperCase();

    current[name] = value;
  }

  return events;
}

/** Extract the X-WR-CALNAME property from an .ics file. */
export function extractCalendarName(content: string): string {
  const match = content.match(/X-WR-CALNAME:([^\r\n]+)/);
  return match ? match[1].trim() : 'Calendar';
}

/** Compute date range from a list of events. */
export function getEventDateRange(events: CalendarEvent[]): { from: string; to: string } | null {
  const dates = events
    .map((e) => e.dtstart)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  if (dates.length === 0) return null;
  return { from: dates[0], to: dates[dates.length - 1] };
}
