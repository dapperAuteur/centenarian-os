'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Pencil, Copy, Trash2, Loader2,
  Volume2, Dumbbell, AlertTriangle, Heart, Share2, CheckCircle2,
  Globe, Lock, Eye,
} from 'lucide-react';
import VideoEmbed from '@/components/ui/VideoEmbed';
import MuscleDiagram from '@/components/ui/MuscleDiagram';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import ExerciseFormModal from '@/components/exercises/ExerciseFormModal';
import ActivityLinker from '@/components/ui/ActivityLinker';
import LifeCategoryTagger from '@/components/ui/LifeCategoryTagger';
import Link from 'next/link';

interface Exercise {
  id: string;
  name: string;
  category_id: string | null;
  difficulty: string | null;
  equipment_needed: string | null;
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
  visibility?: string;
  like_count?: number;
  copy_count?: number;
  done_count?: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner:     'bg-green-50 text-green-700',
  intermediate: 'bg-amber-50 text-amber-700',
  advanced:     'bg-red-50 text-red-700',
};

const EQUIPMENT_LABELS: Record<string, string> = {
  none: 'No Equipment',
  minimal: 'Minimal',
  gym: 'Gym',
};

interface Category {
  id: string;
  name: string;
}

export default function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isOwner, setIsOwner] = useState(true);
  const [liked, setLiked] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Auto-open edit modal when ?edit=1 is in URL (e.g. after duplicate)
  useEffect(() => {
    if (searchParams.get('edit') === '1' && exercise && !loading) {
      setShowEdit(true);
      router.replace(`/dashboard/exercises/${id}`, { scroll: false });
    }
  }, [searchParams, exercise, loading, id, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const [exRes, catRes] = await Promise.all([
      offlineFetch(`/api/exercises/${id}`),
      offlineFetch('/api/exercises/categories'),
    ]);
    const exData = await exRes.json();
    const catData = await catRes.json();
    setExercise(exData.exercise || null);
    setIsOwner(exData.is_owner ?? true);
    setLiked(exData.liked ?? false);
    setCategories(catData.categories || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDuplicate = async () => {
    const res = await offlineFetch(`/api/exercises/${id}/duplicate`, { method: 'POST' });
    const data = await res.json();
    if (data.exercise?.id) router.push(`/dashboard/exercises/${data.exercise.id}?edit=1`);
  };

  const handleDelete = async () => {
    await offlineFetch(`/api/exercises/${id}`, { method: 'DELETE' });
    router.push('/dashboard/exercises');
  };

  const handleLike = async () => {
    setActionLoading('like');
    const res = await offlineFetch(`/api/exercises/${id}/like`, { method: 'POST' });
    const data = await res.json();
    setLiked(data.liked);
    if (exercise) setExercise({ ...exercise, like_count: data.like_count });
    setActionLoading(null);
  };

  const handleCopy = async () => {
    setActionLoading('copy');
    const res = await offlineFetch(`/api/exercises/${id}/copy`, { method: 'POST' });
    const data = await res.json();
    if (data.exercise?.id) router.push(`/dashboard/exercises/${data.exercise.id}`);
    setActionLoading(null);
  };

  const handleDone = async (confirmed = false) => {
    setActionLoading('done');
    const res = await offlineFetch(`/api/exercises/${id}/done`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed }),
    });
    const data = await res.json();
    if (data.confirm_needed) {
      if (window.confirm(`You marked this as done ${data.recent_count} time(s) in the last ${data.window_minutes} minutes. Add another?`)) {
        setActionLoading(null);
        return handleDone(true);
      }
    } else if (exercise) {
      setExercise({ ...exercise, done_count: data.done_count });
    }
    setActionLoading(null);
  };

  const handleShare = async () => {
    setActionLoading('share');
    const res = await offlineFetch(`/api/exercises/${id}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'link' }),
    });
    const data = await res.json();
    if (data.share_url) {
      await navigator.clipboard.writeText(data.share_url);
      alert('Share link copied to clipboard!');
    }
    setActionLoading(null);
  };

  const handleVisibilityToggle = async () => {
    if (!exercise) return;
    const newVisibility = exercise.visibility === 'public' ? 'private' : 'public';
    await offlineFetch(`/api/exercises/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: newVisibility }),
    });
    setExercise({ ...exercise, visibility: newVisibility });
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/exercises" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Exercise Library
        </Link>
        {isOwner && (
          <div className="flex items-center gap-2">
            <button onClick={handleVisibilityToggle}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
              aria-label={exercise.visibility === 'public' ? 'Make private' : 'Make public'}>
              {exercise.visibility === 'public' ? <Globe className="w-3.5 h-3.5 text-green-600" /> : <Lock className="w-3.5 h-3.5" />}
              {exercise.visibility === 'public' ? 'Public' : 'Private'}
            </button>
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
        )}
      </div>

      {/* Social actions for non-owners */}
      {!isOwner && (
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={handleLike} disabled={!!actionLoading}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition min-h-11 ${
              liked ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
            <Heart className={`w-4 h-4 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
            {liked ? 'Liked' : 'Like'} {exercise.like_count ? `(${exercise.like_count})` : ''}
          </button>
          <button onClick={handleCopy} disabled={!!actionLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100 flex items-center gap-1.5 transition min-h-11">
            <Copy className="w-4 h-4" /> Copy to My Library
          </button>
          <button onClick={() => handleDone()} disabled={!!actionLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 flex items-center gap-1.5 transition min-h-11">
            <CheckCircle2 className="w-4 h-4" /> I Did This {exercise.done_count ? `(${exercise.done_count})` : ''}
          </button>
          <button onClick={handleShare} disabled={!!actionLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-sky-50 text-sky-700 hover:bg-sky-100 flex items-center gap-1.5 transition min-h-11">
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{exercise.name}</h1>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {exercise.exercise_categories && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-fuchsia-50 text-fuchsia-700">
                  {exercise.exercise_categories.name}
                </span>
              )}
              {exercise.difficulty && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[exercise.difficulty] || 'bg-gray-100 text-gray-600'}`}>
                  {exercise.difficulty}
                </span>
              )}
              {exercise.equipment_needed && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                  {EQUIPMENT_LABELS[exercise.equipment_needed] || exercise.equipment_needed}
                </span>
              )}
              {!exercise.is_active && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">Retired</span>
              )}
            </div>
          </div>
          <div className="text-right text-sm text-gray-500 space-y-0.5">
            {isOwner && <p>Used {exercise.use_count} time{exercise.use_count !== 1 ? 's' : ''}</p>}
            {(exercise.like_count ?? 0) > 0 && (
              <p className="flex items-center gap-1 justify-end"><Heart className="w-3 h-3" /> {exercise.like_count}</p>
            )}
            {(exercise.done_count ?? 0) > 0 && (
              <p className="flex items-center gap-1 justify-end"><CheckCircle2 className="w-3 h-3" /> {exercise.done_count} done</p>
            )}
            {isOwner && (exercise.copy_count ?? 0) > 0 && (
              <p className="flex items-center gap-1 justify-end"><Copy className="w-3 h-3" /> {exercise.copy_count} copies</p>
            )}
            {isOwner && exercise.visibility === 'public' && (
              <p className="flex items-center gap-1 justify-end text-green-600"><Eye className="w-3 h-3" /> Public</p>
            )}
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

      {/* Owner social actions row */}
      {isOwner && (
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => handleDone()} disabled={!!actionLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 flex items-center gap-1.5 transition min-h-11">
            <CheckCircle2 className="w-4 h-4" /> I Did This
          </button>
          {exercise.visibility === 'public' && (
            <button onClick={handleShare} disabled={!!actionLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-sky-50 text-sky-700 hover:bg-sky-100 flex items-center gap-1.5 transition min-h-11">
              <Share2 className="w-4 h-4" /> Share
            </button>
          )}
        </div>
      )}

      {/* Media */}
      {(exercise.video_url || exercise.media_url || exercise.audio_url) && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Media</h2>
          {exercise.video_url && (
            <VideoEmbed url={exercise.video_url} title={`${exercise.name} video`} />
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

      {/* Muscle Diagram */}
      {exercise.primary_muscles && exercise.primary_muscles.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Muscles Worked</h2>
          <MuscleDiagram primaryMuscles={exercise.primary_muscles} size="md" />
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

      {/* Activity Links + Life Categories (owner only) */}
      {isOwner && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <ActivityLinker entityType="exercise" entityId={exercise.id} />
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <LifeCategoryTagger entityType="exercise" entityId={exercise.id} />
          </div>
        </div>
      )}

      {isOwner && (
        <ExerciseFormModal
          isOpen={showEdit}
          onClose={() => setShowEdit(false)}
          onSaved={load}
          initial={exercise}
          categories={categories}
        />
      )}
    </div>
  );
}
