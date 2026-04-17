'use client';

// app/academy/my-courses/page.tsx
// Student dashboard: all enrolled courses with progress bars, quick-resume links, and re-enrollment.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Play, CheckCircle, Clock, GraduationCap, RotateCcw, Loader2, HardDrive, Award } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface EnrolledCourse {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  category: string | null;
  navigation_mode: 'linear' | 'cyoa';
  enrolled_at: string;
  attempt_number: number;
  metric_slots: number;
  lesson_count: number;
  completed_count: number;
  progress_pct: number;
  new_lesson_count: number;
  updated_lesson_count: number;
  certificate_token: string | null;
  profiles: { username: string; display_name: string | null } | null;
}

export default function MyCoursesPage() {
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [reattempting, setReattempting] = useState<string | null>(null);

  useEffect(() => {
    offlineFetch('/api/academy/my-courses')
      .then((r) => r.json())
      .then((d) => { setCourses(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleReattempt(courseId: string) {
    setReattempting(courseId);
    try {
      const r = await offlineFetch(`/api/academy/courses/${courseId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reattempt: true }),
      });
      const d = await r.json();
      if (d.url) {
        window.location.href = d.url;
      } else if (d.enrolled) {
        window.location.reload();
      }
    } catch { /* ignore */ }
    setReattempting(null);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="text-white max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-8 sm:mb-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3 mb-2">
            <GraduationCap className="w-7 sm:w-8 h-7 sm:h-8 text-fuchsia-400" /> My Courses
          </h1>
          <p className="text-gray-400 text-sm sm:text-base">Track your progress and continue learning.</p>
        </div>
        <Link
          href="/academy/offline"
          className="min-h-11 inline-flex items-center gap-2 px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 rounded-lg transition self-start"
        >
          <HardDrive className="w-4 h-4" aria-hidden="true" />
          Offline storage
        </Link>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-16 sm:py-20 bg-gray-900 border border-dashed border-gray-800 rounded-2xl">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-700" />
          <p className="text-gray-400 mb-4">You are not enrolled in any courses yet.</p>
          <Link
            href="/academy"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-fuchsia-600 text-white rounded-xl font-semibold hover:bg-fuchsia-700 transition min-h-11"
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
              <div className="flex gap-4 sm:gap-5 p-4 sm:p-5">
                {/* Cover thumbnail */}
                <div className="w-24 sm:w-28 h-16 sm:h-20 bg-gray-800 rounded-xl overflow-hidden shrink-0 hidden sm:block">
                  {course.cover_image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
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
                    <div className="min-w-0">
                      {course.category && (
                        <p className="text-fuchsia-400 text-xs font-semibold uppercase tracking-wide mb-1">
                          {course.category}
                        </p>
                      )}
                      <Link
                        href={`/academy/${course.id}`}
                        className="font-bold text-white hover:text-fuchsia-300 transition line-clamp-1"
                      >
                        {course.title}
                      </Link>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {(course.new_lesson_count > 0 || course.updated_lesson_count > 0) && (
                        <span className="flex items-center gap-1 text-xs font-semibold bg-fuchsia-900/30 text-fuchsia-300 px-2 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 shrink-0" />
                          {course.new_lesson_count > 0 && course.updated_lesson_count > 0
                            ? `${course.new_lesson_count} new · ${course.updated_lesson_count} updated`
                            : course.new_lesson_count > 0
                            ? `${course.new_lesson_count} new`
                            : `${course.updated_lesson_count} updated`}
                        </span>
                      )}
                      {course.attempt_number > 1 && (
                        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                          Attempt {course.attempt_number}
                        </span>
                      )}
                      {course.progress_pct === 100 ? (
                        <span className="flex items-center gap-1 text-green-400 text-xs font-semibold bg-green-900/20 px-2 py-1 rounded-full">
                          <CheckCircle className="w-3.5 h-3.5" /> Complete
                        </span>
                      ) : (
                        <span className="text-fuchsia-400 text-sm font-bold">
                          {course.progress_pct}%
                        </span>
                      )}
                    </div>
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

                  {/* CTAs */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/academy/${course.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-xs font-semibold hover:bg-fuchsia-700 transition min-h-9"
                    >
                      <Play className="w-3 h-3" />
                      {course.progress_pct === 0
                        ? 'Start'
                        : course.progress_pct === 100
                        ? 'Review'
                        : 'Continue'}
                    </Link>
                    {course.certificate_token && (
                      <Link
                        href={`/academy/verify/${course.certificate_token}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg text-xs font-semibold transition min-h-9"
                      >
                        <Award className="w-3 h-3" aria-hidden="true" />
                        Certificate
                      </Link>
                    )}
                    {course.progress_pct === 100 && (
                      <button
                        type="button"
                        onClick={() => handleReattempt(course.id)}
                        disabled={reattempting === course.id}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-700 transition disabled:opacity-50 min-h-9"
                      >
                        {reattempting === course.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        Take Again
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
