// app/dashboard/engine/sessions/components/SessionCreateModal.tsx
'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { FocusSession, Task } from '@/lib/types';
import { AlertTriangle, Plus, Info } from 'lucide-react';
import {
  validateSession,
  calculateDuration,
  calculateRevenue,
  toLocalDatetime,
  toUTC,
  formatDuration,
} from '@/lib/utils/sessionValidation';

interface SessionCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void;
  tasks: Task[];
  onOpenTaskModal: () => void;
  allSessions: FocusSession[];
  defaultHourlyRate?: number;
}

/**
 * Manual session creation modal
 * Allows users to create historical focus sessions
 * Auto-calculates duration and revenue, with optional manual override
 * 
 * FIXED: Uses individual state variables instead of formData object
 * to prevent focus loss when typing
 */
export default function SessionCreateModal({
  isOpen,
  onClose,
  onCreate,
  tasks,
  onOpenTaskModal,
  allSessions,
  defaultHourlyRate = 0,
}: SessionCreateModalProps) {
  // Individual state variables (like TaskModal pattern) to prevent re-renders
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [manualDurationMinutes, setManualDurationMinutes] = useState(0);
  const [taskId, setTaskId] = useState('');
  const [hourlyRate, setHourlyRate] = useState(defaultHourlyRate);
  const [notes, setNotes] = useState('');
  const [useManualDuration, setUseManualDuration] = useState(false);
  
  const [isCreating, setIsCreating] = useState(false);
  const [calculatedDuration, setCalculatedDuration] = useState(0);
  const [calculatedRevenue, setCalculatedRevenue] = useState(0);
  const [validation, setValidation] = useState<{
    errors: string[];
    warnings: string[];
  }>({ errors: [], warnings: [] });

  // Set smart defaults when modal opens
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      setStartTime(toLocalDatetime(oneHourAgo.toISOString()));
      setEndTime(toLocalDatetime(now.toISOString()));
      setManualDurationMinutes(60);
      setTaskId('');
      setHourlyRate(defaultHourlyRate);
      setNotes('');
      setUseManualDuration(false);
    }
  }, [isOpen, defaultHourlyRate]);

  // Recalculate duration and revenue
  // NOTE: notes is NOT in dependencies - doesn't affect calculations
  useEffect(() => {
    if (startTime && endTime && !useManualDuration) {
      try {
        const duration = calculateDuration(
          toUTC(startTime),
          toUTC(endTime)
        );
        setCalculatedDuration(duration);

        const revenue = calculateRevenue(duration, hourlyRate);
        setCalculatedRevenue(revenue);

        // Validate
        const validationResult = validateSession(
          {
            start_time: toUTC(startTime),
            end_time: toUTC(endTime),
            task_id: taskId || null,
            hourly_rate: hourlyRate,
            notes: notes,
          },
          allSessions
            .filter(s => s.end_time) // Only check completed sessions
            .map(s => ({
              id: s.id,
              start_time: s.start_time,
              end_time: s.end_time || new Date().toISOString(),
            }))
        );

        setValidation({
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        });
      } catch (err) {
        console.error('Calculation error:', err);
        setCalculatedDuration(0);
        setCalculatedRevenue(0);
      }
    } else if (useManualDuration) {
      // Use manual duration
      const duration = manualDurationMinutes * 60;
      setCalculatedDuration(duration);

      const revenue = calculateRevenue(duration, hourlyRate);
      setCalculatedRevenue(revenue);

      // Validate with manual override warning
      const validationResult = validateSession(
        {
          start_time: toUTC(startTime),
          end_time: toUTC(endTime),
          task_id: taskId || null,
          hourly_rate: hourlyRate,
          notes: notes,
          duration: duration,
        },
        allSessions
          .filter(s => s.end_time)
          .map(s => ({
            id: s.id,
            start_time: s.start_time,
            end_time: s.end_time || new Date().toISOString(),
          }))
      );

      setValidation({
        errors: validationResult.errors,
        warnings: validationResult.warnings,
      });
    } else {
      setCalculatedDuration(0);
      setCalculatedRevenue(0);
      setValidation({ errors: [], warnings: [] });
    }
  }, [startTime, endTime, manualDurationMinutes, hourlyRate, useManualDuration, taskId, allSessions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check for validation errors
    if (validation.errors.length > 0) {
      return;
    }

    // If there are warnings, require user confirmation
    if (validation.warnings.length > 0) {
      const confirmMessage =
        'Warning:\n\n' +
        validation.warnings.join('\n\n') +
        '\n\nDo you want to proceed?';

      if (!confirm(confirmMessage)) {
        return;
      }
    }

    try {
      setIsCreating(true);

      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: insertError } = await supabase
        .from('focus_sessions')
        .insert([{
          user_id: user.id,
          start_time: toUTC(startTime),
          end_time: toUTC(endTime),
          duration: calculatedDuration,
          task_id: taskId || null,
          hourly_rate: hourlyRate,
          revenue: calculatedRevenue,
          notes: notes || null,
        }]);

      if (insertError) throw insertError;

      onCreate();
      handleClose();
    } catch (err) {
      console.error('Create error:', err);
      alert(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setStartTime('');
    setEndTime('');
    setManualDurationMinutes(0);
    setTaskId('');
    setHourlyRate(defaultHourlyRate);
    setNotes('');
    setValidation({ errors: [], warnings: [] });
    setCalculatedDuration(0);
    setCalculatedRevenue(0);
    setUseManualDuration(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Manual Session" size="lg">
      <form onSubmit={handleSubmit} className="p-6">
        {/* Info Banner */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">
                Manual Entry
              </p>
              <p className="text-sm text-blue-700">
                Use this to log focus sessions you forgot to track or completed offline.
                Duration is calculated automatically from start/end times.
              </p>
            </div>
          </div>
        </div>

        {/* Validation Messages */}
        {validation.errors.length > 0 && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900 mb-1">
                  Please fix these errors:
                </p>
                <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                  {validation.errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {validation.warnings.length > 0 && validation.errors.length === 0 && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900 mb-1">Warnings:</p>
                <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
                  {validation.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
              required
            />
          </div>

          {/* End Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
              required
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration
            </label>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setUseManualDuration(false)}
                className={`flex-1 px-3 py-2 rounded-lg border transition ${
                  !useManualDuration
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => setUseManualDuration(true)}
                className={`flex-1 px-3 py-2 rounded-lg border transition ${
                  useManualDuration
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Manual
              </button>
            </div>
            {useManualDuration ? (
              <input
                type="number"
                value={manualDurationMinutes}
                onChange={(e) => setManualDurationMinutes(parseInt(e.target.value) || 0)}
                placeholder="Minutes"
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
              />
            ) : (
              <div className="w-full mt-2 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-700">
                {calculatedDuration > 0 ? formatDuration(calculatedDuration) : '00:00:00'}
              </div>
            )}
          </div>

          {/* Hourly Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hourly Rate ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
            />
          </div>

          {/* Revenue (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Revenue (calculated)
            </label>
            <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-lime-600 font-semibold">
              ${calculatedRevenue.toFixed(2)}
            </div>
          </div>

          {/* Task */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Link to Task
            </label>
            <div className="flex items-center space-x-2">
              <select
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
              >
                <option value="">No task</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.date} - {task.activity}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onOpenTaskModal}
                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                title="Add new task"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What did you work on? Any important details..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
          />
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isCreating}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isCreating || validation.errors.length > 0}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isCreating ? 'Creating...' : 'Create Session'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
