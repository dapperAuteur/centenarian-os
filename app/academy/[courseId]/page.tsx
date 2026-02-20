'use client';

// app/academy/[courseId]/page.tsx
// Course detail: overview, module/lesson list, enrollment CTA.

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import {
  BookOpen, Play, Lock, CheckCircle, Clock, Loader2, ArrowRight, Share2, GitBranch,
} from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  lesson_type: string;
  duration_seconds: number | null;
  order: number;
  is_free_preview: boolean;
  locked: boolean;
}

interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  category: string | null;
  price: number;
  price_type: string;
  navigation_mode: 'linear' | 'cyoa';
  enrolled: boolean;
  teacher_id: string;
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
  course_modules: Module[];
}

function formatDuration(s: number) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function CourseDetailContent() {
  const { courseId } = useParams<{ courseId: string }>();
  const searchParams = useSearchParams();
  const justEnrolled = searchParams.get('enrolled') === 'true';

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState('');

  useEffect(() => {
    fetch(`/api/academy/courses/${courseId}`)
      .then((r) => r.json())
      .then((d) => { setCourse(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [courseId, justEnrolled]);

  async function handleEnroll() {
    if (!course) return;
    setEnrolling(true);
    setEnrollError('');
    try {
      const r = await fetch(`/api/academy/courses/${courseId}/enroll`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Failed to enroll');
      if (d.url) {
        window.location.href = d.url;
      } else {
        setCourse((c) => c ? { ...c, enrolled: true } : c);
      }
    } catch (e) {
      setEnrollError(e instanceof Error ? e.message : 'Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  }

  async function handleShare() {
    const url = window.location.href;
    try {
      await navigator.share({ title: course?.title, url });
    } catch {
      await navigator.clipboard.writeText(url);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!course) {
    return <div className="text-center py-20 text-gray-500">Course not found.</div>;
  }

  const allLessons = course.course_modules.flatMap((m) => m.lessons);
  const totalDuration = allLessons.reduce((sum, l) => sum + (l.duration_seconds ?? 0), 0);
  const modules = [...course.course_modules].sort((a, b) => a.order - b.order);

  return (
    <div className="text-white">
      {justEnrolled && (
        <div className="bg-green-900/20 border-b border-green-700/40 px-6 py-3 text-center text-green-300 text-sm">
          <CheckCircle className="inline w-4 h-4 mr-1.5" />
          You&apos;re enrolled! Start learning below.
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left: Course info */}
          <div className="lg:col-span-2">
            {course.category && (
              <p className="text-fuchsia-400 text-xs font-semibold uppercase tracking-wide mb-3">{course.category}</p>
            )}
            <h1 className="text-3xl font-bold mb-4">{course.title}</h1>

            {course.description && (
              <p className="text-gray-300 mb-6 leading-relaxed">{course.description}</p>
            )}

            <div className="flex items-center gap-4 text-sm text-gray-500 mb-8">
              <span>by {course.profiles?.display_name ?? course.profiles?.username ?? 'Instructor'}</span>
              {totalDuration > 0 && (
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDuration(totalDuration)}</span>
              )}
              <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{allLessons.length} lessons</span>
              {course.navigation_mode === 'cyoa' && (
                <span className="flex items-center gap-1 text-fuchsia-400"><GitBranch className="w-3.5 h-3.5" />Adventure paths</span>
              )}
            </div>

            {/* Curriculum */}
            <h2 className="text-lg font-bold mb-4">Curriculum</h2>
            <div className="space-y-3">
              {modules.map((mod) => (
                <div key={mod.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 bg-gray-800/50">
                    <p className="font-semibold text-white text-sm">{mod.title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{mod.lessons.length} lessons</p>
                  </div>
                  <div className="divide-y divide-gray-800">
                    {[...mod.lessons].sort((a, b) => a.order - b.order).map((lesson) => {
                      const canAccess = course.enrolled || lesson.is_free_preview;
                      return (
                        <div key={lesson.id} className="flex items-center gap-3 px-5 py-3">
                          {canAccess
                            ? <Play className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
                            : <Lock className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                          }
                          <span className={`flex-1 text-sm ${canAccess ? 'text-gray-200' : 'text-gray-600'}`}>
                            {lesson.title}
                            {lesson.is_free_preview && !course.enrolled && (
                              <span className="ml-2 text-xs text-fuchsia-400">Free preview</span>
                            )}
                          </span>
                          {lesson.duration_seconds && (
                            <span className="text-gray-600 text-xs">{formatDuration(lesson.duration_seconds)}</span>
                          )}
                          {canAccess && (
                            <Link
                              href={`/academy/${courseId}/lessons/${lesson.id}`}
                              className="text-xs text-fuchsia-400 hover:text-fuchsia-300"
                            >
                              Start
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Enrollment card */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              {course.cover_image_url && (
                <img src={course.cover_image_url} alt={course.title} className="w-full aspect-video object-cover" />
              )}
              <div className="p-6">
                <div className="mb-4">
                  {course.price_type === 'free' ? (
                    <p className="text-2xl font-bold text-green-400">Free</p>
                  ) : (
                    <p className="text-2xl font-bold text-white">${course.price}</p>
                  )}
                  {course.price_type === 'subscription' && (
                    <p className="text-gray-500 text-sm">per month</p>
                  )}
                </div>

                {course.enrolled ? (
                  <Link
                    href={`/academy/${courseId}/lessons/${allLessons[0]?.id ?? ''}`}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-fuchsia-600 text-white rounded-xl font-semibold hover:bg-fuchsia-700 transition"
                  >
                    <Play className="w-4 h-4" /> Continue Learning
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleEnroll}
                      disabled={enrolling}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-fuchsia-600 text-white rounded-xl font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50 mb-3"
                    >
                      {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      {enrolling ? 'Loading…' : course.price_type === 'free' ? 'Enroll Free' : 'Enroll Now'}
                    </button>
                    {enrollError && <p className="text-red-400 text-sm text-center">{enrollError}</p>}
                  </>
                )}

                <button
                  type="button"
                  onClick={handleShare}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm hover:bg-gray-700 transition mt-3"
                >
                  <Share2 className="w-4 h-4" /> Share Course
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CourseDetailPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" /></div>}>
      <CourseDetailContent />
    </Suspense>
  );
}
