/* eslint-disable @typescript-eslint/no-unused-vars */
// components/focus/PomodoroPresets.tsx
'use client';

import { Clock, Zap, Brain, Settings } from 'lucide-react';
import { useState } from 'react';

interface Preset {
  id: string;
  name: string;
  duration: number; // minutes
  icon: string;
  description: string;
  color: string;
}

const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'pomodoro',
    name: 'Pomodoro',
    duration: 25,
    icon: '🍅',
    description: 'Classic 25-minute focus block',
    color: 'red',
  },
  {
    id: 'double-pom',
    name: 'Double Pom',
    duration: 50,
    icon: '🍅🍅',
    description: 'Two back-to-back pomodoros',
    color: 'orange',
  },
  {
    id: 'deep-work',
    name: 'Deep Work',
    duration: 90,
    icon: '🧠',
    description: 'Extended deep focus session',
    color: 'purple',
  },
  {
    id: 'sprint',
    name: 'Sprint',
    duration: 15,
    icon: '⚡',
    description: 'Quick focus sprint',
    color: 'yellow',
  },
];

interface PomodoroPresetsProps {
  onSelectPreset: (duration: number) => void;
  onOpenCustom: () => void;
  disabled?: boolean;
}

/**
 * Quick-start preset buttons for common focus durations
 * Allows rapid timer setup without manual input
 */
export default function PomodoroPresets({
  onSelectPreset,
  onOpenCustom,
  disabled = false,
}: PomodoroPresetsProps) {
  const [customPresets, setCustomPresets] = useState<Preset[]>([]);

  const allPresets = [...DEFAULT_PRESETS, ...customPresets];

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      red: 'bg-red-100 hover:bg-red-200 text-red-800 border-red-300',
      orange: 'bg-orange-100 hover:bg-orange-200 text-orange-800 border-orange-300',
      purple: 'bg-purple-100 hover:bg-purple-200 text-purple-800 border-purple-300',
      yellow: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-300',
      blue: 'bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300',
    };
    return colors[color] || colors.blue;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Quick Start</h3>
        <button
          onClick={onOpenCustom}
          disabled={disabled}
          className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
        >
          Manage Presets
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {allPresets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelectPreset(preset.duration)}
            disabled={disabled}
            className={`p-4 rounded-xl border-2 transition disabled:opacity-50 disabled:cursor-not-allowed ${getColorClasses(
              preset.color
            )}`}
          >
            <div className="text-3xl mb-2">{preset.icon}</div>
            <div className="text-left">
              <p className="font-bold text-sm">{preset.name}</p>
              <p className="text-xs opacity-75">{preset.duration} min</p>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          💡 <strong>Tip:</strong> Click a preset to instantly start a timer. Remember to take
          breaks between sessions!
        </p>
      </div>
    </div>
  );
}