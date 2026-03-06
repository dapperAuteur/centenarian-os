'use client';

// app/dashboard/teaching/learning-paths/page.tsx
// Teacher: manage learning paths + AI-suggest new ones from existing courses.

import { useEffect, useState, useCallback } from 'react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import Link from 'next/link';
import {
  Layers, Plus, Pencil, Eye, EyeOff, Sparkles, Loader2, CheckCircle2, X,
} from 'lucide-react';

interface CourseStub {
  id: string;
  title: string;
}

interface PathCourseRow {
  course_id: string;
  order_index: number;
  courses: CourseStub;
}

interface LearningPath {
  id: string;
  title: string;
  description?: string;
  is_published: boolean;
  created_at: string;
  learning_path_courses?: PathCourseRow[];
}

interface AISuggestion {
  title: string;
  description: string;
  course_ids: string[];
  courses: CourseStub[];
}

export default function TeachingLearningPathsPage() {
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null); // suggestion title being saved

  const loadPaths = useCallback(async () => {
    setLoading(true);
    const res = await offlineFetch('/api/academy/paths?mine=true');
    if (res.ok) {
      const { data } = await res.json() as { data: LearningPath[] };
      setPaths(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPaths(); }, [loadPaths]);

  const togglePublish = async (path: LearningPath) => {
    await offlineFetch(`/api/academy/paths/${path.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !path.is_published }),
    });
    setPaths((prev) =>
      prev.map((p) => p.id === path.id ? { ...p, is_published: !p.is_published } : p)
    );
  };

  const handleSuggest = async () => {
    setSuggesting(true);
    setSuggestError(null);
    setSuggestions([]);
    const res = await offlineFetch('/api/teaching/learning-paths/suggest', { method: 'POST' });
    const json = await res.json() as { suggestions?: AISuggestion[]; error?: string };
    if (!res.ok) {
      setSuggestError(json.error || 'Failed to generate suggestions');
    } else {
      setSuggestions(json.suggestions || []);
    }
    setSuggesting(false);
  };

  const acceptSuggestion = async (s: AISuggestion) => {
    setCreating(s.title);
    // Create the path
    const createRes = await offlineFetch('/api/academy/paths', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: s.title, description: s.description }),
    });
    if (!createRes.ok) { setCreating(null); return; }
    const { data: newPath } = await createRes.json() as { data: LearningPath };

    // Add courses
    if (s.course_ids.length > 0) {
      await offlineFetch(`/api/academy/paths/${newPath.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courses: s.course_ids.map((id, i) => ({ course_id: id, order_index: i })),
        }),
      });
    }

    setSuggestions((prev) => prev.filter((x) => x.title !== s.title));
    setCreating(null);
    loadPaths();
  };

  const dismissSuggestion = (title: string) => {
    setSuggestions((prev) => prev.filter((s) => s.title !== title));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-7 h-7 text-fuchsia-600" />
            Learning Paths
          </h1>
          <p className="text-gray-500 mt-1">
            Group your courses into structured sequences to show student proficiency.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSuggest}
            disabled={suggesting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-fuchsia-200 text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 rounded-xl font-medium transition disabled:opacity-50"
          >
            {suggesting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              : <><Sparkles className="w-4 h-4" /> Suggest Paths (AI)</>
            }
          </button>
          <Link
            href="/dashboard/teaching/learning-paths/new"
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-fuchsia-600 text-white rounded-xl font-medium hover:bg-fuchsia-700 transition"
          >
            <Plus className="w-4 h-4" />
            New Path
          </Link>
        </div>
      </div>

      {/* AI Suggestions */}
      {suggestError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 text-sm">
          {suggestError}
        </div>
      )}

      {suggestions.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-fuchsia-500" />
            AI Suggestions — Review & Accept
          </h2>
          <div className="space-y-4">
            {suggestions.map((s) => (
              <div key={s.title} className="bg-fuchsia-50 border border-fuchsia-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-base">{s.title}</h3>
                    <p className="text-sm text-gray-600 mt-0.5">{s.description}</p>
                  </div>
                  <button
                    onClick={() => dismissSuggestion(s.title)}
                    className="text-gray-400 hover:text-gray-600 shrink-0 transition"
                    title="Dismiss suggestion"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {s.courses.map((c, i) => (
                    <span
                      key={c.id}
                      className="px-2.5 py-1 bg-white border border-fuchsia-200 text-fuchsia-800 rounded-lg text-xs font-medium"
                    >
                      {i + 1}. {c.title}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => acceptSuggestion(s)}
                  disabled={creating === s.title}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-fuchsia-600 text-white rounded-lg font-medium hover:bg-fuchsia-700 transition disabled:opacity-50"
                >
                  {creating === s.title
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…</>
                    : <><CheckCircle2 className="w-3.5 h-3.5" /> Accept & Create</>
                  }
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Existing paths list */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Paths</h2>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-fuchsia-600 border-t-transparent rounded-full" />
          </div>
        ) : paths.length === 0 ? (
          <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
            <Layers className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-500 mb-1">No learning paths yet</p>
            <p className="text-sm mb-5">Create your first path or let AI suggest one.</p>
            <Link
              href="/dashboard/teaching/learning-paths/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-fuchsia-600 text-white rounded-lg font-medium hover:bg-fuchsia-700 transition"
            >
              <Plus className="w-4 h-4" />
              Create Path
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {paths.map((p) => {
              const courseCount = (p.learning_path_courses || []).length;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-4 bg-white border border-gray-200 rounded-xl px-5 py-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{p.title}</p>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {courseCount} course{courseCount !== 1 ? 's' : ''}
                      {' · '}
                      {p.is_published
                        ? <span className="text-green-600">Published</span>
                        : <span className="text-amber-500">Draft</span>
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => togglePublish(p)}
                      title={p.is_published ? 'Unpublish' : 'Publish'}
                      className="p-2 text-gray-400 hover:text-gray-700 transition"
                    >
                      {p.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <Link
                      href={`/dashboard/teaching/learning-paths/${p.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg transition font-medium"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
