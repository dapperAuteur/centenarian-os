'use client';

// app/dashboard/teaching/courses/page.tsx
// Teacher's full course list with create and edit links.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Plus, Pencil, Eye, EyeOff } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string;
  is_published: boolean;
  price: number;
  price_type: string;
  navigation_mode: string;
  created_at: string;
}

export default function TeachingCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/academy/courses?mine=true')
      .then((r) => r.json())
      .then((data) => {
        setCourses(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function togglePublish(course: Course) {
    await fetch(`/api/academy/courses/${course.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !course.is_published }),
    });
    setCourses((prev) =>
      prev.map((c) => (c.id === course.id ? { ...c, is_published: !c.is_published } : c))
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">My Courses</h1>
          <p className="text-gray-400 text-sm mt-1">{courses.length} course{courses.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/dashboard/teaching/courses/new"
          className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition"
        >
          <Plus className="w-4 h-4" />
          New Course
        </Link>
      </div>

      {courses.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-16 text-center">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-700" />
          <p className="text-gray-500 mb-4">No courses yet. Create your first one!</p>
          <Link
            href="/dashboard/teaching/courses/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition"
          >
            <Plus className="w-4 h-4" /> Create Course
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => (
            <div
              key={course.id}
              className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl px-5 py-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium truncate">{course.title}</p>
                  {course.navigation_mode === 'cyoa' && (
                    <span className="px-1.5 py-0.5 text-xs rounded bg-fuchsia-900/50 text-fuchsia-300 font-medium shrink-0">
                      CYOA
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-sm mt-0.5 line-clamp-1">{course.description}</p>
                <p className="text-gray-600 text-xs mt-1">
                  {course.price_type === 'free'
                    ? 'Free'
                    : `$${course.price} · ${course.price_type === 'one_time' ? 'one-time' : 'subscription'}`}
                  {' · '}
                  {new Date(course.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => togglePublish(course)}
                  title={course.is_published ? 'Unpublish' : 'Publish'}
                  className={`p-2 rounded-lg transition ${
                    course.is_published
                      ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
                      : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                  }`}
                >
                  {course.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <Link
                  href={`/dashboard/teaching/courses/${course.id}`}
                  className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition"
                  title="Edit course"
                >
                  <Pencil className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
