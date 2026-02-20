'use client';

// app/academy/[courseId]/lessons/[lessonId]/page.tsx
// Lesson player: renders video, text, audio, or slides content.
// Tracks progress and shows CYOA Crossroads or linear nav on completion.

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, GitBranch, CheckCircle, Loader2,
  Play, FileText, Volume2, Presentation,
} from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  lesson_type: 'video' | 'text' | 'audio' | 'slides';
  content_url: string | null;
  text_content: string | null;
  duration_seconds: number | null;
  is_free_preview: boolean;
  order: number;
  course_id: string;
}

interface CrossroadsOption {
  lesson_id: string;
  lesson_title: string;
  path_type: 'linear' | 'semantic' | 'random';
  label: string;
}

const LESSON_TYPE_ICON: Record<string, React.ElementType> = {
  video: Play,
  text: FileText,
  audio: Volume2,
  slides: Presentation,
};

export default function LessonPlayerPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const router = useRouter();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [crossroads, setCrossroads] = useState<CrossroadsOption[] | null>(null);
  const [navigationMode, setNavigationMode] = useState<'linear' | 'cyoa'>('linear');
  const [adjacentLessons, setAdjacentLessons] = useState<{ prev: string | null; next: string | null }>({ prev: null, next: null });

  const progressSaved = useRef(false);

  useEffect(() => {
    setLoading(true);
    setCompleted(false);
    setCrossroads(null);
    progressSaved.current = false;

    Promise.all([
      fetch(`/api/academy/courses/${courseId}/lessons/${lessonId}`).then((r) => r.json()),
      fetch(`/api/academy/courses/${courseId}`).then((r) => r.json()),
    ]).then(([lessonData, courseData]) => {
      if (lessonData.locked) {
        router.push(`/academy/${courseId}`);
        return;
      }
      setLesson(lessonData);
      setNavigationMode(courseData.navigation_mode ?? 'linear');

      // Compute prev/next from flat lesson list
      const allLessons = (courseData.course_modules ?? [])
        .flatMap((m: { lessons: { id: string; order: number }[] }) => m.lessons)
        .sort((a: { order: number }, b: { order: number }) => a.order - b.order);

      const idx = allLessons.findIndex((l: { id: string }) => l.id === lessonId);
      setAdjacentLessons({
        prev: idx > 0 ? allLessons[idx - 1].id : null,
        next: idx < allLessons.length - 1 ? allLessons[idx + 1].id : null,
      });

      setLoading(false);
    }).catch(() => setLoading(false));
  }, [courseId, lessonId, router]);

  async function markComplete() {
    if (progressSaved.current) return;
    progressSaved.current = true;

    await fetch(`/api/academy/courses/${courseId}/lessons/${lessonId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    });

    setCompleted(true);

    if (navigationMode === 'cyoa') {
      // Fetch CYOA crossroads options
      const r = await fetch(`/api/academy/courses/${courseId}/lessons/${lessonId}/crossroads`);
      if (r.ok) {
        const d = await r.json();
        setCrossroads(d);
      } else {
        // Fallback to linear if CYOA not set up
        setCrossroads(null);
      }
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500" />
      </div>
    );
  }

  if (!lesson) {
    return <div className="text-center py-20 text-gray-500">Lesson not found.</div>;
  }

  const TypeIcon = LESSON_TYPE_ICON[lesson.lesson_type] ?? Play;

  return (
    <div className="text-white">
      {/* Top nav */}
      <div className="border-b border-gray-800 px-6 py-3 flex items-center gap-4">
        <Link href={`/academy/${courseId}`} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition">
          <ChevronLeft className="w-4 h-4" /> Back to course
        </Link>
        <span className="text-gray-700">|</span>
        <div className="flex items-center gap-1.5 text-gray-400 text-sm">
          <TypeIcon className="w-3.5 h-3.5" />
          <span className="capitalize">{lesson.lesson_type}</span>
        </div>
        <div className="flex-1" />
        {navigationMode === 'cyoa' && (
          <span className="flex items-center gap-1 text-fuchsia-400 text-xs">
            <GitBranch className="w-3.5 h-3.5" /> Adventure Mode
          </span>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-8">{lesson.title}</h1>

        {/* Content area */}
        {lesson.lesson_type === 'video' && lesson.content_url && (
          <div className="aspect-video bg-gray-900 rounded-2xl overflow-hidden mb-8">
            <video
              src={lesson.content_url}
              controls
              className="w-full h-full"
              onEnded={markComplete}
            />
          </div>
        )}

        {lesson.lesson_type === 'audio' && lesson.content_url && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-8 flex flex-col items-center">
            <Volume2 className="w-12 h-12 text-fuchsia-400 mb-6" />
            <audio src={lesson.content_url} controls className="w-full" onEnded={markComplete} />
          </div>
        )}

        {lesson.lesson_type === 'slides' && lesson.content_url && (
          <div className="aspect-video bg-gray-900 rounded-2xl overflow-hidden mb-8">
            <iframe
              src={lesson.content_url}
              className="w-full h-full"
              title={lesson.title}
              allowFullScreen
            />
          </div>
        )}

        {lesson.text_content && (
          <div className="prose prose-invert prose-sm max-w-none mb-8 bg-gray-900 border border-gray-800 rounded-2xl p-8">
            <div dangerouslySetInnerHTML={{ __html: lesson.text_content }} />
          </div>
        )}

        {/* Mark complete button (for text/slides lessons) */}
        {!completed && (lesson.lesson_type === 'text' || lesson.lesson_type === 'slides') && (
          <button
            type="button"
            onClick={markComplete}
            className="flex items-center gap-2 px-5 py-2.5 bg-fuchsia-600 text-white rounded-xl font-semibold hover:bg-fuchsia-700 transition mb-8"
          >
            <CheckCircle className="w-4 h-4" /> Mark as Complete
          </button>
        )}

        {/* Completion + navigation */}
        {completed && (
          <div className="mt-4">
            <div className="flex items-center gap-2 text-green-400 font-semibold mb-6">
              <CheckCircle className="w-5 h-5" /> Lesson complete!
            </div>

            {/* CYOA Crossroads */}
            {navigationMode === 'cyoa' && crossroads !== null && (
              <div>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-fuchsia-400" /> Choose Your Next Path
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {crossroads.map((opt) => (
                    <Link
                      key={opt.lesson_id}
                      href={`/academy/${courseId}/lessons/${opt.lesson_id}`}
                      className={`p-4 rounded-xl border transition text-left group ${
                        opt.path_type === 'linear'
                          ? 'bg-fuchsia-900/20 border-fuchsia-700/50 hover:bg-fuchsia-900/40'
                          : opt.path_type === 'semantic'
                          ? 'bg-indigo-900/20 border-indigo-700/50 hover:bg-indigo-900/40'
                          : 'bg-gray-900 border-gray-700 hover:bg-gray-800'
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide mb-1 opacity-60">{opt.label}</p>
                      <p className="font-semibold text-white text-sm">{opt.lesson_title}</p>
                    </Link>
                  ))}
                  <Link
                    href={`/academy/${courseId}`}
                    className="p-4 rounded-xl border border-gray-800 bg-gray-900 hover:bg-gray-800 transition text-left"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1 opacity-60">Course Map</p>
                    <p className="font-semibold text-white text-sm">View All Lessons</p>
                  </Link>
                </div>
              </div>
            )}

            {/* Linear navigation */}
            {(navigationMode === 'linear' || crossroads === null) && (
              <div className="flex items-center gap-4">
                {adjacentLessons.prev && (
                  <Link
                    href={`/academy/${courseId}/lessons/${adjacentLessons.prev}`}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm hover:bg-gray-700 transition"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </Link>
                )}
                {adjacentLessons.next ? (
                  <Link
                    href={`/academy/${courseId}/lessons/${adjacentLessons.next}`}
                    className="flex items-center gap-2 px-5 py-2.5 bg-fuchsia-600 text-white rounded-xl font-semibold hover:bg-fuchsia-700 transition"
                  >
                    Next Lesson <ChevronRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <Link
                    href={`/academy/${courseId}`}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-700 text-white rounded-xl font-semibold hover:bg-green-800 transition"
                  >
                    <CheckCircle className="w-4 h-4" /> Course Complete!
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
