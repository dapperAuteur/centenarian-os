'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TaskTag } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import RoadmapItemPicker from '@/components/planner/RoadmapItemPicker';
import { TAGS, TAG_COLORS } from '@/lib/constants/tags';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate: string;
  onCreated: () => void;
}

export default function CreateTaskModal({ isOpen, onClose, defaultDate, onCreated }: CreateTaskModalProps) {
  const [milestoneId, setMilestoneId] = useState('');
  const [activity, setActivity] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('09:00');
  const [tag, setTag] = useState<TaskTag>('LIFESTYLE');
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneId) {
      setError('Please select a milestone');
      return;
    }
    if (!activity.trim()) {
      setError('Activity is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const { error: insertError } = await supabase
        .from('tasks')
        .insert([{
          milestone_id: milestoneId,
          date,
          time,
          activity: activity.trim(),
          description: description.trim() || null,
          tag,
          priority,
          completed: false,
        }]);

      if (insertError) throw insertError;

      // Reset and close
      setActivity('');
      setDescription('');
      setTag('LIFESTYLE');
      setPriority(2);
      setTime('09:00');
      setError('');
      onCreated();
      onClose();
    } catch (err) {
      console.error('Create task error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Task" size="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Milestone Picker */}
        <RoadmapItemPicker
          value={milestoneId}
          onChange={setMilestoneId}
          required
        />

        {/* Activity */}
        <div>
          <label htmlFor="task-activity" className="block text-sm font-medium text-gray-700 mb-1">
            Activity *
          </label>
          <input
            id="task-activity"
            type="text"
            value={activity}
            onChange={e => setActivity(e.target.value)}
            required
            placeholder="What needs to be done?"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="task-description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="task-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="Optional details..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          />
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="task-date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              id="task-date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="task-time" className="block text-sm font-medium text-gray-700 mb-1">Time</label>
            <input
              id="task-time"
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Tag */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tag</label>
          <div className="flex flex-wrap gap-2">
            {TAGS.map(t => (
              <button
                key={t}
                type="button"
                aria-pressed={tag === t}
                onClick={() => setTag(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  tag === t
                    ? TAG_COLORS[t]
                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <div className="flex gap-2">
            {([1, 2, 3] as const).map(p => (
              <button
                key={p}
                type="button"
                aria-pressed={priority === p}
                onClick={() => setPriority(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                  priority === p
                    ? p === 1 ? 'bg-red-100 text-red-700 border-red-300'
                      : p === 2 ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                      : 'bg-green-100 text-green-700 border-green-300'
                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {p === 1 ? 'High' : p === 2 ? 'Medium' : 'Low'}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !activity.trim() || !milestoneId}
            className="flex-1 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
