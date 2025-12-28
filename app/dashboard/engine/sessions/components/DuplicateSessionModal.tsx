// app/dashboard/engine/sessions/components/DuplicateSessionModal.tsx
'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { FocusSession, Task } from '@/lib/types';
import { Copy, Calendar, Clock, DollarSign, Tag, FileText } from 'lucide-react';

interface DuplicateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: FocusSession | null;
  tasks: Task[];
  onSave: (sessionData: Partial<FocusSession>) => Promise<void>;
}

/**
 * Modal for duplicating a session with customization
 * Pre-fills with original data, allows editing before creating copy
 */
export default function DuplicateSessionModal({
  isOpen,
  onClose,
  session,
  tasks,
  onSave,
}: DuplicateSessionModalProps) {
  const [formData, setFormData] = useState({
    task_id: '',
    start_time: '',
    end_time: '',
    duration: 0,
    revenue: 0,
    notes: '',
    pomodoro_mode: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill form when session changes
  useEffect(() => {
    if (session) {
      const now = new Date();
      const startTime = new Date(now);
      
      // Calculate end time based on original duration
      const endTime = session.duration 
        ? new Date(startTime.getTime() + session.duration * 1000)
        : new Date(startTime);

      setFormData({
        task_id: session.task_id || '',
        start_time: startTime.toISOString().slice(0, 16),
        end_time: endTime.toISOString().slice(0, 16),
        duration: session.duration || 0,
        revenue: session.revenue || 0,
        notes: session.notes || '',
        pomodoro_mode: session.pomodoro_mode || false,
      });
      setError(null);
    }
  }, [session]);

  // Recalculate duration when times change
  const handleTimeChange = (field: 'start_time' | 'end_time', value: string) => {
    const updated = { ...formData, [field]: value };
    
    if (updated.start_time && updated.end_time) {
      const start = new Date(updated.start_time);
      const end = new Date(updated.end_time);
      const durationSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
      
      if (durationSeconds > 0) {
        updated.duration = durationSeconds;
        setError(null);
      } else {
        setError('End time must be after start time');
      }
    }
    
    setFormData(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.start_time || !formData.end_time) {
      setError('Start time and end time are required');
      return;
    }

    if (formData.duration <= 0) {
      setError('Duration must be positive');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      await onSave({
        task_id: formData.task_id || null,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
        duration: formData.duration,
        revenue: formData.revenue,
        notes: formData.notes,
        pomodoro_mode: formData.pomodoro_mode,
      });

      onClose();
    } catch (err) {
      console.error('Failed to duplicate session:', err);
      setError(err instanceof Error ? err.message : 'Failed to duplicate session');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (!session) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Duplicate Session" size="md">
      <form onSubmit={handleSubmit} className="p-6">
        {/* Info */}
        <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <Copy className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-purple-900 font-medium">
                Duplicating session from {new Date(session.start_time).toLocaleDateString()}
              </p>
              <p className="text-xs text-purple-700 mt-1">
                Customize the details below before creating the copy
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Task Selection */}
        <div className="mb-6">
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
            <Tag className="w-4 h-4 text-indigo-600" />
            <span>Task (Optional)</span>
          </label>
          <select
            value={formData.task_id}
            onChange={(e) => setFormData({ ...formData, task_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-select"
          >
            <option value="">No task</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.activity} ({task.tag})
              </option>
            ))}
          </select>
        </div>

        {/* Start Time */}
        <div className="mb-6">
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Start Time</span>
          </label>
          <input
            type="datetime-local"
            value={formData.start_time}
            onChange={(e) => handleTimeChange('start_time', e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 form-input"
          />
        </div>

        {/* End Time */}
        <div className="mb-6">
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
            <Clock className="w-4 h-4 text-purple-600" />
            <span>End Time</span>
          </label>
          <input
            type="datetime-local"
            value={formData.end_time}
            onChange={(e) => handleTimeChange('end_time', e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 form-input"
          />
          {formData.duration > 0 && (
            <p className="text-xs text-gray-600 mt-1">
              Duration: {formatDuration(formData.duration)}
            </p>
          )}
        </div>

        {/* Revenue */}
        <div className="mb-6">
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
            <DollarSign className="w-4 h-4 text-lime-600" />
            <span>Revenue (Optional)</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.revenue}
            onChange={(e) => setFormData({ ...formData, revenue: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 form-input"
          />
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
            <FileText className="w-4 h-4 text-gray-600" />
            <span>Notes (Optional)</span>
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={4}
            placeholder="Add session notes..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 resize-none"
          />
        </div>

        {/* Pomodoro Mode */}
        <div className="mb-6">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.pomodoro_mode}
              onChange={(e) => setFormData({ ...formData, pomodoro_mode: e.target.checked })}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-gray-700">
              🍅 Pomodoro Mode
            </span>
          </label>
          <p className="text-xs text-gray-500 ml-6 mt-1">
            Note: Pomodoro-specific data (completed cycles, net work time) won&apos;t be copied
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || formData.duration <= 0}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            {isSaving ? 'Creating...' : 'Create Duplicate'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
