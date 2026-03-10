'use client';

// app/academy/paths/page.tsx
// Browse all published learning paths + AI-personalized recommendations for logged-in students.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Layers, BookOpen, Sparkles, Lock, ChevronRight } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';


interface CourseStub {
  id: string;
  title: string;
  category?: string;
  cover_image_url?: string;
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
  is_published: boolean;
  teacher_id: string;
  profiles?: { username: string; display_name?: string };
  learning_path_courses?: PathCourseRow[];
  reason?: string | null;
}

function getTheme() {
  return {
    pageBg: '',
    heading: 'text-gray-900',
    body: 'text-gray-600',
    secondary: 'text-gray-500',
    tertiary: 'text-gray-500',
    accent: 'text-fuchsia-600',
    accentLight: 'text-fuchsia-500',
    accentHover: 'hover:text-fuchsia-700',
    cardBg: 'bg-white border-gray-200 hover:border-fuchsia-300 hover:shadow-md',
    cardHeadingHover: 'group-hover:text-fuchsia-700',
    coverBg: 'bg-gray-100',
    iconPlaceholder: 'text-gray-400',
    numberBg: 'bg-gray-100 text-gray-500',
    reasonBg: 'text-fuchsia-600 bg-fuchsia-50 border-fuchsia-100',
    ctaBg: 'bg-fuchsia-50 border-fuchsia-100 text-fuchsia-700',
    spinnerBorder: 'border-fuchsia-500',
    spinnerBorderLg: 'border-fuchsia-600',
    linkColor: 'text-fuchsia-600 hover:text-fuchsia-700',
  };
}

type Theme = ReturnType<typeof getTheme>;

function PathCard({ path, theme }: { path: LearningPath; theme: Theme }) {
  const courses = (path.learning_path_courses || [])
    .sort((a, b) => a.order_index - b.order_index)
    .map((lpc) => lpc.courses)
    .filter(Boolean);

  return (
    <Link
      href={`/academy/paths/${path.id}`}
      className={`group block rounded-2xl border transition overflow-hidden ${theme.cardBg}`}
    >
      {/* Cover */}
      <div className={`aspect-video overflow-hidden ${theme.coverBg}`}>
        {path.cover_image_url ? (
          <Image
            src={path.cover_image_url}
            alt={path.title}
            width={640}
            height={360}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Layers className={`w-10 h-10 ${theme.iconPlaceholder}`} />
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className={`font-semibold text-lg leading-snug mb-1 transition ${theme.heading} ${theme.cardHeadingHover}`}>
          {path.title}
        </h3>
        {path.description && (
          <p className={`text-sm line-clamp-2 mb-3 ${theme.secondary}`}>{path.description}</p>
        )}
        {path.reason && (
          <p className={`text-xs border rounded-lg px-3 py-1.5 mb-3 leading-relaxed ${theme.reasonBg}`}>
            {path.reason}
          </p>
        )}
        <div className={`flex items-center justify-between text-xs ${theme.tertiary}`}>
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            {courses.length} course{courses.length !== 1 ? 's' : ''}
          </span>
          {path.profiles && (
            <span>by {path.profiles.display_name || path.profiles.username}</span>
          )}
        </div>
        {/* Mini course list */}
        {courses.length > 0 && (
          <div className="mt-3 space-y-1">
            {courses.slice(0, 3).map((c, i) => (
              <div key={c.id} className={`flex items-center gap-2 text-xs ${theme.secondary}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center font-medium shrink-0 ${theme.numberBg}`}>
                  {i + 1}
                </span>
                <span className="truncate">{c.title}</span>
              </div>
            ))}
            {courses.length > 3 && (
              <p className={`text-xs pl-6 ${theme.tertiary}`}>+{courses.length - 3} more</p>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function LearningPathsPage() {
  const theme = getTheme();
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [recommended, setRecommended] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [recLoading, setRecLoading] = useState(false);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [pathsRes, meRes] = await Promise.all([
        offlineFetch('/api/academy/paths'),
        offlineFetch('/api/auth/me'),
      ]);
      if (pathsRes.ok) {
        const { data } = await pathsRes.json() as { data: LearningPath[] };
        setPaths(data || []);
      }
      if (meRes.ok) {
        const me = await meRes.json() as { isAdmin?: boolean; userId?: string };
        if (me.userId) {
          setIsAuth(true);
          loadRecommendations();
        }
      }
      setLoading(false);
    };

    const loadRecommendations = async () => {
      setRecLoading(true);
      const res = await offlineFetch('/api/academy/paths/recommend');
      if (res.ok) {
        const { recommendations } = await res.json() as { recommendations: LearningPath[] };
        setRecommended(recommendations || []);
      }
      setRecLoading(false);
    };

    load();
  }, []);

  return (
    <div className={`min-h-screen ${theme.pageBg}`}>
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
        {/* Header */}
        <div>
          <h1 className={`text-4xl font-bold flex items-center gap-3 ${theme.heading}`}>
            <Layers className={`w-9 h-9 ${theme.accent}`} />
            Learning Paths
          </h1>
          <p className={`mt-2 max-w-2xl ${theme.secondary}`}>
            Structured sequences of courses that build expertise in a topic.
            Complete a path to earn a credential and add it to your profile.
          </p>
        </div>

        {/* AI Recommendations (logged-in only) */}
        {isAuth && (
          <section>
            <h2 className={`text-xl font-semibold mb-1 flex items-center gap-2 ${theme.heading}`}>
              <Sparkles className={`w-5 h-5 ${theme.accentLight}`} />
              Recommended for You
            </h2>
            <p className={`text-sm mb-5 ${theme.secondary}`}>
              Personalized based on your enrollment history.
            </p>
            {recLoading ? (
              <div className={`flex items-center gap-2 text-sm ${theme.tertiary}`}>
                <div className={`animate-spin h-4 w-4 border-2 border-t-transparent rounded-full ${theme.spinnerBorder}`} />
                Personalizing recommendations…
              </div>
            ) : recommended.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {recommended.map((p) => <PathCard key={p.id} path={p} theme={theme} />)}
              </div>
            ) : (
              <p className={`text-sm ${theme.tertiary}`}>
                Enroll in a course to get personalized path recommendations.
              </p>
            )}
          </section>
        )}

        {/* Login CTA for guests */}
        {!isAuth && !loading && (
          <div className={`flex items-center gap-3 border rounded-xl px-5 py-4 text-sm ${theme.ctaBg}`}>
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              <Link href="/login" className="font-semibold underline">Sign in</Link>{' '}
              to get AI-personalized path recommendations based on your learning history.
            </span>
          </div>
        )}

        {/* All paths */}
        <section>
          <h2 className={`text-xl font-semibold mb-5 ${theme.heading}`}>All Learning Paths</h2>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className={`animate-spin h-8 w-8 border-4 border-t-transparent rounded-full ${theme.spinnerBorderLg}`} />
            </div>
          ) : paths.length === 0 ? (
            <p className={`text-sm ${theme.tertiary}`}>No learning paths published yet. Check back soon.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {paths.map((p) => <PathCard key={p.id} path={p} theme={theme} />)}
            </div>
          )}
        </section>

        {/* CTA to academy */}
        <div className={`flex items-center gap-2 text-sm ${theme.secondary}`}>
          <Link
            href="/academy"
            className={`flex items-center gap-1.5 font-medium transition ${theme.linkColor}`}
          >
            Browse individual courses
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
