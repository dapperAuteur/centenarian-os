// lib/utils/analyticsUtils.ts

import { FocusSession } from '@/lib/types';

export interface DailyStats {
  date: string;
  totalSeconds: number;
  sessionCount: number;
  revenue: number;
  avgSessionLength: number;
}

export interface WeeklyStats {
  week: string;
  weekStart: string;
  weekEnd: string;
  totalSeconds: number;
  sessionCount: number;
  revenue: number;
  avgSessionLength: number;
}

export interface TimeOfDayStats {
  hour: number;
  sessionCount: number;
  totalSeconds: number;
}

/**
 * Group sessions by date and calculate daily stats
 */
export function calculateDailyStats(sessions: FocusSession[]): DailyStats[] {
  const dailyMap = new Map<string, DailyStats>();

  sessions
    .filter(s => s.end_time && s.duration) // Only completed sessions
    .forEach(session => {
      const date = new Date(session.start_time).toISOString().split('T')[0];
      
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          totalSeconds: 0,
          sessionCount: 0,
          revenue: 0,
          avgSessionLength: 0,
        });
      }

      const stats = dailyMap.get(date)!;
      stats.totalSeconds += session.duration || 0;
      stats.sessionCount += 1;
      stats.revenue += session.revenue || 0;
    });

  // Calculate averages
  dailyMap.forEach(stats => {
    stats.avgSessionLength = stats.sessionCount > 0 
      ? stats.totalSeconds / stats.sessionCount 
      : 0;
  });

  return Array.from(dailyMap.values()).sort((a, b) => 
    a.date.localeCompare(b.date)
  );
}

/**
 * Group sessions by week and calculate weekly stats
 */
export function calculateWeeklyStats(sessions: FocusSession[]): WeeklyStats[] {
  const weeklyMap = new Map<string, WeeklyStats>();

  sessions
    .filter(s => s.end_time && s.duration)
    .forEach(session => {
      const date = new Date(session.start_time);
      const weekStart = getWeekStart(date);
      const weekEnd = getWeekEnd(date);
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, {
          week: `Week of ${formatShortDate(weekStart)}`,
          weekStart: weekStart.toISOString().split('T')[0],
          weekEnd: weekEnd.toISOString().split('T')[0],
          totalSeconds: 0,
          sessionCount: 0,
          revenue: 0,
          avgSessionLength: 0,
        });
      }

      const stats = weeklyMap.get(weekKey)!;
      stats.totalSeconds += session.duration || 0;
      stats.sessionCount += 1;
      stats.revenue += session.revenue || 0;
    });

  // Calculate averages
  weeklyMap.forEach(stats => {
    stats.avgSessionLength = stats.sessionCount > 0
      ? stats.totalSeconds / stats.sessionCount
      : 0;
  });

  return Array.from(weeklyMap.values()).sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart)
  );
}

/**
 * Calculate session distribution by hour of day
 */
export function calculateTimeOfDayStats(sessions: FocusSession[]): TimeOfDayStats[] {
  const hourMap = new Map<number, TimeOfDayStats>();

  // Initialize all hours
  for (let hour = 0; hour < 24; hour++) {
    hourMap.set(hour, {
      hour,
      sessionCount: 0,
      totalSeconds: 0,
    });
  }

  sessions
    .filter(s => s.end_time && s.duration)
    .forEach(session => {
      const hour = new Date(session.start_time).getHours();
      const stats = hourMap.get(hour)!;
      stats.sessionCount += 1;
      stats.totalSeconds += session.duration || 0;
    });

  return Array.from(hourMap.values());
}

/**
 * Get the start of the week (Monday) for a given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  return new Date(d.setDate(diff));
}

/**
 * Get the end of the week (Sunday) for a given date
 */
function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date);
  return new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
}

/**
 * Format date as "Jan 15"
 */
function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Calculate key metrics for overview
 */
export function calculateOverviewMetrics(sessions: FocusSession[]) {
  const completedSessions = sessions.filter(s => s.end_time && s.duration);

  const totalTime = completedSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalRevenue = completedSessions.reduce((sum, s) => sum + (s.revenue || 0), 0);
  const avgSessionLength = completedSessions.length > 0 
    ? totalTime / completedSessions.length 
    : 0;

  // Find longest session
  const longestSession = completedSessions.reduce(
    (max, s) => ((s.duration || 0) > max ? s.duration || 0 : max),
    0
  );

  // Most productive day
  const dailyStats = calculateDailyStats(completedSessions);
  const mostProductiveDay = dailyStats.reduce(
    (max, day) => (day.totalSeconds > (max?.totalSeconds || 0) ? day : max),
    null as DailyStats | null
  );

  // Sessions by day of week
  const dayOfWeekCounts = new Array(7).fill(0);
  completedSessions.forEach(s => {
    const day = new Date(s.start_time).getDay();
    dayOfWeekCounts[day] += 1;
  });

  return {
    totalTime,
    totalSessions: completedSessions.length,
    totalRevenue,
    avgSessionLength,
    longestSession,
    mostProductiveDay,
    dayOfWeekCounts,
  };
}

/**
 * Format seconds to hours with 1 decimal (e.g., "12.5h")
 */
export function formatHours(seconds: number): string {
  return (seconds / 3600).toFixed(1) + 'h';
}

/**
 * Format seconds to HH:MM (e.g., "2:30")
 */
export function formatHoursMinutes(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}