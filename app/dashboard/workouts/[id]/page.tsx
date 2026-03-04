'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Calendar, Clock, Dumbbell, Copy, Trash2, Loader2, Pencil,
} from 'lucide-react';
import Link from 'next/link';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import ActivityLinker from '@/components/ui/ActivityLinker';
import LifeCategoryTagger from '@/components/ui/LifeCategoryTagger';
import WorkoutLogForm from '@/components/workouts/WorkoutLogForm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyExercise = any;

interface WorkoutLog {
  id: string;
  name: string;
  date: string;
  template_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_min: number | null;
  notes: string | null;
  purpose?: string[];
  overall_feeling?: number | null;
  warmup_notes?: string | null;
  cooldown_notes?: string | null;
  workout_log_exercises: AnyExercise[];
}

const FEELING_LABELS = ['', 'Awful', 'Hard', 'OK', 'Good', 'Great'];

const SUPERSET_COLORS = [
  'border-l-blue-500', 'border-l-purple-500', 'border-l-emerald-500',
  'border-l-amber-500', 'border-l-rose-500', 'border-l-cyan-500',
];

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDuration(min: number | null) {
  if (min == null) return '—';
  if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`;
  return `${min}m`;
}

export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [workout, setWorkout] = useState<WorkoutLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await offlineFetch(`/api/workouts/logs/${id}`);
      if (res.ok) {
        const data = await res.json();
        setWorkout(data.workout || null);
      }
    } catch { /* handled */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Auto-open edit modal when ?edit=1 is in URL (e.g. after duplicate)
  useEffect(() => {
    if (searchParams.get('edit') === '1' && workout && !loading) {
      setShowEdit(true);
      router.replace(`/dashboard/workouts/${id}`, { scroll: false });
    }
  }, [searchParams, workout, loading, id, router]);

  const handleDuplicate = async () => {
    setActionLoading('duplicate');
    try {
      const res = await offlineFetch(`/api/workouts/logs/${id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        router.push(`/dashboard/workouts/${data.id}?edit=1`);
      }
    } finally { setActionLoading(null); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this workout?')) return;
    setActionLoading('delete');
    try {
      const res = await offlineFetch(`/api/workouts/logs/${id}`, { method: 'DELETE' });
      if (res.ok) router.push('/dashboard/workouts');
    } finally { setActionLoading(null); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin h-8 w-8 text-orange-600" />
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center text-gray-400">
        <p>Workout not found.</p>
        <Link href="/dashboard/workouts" className="text-orange-600 hover:underline mt-2 inline-block">Back to workouts</Link>
      </div>
    );
  }

  // Build superset group color map
  const supersetGroups = new Map<number, number>();
  let groupIdx = 0;
  for (const ex of workout.workout_log_exercises) {
    if (ex.is_superset && ex.superset_group != null && !supersetGroups.has(ex.superset_group)) {
      supersetGroups.set(ex.superset_group, groupIdx++);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/workouts" className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                <Dumbbell className="w-3 h-3" />
                Workout
              </span>
              {workout.overall_feeling != null && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-fuchsia-50 text-fuchsia-700">
                  Feeling: {workout.overall_feeling}/5 {FEELING_LABELS[workout.overall_feeling]}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{workout.name}</h1>
            <p className="text-gray-500 text-sm">{fmtDate(workout.date)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {workout.duration_min != null && (
            <div className="text-2xl font-bold text-gray-900 flex items-center gap-1">
              <Clock className="w-5 h-5 text-gray-400" />
              {fmtDuration(workout.duration_min)}
            </div>
          )}
        </div>
      </div>

      {/* Purpose badges */}
      {workout.purpose && workout.purpose.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {workout.purpose.map((p) => (
            <span key={p} className="text-xs px-2.5 py-1 bg-fuchsia-50 text-fuchsia-700 rounded-full font-medium">{p}</span>
          ))}
        </div>
      )}

      {/* Details Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400 text-xs block">Date</span>
            <span className="text-gray-900 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {fmtDate(workout.date)}
            </span>
          </div>
          {workout.duration_min != null && (
            <div>
              <span className="text-gray-400 text-xs block">Duration</span>
              <span className="text-gray-900 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                {fmtDuration(workout.duration_min)}
              </span>
            </div>
          )}
          <div>
            <span className="text-gray-400 text-xs block">Exercises</span>
            <span className="text-gray-900 font-medium">{workout.workout_log_exercises.length}</span>
          </div>
        </div>

        {workout.notes && (
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{workout.notes}</div>
        )}

        {/* Warmup / Cooldown notes */}
        {(workout.warmup_notes || workout.cooldown_notes) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {workout.warmup_notes && (
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-green-700 mb-1">Warmup</p>
                <p className="text-sm text-green-800">{workout.warmup_notes}</p>
              </div>
            )}
            {workout.cooldown_notes && (
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700 mb-1">Cooldown</p>
                <p className="text-sm text-blue-800">{workout.cooldown_notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Exercises Table */}
      {workout.workout_log_exercises.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Exercises</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {workout.workout_log_exercises.map((ex: AnyExercise) => {
              const supersetColor = ex.is_superset && ex.superset_group != null
                ? SUPERSET_COLORS[supersetGroups.get(ex.superset_group)! % SUPERSET_COLORS.length]
                : '';

              return (
                <div key={ex.id} className={`px-6 py-4 ${supersetColor ? `border-l-4 ${supersetColor}` : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {ex.exercise_id ? (
                          <Link href={`/dashboard/exercises/${ex.exercise_id}`} className="hover:text-fuchsia-600 transition">
                            {ex.name}
                          </Link>
                        ) : ex.name}
                      </p>
                      {ex.notes && <p className="text-xs text-gray-400 mt-0.5">{ex.notes}</p>}
                    </div>
                    <div className="text-right text-sm text-gray-600 space-x-4">
                      {ex.sets_completed != null && <span>{ex.sets_completed} sets</span>}
                      {ex.is_timed ? (
                        ex.duration_sec != null && <span>{ex.duration_sec}s</span>
                      ) : (
                        ex.reps_completed != null && <span>{ex.reps_completed} reps{ex.per_side ? '/side' : ''}</span>
                      )}
                      {ex.is_bodyweight ? (
                        <span className="text-fuchsia-600 font-medium">BW</span>
                      ) : (
                        ex.weight_lbs != null && <span>{ex.weight_lbs} lbs</span>
                      )}
                      {!ex.is_timed && ex.duration_sec != null && <span>{ex.duration_sec}s</span>}
                    </div>
                  </div>

                  {/* Flag badges + advanced metrics */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {ex.phase && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        ex.phase === 'warmup' ? 'bg-green-50 text-green-700'
                        : ex.phase === 'cooldown' ? 'bg-blue-50 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                      }`}>{ex.phase}</span>
                    )}
                    {ex.is_circuit && <span className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-full">Circuit</span>}
                    {ex.is_negative && <span className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-full">Negatives</span>}
                    {ex.is_isometric && <span className="text-xs px-1.5 py-0.5 bg-cyan-50 text-cyan-700 rounded-full">Isometric</span>}
                    {ex.to_failure && <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-700 rounded-full">To Failure</span>}
                    {ex.is_superset && <span className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full">Superset {ex.superset_group != null ? `#${ex.superset_group}` : ''}</span>}
                    {ex.is_balance && <span className="text-xs px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">Balance</span>}
                    {ex.is_unilateral && <span className="text-xs px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded-full">Unilateral{ex.side ? ` (${ex.side})` : ''}</span>}
                    {ex.is_bodyweight && <span className="text-xs px-1.5 py-0.5 bg-lime-50 text-lime-700 rounded-full">Bodyweight</span>}
                    {ex.is_timed && <span className="text-xs px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded-full">Timed</span>}
                    {ex.per_side && <span className="text-xs px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded-full">Per Side</span>}
                    {ex.rpe != null && <span className="text-xs px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded-full">RPE {ex.rpe}</span>}
                    {ex.tempo && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded-full">Tempo {ex.tempo}</span>}
                    {ex.percent_of_max != null && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded-full">{ex.percent_of_max}% max</span>}
                    {ex.distance_miles != null && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded-full">{ex.distance_miles} mi</span>}
                    {ex.hold_sec != null && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded-full">Hold {ex.hold_sec}s</span>}
                    {ex.rest_sec != null && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">Rest {ex.rest_sec}s</span>}
                    {ex.feeling != null && <span className="text-xs px-1.5 py-0.5 bg-fuchsia-50 text-fuchsia-700 rounded-full">{FEELING_LABELS[ex.feeling]}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowEdit(true)}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-sky-50 text-sky-700 rounded-lg text-sm font-medium hover:bg-sky-100 disabled:opacity-50 transition"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={handleDuplicate}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-100 disabled:opacity-50 transition"
          >
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>
          <button
            onClick={handleDelete}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
          {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400 self-center" />}
        </div>
      </div>

      {/* Activity Links + Life Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <ActivityLinker entityType="workout" entityId={workout.id} />
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <LifeCategoryTagger entityType="workout" entityId={workout.id} />
        </div>
      </div>

      {/* Edit Log Modal */}
      <WorkoutLogForm
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        onSaved={load}
        existingLog={workout}
      />
    </div>
  );
}
