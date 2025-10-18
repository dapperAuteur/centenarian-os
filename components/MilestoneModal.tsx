/* eslint-disable @typescript-eslint/no-explicit-any */
// File: components/MilestoneModal.tsx
// Modal for creating/editing milestones

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MilestoneStatus } from '@/lib/types';
import { X } from 'lucide-react';

interface MilestoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  goalId: string | null;
  milestoneId?: string | null;
}

const STATUSES: { value: MilestoneStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'blocked', label: 'Blocked' },
];

export function MilestoneModal({ isOpen, onClose, goalId, milestoneId }: MilestoneModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState<MilestoneStatus>('not_started');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    if (isOpen && milestoneId) {
      loadMilestone();
    } else if (isOpen) {
      resetForm();
    }
  }, [isOpen, milestoneId]);

  const loadMilestone = async () => {
    if (!milestoneId) return;
    
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('id', milestoneId)
      .single();

    if (data) {
      setTitle(data.title);
      setDescription(data.description || '');
      setTargetDate(data.target_date);
      setStatus(data.status);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!goalId && !milestoneId) {
        throw new Error('Goal ID is required');
      }

      const milestoneData = {
        title,
        description,
        target_date: targetDate,
        status,
        ...(goalId && { goal_id: goalId }),
      };

      if (milestoneId) {
        const { error } = await supabase
          .from('milestones')
          .update(milestoneData)
          .eq('id', milestoneId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('milestones')
          .insert([milestoneData]);
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
    setTitle('');
    setDescription('');
    setTargetDate('');
    setStatus('not_started');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {milestoneId ? 'Edit Milestone' : 'Create New Milestone'}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Milestone Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g., Q4 2025: Hold a 30s Front Lever"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Specific, measurable outcome for this milestone..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Date *
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    status === s.value
                      ? 'bg-sky-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {s.label}
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
              {loading ? 'Saving...' : milestoneId ? 'Update' : 'Create Milestone'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}