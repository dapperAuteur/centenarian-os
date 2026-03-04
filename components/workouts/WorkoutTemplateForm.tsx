'use client';

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import TemplateExerciseRow, { TemplateExercise } from './TemplateExerciseRow';
import WorkoutPurposeSelect from './WorkoutPurposeSelect';
import { offlineFetch } from '@/lib/offline/offline-fetch';

const CATEGORIES = ['Strength', 'Cardio', 'HIIT', 'Yoga', 'Flexibility', 'Cycling', 'Running', 'Swimming', 'Other'];

interface TemplateData {
  id?: string;
  name: string;
  description?: string | null;
  category?: string | null;
  estimated_duration_min?: number | null;
  purpose?: string[];
  workout_template_exercises?: TemplateExercise[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: TemplateData | null;
}

export default function WorkoutTemplateForm({ isOpen, onClose, onSaved, initial }: Props) {
  const [form, setForm] = useState({ name: '', description: '', category: '', estimated_duration_min: '' });
  const [purpose, setPurpose] = useState<string[]>([]);
  const [exercises, setExercises] = useState<TemplateExercise[]>([]);
  const [equipment, setEquipment] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const editingId = initial?.id;

  useEffect(() => {
    if (isOpen) {
      if (initial) {
        setForm({
          name: initial.name,
          description: initial.description ?? '',
          category: initial.category ?? '',
          estimated_duration_min: initial.estimated_duration_min != null ? String(initial.estimated_duration_min) : '',
        });
        setPurpose(initial.purpose ?? []);
        setExercises(initial.workout_template_exercises?.map((ex) => ({ ...ex })) ?? []);
      } else {
        setForm({ name: '', description: '', category: '', estimated_duration_min: '' });
        setPurpose([]);
        setExercises([{ name: '', sets: null, reps: null, weight_lbs: null, duration_sec: null, rest_sec: 60, notes: '', is_bodyweight: false, is_timed: false, per_side: false }]);
      }
      // Load equipment
      offlineFetch('/api/equipment?active=true').then(async (r) => {
        if (r.ok) {
          const data = await r.json();
          setEquipment((data ?? []).map((e: { id: string; name: string }) => ({ id: e.id, name: e.name })));
        }
      }).catch(() => {});
    }
  }, [isOpen, initial]);

  const addExercise = () => {
    setExercises((prev) => [...prev, { name: '', sets: null, reps: null, weight_lbs: null, duration_sec: null, rest_sec: 60, notes: '', is_bodyweight: false, is_timed: false, per_side: false }]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        category: form.category || null,
        estimated_duration_min: form.estimated_duration_min ? Number(form.estimated_duration_min) : null,
        purpose,
        exercises: exercises.filter((ex) => ex.name.trim()),
      };
      const url = editingId ? `/api/workouts/${editingId}` : '/api/workouts';
      const res = await offlineFetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onSaved();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingId ? 'Edit Template' : 'New Workout Template'} size="lg">
      <form onSubmit={handleSave} className="flex flex-col">
        {/* Scrollable content */}
        <div className="space-y-4 flex-1 px-1 pt-1">
          <div>
            <label htmlFor="wt-name" className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
            <input
              id="wt-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Push Day, Morning HIIT"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              required
              aria-required="true"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="wt-category" className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <select
                id="wt-category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Select...</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="wt-duration" className="block text-xs font-medium text-gray-600 mb-1">Est. duration (min)</label>
              <input
                id="wt-duration"
                type="number"
                value={form.estimated_duration_min}
                onChange={(e) => setForm((f) => ({ ...f, estimated_duration_min: e.target.value }))}
                placeholder="45"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="wt-desc" className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <input
              id="wt-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional notes about this workout"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <WorkoutPurposeSelect value={purpose} onChange={setPurpose} />

          {/* Exercises */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">Exercises</label>
              <button type="button" onClick={addExercise}
                className="text-xs text-lime-600 font-medium hover:text-lime-700 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add exercise
              </button>
            </div>
            <div className="space-y-2 max-h-[45vh] overflow-y-auto">
              {exercises.map((ex, i) => (
                <TemplateExerciseRow
                  key={i}
                  exercise={ex}
                  equipment={equipment}
                  onChange={(updated) => setExercises((prev) => prev.map((p, j) => j === i ? updated : p))}
                  onRemove={() => setExercises((prev) => prev.filter((_, j) => j !== i))}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Sticky button bar */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-1 pt-3 pb-3 flex gap-3 mt-2"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={onClose}
            className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 bg-gray-900 text-white rounded-xl py-2 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50">
            {saving ? 'Saving...' : editingId ? 'Update' : 'Create Template'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
