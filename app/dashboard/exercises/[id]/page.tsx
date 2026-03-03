'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Pencil, Copy, Trash2, Loader2,
  Volume2, Dumbbell, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import ExerciseFormModal from '@/components/exercises/ExerciseFormModal';
import ActivityLinker from '@/components/ui/ActivityLinker';
import LifeCategoryTagger from '@/components/ui/LifeCategoryTagger';
import Link from 'next/link';

interface Exercise {
  id: string;
  name: string;
  category_id: string | null;
  exercise_categories: { id: string; name: string; icon: string | null; color: string | null } | null;
  exercise_equipment: { id: string; equipment_id: string; equipment: { id: string; name: string } }[];
  instructions: string | null;
  form_cues: string | null;
  video_url: string | null;
  media_url: string | null;
  audio_url: string | null;
  primary_muscles: string[] | null;
  default_sets: number | null;
  default_reps: number | null;
  default_weight_lbs: number | null;
  default_duration_sec: number | null;
  default_rest_sec: number | null;
  is_active: boolean;
  use_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Category {
  id: string;
  name: string;
}

export default function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [exRes, catRes] = await Promise.all([
      offlineFetch(`/api/exercises/${id}`),
      offlineFetch('/api/exercises/categories'),
    ]);
    const exData = await exRes.json();
    const catData = await catRes.json();
    setExercise(exData.exercise || null);
    setCategories(catData.categories || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDuplicate = async () => {
    const res = await offlineFetch(`/api/exercises/${id}/duplicate`, { method: 'POST' });
    const data = await res.json();
    if (data.exercise?.id) router.push(`/dashboard/exercises/${data.exercise.id}`);
  };

  const handleDelete = async () => {
    await offlineFetch(`/api/exercises/${id}`, { method: 'DELETE' });
    router.push('/dashboard/exercises');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-600" />
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <p className="text-gray-500">Exercise not found.</p>
        <Link href="/dashboard/exercises" className="text-fuchsia-600 text-sm mt-2 inline-block">
          Back to library
        </Link>
      </div>
    );
  }

  const isYouTube = exercise.video_url && (exercise.video_url.includes('youtube.com') || exercise.video_url.includes('youtu.be'));
  const youtubeEmbedUrl = isYouTube
    ? exercise.video_url!.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')
    : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/exercises" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Exercise Library
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowEdit(true)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
          <button onClick={handleDuplicate}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <button onClick={handleDelete}
                className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">Confirm</button>
              <button onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 bg-gray-100 rounded text-xs hover:bg-gray-200">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="px-3 py-1.5 border border-red-200 rounded-lg text-sm text-red-600 hover:bg-red-50 flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{exercise.name}</h1>
            {exercise.exercise_categories && (
              <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-fuchsia-50 text-fuchsia-700">
                {exercise.exercise_categories.name}
              </span>
            )}
            {!exercise.is_active && (
              <span className="inline-block mt-1 ml-2 text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">Retired</span>
            )}
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>Used {exercise.use_count} time{exercise.use_count !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Primary muscles */}
        {exercise.primary_muscles && exercise.primary_muscles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {exercise.primary_muscles.map((m) => (
              <span key={m} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">{m}</span>
            ))}
          </div>
        )}
      </div>

      {/* Media */}
      {(exercise.video_url || exercise.media_url || exercise.audio_url) && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Media</h2>
          {youtubeEmbedUrl && (
            <div className="aspect-video rounded-lg overflow-hidden bg-black">
              <iframe src={youtubeEmbedUrl} className="w-full h-full" allowFullScreen
                title={`${exercise.name} video`} />
            </div>
          )}
          {exercise.video_url && !isYouTube && (
            <a href={exercise.video_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-fuchsia-600 hover:text-fuchsia-700">
              <ExternalLink className="w-4 h-4" /> Watch video
            </a>
          )}
          {exercise.media_url && (
            <div className="rounded-lg overflow-hidden">
              {exercise.media_url.includes('/video/') ? (
                <video src={exercise.media_url} controls className="w-full max-h-80 bg-black rounded-lg">
                  <track kind="captions" />
                </video>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={exercise.media_url} alt={exercise.name} className="max-h-80 rounded-lg" />
              )}
            </div>
          )}
          {exercise.audio_url && (
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-gray-500" />
              <audio src={exercise.audio_url} controls className="flex-1" />
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {exercise.instructions && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Instructions</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{exercise.instructions}</p>
        </div>
      )}

      {/* Form Cues */}
      {exercise.form_cues && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-amber-800 mb-3">Things to Watch For</h2>
          <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{exercise.form_cues}</p>
        </div>
      )}

      {/* Defaults */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Default Values</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            ['Sets', exercise.default_sets],
            ['Reps', exercise.default_reps],
            ['Weight', exercise.default_weight_lbs ? `${exercise.default_weight_lbs} lbs` : null],
            ['Duration', exercise.default_duration_sec ? `${exercise.default_duration_sec}s` : null],
            ['Rest', exercise.default_rest_sec ? `${exercise.default_rest_sec}s` : null],
          ].map(([label, val]) => (
            <div key={label as string}>
              <p className="text-xs text-gray-500">{label as string}</p>
              <p className="text-lg font-semibold text-gray-900">{val ?? '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Equipment */}
      {exercise.exercise_equipment && exercise.exercise_equipment.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Equipment</h2>
          <div className="flex flex-wrap gap-2">
            {exercise.exercise_equipment.map((eq) => (
              <Link key={eq.id} href={`/dashboard/equipment/${eq.equipment_id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-700 hover:bg-gray-200 transition">
                <Dumbbell className="w-3.5 h-3.5" />
                {eq.equipment.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {exercise.notes && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{exercise.notes}</p>
        </div>
      )}

      {/* Activity Links + Life Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <ActivityLinker entityType="exercise" entityId={exercise.id} />
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <LifeCategoryTagger entityType="exercise" entityId={exercise.id} />
        </div>
      </div>

      <ExerciseFormModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        onSaved={load}
        initial={exercise}
        categories={categories}
      />
    </div>
  );
}
