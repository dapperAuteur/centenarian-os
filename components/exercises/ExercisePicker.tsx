'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Dumbbell } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Exercise {
  id: string;
  name: string;
  category_id: string | null;
  exercise_categories: { id: string; name: string; color: string | null } | null;
  default_sets: number | null;
  default_reps: number | null;
  default_weight_lbs: number | null;
  default_duration_sec: number | null;
  default_rest_sec: number | null;
}

interface Props {
  value: string; // exercise name (free text or from library)
  exerciseId?: string | null;
  onChange: (name: string, exerciseId: string | null, defaults?: {
    sets?: number | null;
    reps?: number | null;
    weight_lbs?: number | null;
    duration_sec?: number | null;
    rest_sec?: number | null;
  }) => void;
  placeholder?: string;
}

export default function ExercisePicker({ value, exerciseId, onChange, placeholder }: Props) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    offlineFetch('/api/exercises?sort=use_count&dir=desc')
      .then((r) => r.json())
      .then((d) => setExercises(d.exercises || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = search
    ? exercises.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    : exercises;

  const selectExercise = (ex: Exercise) => {
    onChange(ex.name, ex.id, {
      sets: ex.default_sets,
      reps: ex.default_reps,
      weight_lbs: ex.default_weight_lbs,
      duration_sec: ex.default_duration_sec,
      rest_sec: ex.default_rest_sec,
    });
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex gap-1">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value, null)}
          onFocus={() => exercises.length > 0 && setOpen(true)}
          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm min-w-0"
          placeholder={placeholder || 'Exercise name'}
        />
        {exercises.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="px-1.5 border border-gray-300 rounded hover:bg-gray-50"
            title="Browse exercises"
          >
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          </button>
        )}
      </div>

      {exerciseId && (
        <div className="mt-0.5">
          <span className="inline-flex items-center gap-1 text-[10px] text-fuchsia-600">
            <Dumbbell className="w-2.5 h-2.5" /> From library
          </span>
        </div>
      )}

      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded text-sm"
                placeholder="Search exercises..."
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-500 p-3 text-center">No exercises found</p>
            ) : (
              filtered.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => selectExercise(ex)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-900 truncate block">{ex.name}</span>
                    {ex.exercise_categories && (
                      <span className="text-xs text-gray-500">{ex.exercise_categories.name}</span>
                    )}
                  </div>
                  {(ex.default_sets || ex.default_reps) && (
                    <span className="text-xs text-gray-400 shrink-0">
                      {ex.default_sets && `${ex.default_sets}×`}{ex.default_reps}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
