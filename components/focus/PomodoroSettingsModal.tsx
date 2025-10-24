// components/focus/PomodoroSettingsModal.tsx
'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { PomodoroSettings, DEFAULT_POMODORO_SETTINGS } from '@/lib/types';
import { Clock, Coffee, Zap, Settings as SettingsIcon } from 'lucide-react';

interface PomodoroSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PomodoroSettings;
  onSave: (settings: PomodoroSettings) => void;
}

/**
 * Configure Pomodoro timing and behavior
 */
export default function PomodoroSettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
}: PomodoroSettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<PomodoroSettings>(settings);

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_POMODORO_SETTINGS);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pomodoro Settings" size="md">
      <div className="p-6">
        {/* Work Duration */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            <label className="text-sm font-semibold text-gray-900">
              Work Duration (minutes)
            </label>
          </div>
          <input
            type="number"
            value={localSettings.workDuration}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, workDuration: parseInt(e.target.value) || 25 })
            }
            min="1"
            max="120"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-600 mt-1">Classic Pomodoro: 25 minutes</p>
        </div>

        {/* Short Break */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <Coffee className="w-5 h-5 text-amber-600" />
            <label className="text-sm font-semibold text-gray-900">
              Short Break (minutes)
            </label>
          </div>
          <input
            type="number"
            value={localSettings.shortBreakDuration}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, shortBreakDuration: parseInt(e.target.value) || 5 })
            }
            min="1"
            max="30"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
          />
          <p className="text-xs text-gray-600 mt-1">Classic Pomodoro: 5 minutes</p>
        </div>

        {/* Long Break */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <Zap className="w-5 h-5 text-purple-600" />
            <label className="text-sm font-semibold text-gray-900">
              Long Break (minutes)
            </label>
          </div>
          <input
            type="number"
            value={localSettings.longBreakDuration}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, longBreakDuration: parseInt(e.target.value) || 15 })
            }
            min="1"
            max="60"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          />
          <p className="text-xs text-gray-600 mt-1">Classic Pomodoro: 15 minutes</p>
        </div>

        {/* Intervals Before Long Break */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <SettingsIcon className="w-5 h-5 text-gray-600" />
            <label className="text-sm font-semibold text-gray-900">
              Pomodoros Before Long Break
            </label>
          </div>
          <input
            type="number"
            value={localSettings.intervalsBeforeLongBreak}
            onChange={(e) =>
              setLocalSettings({
                ...localSettings,
                intervalsBeforeLongBreak: parseInt(e.target.value) || 4,
              })
            }
            min="2"
            max="8"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500"
          />
          <p className="text-xs text-gray-600 mt-1">Classic Pomodoro: 4 intervals</p>
        </div>

        {/* Auto-start Options */}
        <div className="mb-6 space-y-3">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={localSettings.autoStartBreaks}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, autoStartBreaks: e.target.checked })
              }
              className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">Auto-start Breaks</p>
              <p className="text-xs text-gray-600">Automatically start break timer when work ends</p>
            </div>
          </label>

          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={localSettings.autoStartWork}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, autoStartWork: e.target.checked })
              }
              className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">Auto-start Work</p>
              <p className="text-xs text-gray-600">Automatically start next work interval after break</p>
            </div>
          </label>
        </div>

        {/* Preview */}
        <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg mb-6">
          <p className="text-sm font-semibold text-gray-900 mb-2">Your Pomodoro Cycle:</p>
          <div className="text-xs text-gray-700 space-y-1">
            <p>🍅 Work: {localSettings.workDuration} min</p>
            <p>☕ Short Break: {localSettings.shortBreakDuration} min</p>
            <p>🍅 Work: {localSettings.workDuration} min</p>
            <p>☕ Short Break: {localSettings.shortBreakDuration} min</p>
            <p className="text-gray-500">... (×{localSettings.intervalsBeforeLongBreak - 2} more)</p>
            <p>🍅 Work: {localSettings.workDuration} min</p>
            <p>⚡ Long Break: {localSettings.longBreakDuration} min</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
          >
            Reset to Defaults
          </button>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}