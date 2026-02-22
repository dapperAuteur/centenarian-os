'use client';

// app/academy/paths/[pathId]/page.tsx
// Learning path detail: course list, student progress, enroll/continue CTA.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Layers, BookOpen, CheckCircle2, Lock, ChevronRight, Trophy, ArrowRight,
} from 'lucide-react';

interface CourseStub {
  id: string;
  title: string;
  description?: string;
  cover_image_url?: string;
  category?: string;
  price: number;
  price_type: string;
  is_published: boolean;
}

interface PathCourseRow {
  course_id: string;
  order_index: number;
  is_required: boolean;
  courses: CourseStub;
}

interface LearningPath {
  id: string;
  title: string;
  description?: string;
  cover_image_url?: string;
  teacher_id: string;
  profiles?: { username: string; display_name?: string; avatar_url?: string };
  learning_path_courses?: PathCourseRow[];
}

export default function LearningPathDetailPage() {
  const { pathId } = useParams<{ pathId: string }>();
  const [path, setPath] = useState<LearningPath | null>(null);
  const [completedCourseIds, setCompletedCourseIds] = useState<string[]>([]);
  const [pathCompleted, setPathCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!pathId) return;
    const load = async () => {
      setLoading(true);
      const res = await fetch(`/api/academy/paths/${pathId}`);
      if (!res.ok) { setNotFound(true); setLoading(false); return; }
      const { data, completedCourseIds: done, pathCompleted: pc } = await res.json() as {
        data: LearningPath;
        completedCourseIds: string[];
        pathCompleted: boolean;
      };
      setPath(data);
      setCompletedCourseIds(done || []);
      setPathCompleted(pc);
      setLoading(false);
    };
    load();
  }, [pathId]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin h-10 w-10 border-4 border-fuchsia-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notFound || !path) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Path not found</h1>
        <p className="text-gray-500 mb-6">This learning path may have been removed or is not yet published.</p>
        <Link href="/academy/paths" className="text-fuchsia-600 hover:underline text-sm font-medium">
          ← Back to Learning Paths
        </Link>
      </div>
    );
  }

  const sortedCourses = (path.learning_path_courses || [])
    .sort((a, b) => a.order_index - b.order_index);

  const requiredCourses = sortedCourses.filter((c) => c.is_required);
  const completedRequired = requiredCourses.filter((c) => completedCourseIds.includes(c.course_id));
  const progress = requiredCourses.length > 0
    ? Math.round((completedRequired.length / requiredCourses.length) * 100)
    : 0;

  // Find the next course to take
  const nextCourse = sortedCourses.find((c) => !completedCourseIds.includes(c.course_id));

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-10">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 flex items-center gap-1.5">
        <Link href="/academy" className="hover:text-gray-600 transition">Academy</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/academy/paths" className="hover:text-gray-600 transition">Learning Paths</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-600 font-medium">{path.title}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-8">
        {path.cover_image_url && (
          <div className="md:w-72 shrink-0 rounded-2xl overflow-hidden aspect-video md:aspect-square">
            <Image
              src={path.cover_image_url}
              alt={path.title}
              width={400}
              height={400}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-fuchsia-100 shrink-0 mt-0.5">
              <Layers className="w-5 h-5 text-fuchsia-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 leading-tight">{path.title}</h1>
              {path.profiles && (
                <p className="text-sm text-gray-500 mt-1">
                  by{' '}
                  <Link
                    href={`/profiles/${path.profiles.username}`}
                    className="text-fuchsia-600 hover:underline"
                  >
                    {path.profiles.display_name || path.profiles.username}
                  </Link>
                </p>
              )}
            </div>
          </div>

          {path.description && (
            <p className="text-gray-600 leading-relaxed">{path.description}</p>
          )}

          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <BookOpen className="w-4 h-4" />
              {sortedCourses.length} course{sortedCourses.length !== 1 ? 's' : ''}
            </span>
            <span>
              {requiredCourses.length} required · {sortedCourses.length - requiredCourses.length} optional
            </span>
          </div>

          {/* Progress bar */}
          {completedRequired.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-gray-600 font-medium">
                  {completedRequired.length} / {requiredCourses.length} required completed
                </span>
                <span className="text-fuchsia-600 font-semibold">{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-fuchsia-600 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Path completion badge */}
          {pathCompleted && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold w-fit">
              <Trophy className="w-4 h-4" />
              Path Completed
            </div>
          )}

          {/* CTA */}
          {!pathCompleted && nextCourse && (
            <Link
              href={`/academy/${nextCourse.course_id}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl font-semibold text-sm transition"
            >
              {completedRequired.length === 0 ? 'Start Path' : 'Continue Path'}
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Course list */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-5">Courses in This Path</h2>
        <div className="space-y-3">
          {sortedCourses.map((lpc, i) => {
            const c = lpc.courses;
            const done = completedCourseIds.includes(lpc.course_id);
            return (
              <Link
                key={lpc.course_id}
                href={`/academy/${lpc.course_id}`}
                className="group flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-fuchsia-200 hover:bg-fuchsia-50/30 transition"
              >
                {/* Step number / check */}
                <div className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 text-sm font-bold transition ${
                  done
                    ? 'bg-green-100 text-green-600'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {done ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
                </div>

                {/* Course cover */}
                {c.cover_image_url && (
                  <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0">
                    <Image
                      src={c.cover_image_url}
                      alt={c.title}
                      width={56}
                      height={56}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 group-hover:text-fuchsia-700 transition truncate">
                    {c.title}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                    {c.category && <span>{c.category}</span>}
                    {!lpc.is_required && (
                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">Optional</span>
                    )}
                    {c.price_type === 'free' || c.price === 0 ? (
                      <span className="text-green-600 font-medium">Free</span>
                    ) : (
                      <span>${c.price}</span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-fuchsia-400 transition shrink-0" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
