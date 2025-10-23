/* eslint-disable @typescript-eslint/no-unused-vars */
// components/focus/GoalStreakTracker.tsx
'use client';

import { FocusSession } from '@/lib/types';
import { calculateDailyProgress } from '@/lib/utils/goalUtils';
import { Flame, Calendar } from 'lucide-react';

interface GoalStreakTrackerProps {
  sessions: FocusSession[];
  dailyGoalMinutes: number;
}

/**
 * Shows current streak of consecutive days meeting daily goal
 * Displays last 7 days with visual indicators
 */
export default function GoalStreakTracker({
  sessions,
  dailyGoalMinutes,
}: GoalStreakTrackerProps) {
  // Calculate last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });

  const dailyResults = last7Days.map(date => {
    const progress = calculateDailyProgress(sessions, dailyGoalMinutes, date);
    return {
      date,
      completed: progress.percentage >= 100,
      percentage: progress.percentage,
    };
  });

  // Calculate current streak
  let currentStreak = 0;
  for (let i = dailyResults.length - 1; i >= 0; i--) {
    if (dailyResults[i].completed) {
      currentStreak++;
    } else {
      break;
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Flame className="w-5 h-5 text-orange-600" />
          <h3 className="text-lg font-bold text-gray-900">Goal Streak</h3>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-orange-600">{currentStreak}</p>
          <p className="text-xs text-gray-600">days in a row</p>
        </div>
      </div>

      {/* Last 7 Days */}
      <div className="flex items-center justify-between space-x-2">
        {dailyResults.map((day, idx) => {
          const date = new Date(day.date);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

          return (
            <div key={day.date} className="flex-1 text-center">
              <div className="text-xs text-gray-600 mb-1">{dayName}</div>
              <div
                className={`w-full h-12 rounded-lg flex items-center justify-center transition ${
                  day.completed
                    ? 'bg-lime-100 border-2 border-lime-600'
                    : day.percentage > 0
                    ? 'bg-amber-100 border-2 border-amber-300'
                    : 'bg-gray-100 border-2 border-gray-300'
                }`}
                title={`${Math.round(day.percentage)}% completed`}
              >
                {day.completed ? (
                  <span className="text-2xl">✓</span>
                ) : day.percentage > 0 ? (
                  <span className="text-xs font-bold text-amber-800">
                    {Math.round(day.percentage)}%
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Streak Message */}
      <div className="mt-4 p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg">
        <p className="text-sm text-center text-gray-700">
          {currentStreak === 0 ? (
            <>Complete today&apos;s goal to start your streak! 🚀</>
          ) : currentStreak === 1 ? (
            <>Great start! Keep it going tomorrow! 💪</>
          ) : currentStreak >= 7 ? (
            <>Amazing! You&apos;ve hit your goal every day this week! 🔥</>
          ) : (
            <>You&apos;re on fire! {currentStreak} days and counting! 🔥</>
          )}
        </p>
      </div>
    </div>
  );
}