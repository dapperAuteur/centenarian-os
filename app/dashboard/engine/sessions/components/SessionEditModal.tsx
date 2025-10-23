// app/dashboard/engine/sessions/components/SessionEditModal.tsx
'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { FocusSession, Task } from '@/lib/types';
import { AlertTriangle, Plus } from 'lucide-react';
import {
  validateSession,
  calculateDuration,
  calculateRevenue,
  toLocalDatetime,
  toUTC,
  formatDuration,
} from '@/lib/utils/sessionValidation';
import TagSelector from '@/components/ui/TagSelector';

interface SessionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  session: FocusSession | null;
  onOpenTaskModal: () => void;
  tasks: Task[];
  allSessions: FocusSession[];
}

/**
 * Edit modal for focus sessions with tags support
 * Uses individual state variables to prevent focus loss
 */
export default function SessionEditModal({
  isOpen,
  onClose,
  onSave,
  session,
  onOpenTaskModal,
  tasks,
  allSessions,
}: SessionEditModalProps) {
  // Individual state variables (prevents focus loss)
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [taskId, setTaskId] = useState('');
  const [hourlyRate, setHourlyRate] = useState(0);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]); // ✅ Added tags
  
  const [isSaving, setIsSaving] = useState(false);
  const [calculatedDuration, setCalculatedDuration] = useState(0);
  const [calculatedRevenue, setCalculatedRevenue] = useState(0);
  const [validation, setValidation] = useState<{
    errors: string[];
    warnings: string[];
  }>({ errors: [], warnings: [] });

  // Initialize form when session changes
  useEffect(() => {
    if (session && isOpen) {
      setStartTime(toLocalDatetime(session.start_time));
      setEndTime(session.end_time ? toLocalDatetime(session.end_time) : '');
      setTaskId(session.task_id || '');
      setHourlyRate(session.hourly_rate || 0);
      setNotes(session.notes || '');
      setTags(session.tags || []); // ✅ Initialize tags
    }
  }, [session, isOpen]);

  // Recalculate duration and revenue
  useEffect(() => {
    if (startTime && endTime) {
      try {
        const duration = calculateDuration(toUTC(startTime), toUTC(endTime));
        setCalculatedDuration(duration);

        const revenue = calculateRevenue(duration, hourlyRate);
        setCalculatedRevenue(revenue);

        const validationResult = validateSession(
          {
            start_time: toUTC(startTime),
            end_time: toUTC(endTime),
            task_id: taskId || null,
            hourly_rate: hourlyRate,
            notes: notes,
          },
          allSessions.map(s => ({
            id: s.id,
            start_time: s.start_time,
            end_time: s.end_time || new Date().toISOString(),
          })),
          session?.id
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
    }
  }, [startTime, endTime, hourlyRate, allSessions, session, taskId, notes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session) return;

    if (validation.errors.length > 0) {
      return;
    }

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
      setIsSaving(true);

      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      const { error: updateError } = await supabase
        .from('focus_sessions')
        .update({
          start_time: toUTC(startTime),
          end_time: toUTC(endTime),
          duration: calculatedDuration,
          task_id: taskId || null,
          hourly_rate: hourlyRate,
          revenue: calculatedRevenue,
          notes: notes || null,
          tags: tags.length > 0 ? tags : null, // ✅ Include tags
        })
        .eq('id', session.id);

      if (updateError) throw updateError;

      onSave();
      handleClose();
    } catch (err) {
      console.error('Save error:', err);
      alert(err instanceof Error ? err.message : 'Failed to save session');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setStartTime('');
    setEndTime('');
    setTaskId('');
    setHourlyRate(0);
    setNotes('');
    setTags([]); // ✅ Reset tags
    setValidation({ errors: [], warnings: [] });
    setCalculatedDuration(0);
    setCalculatedRevenue(0);
    onClose();
  };

  if (!session) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit Session" size="lg">
      <form onSubmit={handleSubmit} className="p-6">
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

          {/* Duration (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (calculated)
            </label>
            <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-700">
              {calculatedDuration > 0 ? formatDuration(calculatedDuration) : '00:00:00'}
            </div>
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
            placeholder="Session notes..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
          />
        </div>

        {/* Tags - ✅ Added */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags
          </label>
          <TagSelector
            selectedTags={tags}
            onChange={setTags}
          />
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || validation.errors.length > 0}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}