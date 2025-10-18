/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// File: components/RoadmapModal.tsx
// Modal for creating/editing roadmaps

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X } from 'lucide-react';

interface RoadmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  roadmapId?: string | null;
}

export function RoadmapModal({ isOpen, onClose, roadmapId }: RoadmapModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    if (isOpen && !roadmapId) {
      // Set default dates for new roadmap
      const today = new Date();
      setStartDate(today.toISOString().split('T')[0]);
      const futureDate = new Date(today);
      futureDate.setFullYear(today.getFullYear() + 10);
      setEndDate(futureDate.toISOString().split('T')[0]);
    }
  }, [isOpen, roadmapId]);

  useEffect(() => {
    const loadRoadmap = async () => {
    if (!roadmapId) return;
    
    const { data, error } = await supabase
      .from('roadmaps')
      .select('*')
      .eq('id', roadmapId)
      .single();

    if (data) {
      setTitle(data.title);
      setDescription(data.description || '');
      setStartDate(data.start_date);
      setEndDate(data.end_date);
    }
  };
    if (isOpen && roadmapId) {
      loadRoadmap();
    }
  }, [isOpen, roadmapId, supabase]);

  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const roadmapData = {
        title,
        description,
        start_date: startDate,
        end_date: endDate,
        user_id: user.id,
      };

      if (roadmapId) {
        const { error } = await supabase
          .from('roadmaps')
          .update(roadmapData)
          .eq('id', roadmapId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('roadmaps')
          .insert([roadmapData]);
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
    setStartDate('');
    setEndDate('');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {roadmapId ? 'Edit Roadmap' : 'Create New Roadmap'}
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
              Roadmap Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g., My Centenarian Journey"
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
              placeholder="Brief overview of your multi-decade plan..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent form-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent form-input"
              />
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
              {loading ? 'Saving...' : roadmapId ? 'Update' : 'Create Roadmap'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}