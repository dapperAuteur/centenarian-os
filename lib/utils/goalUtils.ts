// lib/utils/goalUtils.ts

import { FocusSession } from '@/lib/types';

export interface DailyProgress {
  date: string;
  completedMinutes: number;
  goalMinutes: number;
  percentage: number;
  status: 'completed' | 'on-track' | 'behind' | 'not-started';
}

export interface WeeklyProgress {
  weekStart: string;
  weekEnd: string;
  completedMinutes: number;
  goalMinutes: number;
  percentage: number;
  status: 'completed' | 'on-track' | 'behind' | 'not-started';
  dailyBreakdown: DailyProgress[];
}

/**
 * Calculate today's progress toward daily goal
 */
export function calculateDailyProgress(
  sessions: FocusSession[],
  goalMinutes: number,
  targetDate?: string
): DailyProgress {
  const date = targetDate || new Date().toISOString().split('T')[0];
  
  const todaySessions = sessions.filter(s => {
    if (!s.end_time || !s.duration) return false;
    const sessionDate = new Date(s.start_time).toISOString().split('T')[0];
    return sessionDate === date;
  });

  const completedSeconds = todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const completedMinutes = Math.floor(completedSeconds / 60);
  const percentage = goalMinutes > 0 ? (completedMinutes / goalMinutes) * 100 : 0;

  let status: DailyProgress['status'];
  if (percentage >= 100) {
    status = 'completed';
  } else if (percentage >= 50) {
    status = 'on-track';
  } else if (percentage > 0) {
    status = 'behind';
  } else {
    status = 'not-started';
  }

  return {
    date,
    completedMinutes,
    goalMinutes,
    percentage: Math.min(percentage, 100),
    status,
  };
}

/**
 * Calculate this week's progress toward weekly goal
 */
export function calculateWeeklyProgress(
  sessions: FocusSession[],
  goalMinutes: number,
  dailyGoalMinutes: number
): WeeklyProgress {
  const now = new Date();
  const weekStart = getWeekStart(now);
  const weekEnd = getWeekEnd(now);

  const weekSessions = sessions.filter(s => {
    if (!s.end_time || !s.duration) return false;
    const sessionDate = new Date(s.start_time);
    return sessionDate >= weekStart && sessionDate <= weekEnd;
  });

  const completedSeconds = weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const completedMinutes = Math.floor(completedSeconds / 60);
  const percentage = goalMinutes > 0 ? (completedMinutes / goalMinutes) * 100 : 0;

  let status: WeeklyProgress['status'];
  if (percentage >= 100) {
    status = 'completed';
  } else if (percentage >= 50) {
    status = 'on-track';
  } else if (percentage > 0) {
    status = 'behind';
  } else {
    status = 'not-started';
  }

  // Calculate daily breakdown for the week
  const dailyBreakdown: DailyProgress[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    dailyBreakdown.push(calculateDailyProgress(sessions, dailyGoalMinutes, dateStr));
  }

  return {
    weekStart: weekStart.toISOString().split('T')[0],
    weekEnd: weekEnd.toISOString().split('T')[0],
    completedMinutes,
    goalMinutes,
    percentage: Math.min(percentage, 100),
    status,
    dailyBreakdown,
  };
}

/**
 * Get the start of the week (Monday)
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

/**
 * Get the end of the week (Sunday)
 */
function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

/**
 * Format minutes to hours and minutes (e.g., "2h 30m")
 */
export function formatGoalTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Get status color classes
 */
export function getStatusColors(status: DailyProgress['status']): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'completed':
      return {
        bg: 'bg-lime-100',
        text: 'text-lime-800',
        border: 'border-lime-300',
      };
    case 'on-track':
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        border: 'border-blue-300',
      };
    case 'behind':
      return {
        bg: 'bg-amber-100',
        text: 'text-amber-800',
        border: 'border-amber-300',
      };
    case 'not-started':
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        border: 'border-gray-300',
      };
  }
}

/**
 * Get progress bar color
 */
export function getProgressBarColor(percentage: number): string {
  if (percentage >= 100) return 'bg-lime-600';
  if (percentage >= 75) return 'bg-blue-600';
  if (percentage >= 50) return 'bg-indigo-600';
  if (percentage >= 25) return 'bg-amber-600';
  return 'bg-red-600';
}