// components/focus/GoalSettingsModal.tsx
'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Target, Info } from 'lucide-react';
import { formatGoalTime } from '@/lib/utils/goalUtils';

interface GoalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDailyGoal: number;
  currentWeeklyGoal: number;
  onSave: (dailyMinutes: number, weeklyMinutes: number) => Promise<void>;
}

/**
 * Modal for setting daily and weekly focus time goals
 * Provides presets and custom input
 */
export default function GoalSettingsModal({
  isOpen,
  onClose,
  currentDailyGoal,
  currentWeeklyGoal,
  onSave,
}: GoalSettingsModalProps) {
  const [dailyMinutes, setDailyMinutes] = useState(currentDailyGoal);
  const [weeklyMinutes, setWeeklyMinutes] = useState(currentWeeklyGoal);
  const [isSaving, setIsSaving] = useState(false);

  const dailyPresets = [
    { label: '30 min', value: 30 },
    { label: '1 hour', value: 60 },
    { label: '2 hours', value: 120 },
    { label: '3 hours', value: 180 },
    { label: '4 hours', value: 240 },
  ];

  const weeklyPresets = [
    { label: '5 hours', value: 300 },
    { label: '10 hours', value: 600 },
    { label: '14 hours', value: 840 },
    { label: '20 hours', value: 1200 },
    { label: '30 hours', value: 1800 },
  ];

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(dailyMinutes, weeklyMinutes);
      onClose();
    } catch (error) {
      console.error('Failed to save goals:', error);
      alert('Failed to save goals. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Set Focus Goals" size="md">
      <div className="p-6">
        {/* Info */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-900">
                Set daily and weekly focus time goals to track your progress. Goals help maintain
                consistency and build deep work habits.
              </p>
            </div>
          </div>
        </div>

        {/* Daily Goal */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <Target className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-gray-900">Daily Goal</h3>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {dailyPresets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setDailyMinutes(preset.value)}
                className={`px-4 py-2 rounded-lg border transition ${
                  dailyMinutes === preset.value
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custom (minutes)
            </label>
            <input
              type="number"
              value={dailyMinutes}
              onChange={(e) => setDailyMinutes(parseInt(e.target.value) || 0)}
              min="0"
              max="1440"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
            />
            <p className="text-xs text-gray-500 mt-1">
              Current: {formatGoalTime(dailyMinutes)}
            </p>
          </div>
        </div>

        {/* Weekly Goal */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <Target className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-bold text-gray-900">Weekly Goal</h3>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {weeklyPresets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setWeeklyMinutes(preset.value)}
                className={`px-4 py-2 rounded-lg border transition ${
                  weeklyMinutes === preset.value
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custom (minutes)
            </label>
            <input
              type="number"
              value={weeklyMinutes}
              onChange={(e) => setWeeklyMinutes(parseInt(e.target.value) || 0)}
              min="0"
              max="10080"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 form-input"
            />
            <p className="text-xs text-gray-500 mt-1">
              Current: {formatGoalTime(weeklyMinutes)}
            </p>
          </div>
        </div>

        {/* Recommendation */}
        {dailyMinutes * 7 > weeklyMinutes && (
          <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              ⚠️ Your daily goal × 7 ({formatGoalTime(dailyMinutes * 7)}) exceeds your weekly
              goal. Consider adjusting.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || dailyMinutes < 0 || weeklyMinutes < 0}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isSaving ? 'Saving...' : 'Save Goals'}
          </button>
        </div>
      </div>
    </Modal>
  );
}