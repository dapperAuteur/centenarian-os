/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// File: components/GoalModal.tsx
// Modal for creating/editing goals

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TaskTag } from '@/lib/types';
import { X } from 'lucide-react';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  roadmapId: string | null;
  goalId?: string | null;
}

const CATEGORIES: TaskTag[] = ['FITNESS', 'CREATIVE', 'SKILL', 'OUTREACH', 'LIFESTYLE', 'MINDSET', 'FUEL'];

export function GoalModal({ isOpen, onClose, roadmapId, goalId }: GoalModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskTag>('FITNESS');
  const [targetYear, setTargetYear] = useState(new Date().getFullYear() + 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    const loadGoal = async () => {
    if (!goalId) return;
    
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .single();

    if (data) {
      setTitle(data.title);
      setDescription(data.description || '');
      setCategory(data.category);
      setTargetYear(data.target_year);
    }
  };
    if (isOpen && goalId) {
      loadGoal();
    } else if (isOpen) {
      resetForm();
    }
  }, [isOpen, goalId, supabase]);

  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!roadmapId && !goalId) {
        throw new Error('Roadmap ID is required');
      }

      const goalData = {
        title,
        description,
        category,
        target_year: targetYear,
        ...(roadmapId && { roadmap_id: roadmapId }),
      };

      if (goalId) {
        const { error } = await supabase
          .from('goals')
          .update(goalData)
          .eq('id', goalId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('goals')
          .insert([goalData]);
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
    setCategory('FITNESS');
    setTargetYear(new Date().getFullYear() + 1);
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {goalId ? 'Edit Goal' : 'Create New Goal'}
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
              Goal Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g., Achieve Sub-17s 100m Dash"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent form-input"
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
              placeholder="What does success look like for this goal?"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent form-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    category === cat
                      ? 'bg-sky-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Year *
            </label>
            <input
              type="number"
              value={targetYear}
              onChange={(e) => setTargetYear(parseInt(e.target.value))}
              required
              min={new Date().getFullYear()}
              max={new Date().getFullYear() + 50}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent form-input"
            />
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
              {loading ? 'Saving...' : goalId ? 'Update' : 'Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}