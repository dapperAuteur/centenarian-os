/* eslint-disable @typescript-eslint/no-explicit-any */
// File: components/TaskModal.tsx
// Modal for creating/editing tasks

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TaskTag } from '@/lib/types';
import { X } from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestoneId: string | null;
  taskId?: string | null;
}

const TAGS: TaskTag[] = ['FITNESS', 'CREATIVE', 'SKILL', 'OUTREACH', 'LIFESTYLE', 'MINDSET', 'FUEL'];

export function TaskModal({ isOpen, onClose, milestoneId, taskId }: TaskModalProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('06:00');
  const [activity, setActivity] = useState('');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState<TaskTag>('FITNESS');
  const [priority, setPriority] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    if (isOpen && taskId) {
      loadTask();
    } else if (isOpen) {
      resetForm();
    }
  }, [isOpen, taskId]);

  const loadTask = async () => {
    if (!taskId) return;
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (data) {
      setDate(data.date);
      setTime(data.time);
      setActivity(data.activity);
      setDescription(data.description || '');
      setTag(data.tag);
      setPriority(data.priority);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!milestoneId && !taskId) {
        throw new Error('Milestone ID is required');
      }

      const taskData = {
        date,
        time,
        activity,
        description,
        tag,
        priority,
        ...(milestoneId && { milestone_id: milestoneId }),
      };

      if (taskId) {
        const { error } = await supabase
          .from('tasks')
          .update(taskData)
          .eq('id', taskId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tasks')
          .insert([taskData]);
        if (error) throw error;
      }

      resetForm();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    setTime('06:00');
    setActivity('');
    setDescription('');
    setTag('FITNESS');
    setPriority(1);
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {taskId ? 'Edit Task' : 'Create New Task'}
          </h2>
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent form-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time *
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent form-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Activity (Short Description) *
            </label>
            <input
              type="text"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              required
              placeholder="e.g., Morning Strength: Push-ups, TRX Row, Plank"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent form-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Detailed Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Specific instructions, sets/reps, focus areas..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tag *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTag(t)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    tag === t
                      ? 'bg-sky-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p as 1 | 2 | 3)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    priority === p
                      ? 'bg-sky-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {p === 1 ? 'High' : p === 2 ? 'Medium' : 'Low'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Saving...' : taskId ? 'Update' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}