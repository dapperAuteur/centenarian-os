'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Calendar, Clock, Dumbbell, Copy, Trash2, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import ActivityLinker from '@/components/ui/ActivityLinker';
import LifeCategoryTagger from '@/components/ui/LifeCategoryTagger';

interface LogExercise {
  id: string;
  name: string;
  sets_completed: number | null;
  reps_completed: number | null;
  weight_lbs: number | null;
  duration_sec: number | null;
  notes: string | null;
  sort_order: number;
}

interface WorkoutLog {
  id: string;
  name: string;
  date: string;
  template_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_min: number | null;
  notes: string | null;
  workout_log_exercises: LogExercise[];
}

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
  const [workout, setWorkout] = useState<WorkoutLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  const handleDuplicate = async () => {
    setActionLoading('duplicate');
    try {
      const res = await offlineFetch(`/api/workouts/logs/${id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        router.push(`/dashboard/workouts/${data.id}`);
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
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{workout.name}</h1>
            <p className="text-gray-500 text-sm">{fmtDate(workout.date)}</p>
          </div>
        </div>
        {workout.duration_min != null && (
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 flex items-center gap-1">
              <Clock className="w-5 h-5 text-gray-400" />
              {fmtDuration(workout.duration_min)}
            </div>
          </div>
        )}
      </div>

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
      </div>

      {/* Exercises Table */}
      {workout.workout_log_exercises.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Exercises</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Exercise</th>
                <th className="px-6 py-3 text-right">Sets</th>
                <th className="px-6 py-3 text-right">Reps</th>
                <th className="px-6 py-3 text-right">Weight</th>
                <th className="px-6 py-3 text-right">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {workout.workout_log_exercises.map((ex) => (
                <tr key={ex.id}>
                  <td className="px-6 py-3 text-gray-900">
                    {ex.name}
                    {ex.notes && <span className="text-xs text-gray-400 block">{ex.notes}</span>}
                  </td>
                  <td className="px-6 py-3 text-right text-gray-600">{ex.sets_completed ?? '—'}</td>
                  <td className="px-6 py-3 text-right text-gray-600">{ex.reps_completed ?? '—'}</td>
                  <td className="px-6 py-3 text-right text-gray-600">{ex.weight_lbs != null ? `${ex.weight_lbs} lbs` : '—'}</td>
                  <td className="px-6 py-3 text-right text-gray-600">{ex.duration_sec != null ? `${ex.duration_sec}s` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Actions</h3>
        <div className="flex flex-wrap gap-2">
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

      {/* Activity Links */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <ActivityLinker entityType="workout" entityId={workout.id} />
      </div>

      {/* Life Categories */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <LifeCategoryTagger entityType="workout" entityId={workout.id} />
      </div>
    </div>
  );
}
