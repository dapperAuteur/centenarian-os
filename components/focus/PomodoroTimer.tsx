// components/focus/PomodoroTimer.tsx
'use client';

import { useState, useEffect } from 'react';
import { Clock, Coffee, Play, Pause, SkipForward } from 'lucide-react';
import { formatPomodoroProgress } from '@/lib/utils/pomodoroUtils';
import { PomodoroSettings } from '@/lib/types';

type PomodoroPhase = 'work' | 'short-break' | 'long-break';

interface PomodoroTimerProps {
  phase: PomodoroPhase;
  seconds: number;
  targetSeconds: number;
  completedIntervals: number;
  settings: PomodoroSettings;
  isRunning: boolean;
  onSkip: () => void;
  showSkip?: boolean;
}

/**
 * Specialized display for Pomodoro mode
 * Shows current phase, progress, and cycle position
 */
export default function PomodoroTimer({
  phase,
  seconds,
  targetSeconds,
  completedIntervals,
  settings,
  isRunning,
  onSkip,
  showSkip = true,
}: PomodoroTimerProps) {
  const percentage = (seconds / targetSeconds) * 100;
  const remaining = targetSeconds - seconds;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const phaseConfig = {
    work: {
      label: 'Work Session',
      icon: Clock,
      color: 'indigo',
      bgColor: 'bg-indigo-50',
      progressColor: 'bg-indigo-600',
      textColor: 'text-indigo-900',
    },
    'short-break': {
      label: 'Short Break',
      icon: Coffee,
      color: 'amber',
      bgColor: 'bg-amber-50',
      progressColor: 'bg-amber-600',
      textColor: 'text-amber-900',
    },
    'long-break': {
      label: 'Long Break',
      icon: Coffee,
      color: 'purple',
      bgColor: 'bg-purple-50',
      progressColor: 'bg-purple-600',
      textColor: 'text-purple-900',
    },
  };

  const config = phaseConfig[phase];
  const Icon = config.icon;

  return (
    <div className={`p-6 ${config.bgColor} rounded-2xl border-2 border-${config.color}-200`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Icon className={`w-6 h-6 text-${config.color}-600`} />
          <h3 className={`text-lg font-bold ${config.textColor}`}>{config.label}</h3>
        </div>
        <div className="flex items-center space-x-3">
          <div className={`px-3 py-1 ${config.bgColor} border border-${config.color}-300 rounded-full`}>
            <span className={`text-sm font-semibold ${config.textColor}`}>
              🍅 {formatPomodoroProgress(completedIntervals, settings)}
            </span>
          </div>
          {showSkip && (
            <button
              onClick={onSkip}
              disabled={!isRunning}
              className={`p-2 text-${config.color}-600 hover:bg-${config.color}-100 rounded-lg transition disabled:opacity-50`}
              title="Skip to next phase"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Timer */}
      <div className="text-center mb-4">
        <div className="text-6xl font-bold font-mono text-gray-900 mb-2">
          {formatTime(remaining)}
        </div>
        <p className="text-sm text-gray-600">remaining</p>
      </div>

      {/* Progress Bar */}
      <div className="relative w-full h-4 bg-white rounded-full overflow-hidden border border-gray-200">
        <div
          className={`absolute left-0 top-0 h-full ${config.progressColor} transition-all duration-1000`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Phase Info */}
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">
          {phase === 'work'
            ? `Focus for ${Math.floor(targetSeconds / 60)} minutes`
            : `Take a ${phase === 'short-break' ? 'short' : 'long'} break`}
        </p>
      </div>
    </div>
  );
}