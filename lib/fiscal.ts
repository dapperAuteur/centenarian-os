// lib/fiscal.ts
// Fiscal year utility functions used by forecast API and UI.

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

  const fyEnd = addDaysToDate(
    new Date(fyStart.getFullYear() + 1, config.startMonth - 1, config.startDay),
    -1
  );

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

  const qStart = new Date(fyStart);
  qStart.setMonth(qStart.getMonth() + (quarter - 1) * 3);

  const qEnd = new Date(qStart);
  qEnd.setMonth(qEnd.getMonth() + 3);
  qEnd.setDate(qEnd.getDate() - 1);

  // Month label
  const startMonth = qStart.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = qEnd.toLocaleDateString('en-US', { month: 'short' });
  const label = `Q${quarter} (${startMonth}-${endMonth})`;

  return { label, start: toDateStr(qStart), end: toDateStr(qEnd), quarter };
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

  // YTD: fiscal year start → today
  const ytd: FiscalPeriod = {
    label: 'Fiscal YTD',
    start: fy.start,
    end: todayStr,
  };

  // Quarters
  const quarters: (FiscalPeriod & { quarter: number })[] = [];
  for (let q = 0; q < 4; q++) {
    const qStart = new Date(fyStart);
    qStart.setMonth(qStart.getMonth() + q * 3);

    const qEnd = new Date(qStart);
    qEnd.setMonth(qEnd.getMonth() + 3);
    qEnd.setDate(qEnd.getDate() - 1);

    // Clamp to fiscal year end
    const fyEndDate = dateFromStr(fy.end);
    if (qEnd > fyEndDate) qEnd.setTime(fyEndDate.getTime());

    const startMonth = qStart.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = qEnd.toLocaleDateString('en-US', { month: 'short' });

    quarters.push({
      label: `Q${q + 1} (${startMonth}-${endMonth})`,
      start: toDateStr(qStart),
      end: toDateStr(qEnd),
      quarter: q + 1,
    });
  }

  return { ytd, fullYear: fy, quarters };
}
