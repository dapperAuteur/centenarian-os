'use client';

// app/academy/my-courses/page.tsx
// Student dashboard: all enrolled courses with progress bars and quick-resume links.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Play, CheckCircle, Clock, GraduationCap } from 'lucide-react';

interface EnrolledCourse {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  category: string | null;
  navigation_mode: 'linear' | 'cyoa';
  enrolled_at: string;
  lesson_count: number;
  completed_count: number;
  progress_pct: number;
  profiles: { username: string; display_name: string | null } | null;
}

export default function MyCoursesPage() {
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/academy/my-courses')
      .then((r) => r.json())
      .then((d) => { setCourses(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="text-white max-w-5xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
          <GraduationCap className="w-8 h-8 text-fuchsia-400" /> My Courses
        </h1>
        <p className="text-gray-400">Track your progress and continue learning.</p>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-20 bg-gray-900 border border-dashed border-gray-800 rounded-2xl">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-700" />
          <p className="text-gray-400 mb-4">You are not enrolled in any courses yet.</p>
          <Link
            href="/academy"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-fuchsia-600 text-white rounded-xl font-semibold hover:bg-fuchsia-700 transition"
          >
            <BookOpen className="w-4 h-4" /> Browse Academy
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map((course) => (
            <div
              key={course.id}
              className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition"
            >
              <div className="flex gap-5 p-5">
                {/* Cover thumbnail */}
                <div className="w-28 h-20 bg-gray-800 rounded-xl overflow-hidden shrink-0 hidden sm:block">
                  {course.cover_image_url ? (
                    <img
                      src={course.cover_image_url}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-7 h-7 text-gray-700" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div>
                      {course.category && (
                        <p className="text-fuchsia-400 text-xs font-semibold uppercase tracking-wide mb-1">
                          {course.category}
                        </p>
                      )}
                      <Link
                        href={`/academy/${course.id}`}
                        className="font-bold text-white hover:text-fuchsia-300 transition"
                      >
                        {course.title}
                      </Link>
                    </div>
                    {course.progress_pct === 100 ? (
                      <span className="flex items-center gap-1 text-green-400 text-xs font-semibold shrink-0 bg-green-900/20 px-2 py-1 rounded-full">
                        <CheckCircle className="w-3.5 h-3.5" /> Complete
                      </span>
                    ) : (
                      <span className="text-fuchsia-400 text-sm font-bold shrink-0">
                        {course.progress_pct}%
                      </span>
                    )}
                  </div>

                  <p className="text-gray-500 text-xs mb-3">
                    by {course.profiles?.display_name ?? course.profiles?.username ?? 'Instructor'}
                    {' · '}
                    <Clock className="w-3 h-3 inline" />{' '}
                    Enrolled {new Date(course.enrolled_at).toLocaleDateString()}
                  </p>

                  {/* Progress bar */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-fuchsia-500 rounded-full transition-all duration-500"
                        style={{ width: `${course.progress_pct}%` }}
                      />
                    </div>
                    <span className="text-gray-500 text-xs shrink-0">
                      {course.completed_count}/{course.lesson_count} lessons
                    </span>
                  </div>

                  {/* CTA */}
                  <Link
                    href={`/academy/${course.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-fuchsia-600 text-white rounded-lg text-xs font-semibold hover:bg-fuchsia-700 transition"
                  >
                    <Play className="w-3 h-3" />
                    {course.progress_pct === 0
                      ? 'Start'
                      : course.progress_pct === 100
                      ? 'Review'
                      : 'Continue'}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
