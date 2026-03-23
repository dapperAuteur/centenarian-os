// components/planner/ScheduleCalendarOverlay.tsx
'use client';

import type { ScheduleTemplate, ScheduleException } from '@/lib/types';

interface ScheduleCalendarOverlayProps {
  templates: ScheduleTemplate[];
  exceptions: ScheduleException[];
  visibleDates: string[]; // ISO date strings for the currently visible calendar range
  onDayClick?: (templateId: string, date: string) => void;
}

const TEMPLATE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  work: { bg: 'bg-sky-100', border: 'border-sky-300', text: 'text-sky-700' },
  fitness: { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700' },
  class: { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-700' },
  custom: { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-700' },
};

const EXCEPTION_BADGES: Record<string, { label: string; color: string }> = {
  skip: { label: 'Skip', color: 'bg-gray-400' },
  paid_off: { label: 'Paid Off', color: 'bg-green-500' },
  unpaid_off: { label: 'Unpaid', color: 'bg-red-500' },
  reschedule: { label: 'Moved', color: 'bg-amber-500' },
};

/**
 * Check if a specific date is an active schedule day for a template,
 * accounting for week_interval.
 */
function isScheduledDay(
  date: Date,
  template: ScheduleTemplate,
): boolean {
  const dayOfWeek = date.getDay();
  if (!template.schedule_days.includes(dayOfWeek)) return false;

  if (template.start_date && date.toISOString().split('T')[0] < template.start_date) return false;
  if (template.end_date && date.toISOString().split('T')[0] > template.end_date) return false;

  if (template.week_interval > 1) {
    const anchor = template.start_date
      ? new Date(template.start_date + 'T00:00:00')
      : new Date(template.created_at);
    const daysDiff = Math.floor((date.getTime() - anchor.getTime()) / 86400000);
    const weeksSince = Math.floor(daysDiff / 7);
    if (weeksSince % template.week_interval !== 0) return false;
  }

  return true;
}

export default function ScheduleCalendarOverlay({
  templates,
  exceptions,
  visibleDates,
  onDayClick,
}: ScheduleCalendarOverlayProps) {
  // Build exception lookup: templateId:date -> exception
  const exceptionMap = new Map<string, ScheduleException>();
  for (const ex of exceptions) {
    exceptionMap.set(`${ex.template_id}:${ex.exception_date}`, ex);
  }

  // For each visible date, determine which templates are scheduled
  const dateSchedules = new Map<string, { template: ScheduleTemplate; exception?: ScheduleException }[]>();

  for (const dateStr of visibleDates) {
    const date = new Date(dateStr + 'T00:00:00');
    const schedules: { template: ScheduleTemplate; exception?: ScheduleException }[] = [];

    for (const tmpl of templates) {
      if (!tmpl.is_active) continue;
      if (isScheduledDay(date, tmpl)) {
        const exception = exceptionMap.get(`${tmpl.id}:${dateStr}`);
        schedules.push({ template: tmpl, exception });
      }
    }

    if (schedules.length > 0) {
      dateSchedules.set(dateStr, schedules);
    }
  }

  if (dateSchedules.size === 0) return null;

  return (
    <div className="space-y-1">
      {Array.from(dateSchedules.entries()).map(([dateStr, schedules]) => (
        <div key={dateStr} className="flex flex-wrap gap-1">
          {schedules.map(({ template, exception }) => {
            const colors = TEMPLATE_COLORS[template.template_type] || TEMPLATE_COLORS.custom;
            const exBadge = exception ? EXCEPTION_BADGES[exception.exception_type] : null;

            return (
              <button
                key={`${template.id}-${dateStr}`}
                onClick={() => onDayClick?.(template.id, dateStr)}
                className={`min-h-6 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors.bg} ${colors.border} ${colors.text} ${
                  exception ? 'line-through opacity-70' : ''
                }`}
                aria-label={`${template.name} on ${dateStr}${exception ? ` (${exception.exception_type})` : ''}`}
              >
                <span className="truncate max-w-[60px]">{template.name}</span>
                {exBadge && (
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${exBadge.color}`} title={exBadge.label} />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * Helper to get schedule indicators for a single date cell.
 * Use this in the calendar grid to render colored dots/bands.
 */
export function getScheduleIndicators(
  dateStr: string,
  templates: ScheduleTemplate[],
  exceptionMap: Map<string, ScheduleException>,
): { template: ScheduleTemplate; exception?: ScheduleException }[] {
  const date = new Date(dateStr + 'T00:00:00');
  const results: { template: ScheduleTemplate; exception?: ScheduleException }[] = [];

  for (const tmpl of templates) {
    if (!tmpl.is_active) continue;
    if (isScheduledDay(date, tmpl)) {
      const exception = exceptionMap.get(`${tmpl.id}:${dateStr}`);
      results.push({ template: tmpl, exception });
    }
  }

  return results;
}
