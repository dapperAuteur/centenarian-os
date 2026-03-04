'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from 'lucide-react';
import ExercisePicker from '@/components/exercises/ExercisePicker';

export interface TemplateExercise {
  name: string;
  exercise_id?: string | null;
  sets?: number | null;
  reps?: number | null;
  weight_lbs?: number | null;
  duration_sec?: number | null;
  rest_sec?: number | null;
  notes?: string | null;
  equipment_id?: string | null;
  is_circuit?: boolean;
  is_negative?: boolean;
  is_isometric?: boolean;
  to_failure?: boolean;
  is_superset?: boolean;
  superset_group?: number | null;
  is_balance?: boolean;
  is_unilateral?: boolean;
  percent_of_max?: number | null;
  rpe?: number | null;
  tempo?: string | null;
  distance_miles?: number | null;
  hold_sec?: number | null;
  phase?: string | null;
  is_bodyweight?: boolean;
  is_timed?: boolean;
  per_side?: boolean;
}

interface Props {
  exercise: TemplateExercise;
  onChange: (ex: TemplateExercise) => void;
  onRemove: () => void;
  equipment?: { id: string; name: string }[];
}

export default function TemplateExerciseRow({ exercise, onChange, onRemove, equipment }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const set = <K extends keyof TemplateExercise>(key: K, val: TemplateExercise[K]) => {
    onChange({ ...exercise, [key]: val });
  };

  const toggleBool = (key: keyof TemplateExercise) => {
    onChange({ ...exercise, [key]: !exercise[key] });
  };

  const boolFlags: { key: keyof TemplateExercise; label: string }[] = [
    { key: 'is_circuit', label: 'Circuit' },
    { key: 'is_negative', label: 'Negatives' },
    { key: 'is_isometric', label: 'Isometric' },
    { key: 'to_failure', label: 'To Failure' },
    { key: 'is_superset', label: 'Superset' },
    { key: 'is_balance', label: 'Balance' },
    { key: 'is_unilateral', label: 'Unilateral' },
  ];

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-3" role="group" aria-label={exercise.name || 'Exercise'}>
      {/* Main row */}
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-gray-300 mt-2.5 shrink-0 cursor-grab" aria-hidden="true" />
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-6 gap-2">
          <div className="col-span-2">
            <ExercisePicker
              value={exercise.name}
              exerciseId={exercise.exercise_id}
              onChange={(name, exerciseId, defaults) => {
                const updates: Partial<TemplateExercise> = { name, exercise_id: exerciseId };
                if (defaults) {
                  if (defaults.sets != null) updates.sets = defaults.sets;
                  if (defaults.reps != null) updates.reps = defaults.reps;
                  if (defaults.weight_lbs != null) updates.weight_lbs = defaults.weight_lbs;
                  if (defaults.duration_sec != null) updates.duration_sec = defaults.duration_sec;
                  if (defaults.rest_sec != null) updates.rest_sec = defaults.rest_sec;
                  if (defaults.is_bodyweight_default != null) updates.is_bodyweight = defaults.is_bodyweight_default;
                  if (defaults.is_timed_default != null) updates.is_timed = defaults.is_timed_default;
                  if (defaults.per_side_default != null) updates.per_side = defaults.per_side_default;
                }
                onChange({ ...exercise, ...updates });
              }}
            />
          </div>
          <input type="number" placeholder="Sets" value={exercise.sets ?? ''}
            onChange={(e) => set('sets', e.target.value === '' ? null : parseInt(e.target.value))}
            aria-label="Sets"
            className="px-2 py-1.5 border border-gray-300 rounded text-sm" />

          {/* Reps OR Duration based on is_timed */}
          {exercise.is_timed ? (
            <input type="number" placeholder="Time (s)" value={exercise.duration_sec ?? ''}
              onChange={(e) => set('duration_sec', e.target.value === '' ? null : parseInt(e.target.value))}
              aria-label="Duration in seconds"
              className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
          ) : (
            <input type="number" placeholder={exercise.per_side ? 'Reps/side' : 'Reps'} value={exercise.reps ?? ''}
              onChange={(e) => set('reps', e.target.value === '' ? null : parseInt(e.target.value))}
              aria-label={exercise.per_side ? 'Reps per side' : 'Reps'}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
          )}

          {/* Weight — disabled when bodyweight */}
          <div className="relative">
            <input type="number"
              placeholder={exercise.is_bodyweight ? 'BW' : 'Weight'}
              value={exercise.is_bodyweight ? '' : (exercise.weight_lbs ?? '')}
              onChange={(e) => set('weight_lbs', e.target.value === '' ? null : parseFloat(e.target.value))}
              disabled={!!exercise.is_bodyweight}
              aria-label="Weight in pounds"
              className={`w-full px-2 py-1.5 border border-gray-300 rounded text-sm ${
                exercise.is_bodyweight ? 'bg-gray-50 text-gray-400' : ''
              }`} step="any" />
            {exercise.is_bodyweight && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-fuchsia-600" aria-hidden="true">BW</span>
            )}
          </div>

          <input type="number" placeholder="Rest (s)" value={exercise.rest_sec ?? ''}
            onChange={(e) => set('rest_sec', e.target.value === '' ? null : parseInt(e.target.value))}
            aria-label="Rest in seconds"
            className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
            className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            aria-label="Toggle advanced options" aria-expanded={showAdvanced}>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button type="button" onClick={onRemove}
            className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
            aria-label="Remove exercise">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode toggles — always visible */}
      <div className="flex flex-wrap gap-3 pl-6">
        <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
          <input type="checkbox"
            checked={exercise.is_timed ?? false}
            onChange={() => toggleBool('is_timed')}
            className="rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500" />
          <span className="text-gray-600 font-medium">Timed</span>
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
          <input type="checkbox"
            checked={exercise.is_bodyweight ?? false}
            onChange={() => {
              const newVal = !exercise.is_bodyweight;
              onChange({ ...exercise, is_bodyweight: newVal, weight_lbs: newVal ? null : exercise.weight_lbs });
            }}
            className="rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500" />
          <span className="text-gray-600 font-medium">Bodyweight</span>
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
          <input type="checkbox"
            checked={exercise.per_side ?? false}
            onChange={() => toggleBool('per_side')}
            className="rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500" />
          <span className="text-gray-600 font-medium">Per Side</span>
        </label>
      </div>

      {/* Advanced section */}
      {showAdvanced && (
        <div className="pl-6 space-y-3 border-t border-gray-100 pt-3">
          {/* Boolean toggles */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Exercise flags">
            {boolFlags.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleBool(key)}
                aria-pressed={!!exercise[key]}
                className={`px-2 py-1 rounded text-xs font-medium transition border ${
                  exercise[key]
                    ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Numeric + text fields */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {exercise.is_superset && (
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Superset Group</label>
                <input type="number" value={exercise.superset_group ?? ''}
                  onChange={(e) => set('superset_group', e.target.value === '' ? null : parseInt(e.target.value))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" min={1} />
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">% of Max</label>
              <input type="number" value={exercise.percent_of_max ?? ''}
                onChange={(e) => set('percent_of_max', e.target.value === '' ? null : parseFloat(e.target.value))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" step="any" max={100} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">RPE (1-10)</label>
              <input type="number" value={exercise.rpe ?? ''}
                onChange={(e) => set('rpe', e.target.value === '' ? null : parseInt(e.target.value))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" min={1} max={10} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Tempo</label>
              <input value={exercise.tempo || ''}
                onChange={(e) => set('tempo', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                placeholder="3-1-2-0" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Distance (mi)</label>
              <input type="number" value={exercise.distance_miles ?? ''}
                onChange={(e) => set('distance_miles', e.target.value === '' ? null : parseFloat(e.target.value))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" step="any" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Hold (sec)</label>
              <input type="number" value={exercise.hold_sec ?? ''}
                onChange={(e) => set('hold_sec', e.target.value === '' ? null : parseInt(e.target.value))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
            </div>
            {/* Only show Duration in Advanced if NOT timed (it's in main row when timed) */}
            {!exercise.is_timed && (
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Duration (sec)</label>
                <input type="number" value={exercise.duration_sec ?? ''}
                  onChange={(e) => set('duration_sec', e.target.value === '' ? null : parseInt(e.target.value))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Phase</label>
              <select value={exercise.phase || ''}
                onChange={(e) => set('phase', e.target.value || null)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
                <option value="">—</option>
                <option value="warmup">Warm-up</option>
                <option value="working">Working</option>
                <option value="cooldown">Cool-down</option>
              </select>
            </div>
          </div>

          {/* Equipment */}
          {equipment && equipment.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Equipment</label>
              <select value={exercise.equipment_id || ''}
                onChange={(e) => set('equipment_id', e.target.value || null)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
                <option value="">None</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>{eq.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Notes</label>
            <input value={exercise.notes || ''}
              onChange={(e) => set('notes', e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              placeholder="Notes for this exercise..." />
          </div>
        </div>
      )}
    </div>
  );
}
