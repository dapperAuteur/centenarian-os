'use client';

// app/dashboard/teaching/learning-paths/[id]/page.tsx
// Edit a learning path: metadata, course order, publish/unpublish.

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Layers, ArrowLeft, GripVertical, Plus, Trash2, Eye, EyeOff, Save, Loader2,
} from 'lucide-react';

interface CourseStub {
  id: string;
  title: string;
  category?: string;
}

interface PathCourse {
  course_id: string;
  order_index: number;
  is_required: boolean;
  courses: CourseStub;
}

interface LearningPath {
  id: string;
  title: string;
  description?: string;
  is_published: boolean;
  learning_path_courses?: PathCourse[];
}

export default function EditLearningPathPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [path, setPath] = useState<LearningPath | null>(null);
  const [courses, setCourses] = useState<PathCourse[]>([]);
  const [availableCourses, setAvailableCourses] = useState<CourseStub[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const loadPath = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [pathRes, coursesRes] = await Promise.all([
      fetch(`/api/academy/paths/${id}`),
      fetch('/api/academy/courses?mine=true'),
    ]);
    if (pathRes.ok) {
      const { data } = await pathRes.json() as { data: LearningPath };
      setPath(data);
      setTitle(data.title);
      setDescription(data.description ?? '');
      const sorted = [...(data.learning_path_courses ?? [])].sort(
        (a, b) => a.order_index - b.order_index
      );
      setCourses(sorted);
    }
    if (coursesRes.ok) {
      const data = await coursesRes.json() as CourseStub[];
      setAvailableCourses(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadPath(); }, [loadPath]);

  const handleSave = async () => {
    if (!path) return;
    setSaving(true);
    const res = await fetch(`/api/academy/paths/${path.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        courses: courses.map((c, i) => ({
          course_id: c.course_id,
          order_index: i,
          is_required: c.is_required,
        })),
      }),
    });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    setSaving(false);
  };

  const togglePublish = async () => {
    if (!path) return;
    const res = await fetch(`/api/academy/paths/${path.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !path.is_published }),
    });
    if (res.ok) setPath((p) => p ? { ...p, is_published: !p.is_published } : p);
  };

  const addCourse = (c: CourseStub) => {
    if (courses.find((x) => x.course_id === c.id)) return;
    setCourses((prev) => [
      ...prev,
      {
        course_id: c.id,
        order_index: prev.length,
        is_required: true,
        courses: c,
      },
    ]);
    setSaved(false);
  };

  const removeCourse = (courseId: string) => {
    setCourses((prev) => prev.filter((c) => c.course_id !== courseId));
    setSaved(false);
  };

  const toggleRequired = (courseId: string) => {
    setCourses((prev) =>
      prev.map((c) =>
        c.course_id === courseId ? { ...c, is_required: !c.is_required } : c
      )
    );
    setSaved(false);
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setCourses((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
    setSaved(false);
  };

  const moveDown = (idx: number) => {
    setCourses((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
    setSaved(false);
  };

  const coursesNotInPath = availableCourses.filter(
    (c) => !courses.find((x) => x.course_id === c.id)
  );

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin h-10 w-10 border-4 border-fuchsia-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!path) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <p className="text-gray-500">Path not found.</p>
        <button onClick={() => router.back()} className="mt-4 text-fuchsia-600 hover:underline text-sm">
          ← Go back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link
            href="/dashboard/teaching/learning-paths"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Paths
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-fuchsia-600" />
            Edit Path
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={togglePublish}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border font-medium transition ${
              path.is_published
                ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
                : 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
            }`}
          >
            {path.is_published
              ? <><EyeOff className="w-4 h-4" /> Unpublish</>
              : <><Eye className="w-4 h-4" /> Publish</>
            }
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-fuchsia-600 text-white text-sm rounded-xl font-medium hover:bg-fuchsia-700 transition disabled:opacity-50"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : <><Save className="w-4 h-4" /> {saved ? 'Saved!' : 'Save'}</>
            }
          </button>
        </div>
      </div>

      {/* Metadata */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-700">Details</h2>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setSaved(false); }}
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
            rows={3}
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-500 resize-none"
          />
        </div>
      </section>

      {/* Course order */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-4">Courses in This Path</h2>
        {courses.length === 0 ? (
          <p className="text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
            No courses added yet. Add from your courses below.
          </p>
        ) : (
          <div className="space-y-2">
            {courses.map((c, i) => (
              <div
                key={c.course_id}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3"
              >
                <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => moveUp(i)}
                    disabled={i === 0}
                    className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-xs leading-none"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveDown(i)}
                    disabled={i === courses.length - 1}
                    className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-xs leading-none"
                  >
                    ▼
                  </button>
                </div>
                <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{c.courses.title}</p>
                  {c.courses.category && (
                    <p className="text-xs text-gray-400">{c.courses.category}</p>
                  )}
                </div>
                <button
                  onClick={() => toggleRequired(c.course_id)}
                  className={`px-2 py-0.5 text-xs rounded-full font-medium border transition ${
                    c.is_required
                      ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {c.is_required ? 'Required' : 'Optional'}
                </button>
                <button
                  onClick={() => removeCourse(c.course_id)}
                  className="text-gray-300 hover:text-red-400 transition"
                  title="Remove from path"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add from your courses */}
      {coursesNotInPath.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Add Courses</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {coursesNotInPath.map((c) => (
              <button
                key={c.id}
                onClick={() => addCourse(c)}
                className="flex items-center gap-2 text-left px-4 py-3 bg-white border border-gray-200 hover:border-fuchsia-300 hover:bg-fuchsia-50 rounded-xl text-sm transition"
              >
                <Plus className="w-4 h-4 text-fuchsia-500 shrink-0" />
                <span className="truncate font-medium text-gray-800">{c.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
