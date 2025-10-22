// app/dashboard/engine/sessions/components/TaskCreateModal.tsx
'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Plus } from 'lucide-react';

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: (taskId: string) => void;
}

/**
 * Quick task creation modal for use during session edit/create
 * Creates a task for today with minimal fields
 */
export default function TaskCreateModal({
  isOpen,
  onClose,
  onTaskCreated,
}: TaskCreateModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    activity: '',
    description: '',
    time: '09:00',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.activity.trim()) {
      setError('Task name is required');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      // Import here to avoid circular dependencies
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // We need a milestone to create a task
      // Let's get the user's first active roadmap and goal
      const { data: roadmaps } = await supabase
        .from('roadmaps')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .single();

      if (!roadmaps) {
        setError('No active roadmap found. Please create a roadmap first.');
        return;
      }

      const { data: goals } = await supabase
        .from('goals')
        .select('id')
        .eq('roadmap_id', roadmaps.id)
        .eq('status', 'active')
        .limit(1)
        .single();

      if (!goals) {
        setError('No active goals found. Please create a goal first.');
        return;
      }

      const { data: milestones } = await supabase
        .from('milestones')
        .select('id')
        .eq('goal_id', goals.id)
        .neq('status', 'archived')
        .limit(1)
        .single();

      if (!milestones) {
        setError('No milestones found. Please create a milestone first.');
        return;
      }

      // Create the task
      const today = new Date().toISOString().split('T')[0];
      
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert([{
          milestone_id: milestones.id,
          date: today,
          time: formData.time,
          activity: formData.activity,
          description: formData.description || null,
          tag: 'OTHER',
          priority: 2,
          completed: false,
        }])
        .select()
        .single();

      if (taskError) throw taskError;
      if (!task) throw new Error('Failed to create task');

      onTaskCreated(task.id);
      setFormData({ activity: '', description: '', time: '09:00' });
      onClose();
    } catch (err) {
      console.error('Create task error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setFormData({ activity: '', description: '', time: '09:00' });
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Quick Add Task" size="sm">
      <form onSubmit={handleSubmit} className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.activity}
              onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
              placeholder="e.g., Client meeting, Code review"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time (optional)
            </label>
            <input
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="Additional details..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 form-input"
            />
          </div>
        </div>

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
            disabled={isCreating || !formData.activity.trim()}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Plus className="w-4 h-4 mr-2" />
            {isCreating ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}