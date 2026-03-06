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

function PathCard({ path }: { path: LearningPath }) {
  const courses = (path.learning_path_courses || [])
    .sort((a, b) => a.order_index - b.order_index)
    .map((lpc) => lpc.courses)
    .filter(Boolean);

  return (
    <Link
      href={`/academy/paths/${path.id}`}
      className="group block bg-white rounded-2xl border border-gray-200 hover:border-fuchsia-300 hover:shadow-md transition overflow-hidden"
    >
      {/* Cover */}
      <div className="aspect-video bg-gray-100 overflow-hidden">
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
            <Layers className="w-10 h-10 text-gray-300" />
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="font-semibold text-gray-900 text-lg leading-snug mb-1 group-hover:text-fuchsia-700 transition">
          {path.title}
        </h3>
        {path.description && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">{path.description}</p>
        )}
        {path.reason && (
          <p className="text-xs text-fuchsia-600 bg-fuchsia-50 border border-fuchsia-100 rounded-lg px-3 py-1.5 mb-3 leading-relaxed">
            {path.reason}
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-gray-400">
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
              <div key={c.id} className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-4 h-4 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center font-medium shrink-0">
                  {i + 1}
                </span>
                <span className="truncate">{c.title}</span>
              </div>
            ))}
            {courses.length > 3 && (
              <p className="text-xs text-gray-400 pl-6">+{courses.length - 3} more</p>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function LearningPathsPage() {
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
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
          <Layers className="w-9 h-9 text-fuchsia-600" />
          Learning Paths
        </h1>
        <p className="text-gray-500 mt-2 max-w-2xl">
          Structured sequences of courses that build expertise in a topic.
          Complete a path to earn a credential and add it to your profile.
        </p>
      </div>

      {/* AI Recommendations (logged-in only) */}
      {isAuth && (
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-fuchsia-500" />
            Recommended for You
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            Personalized based on your enrollment history.
          </p>
          {recLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="animate-spin h-4 w-4 border-2 border-fuchsia-500 border-t-transparent rounded-full" />
              Personalizing recommendations…
            </div>
          ) : recommended.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {recommended.map((p) => <PathCard key={p.id} path={p} />)}
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Enroll in a course to get personalized path recommendations.
            </p>
          )}
        </section>
      )}

      {/* Login CTA for guests */}
      {!isAuth && !loading && (
        <div className="flex items-center gap-3 bg-fuchsia-50 border border-fuchsia-100 rounded-xl px-5 py-4 text-sm text-fuchsia-700">
          <Lock className="w-4 h-4 shrink-0" />
          <span>
            <Link href="/login" className="font-semibold underline">Sign in</Link>{' '}
            to get AI-personalized path recommendations based on your learning history.
          </span>
        </div>
      )}

      {/* All paths */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-5">All Learning Paths</h2>
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin h-8 w-8 border-4 border-fuchsia-600 border-t-transparent rounded-full" />
          </div>
        ) : paths.length === 0 ? (
          <p className="text-gray-400 text-sm">No learning paths published yet. Check back soon.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {paths.map((p) => <PathCard key={p.id} path={p} />)}
          </div>
        )}
      </section>

      {/* CTA to academy */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link
          href="/academy"
          className="flex items-center gap-1.5 text-fuchsia-600 hover:text-fuchsia-700 font-medium transition"
        >
          Browse individual courses
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
