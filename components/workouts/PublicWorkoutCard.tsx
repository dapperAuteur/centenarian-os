'use client';

// components/workouts/PublicWorkoutCard.tsx
// Expandable workout card for the public /workouts library page.

import { useState } from 'react';
import Link from 'next/link';
import { Clock, CheckCircle, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

export interface PublicExercise {
  exercise_id: string | null;
  name: string;
  sets: number | null;
  reps: number | null;
  weight_lbs: number | null;
  duration_sec: number | null;
  rpe: number | null;
  sort_order: number;
  phase: string | null;
  notes: string | null;
}

export interface PublicWorkoutTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  category_id: string | null;
  estimated_duration_min: number | null;
  done_count: number;
  like_count: number;
  workout_categories?: { name: string } | null;
  workout_template_exercises: PublicExercise[];
}

export default function PublicWorkoutCard({ wt }: { wt: PublicWorkoutTemplate }) {
  const [expanded, setExpanded] = useState(false);
  const exercises = [...(wt.workout_template_exercises ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  return (
    <article className="bg-white rounded-xl border border-gray-200 hover:border-sky-300 hover:shadow-sm transition flex flex-col">
      <div className="p-4 flex flex-col gap-3 flex-1">
        <h2 className="text-sm font-semibold text-gray-900 leading-snug">{wt.name}</h2>
        {wt.description && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{wt.description}</p>
        )}
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {(wt.workout_categories?.name || wt.category) && (
            <span className="text-[11px] font-medium bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">
              {wt.workout_categories?.name ?? wt.category}
            </span>
          )}
          {wt.estimated_duration_min && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              <Clock className="w-3 h-3" aria-hidden="true" />
              {wt.estimated_duration_min} min
            </span>
          )}
          {wt.done_count > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              <CheckCircle className="w-3 h-3" aria-hidden="true" />
              {wt.done_count} done
            </span>
          )}
        </div>
      </div>

      {exercises.length > 0 && (
        <div className="border-t border-gray-100">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
            aria-expanded={expanded}
          >
            <span>{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</span>
            {expanded
              ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
              : <ChevronDown className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
            }
          </button>

          {expanded && (
            <ul role="list" className="px-4 pb-4 space-y-1.5">
              {exercises.map((ex, i) => {
                const detail = [
                  ex.sets != null ? `${ex.sets} sets` : null,
                  ex.reps != null ? `${ex.reps} reps` : null,
                  ex.weight_lbs != null ? `${ex.weight_lbs} lbs` : null,
                  ex.duration_sec != null ? `${ex.duration_sec}s` : null,
                  ex.rpe != null ? `RPE ${ex.rpe}` : null,
                ].filter(Boolean).join(' · ');

                const inner = (
                  <>
                    <span className="font-medium text-gray-800 truncate">{ex.name}</span>
                    <span className="flex items-center gap-1 text-gray-500 ml-2 shrink-0">
                      {detail || '—'}
                      {ex.exercise_id && (
                        <ArrowRight className="w-3 h-3 text-sky-500" aria-hidden="true" />
                      )}
                    </span>
                  </>
                );

                return (
                  <li key={i} role="listitem">
                    {ex.exercise_id ? (
                      <Link
                        href={`/exercises/${ex.exercise_id}?from=workouts`}
                        className="flex items-center justify-between text-xs bg-gray-50 hover:bg-sky-50 hover:border-sky-200 border border-transparent rounded-lg px-3 py-2 transition"
                        aria-label={`View ${ex.name} exercise detail`}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                        {inner}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}
