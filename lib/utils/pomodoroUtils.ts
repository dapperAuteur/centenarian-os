/* eslint-disable @typescript-eslint/no-unused-vars */
// lib/utils/pomodoroUtils.ts

import { WorkInterval, BreakInterval, PomodoroSettings } from '@/lib/types';

/**
 * Calculate net work duration (total work time minus breaks)
 */
export function calculateNetWorkDuration(
  workIntervals: WorkInterval[],
  breakIntervals: BreakInterval[]
): number {
  const totalWork = workIntervals.reduce((sum, interval) => sum + interval.duration, 0);
  return totalWork;
}

/**
 * Determine if it's time for a long break
 */
export function shouldTakeLongBreak(
  completedIntervals: number,
  settings: PomodoroSettings
): boolean {
  return completedIntervals > 0 && completedIntervals % settings.intervalsBeforeLongBreak === 0;
}

/**
 * Get break duration for current cycle
 */
export function getBreakDuration(
  completedIntervals: number,
  settings: PomodoroSettings
): { duration: number; type: 'short' | 'long' } {
  if (shouldTakeLongBreak(completedIntervals, settings)) {
    return { duration: settings.longBreakDuration * 60, type: 'long' };
  }
  return { duration: settings.shortBreakDuration * 60, type: 'short' };
}

/**
 * Format Pomodoro cycle (e.g., "2/4" means 2nd interval of 4)
 */
export function formatPomodoroProgress(
  completedIntervals: number,
  settings: PomodoroSettings
): string {
  const currentInCycle = (completedIntervals % settings.intervalsBeforeLongBreak) || settings.intervalsBeforeLongBreak;
  return `${currentInCycle}/${settings.intervalsBeforeLongBreak}`;
}

/**
 * Calculate total session stats
 */
export function calculatePomodoroStats(
  workIntervals: WorkInterval[],
  breakIntervals: BreakInterval[]
) {
  const totalWork = workIntervals.reduce((sum, i) => sum + i.duration, 0);
  const totalBreak = breakIntervals.reduce((sum, i) => sum + i.duration, 0);
  const totalTime = totalWork + totalBreak;

  return {
    totalWorkSeconds: totalWork,
    totalBreakSeconds: totalBreak,
    totalTimeSeconds: totalTime,
    completedPomodoros: workIntervals.length,
    shortBreaks: breakIntervals.filter(b => b.type === 'short').length,
    longBreaks: breakIntervals.filter(b => b.type === 'long').length,
  };
}