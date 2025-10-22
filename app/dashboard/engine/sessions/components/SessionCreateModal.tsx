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
import TaskCreateModal from './TaskCreateModal';

interface SessionCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void;
  tasks: Task[];
  allSessions: FocusSession[];
  defaultHourlyRate?: number;
}

/**
 * Manual session creation modal
 * Allows users to create historical focus sessions
 * Auto-calculates duration and revenue, with optional manual override
 */
export default function SessionCreateModal({
  isOpen,
  onClose,
  onCreate,
  tasks,
  allSessions,
  defaultHourlyRate = 0,
}: SessionCreateModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [useManualDuration, setUseManualDuration] = useState(false);
  
  const [formData, setFormData] = useState({
    start_time: '',
    end_time: '',
    manual_duration_minutes: 0,
    task_id: '',
    hourly_rate: defaultHourlyRate,
    notes: '',
  });
  
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
      
      setFormData({
        start_time: toLocalDatetime(oneHourAgo.toISOString()),
        end_time: toLocalDatetime(now.toISOString()),
        manual_duration_minutes: 60,
        task_id: '',
        hourly_rate: defaultHourlyRate,
        notes: '',
      });
      setUseManualDuration(false);
    }
  }, [isOpen, defaultHourlyRate]);

  // Recalculate duration and revenue
  useEffect(() => {
    if (formData.start_time && formData.end_time && !useManualDuration) {
      try {
        const duration = calculateDuration(
          toUTC(formData.start_time),
          toUTC(formData.end_time)
        );
        setCalculatedDuration(duration);

        const revenue = calculateRevenue(duration, formData.hourly_rate);
        setCalculatedRevenue(revenue);

        // Validate
        const validationResult = validateSession(
          {
            start_time: toUTC(formData.start_time),
            end_time: toUTC(formData.end_time),
            task_id: formData.task_id || null,
            hourly_rate: formData.hourly_rate,
            notes: formData.notes,
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
      const duration = formData.manual_duration_minutes * 60;
      setCalculatedDuration(duration);

      const revenue = calculateRevenue(duration, formData.hourly_rate);
      setCalculatedRevenue(revenue);

      // Validate with manual override warning
      const validationResult = validateSession(
        {
          start_time: toUTC(formData.start_time),
          end_time: toUTC(formData.end_time),
          task_id: formData.task_id || null,
          hourly_rate: formData.hourly_rate,
          notes: formData.notes,
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
  }, [
    formData.start_time,
    formData.end_time,
    formData.manual_duration_minutes,
    formData.hourly_rate,
    useManualDuration,
    allSessions,
  ]);

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
          start_time: toUTC(formData.start_time),
          end_time: toUTC(formData.end_time),
          duration: calculatedDuration,
          task_id: formData.task_id || null,
          hourly_rate: formData.hourly_rate,
          revenue: calculatedRevenue,
          notes: formData.notes || null,
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
    setFormData({
      start_time: '',
      end_time: '',
      manual_duration_minutes: 0,
      task_id: '',
      hourly_rate: defaultHourlyRate,
      notes: '',
    });
    setValidation({ errors: [], warnings: [] });
    setCalculatedDuration(0);
    setCalculatedRevenue(0);
    setUseManualDuration(false);
    onClose();
  };

  const handleTaskCreated = (taskId: string) => {
    setFormData({ ...formData, task_id: taskId });
    setShowTaskModal(false);
  };

  return (
    <>
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
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                  value={formData.manual_duration_minutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      manual_duration_minutes: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="Minutes"
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                value={formData.hourly_rate}
                onChange={(e) =>
                  setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })
                }
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                  value={formData.task_id}
                  onChange={(e) => setFormData({ ...formData, task_id: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                  onClick={() => setShowTaskModal(true)}
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
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="What did you work on? Any important details..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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

      {/* Task Creation Modal */}
      <TaskCreateModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onTaskCreated={handleTaskCreated}
      />
    </>
  );
}