// lib/fiscal.ts
// Fiscal year utility functions used by forecast API and UI.
//
// Leap year safety: fiscal_year_start_day is capped at 28 in the DB
// (migration 155 CHECK constraint), so Feb 29 can never be a fiscal start.
// All month arithmetic uses a safe helper that clamps to the last day of
// the target month, preventing JavaScript's Date.setMonth() overflow
// (e.g., Jan 31 + 3 months → May 1 instead of Apr 30).

export interface FiscalConfig {
  startMonth: number; // 1-12
  startDay: number;   // 1-28
}

export interface FiscalPeriod {
  label: string;
  start: string;
  end: string;
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function dateFromStr(s: string): Date {
  return new Date(s + 'T00:00:00');
}

function addDaysToDate(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Safely add months to a date, clamping to the last day of the target month.
 * Prevents JavaScript overflow (e.g., Jan 31 + 1 month → Feb 28, not Mar 3).
 */
function addMonths(d: Date, months: number): Date {
  const result = new Date(d);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  // If the day overflowed into the next month, clamp to last day of target month
  const expectedMonth = ((d.getMonth() + months) % 12 + 12) % 12;
  if (result.getMonth() !== expectedMonth) {
    // Overflowed — set to last day of the intended month
    result.setDate(0); // goes back to last day of previous month
  }
  return result;
}

/** Check if using default calendar year (Jan 1) */
export function isCalendarYear(config: FiscalConfig): boolean {
  return config.startMonth === 1 && config.startDay === 1;
}

/** Get the fiscal year boundaries containing the given date */
export function getFiscalYear(date: string, config: FiscalConfig): FiscalPeriod {
  const d = dateFromStr(date);
  const year = d.getFullYear();

  // Fiscal year start in the current calendar year
  const fyStartThisYear = new Date(year, config.startMonth - 1, config.startDay);

  let fyStart: Date;
  if (d >= fyStartThisYear) {
    fyStart = fyStartThisYear;
  } else {
    fyStart = new Date(year - 1, config.startMonth - 1, config.startDay);
  }

  // Fiscal year ends the day before the next fiscal year starts
  const nextFyStart = new Date(fyStart.getFullYear() + 1, config.startMonth - 1, config.startDay);
  const fyEnd = addDaysToDate(nextFyStart, -1);

  const startYear = fyStart.getFullYear();
  const endYear = fyEnd.getFullYear();
  const label = startYear === endYear
    ? `FY ${startYear}`
    : `FY ${startYear}-${String(endYear).slice(2)}`;

  return { label, start: toDateStr(fyStart), end: toDateStr(fyEnd) };
}

/** Get the fiscal quarter containing the given date */
export function getFiscalQuarter(
  date: string,
  config: FiscalConfig
): FiscalPeriod & { quarter: number } {
  const fy = getFiscalYear(date, config);
  const fyStart = dateFromStr(fy.start);
  const d = dateFromStr(date);

  // Quarters are 3-month blocks from fiscal year start
  const monthsFromStart =
    (d.getFullYear() - fyStart.getFullYear()) * 12 + (d.getMonth() - fyStart.getMonth());
  const quarter = Math.min(Math.floor(monthsFromStart / 3) + 1, 4);

  const qStart = addMonths(fyStart, (quarter - 1) * 3);
  const qEndRaw = addMonths(fyStart, quarter * 3);
  const qEnd = addDaysToDate(qEndRaw, -1);

  // Clamp to fiscal year end
  const fyEndDate = dateFromStr(fy.end);
  const clampedEnd = qEnd > fyEndDate ? fyEndDate : qEnd;

  const startMonth = qStart.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = clampedEnd.toLocaleDateString('en-US', { month: 'short' });
  const label = `Q${quarter} (${startMonth}-${endMonth})`;

  return { label, start: toDateStr(qStart), end: toDateStr(clampedEnd), quarter };
}

/** Get all fiscal periods for the current fiscal year */
export function getFiscalPeriods(
  config: FiscalConfig,
  today?: string
): {
  ytd: FiscalPeriod;
  fullYear: FiscalPeriod;
  quarters: (FiscalPeriod & { quarter: number })[];
} {
  const todayStr = today ?? new Date().toISOString().split('T')[0];
  const fy = getFiscalYear(todayStr, config);
  const fyStart = dateFromStr(fy.start);
  const fyEndDate = dateFromStr(fy.end);

  // YTD: fiscal year start → today
  const ytd: FiscalPeriod = {
    label: 'Fiscal YTD',
    start: fy.start,
    end: todayStr,
  };

  // Quarters — use safe addMonths to avoid day overflow
  const quarters: (FiscalPeriod & { quarter: number })[] = [];
  for (let q = 0; q < 4; q++) {
    const qStart = addMonths(fyStart, q * 3);
    const nextQStart = addMonths(fyStart, (q + 1) * 3);
    const qEnd = addDaysToDate(nextQStart, -1);

    // Clamp to fiscal year end
    const clampedEnd = qEnd > fyEndDate ? fyEndDate : qEnd;

    // Skip quarters that start after fiscal year end (shouldn't happen, but safety)
    if (qStart > fyEndDate) continue;

    const startMonth = qStart.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = clampedEnd.toLocaleDateString('en-US', { month: 'short' });

    quarters.push({
      label: `Q${q + 1} (${startMonth}-${endMonth})`,
      start: toDateStr(qStart),
      end: toDateStr(clampedEnd),
      quarter: q + 1,
    });
  }

  return { ytd, fullYear: fy, quarters };
}
