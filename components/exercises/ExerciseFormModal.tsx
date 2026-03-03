'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import MediaUploader from '@/components/ui/MediaUploader';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Category {
  id: string;
  name: string;
}

interface Equipment {
  id: string;
  name: string;
}

interface ExerciseData {
  id?: string;
  name: string;
  category_id: string | null;
  equipment_needed: string | null;
  instructions: string;
  form_cues: string;
  video_url: string;
  media_url: string;
  media_public_id: string;
  audio_url: string;
  audio_public_id: string;
  primary_muscles: string[];
  default_sets: number | null;
  default_reps: number | null;
  default_weight_lbs: number | null;
  default_duration_sec: number | null;
  default_rest_sec: number | null;
  notes: string;
  equipment_ids: string[];
}

// Wider type that accepts null values from the database
type ExerciseInitial = {
  id?: string;
  exercise_equipment?: { equipment_id: string }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

const EMPTY: ExerciseData = {
  name: '',
  category_id: null,
  equipment_needed: null,
  instructions: '',
  form_cues: '',
  video_url: '',
  media_url: '',
  media_public_id: '',
  audio_url: '',
  audio_public_id: '',
  primary_muscles: [],
  default_sets: null,
  default_reps: null,
  default_weight_lbs: null,
  default_duration_sec: null,
  default_rest_sec: 60,
  notes: '',
  equipment_ids: [],
};

const MUSCLE_OPTIONS = [
  'chest', 'anterior deltoid', 'lateral deltoid', 'rear deltoid',
  'triceps', 'biceps', 'forearms', 'lats', 'traps', 'rhomboids',
  'erectors', 'rectus abdominis', 'obliques', 'transverse abdominis',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'hip flexors',
  'adductors', 'abductors', 'rotator cuff',
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: ExerciseInitial;
  categories: Category[];
}

export default function ExerciseFormModal({ isOpen, onClose, onSaved, initial, categories }: Props) {
  const [form, setForm] = useState<ExerciseData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [muscleInput, setMuscleInput] = useState('');

  const isEdit = !!initial?.id;

  useEffect(() => {
    if (isOpen) {
      if (initial) {
        setForm({
          ...EMPTY,
          name: initial.name || '',
          category_id: initial.category_id ?? null,
          equipment_needed: initial.equipment_needed ?? null,
          instructions: initial.instructions ?? '',
          form_cues: initial.form_cues ?? '',
          video_url: initial.video_url ?? '',
          media_url: initial.media_url ?? '',
          media_public_id: initial.media_public_id ?? '',
          audio_url: initial.audio_url ?? '',
          audio_public_id: initial.audio_public_id ?? '',
          primary_muscles: initial.primary_muscles || [],
          default_sets: initial.default_sets ?? null,
          default_reps: initial.default_reps ?? null,
          default_weight_lbs: initial.default_weight_lbs ?? null,
          default_duration_sec: initial.default_duration_sec ?? null,
          default_rest_sec: initial.default_rest_sec ?? 60,
          notes: initial.notes ?? '',
          equipment_ids: initial.exercise_equipment?.map((e) => e.equipment_id) || initial.equipment_ids || [],
          id: initial.id,
        });
      } else {
        setForm(EMPTY);
      }
      setError(null);
    }
  }, [isOpen, initial]);

  useEffect(() => {
    offlineFetch('/api/equipment?include_retired=false')
      .then((r) => r.json())
      .then((d) => setEquipment(d.equipment || []))
      .catch(() => {});
  }, []);

  const set = (key: keyof ExerciseData, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleMuscle = (m: string) => {
    setForm((prev) => ({
      ...prev,
      primary_muscles: prev.primary_muscles.includes(m)
        ? prev.primary_muscles.filter((x) => x !== m)
        : [...prev.primary_muscles, m],
    }));
  };

  const toggleEquipment = (id: string) => {
    setForm((prev) => ({
      ...prev,
      equipment_ids: prev.equipment_ids.includes(id)
        ? prev.equipment_ids.filter((x) => x !== id)
        : [...prev.equipment_ids, id],
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      ...form,
      name: form.name.trim(),
      primary_muscles: form.primary_muscles.length > 0 ? form.primary_muscles : null,
    };

    const url = isEdit ? `/api/exercises/${initial!.id}` : '/api/exercises';
    const method = isEdit ? 'PATCH' : 'POST';

    const res = await offlineFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Failed to save');
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  const filteredMuscles = muscleInput
    ? MUSCLE_OPTIONS.filter((m) => m.includes(muscleInput.toLowerCase()))
    : MUSCLE_OPTIONS;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Exercise' : 'New Exercise'} size="lg">
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

        {/* Name + Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="e.g. Barbell Bench Press"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={form.category_id || ''}
              onChange={(e) => set('category_id', e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Equipment Level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Equipment Level
            <span className="text-gray-400 font-normal ml-1 text-xs">(used for filtering)</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            {([
              [null,      'Unspecified'],
              ['none',    'No Equipment'],
              ['minimal', 'Minimal Equipment'],
              ['gym',     'Gym'],
            ] as [string | null, string][]).map(([val, label]) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => set('equipment_needed', val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  form.equipment_needed === val
                    ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
          <textarea
            value={form.instructions}
            onChange={(e) => set('instructions', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="Step-by-step instructions for performing this exercise..."
          />
        </div>

        {/* Form Cues */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Things to Watch For</label>
          <textarea
            value={form.form_cues}
            onChange={(e) => set('form_cues', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="Common mistakes, form cues, safety notes..."
          />
        </div>

        {/* Media */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Video URL</label>
            <input
              value={form.video_url}
              onChange={(e) => set('video_url', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="https://youtube.com/watch?v=..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload Media</label>
            <MediaUploader
              onUpload={(url) => set('media_url', url)}
              onRemove={() => { set('media_url', ''); set('media_public_id', ''); }}
              currentUrl={form.media_url || undefined}
              accept="image/*,video/*"
              label="Upload image or video"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Upload Audio</label>
          <MediaUploader
            onUpload={(url) => set('audio_url', url)}
            onRemove={() => { set('audio_url', ''); set('audio_public_id', ''); }}
            currentUrl={form.audio_url || undefined}
            accept="audio/*"
            label="Upload audio guide"
          />
        </div>

        {/* Primary Muscles */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Primary Muscles</label>
          <input
            value={muscleInput}
            onChange={(e) => setMuscleInput(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2"
            placeholder="Search muscles..."
          />
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {filteredMuscles.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => toggleMuscle(m)}
                className={`px-2 py-1 rounded text-xs font-medium transition border ${
                  form.primary_muscles.includes(m)
                    ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Defaults */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Default Values</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {([
              ['default_sets', 'Sets'],
              ['default_reps', 'Reps'],
              ['default_weight_lbs', 'Weight (lbs)'],
              ['default_duration_sec', 'Duration (sec)'],
              ['default_rest_sec', 'Rest (sec)'],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
                <input
                  type="number"
                  value={form[key] ?? ''}
                  onChange={(e) => set(key, e.target.value === '' ? null : parseFloat(e.target.value))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Equipment */}
        {equipment.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipment Used</label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {equipment.map((eq) => (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => toggleEquipment(eq.id)}
                  className={`px-2 py-1 rounded text-xs font-medium transition border ${
                    form.equipment_ids.includes(eq.id)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {eq.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-200">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-medium hover:bg-fuchsia-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Create Exercise'}
        </button>
      </div>
    </Modal>
  );
}

// Re-export types for consumers
export type { ExerciseData, Category as ExerciseCategory };
