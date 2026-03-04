'use client';

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import LogExerciseRow, { LogExercise } from './LogExerciseRow';
import WorkoutPurposeSelect from './WorkoutPurposeSelect';
import { offlineFetch } from '@/lib/offline/offline-fetch';

const FEELING_LABELS = ['', 'Awful', 'Hard', 'OK', 'Good', 'Great'];

interface TemplateData {
  id: string;
  name: string;
  estimated_duration_min?: number | null;
  purpose?: string[];
  workout_template_exercises?: {
    name: string;
    exercise_id?: string | null;
    sets?: number | null;
    reps?: number | null;
    weight_lbs?: number | null;
    duration_sec?: number | null;
    rest_sec?: number | null;
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
    tempo?: string;
    distance_miles?: number | null;
    hold_sec?: number | null;
    phase?: string | null;
    is_bodyweight?: boolean;
    is_timed?: boolean;
    per_side?: boolean;
  }[];
}

interface LogData {
  id: string;
  name: string;
  date: string;
  duration_min?: number | null;
  notes?: string | null;
  template_id?: string | null;
  purpose?: string[];
  overall_feeling?: number | null;
  warmup_notes?: string | null;
  cooldown_notes?: string | null;
  workout_log_exercises?: LogExercise[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Pre-fill from template (new log) */
  template?: TemplateData | null;
  /** Edit existing log */
  existingLog?: LogData | null;
  /** Title override */
  title?: string;
  /** Called after a successful save with the new/updated log id */
  onWorkoutLogged?: (logId: string) => void;
}

export default function WorkoutLogForm({ isOpen, onClose, onSaved, template, existingLog, title, onWorkoutLogged }: Props) {
  const [form, setForm] = useState({ name: '', date: new Date().toISOString().split('T')[0], duration_min: '', notes: '' });
  const [purpose, setPurpose] = useState<string[]>([]);
  const [overallFeeling, setOverallFeeling] = useState<number | null>(null);
  const [warmupNotes, setWarmupNotes] = useState('');
  const [cooldownNotes, setCooldownNotes] = useState('');
  const [exercises, setExercises] = useState<LogExercise[]>([]);
  const [equipment, setEquipment] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const isEdit = !!existingLog;

  useEffect(() => {
    if (!isOpen) return;

    if (existingLog) {
      // Edit existing log
      setForm({
        name: existingLog.name,
        date: existingLog.date,
        duration_min: existingLog.duration_min != null ? String(existingLog.duration_min) : '',
        notes: existingLog.notes ?? '',
      });
      setPurpose(existingLog.purpose ?? []);
      setOverallFeeling(existingLog.overall_feeling ?? null);
      setWarmupNotes(existingLog.warmup_notes ?? '');
      setCooldownNotes(existingLog.cooldown_notes ?? '');
      setExercises(existingLog.workout_log_exercises?.map((ex) => ({ ...ex })) ?? []);
    } else if (template) {
      // New log from template
      setForm({
        name: template.name,
        date: new Date().toISOString().split('T')[0],
        duration_min: template.estimated_duration_min ? String(template.estimated_duration_min) : '',
        notes: '',
      });
      setPurpose(template.purpose ?? []);
      setOverallFeeling(null);
      setWarmupNotes('');
      setCooldownNotes('');
      setExercises(
        (template.workout_template_exercises ?? []).map((ex) => ({
          name: ex.name,
          exercise_id: ex.exercise_id,
          sets_completed: ex.sets ?? null,
          reps_completed: ex.reps ?? null,
          weight_lbs: ex.weight_lbs ?? null,
          duration_sec: ex.duration_sec ?? null,
          rest_sec: ex.rest_sec ?? 60,
          equipment_id: ex.equipment_id,
          is_circuit: ex.is_circuit,
          is_negative: ex.is_negative,
          is_isometric: ex.is_isometric,
          to_failure: ex.to_failure,
          is_superset: ex.is_superset,
          superset_group: ex.superset_group,
          is_balance: ex.is_balance,
          is_unilateral: ex.is_unilateral,
          percent_of_max: ex.percent_of_max,
          rpe: ex.rpe,
          tempo: ex.tempo,
          distance_miles: ex.distance_miles,
          hold_sec: ex.hold_sec,
          phase: ex.phase,
          is_bodyweight: ex.is_bodyweight,
          is_timed: ex.is_timed,
          per_side: ex.per_side,
        })),
      );
    } else {
      // Quick log
      setForm({ name: '', date: new Date().toISOString().split('T')[0], duration_min: '', notes: '' });
      setPurpose([]);
      setOverallFeeling(null);
      setWarmupNotes('');
      setCooldownNotes('');
      setExercises([{ name: '', sets_completed: null, reps_completed: null, weight_lbs: null, duration_sec: null, rest_sec: 60, is_bodyweight: false, is_timed: false, per_side: false }]);
    }

    offlineFetch('/api/equipment?active=true').then(async (r) => {
      if (r.ok) {
        const data = await r.json();
        setEquipment((data ?? []).map((e: { id: string; name: string }) => ({ id: e.id, name: e.name })));
      }
    }).catch(() => {});
  }, [isOpen, template, existingLog]);

  const addExercise = () => {
    setExercises((prev) => [...prev, { name: '', sets_completed: null, reps_completed: null, weight_lbs: null, duration_sec: null, rest_sec: 60, is_bodyweight: false, is_timed: false, per_side: false }]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        template_id: template?.id ?? existingLog?.template_id ?? null,
        name: form.name,
        date: form.date,
        duration_min: form.duration_min ? Number(form.duration_min) : null,
        notes: form.notes || null,
        purpose,
        overall_feeling: overallFeeling,
        warmup_notes: warmupNotes || null,
        cooldown_notes: cooldownNotes || null,
        exercises: exercises.filter((ex) => ex.name.trim()),
      };

      const url = isEdit ? `/api/workouts/logs/${existingLog!.id}` : '/api/workouts/logs';
      const res = await offlineFetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        onSaved();
        onClose();
        if (onWorkoutLogged && data?.id) {
          onWorkoutLogged(data.id);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = title ?? (isEdit ? `Edit: ${existingLog!.name}` : template ? `Log: ${template.name}` : 'Log Workout');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="lg">
      <form onSubmit={handleSave} className="flex flex-col">
        {/* Scrollable content */}
        <div className="space-y-4 flex-1 px-1 pt-1">
          {/* Name (editable for quick log and edit, read-only for template) */}
          {!template && (
            <div>
              <label htmlFor="wl-name" className="block text-xs font-medium text-gray-600 mb-1">Workout name *</label>
              <input
                id="wl-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Morning Run, Gym Session"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
                aria-required="true"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="wl-date" className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input id="wl-date" type="date" value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" required aria-required="true" />
            </div>
            <div>
              <label htmlFor="wl-duration" className="block text-xs font-medium text-gray-600 mb-1">Duration (min)</label>
              <input id="wl-duration" type="number" value={form.duration_min}
                onChange={(e) => setForm((f) => ({ ...f, duration_min: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <WorkoutPurposeSelect value={purpose} onChange={setPurpose} />

          {/* Exercises */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">Exercises</label>
              <button type="button" onClick={addExercise}
                className="text-xs text-lime-600 font-medium hover:text-lime-700 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="space-y-2 max-h-[35vh] overflow-y-auto">
              {exercises.map((ex, i) => (
                <LogExerciseRow
                  key={i}
                  exercise={ex}
                  equipment={equipment}
                  onChange={(updated) => setExercises((prev) => prev.map((p, j) => j === i ? updated : p))}
                  onRemove={() => setExercises((prev) => prev.filter((_, j) => j !== i))}
                />
              ))}
            </div>
          </div>

          {/* Overall feeling */}
          <fieldset>
            <legend className="text-xs font-medium text-gray-600 mb-1">How did the workout feel?</legend>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={overallFeeling === v}
                  onClick={() => setOverallFeeling(overallFeeling === v ? null : v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    overallFeeling === v
                      ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {v} {FEELING_LABELS[v]}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Warmup / Cooldown / Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="wl-warmup" className="block text-xs font-medium text-gray-600 mb-1">Warmup Notes</label>
              <input id="wl-warmup" value={warmupNotes}
                onChange={(e) => setWarmupNotes(e.target.value)}
                placeholder="What did you do to warm up?"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="wl-cooldown" className="block text-xs font-medium text-gray-600 mb-1">Cooldown Notes</label>
              <input id="wl-cooldown" value={cooldownNotes}
                onChange={(e) => setCooldownNotes(e.target.value)}
                placeholder="Stretching, foam rolling, etc."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label htmlFor="wl-notes" className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <input id="wl-notes" value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="How did it go?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
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
            className="flex-1 bg-lime-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-lime-700 transition disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Save Workout'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
