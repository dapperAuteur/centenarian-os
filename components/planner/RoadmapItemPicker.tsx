'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMilestoneHierarchy } from '@/lib/hooks/useMilestoneHierarchy';
import type { TaskTag } from '@/lib/types';

interface RoadmapItemPickerProps {
  value: string;
  onChange: (milestoneId: string) => void;
  required?: boolean;
}

type CreatingLevel = 'roadmap' | 'goal' | 'milestone' | null;

const CATEGORIES: TaskTag[] = ['FITNESS', 'CREATIVE', 'SKILL', 'OUTREACH', 'LIFESTYLE', 'MINDSET', 'FUEL'];

export default function RoadmapItemPicker({ value, onChange, required }: RoadmapItemPickerProps) {
  const { roadmaps, goals, milestones, loading, reload } = useMilestoneHierarchy();
  const supabase = createClient();

  const [selectedRoadmapId, setSelectedRoadmapId] = useState('');
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [creating, setCreating] = useState<CreatingLevel>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<TaskTag>('LIFESTYLE');
  const [saving, setSaving] = useState(false);

  // Filter goals/milestones by selection
  const filteredGoals = useMemo(
    () => goals.filter(g => g.roadmap_id === selectedRoadmapId),
    [goals, selectedRoadmapId]
  );
  const filteredMilestones = useMemo(
    () => milestones.filter(m => m.goal_id === selectedGoalId),
    [milestones, selectedGoalId]
  );

  // Track whether we've done the initial sync from hierarchy data
  const initializedRef = useRef(false);

  // One-time initialization: sync selects from value prop or pick first available
  useEffect(() => {
    if (loading || initializedRef.current) return;
    if (roadmaps.length === 0) return;

    initializedRef.current = true;

    // If a value is already set, resolve its parents
    if (value) {
      const ms = milestones.find(m => m.id === value);
      if (ms) {
        const goal = goals.find(g => g.id === ms.goal_id);
        if (goal) {
          setSelectedRoadmapId(goal.roadmap_id);
          setSelectedGoalId(goal.id);
          return;
        }
      }
    }

    // Otherwise cascade: first roadmap → first goal → first milestone
    const firstRoadmap = roadmaps[0];
    setSelectedRoadmapId(firstRoadmap.id);

    const firstGoal = goals.find(g => g.roadmap_id === firstRoadmap.id);
    if (firstGoal) {
      setSelectedGoalId(firstGoal.id);
      const firstMs = milestones.find(m => m.goal_id === firstGoal.id);
      if (firstMs) onChange(firstMs.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, roadmaps, goals, milestones]);

  // Cascade handlers — called from onChange, not effects
  const handleRoadmapChange = (roadmapId: string) => {
    setSelectedRoadmapId(roadmapId);
    // Auto-pick first goal under this roadmap
    const goalsForRoadmap = goals.filter(g => g.roadmap_id === roadmapId);
    if (goalsForRoadmap.length > 0) {
      const firstGoal = goalsForRoadmap[0];
      setSelectedGoalId(firstGoal.id);
      // Auto-pick first milestone under this goal
      const msForGoal = milestones.filter(m => m.goal_id === firstGoal.id);
      onChange(msForGoal.length > 0 ? msForGoal[0].id : '');
    } else {
      setSelectedGoalId('');
      onChange('');
    }
  };

  const handleGoalChange = (goalId: string) => {
    setSelectedGoalId(goalId);
    // Auto-pick first milestone under this goal
    const msForGoal = milestones.filter(m => m.goal_id === goalId);
    onChange(msForGoal.length > 0 ? msForGoal[0].id : '');
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || saving) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (creating === 'roadmap') {
        const today = new Date();
        const future = new Date(today);
        future.setFullYear(today.getFullYear() + 10);
        const { data, error } = await supabase
          .from('roadmaps')
          .insert([{
            user_id: user.id,
            title: newTitle.trim(),
            description: '',
            start_date: today.toISOString().split('T')[0],
            end_date: future.toISOString().split('T')[0],
          }])
          .select('id')
          .single();
        if (error) throw error;
        await reload();
        setSelectedRoadmapId(data.id);
      } else if (creating === 'goal') {
        const { data, error } = await supabase
          .from('goals')
          .insert([{
            roadmap_id: selectedRoadmapId,
            title: newTitle.trim(),
            description: '',
            category: newCategory,
            target_year: new Date().getFullYear() + 1,
          }])
          .select('id')
          .single();
        if (error) throw error;
        await reload();
        setSelectedGoalId(data.id);
      } else if (creating === 'milestone') {
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() + 3);
        const { data, error } = await supabase
          .from('milestones')
          .insert([{
            goal_id: selectedGoalId,
            title: newTitle.trim(),
            description: '',
            target_date: targetDate.toISOString().split('T')[0],
            status: 'not_started',
          }])
          .select('id')
          .single();
        if (error) throw error;
        await reload();
        onChange(data.id);
      }

      setCreating(null);
      setNewTitle('');
    } catch (err) {
      console.error('Failed to create:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500 py-2">Loading roadmap data...</div>;
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Assign to Roadmap Item {required && '*'}
      </label>

      {/* Breadcrumb hint */}
      <div className="flex items-center gap-1 text-xs text-gray-400">
        <span>Roadmap</span>
        <ChevronRight className="w-3 h-3" />
        <span>Goal</span>
        <ChevronRight className="w-3 h-3" />
        <span>Milestone</span>
      </div>

      {/* Roadmap select */}
      <div className="flex gap-2">
        <select
          value={selectedRoadmapId}
          onChange={e => handleRoadmapChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
        >
          <option value="">Select roadmap...</option>
          {roadmaps.map(r => (
            <option key={r.id} value={r.id}>{r.title}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => { setCreating('roadmap'); setNewTitle(''); }}
          className="px-2 py-2 text-sky-600 hover:bg-sky-50 rounded-lg transition"
          title="New Roadmap"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Goal select */}
      {selectedRoadmapId && (
        <div className="flex gap-2">
          <select
            value={selectedGoalId}
            onChange={e => handleGoalChange(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          >
            <option value="">Select goal...</option>
            {filteredGoals.map(g => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => { setCreating('goal'); setNewTitle(''); }}
            className="px-2 py-2 text-sky-600 hover:bg-sky-50 rounded-lg transition"
            title="New Goal"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Milestone select */}
      {selectedGoalId && (
        <div className="flex gap-2">
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            required={required}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          >
            <option value="">Select milestone...</option>
            {filteredMilestones.map(m => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => { setCreating('milestone'); setNewTitle(''); }}
            className="px-2 py-2 text-sky-600 hover:bg-sky-50 rounded-lg transition"
            title="New Milestone"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Inline creation form */}
      {creating && (
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 space-y-2">
          <p className="text-sm font-medium text-sky-800">
            New {creating.charAt(0).toUpperCase() + creating.slice(1)}
          </p>
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder={`${creating.charAt(0).toUpperCase() + creating.slice(1)} title...`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
          />
          {creating === 'goal' && (
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value as TaskTag)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !newTitle.trim()}
              className="px-3 py-1.5 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700 disabled:opacity-50 transition"
            >
              {saving ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setCreating(null)}
              className="px-3 py-1.5 text-gray-600 text-sm hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
