'use client';

// app/academy/[courseId]/lessons/[lessonId]/page.tsx
// Lesson player: renders video, text, audio, or slides content.
// Tracks progress and shows CYOA Crossroads or linear nav on completion.

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, GitBranch, CheckCircle, Loader2,
  Play, FileText, Volume2, Presentation, ClipboardList, ArrowRight, HelpCircle,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import QuizPlayer from '@/components/academy/QuizPlayer';
import AudioPlayer from '@/components/academy/AudioPlayer';
import VideoPlayer from '@/components/academy/VideoPlayer';
import LessonDiscussion from '@/components/academy/LessonDiscussion';
import PodcastLinks from '@/components/academy/PodcastLinks';
import DocumentViewer from '@/components/academy/DocumentViewer';

const MapViewer = dynamic(() => import('@/components/academy/MapViewer'), { ssr: false });
import { marked } from 'marked';
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
import TiptapCodeBlock from '@tiptap/extension-code-block';
import TiptapHeading from '@tiptap/extension-heading';

const TIPTAP_EXTENSIONS = [
  StarterKit.configure({ codeBlock: false, heading: false }),
  TiptapHeading.configure({ levels: [1, 2, 3] }),
  TiptapCodeBlock,
  TiptapLink.configure({ openOnClick: false }),
  TiptapImage,
];

function renderTextContent(text_content: string | null, content_format?: string): string {
  if (!text_content) return '';
  if (content_format === 'tiptap') {
    try {
      return generateHTML(JSON.parse(text_content), TIPTAP_EXTENSIONS);
    } catch {
      return '';
    }
  }
  return marked.parse(text_content, { async: false }) as string;
}

interface Lesson {
  id: string;
  title: string;
  lesson_type: 'video' | 'text' | 'audio' | 'slides' | 'quiz';
  content_url: string | null;
  text_content: string | null;
  content_format: 'markdown' | 'tiptap';
  duration_seconds: number | null;
  is_free_preview: boolean;
  order: number;
  course_id: string;
  quiz_content: {
    questions: Array<{
      id: string;
      questionText: string;
      questionType: 'multiple_choice' | 'true_false';
      options: Array<{ id: string; text: string }>;
      correctOptionId: string;
      explanation: string;
      citation?: string;
    }>;
    passingScore: number;
    attemptsAllowed: number;
  } | null;
  audio_chapters: Array<{ id: string; title: string; startTime: number; endTime: number }> | null;
  transcript_content: Array<{ startTime: number; endTime: number; text: string }> | null;
  map_content: {
    center: [number, number];
    zoom: number;
    markers?: Array<{ id: string; lat: number; lng: number; title: string; description?: string; color?: string }>;
    lines?: Array<{ id: string; coords: [number, number][]; title: string; color?: string; description?: string }>;
    polygons?: Array<{ id: string; coords: [number, number][]; title: string; color?: string; fillColor?: string; description?: string }>;
  } | null;
  documents: Array<{ id: string; url: string; title: string; description?: string; source_url?: string }> | null;
  podcast_links: Array<{ url: string; label?: string }> | null;
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
  quiz: HelpCircle,
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
  const [lessonAssignments, setLessonAssignments] = useState<{ id: string; title: string; due_date: string | null }[]>([]);
  const [currentUser, setCurrentUser] = useState<{ userId: string | null; isTeacher: boolean }>({ userId: null, isTeacher: false });

  const progressSaved = useRef(false);

  useEffect(() => {
    setLoading(true);
    setCompleted(false);
    setCrossroads(null);
    progressSaved.current = false;

    Promise.all([
      offlineFetch(`/api/academy/courses/${courseId}/lessons/${lessonId}`).then((r) => r.json()),
      offlineFetch(`/api/academy/courses/${courseId}`).then((r) => r.json()),
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

  useEffect(() => {
    offlineFetch(`/api/academy/courses/${courseId}/assignments?scope=lesson&lesson_id=${lessonId}`)
      .then((r) => r.json())
      .then((d) => setLessonAssignments(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [courseId, lessonId]);

  useEffect(() => {
    offlineFetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setCurrentUser({ userId: d.userId ?? null, isTeacher: !!d.isTeacher }))
      .catch(() => {});
  }, []);

  async function markComplete() {
    if (progressSaved.current) return;
    progressSaved.current = true;

    await offlineFetch(`/api/academy/courses/${courseId}/lessons/${lessonId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    });

    setCompleted(true);

    if (navigationMode === 'cyoa') {
      // Fetch CYOA crossroads options
      const r = await offlineFetch(`/api/academy/courses/${courseId}/lessons/${lessonId}/crossroads`);
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
      <div className="border-b border-gray-800 px-3 sm:px-6 py-3 flex items-center gap-3">
        <Link href={`/academy/${courseId}`} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition shrink-0">
          <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back to course</span><span className="sm:hidden">Back</span>
        </Link>
        <span className="text-gray-700 hidden sm:inline">|</span>
        <div className="flex items-center gap-1.5 text-gray-400 text-sm">
          <TypeIcon className="w-3.5 h-3.5" />
          <span className="capitalize hidden sm:inline">{lesson.lesson_type}</span>
        </div>
        <div className="flex-1" />
        {navigationMode === 'cyoa' && (
          <span className="flex items-center gap-1 text-fuchsia-400 text-xs shrink-0">
            <GitBranch className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Adventure Mode</span>
          </span>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <h1 className="text-xl sm:text-2xl font-bold mb-6">{lesson.title}</h1>

        {/* Content area */}
        {lesson.lesson_type === 'video' && lesson.content_url && (
          <VideoPlayer
            src={lesson.content_url}
            chapters={lesson.audio_chapters}
            transcript={lesson.transcript_content}
            onEnded={markComplete}
          />
        )}

        {lesson.lesson_type === 'audio' && lesson.content_url && (
          <AudioPlayer
            src={lesson.content_url}
            chapters={lesson.audio_chapters}
            transcript={lesson.transcript_content}
            onEnded={markComplete}
          />
        )}

        {lesson.podcast_links && lesson.podcast_links.length > 0 && (
          <PodcastLinks podcastLinks={lesson.podcast_links} />
        )}

        {lesson.lesson_type === 'slides' && lesson.content_url && (
          <div className="aspect-video bg-gray-900 rounded-xl sm:rounded-2xl overflow-hidden mb-6">
            <iframe
              src={lesson.content_url}
              className="w-full h-full"
              title={lesson.title}
              allowFullScreen
            />
          </div>
        )}

        {lesson.lesson_type === 'quiz' && lesson.quiz_content && (
          <QuizPlayer
            quizContent={lesson.quiz_content}
            courseId={courseId}
            lessonId={lessonId}
            onComplete={markComplete}
          />
        )}

        {lesson.text_content && (
          <div className="prose prose-invert prose-sm max-w-none mb-6 bg-gray-900 border border-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-8">
            <div dangerouslySetInnerHTML={{ __html: renderTextContent(lesson.text_content, lesson.content_format) }} />
          </div>
        )}

        {lesson.map_content && (
          <MapViewer mapContent={lesson.map_content} />
        )}

        {lesson.documents && lesson.documents.length > 0 && (
          <DocumentViewer documents={lesson.documents} />
        )}

        {/* Lesson-scoped assignments */}
        {lessonAssignments.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base font-bold mb-3 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-fuchsia-400" /> Assignments for this Lesson
            </h2>
            <div className="space-y-2">
              {lessonAssignments.map((a) => (
                <Link
                  key={a.id}
                  href={`/academy/${courseId}/assignments/${a.id}`}
                  className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 hover:border-fuchsia-700/50 transition group"
                >
                  <ClipboardList className="w-4 h-4 text-fuchsia-400 shrink-0" />
                  <span className="flex-1 text-sm text-gray-200 group-hover:text-white">{a.title}</span>
                  {a.due_date && (
                    <span className="text-xs text-gray-500 shrink-0">
                      Due {new Date(a.due_date).toLocaleDateString()}
                    </span>
                  )}
                  <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-fuchsia-400 transition shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Discussion */}
        {currentUser.userId && (
          <div className="mb-6">
            <LessonDiscussion
              courseId={courseId}
              lessonId={lessonId}
              currentUserId={currentUser.userId}
              isTeacher={currentUser.isTeacher}
            />
          </div>
        )}

        {/* Mark complete button (for text/slides lessons) */}
        {!completed && (lesson.lesson_type === 'text' || lesson.lesson_type === 'slides') && (
          <button
            type="button"
            onClick={markComplete}
            className="flex items-center gap-2 px-5 py-3 bg-fuchsia-600 text-white rounded-xl font-semibold hover:bg-fuchsia-700 transition mb-6 min-h-11 w-full sm:w-auto justify-center sm:justify-start"
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
                <h2 className="text-base sm:text-lg font-bold mb-4 flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-fuchsia-400" /> Choose Your Next Path
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {crossroads.map((opt) => (
                    <Link
                      key={opt.lesson_id}
                      href={`/academy/${courseId}/lessons/${opt.lesson_id}`}
                      className={`p-4 rounded-xl border transition text-left min-h-[72px] flex flex-col justify-center ${
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
                    className="p-4 rounded-xl border border-gray-800 bg-gray-900 hover:bg-gray-800 transition text-left min-h-[72px] flex flex-col justify-center"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1 opacity-60">Course Map</p>
                    <p className="font-semibold text-white text-sm">View All Lessons</p>
                  </Link>
                </div>
              </div>
            )}

            {/* Linear navigation */}
            {(navigationMode === 'linear' || crossroads === null) && (
              <div className="flex flex-wrap items-center gap-3">
                {adjacentLessons.prev && (
                  <Link
                    href={`/academy/${courseId}/lessons/${adjacentLessons.prev}`}
                    className="flex items-center gap-2 px-4 py-3 bg-gray-800 text-gray-300 rounded-xl text-sm hover:bg-gray-700 transition min-h-11"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </Link>
                )}
                {adjacentLessons.next ? (
                  <Link
                    href={`/academy/${courseId}/lessons/${adjacentLessons.next}`}
                    className="flex items-center gap-2 px-5 py-3 bg-fuchsia-600 text-white rounded-xl font-semibold hover:bg-fuchsia-700 transition min-h-11"
                  >
                    Next Lesson <ChevronRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <Link
                    href={`/academy/${courseId}`}
                    className="flex items-center gap-2 px-5 py-3 bg-green-700 text-white rounded-xl font-semibold hover:bg-green-800 transition min-h-11"
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
