// components/focus/GoalProgressWidget.tsx
'use client';

import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { Target, TrendingUp, Calendar } from 'lucide-react';
import { formatGoalTime, getProgressBarColor } from '@/lib/utils/goalUtils';

interface GoalProgressWidgetProps {
  title: string;
  completedMinutes: number;
  goalMinutes: number;
  percentage: number;
  icon: 'target' | 'trending' | 'calendar';
  showDetails?: boolean;
}

/**
 * Circular progress widget for daily/weekly goals
 * Shows completion percentage with color coding
 */
export default function GoalProgressWidget({
  title,
  completedMinutes,
  goalMinutes,
  percentage,
  icon,
  showDetails = true,
}: GoalProgressWidgetProps) {
  const IconComponent = {
    target: Target,
    trending: TrendingUp,
    calendar: Calendar,
  }[icon];

  const pathColor =
    percentage >= 100
      ? '#84cc16' // lime-600
      : percentage >= 75
      ? '#3b82f6' // blue-600
      : percentage >= 50
      ? '#4f46e5' // indigo-600
      : percentage >= 25
      ? '#f59e0b' // amber-600
      : '#dc2626'; // red-600

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center space-x-2 mb-4">
        <IconComponent className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      </div>

      <div className="flex items-center justify-center mb-4">
        <div className="w-32 h-32">
          <CircularProgressbar
            value={percentage}
            text={`${Math.round(percentage)}%`}
            styles={buildStyles({
              textSize: '24px',
              pathColor: pathColor,
              textColor: '#111827',
              trailColor: '#e5e7eb',
            })}
          />
        </div>
      </div>

      {showDetails && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Completed</span>
            <span className="font-semibold text-gray-900">
              {formatGoalTime(completedMinutes)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Goal</span>
            <span className="font-semibold text-gray-900">
              {formatGoalTime(goalMinutes)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Remaining</span>
            <span className="font-semibold text-gray-900">
              {formatGoalTime(Math.max(0, goalMinutes - completedMinutes))}
            </span>
          </div>
        </div>
      )}

      {percentage >= 100 && (
        <div className="mt-4 p-3 bg-lime-50 border border-lime-200 rounded-lg">
          <p className="text-sm font-semibold text-lime-800 text-center">
            🎉 Goal Completed!
          </p>
        </div>
      )}
    </div>
  );
}