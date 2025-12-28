// components/planner/CreateRecurringTaskModal.tsx
'use client';

import { useState } from 'react';
import { Repeat, X } from 'lucide-react';
import { RecurrencePattern, RecurrenceType } from '@/lib/types';

interface CreateRecurringTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestoneId: string;
  onSave: (data: RecurringTaskData) => Promise<void>;
}

export interface RecurringTaskData {
  milestone_id: string;
  activity: string;
  description?: string;
  tag: string;
  priority: 1 | 2 | 3;
  time: string;
  pattern: RecurrencePattern;
}

export default function CreateRecurringTaskModal({
  isOpen,
  onClose,
  milestoneId,
  onSave,
}: CreateRecurringTaskModalProps) {
  const [activity, setActivity] = useState('');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState('GENERAL');
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [time, setTime] = useState('09:00');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('daily');
  const [customInterval, setCustomInterval] = useState(1);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  const tags = ['GENERAL', 'STRENGTH', 'RECOVERY', 'SKILL', 'ADMIN', 'CREATIVE'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleDayOfWeek = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter((d) => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day].sort());
    }
  };

  const handleSave = async () => {
    if (!activity.trim()) {
      alert('Activity is required');
      return;
    }

    const pattern: RecurrencePattern = {
      type: recurrenceType,
    };

    if (recurrenceType === 'custom') {
      pattern.interval = customInterval;
    } else if (recurrenceType === 'weekly') {
      pattern.daysOfWeek = daysOfWeek;
    } else if (recurrenceType === 'monthly') {
      pattern.dayOfMonth = dayOfMonth;
    }

    if (endDate) {
      pattern.endDate = endDate;
    }

    setSaving(true);
    try {
      await onSave({
        milestone_id: milestoneId,
        activity,
        description: description || undefined,
        tag,
        priority,
        time,
        pattern,
      });
      onClose();
      // Reset form
      setActivity('');
      setDescription('');
      setTag('GENERAL');
      setPriority(2);
      setTime('09:00');
      setRecurrenceType('daily');
    } catch (error) {
      console.error('[Recurring Task] Save failed:', error);
      alert('Failed to create recurring task. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Create Recurring Task</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded transition"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="p-6">
            <div className="space-y-4">
        {/* Activity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Activity *
          </label>
          <input
            type="text"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g., Morning workout"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            placeholder="Optional details"
          />
        </div>

        {/* Tag & Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tag
            </label>
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) as 1 | 2 | 3)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value={1}>High</option>
              <option value={2}>Medium</option>
              <option value={3}>Low</option>
            </select>
          </div>
        </div>

        {/* Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Time
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Recurrence Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Repeat className="w-4 h-4 inline mr-1" />
            Recurrence Pattern
          </label>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {(['daily', 'weekly', 'biweekly', 'monthly', 'custom'] as RecurrenceType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setRecurrenceType(type)}
                className={`px-3 py-2 rounded-lg border capitalize text-sm ${
                  recurrenceType === type
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Pattern Options */}
          {recurrenceType === 'weekly' && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">Select Days</p>
              <div className="flex gap-2">
                {dayNames.map((day, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => toggleDayOfWeek(index)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium ${
                      daysOfWeek.includes(index)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {recurrenceType === 'monthly' && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Day of Month
              </label>
              <input
                type="number"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 1)}
                min="1"
                max="31"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {recurrenceType === 'custom' && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Repeat Every X Days
              </label>
              <input
                type="number"
                value={customInterval}
                onChange={(e) => setCustomInterval(parseInt(e.target.value) || 1)}
                min="1"
                max="365"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>

        {/* End Date (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Date (Optional)
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Leave blank to repeat indefinitely
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !activity.trim()}
            className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Recurring Task'}
          </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}