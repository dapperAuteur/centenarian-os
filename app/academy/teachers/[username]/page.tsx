'use client';

// app/academy/teachers/[username]/page.tsx
// Public page showing a teacher's profile and all their published courses.
// Students can like and save courses from here.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen, Heart, Bookmark, Loader2, ChevronLeft,
  GitBranch, Star,
} from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface TeacherProfile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  category: string | null;
  price: number;
  price_type: string;
  navigation_mode: string;
  like_count: number;
  liked: boolean;
  saved: boolean;
}

const PRICE_LABEL: Record<string, string> = {
  free: 'Free',
  one_time: 'One-time',
  subscription: 'Monthly',
};

export default function TeacherCoursesPage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [togglingLike, setTogglingLike] = useState<string | null>(null);
  const [togglingSave, setTogglingSave] = useState<string | null>(null);

  useEffect(() => {
    offlineFetch(`/api/academy/teachers/${username}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setProfile(d.profile);
        setCourses(d.courses ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [username]);

  async function toggleLike(courseId: string) {
    setTogglingLike(courseId);
    const r = await offlineFetch(`/api/academy/courses/${courseId}/like`, { method: 'POST' });
    if (r.ok) {
      const { liked, like_count } = await r.json();
      setCourses((prev) => prev.map((c) => c.id === courseId ? { ...c, liked, like_count } : c));
    }
    setTogglingLike(null);
  }

  async function toggleSave(courseId: string) {
    setTogglingSave(courseId);
    const r = await offlineFetch(`/api/academy/courses/${courseId}/save`, { method: 'POST' });
    if (r.ok) {
      const { saved } = await r.json();
      setCourses((prev) => prev.map((c) => c.id === courseId ? { ...c, saved } : c));
    }
    setTogglingSave(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">
        Teacher not found.
      </div>
    );
  }

  const displayName = profile.display_name || profile.username;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <Link href="/academy" className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition">
          <ChevronLeft className="w-4 h-4" /> Academy
        </Link>
        <span className="text-gray-700">·</span>
        <Link href="/" className="text-fuchsia-400 font-semibold text-sm">CentenarianOS</Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Teacher profile header */}
        <div className="flex items-start gap-6 mb-12">
          <div className="w-20 h-20 rounded-full bg-fuchsia-900/40 border-2 border-fuchsia-700 flex items-center justify-center shrink-0 overflow-hidden">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-fuchsia-300">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-white">{displayName}</h1>
            <p className="text-gray-400 text-sm mt-1">@{profile.username}</p>
            {profile.bio && (
              <p className="text-gray-300 mt-3 leading-relaxed max-w-xl">{profile.bio}</p>
            )}
            <div className="flex items-center gap-2 mt-4">
              <BookOpen className="w-4 h-4 text-fuchsia-400" />
              <span className="text-sm text-gray-400">
                {courses.length} published course{courses.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Courses grid */}
        {courses.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No courses published yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div
                key={course.id}
                className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col hover:border-gray-700 transition"
              >
                {/* Cover image */}
                <Link href={`/academy/${course.id}`} className="block aspect-video bg-gray-800 shrink-0 overflow-hidden">
                  {course.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={course.cover_image_url}
                      alt={course.title}
                      className="w-full h-full object-cover hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-10 h-10 text-gray-700" />
                    </div>
                  )}
                </Link>

                {/* Content */}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Link href={`/academy/${course.id}`} className="font-semibold text-white hover:text-fuchsia-300 transition leading-snug line-clamp-2">
                      {course.title}
                    </Link>
                    {course.navigation_mode === 'cyoa' && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-fuchsia-900/40 text-fuchsia-400 text-xs rounded shrink-0">
                        <GitBranch className="w-2.5 h-2.5" /> CYOA
                      </span>
                    )}
                  </div>

                  {course.description && (
                    <p className="text-gray-400 text-sm line-clamp-2 leading-relaxed mb-3">
                      {course.description}
                    </p>
                  )}

                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-800">
                    <span className="text-sm font-medium text-fuchsia-400">
                      {course.price_type === 'free' ? 'Free' : `$${course.price} · ${PRICE_LABEL[course.price_type]}`}
                    </span>

                    {/* Like + Save */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleLike(course.id)}
                        disabled={togglingLike === course.id}
                        title={course.liked ? 'Unlike' : 'Like'}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
                      >
                        <Heart
                          className={`w-4 h-4 transition ${course.liked ? 'fill-red-500 text-red-500' : 'text-gray-500'}`}
                        />
                        <span className="text-xs text-gray-500">{course.like_count}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSave(course.id)}
                        disabled={togglingSave === course.id}
                        title={course.saved ? 'Remove from saved' : 'Save course'}
                        className="p-1.5 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
                      >
                        <Bookmark
                          className={`w-4 h-4 transition ${course.saved ? 'fill-fuchsia-500 text-fuchsia-500' : 'text-gray-500'}`}
                        />
                      </button>
                    </div>
                  </div>

                  {course.category && (
                    <div className="mt-2">
                      <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
                        {course.category}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Total likes for social proof */}
        {courses.length > 0 && (
          <div className="mt-8 flex items-center gap-2 text-gray-600 text-sm">
            <Star className="w-4 h-4" />
            <span>
              {courses.reduce((sum, c) => sum + c.like_count, 0)} total likes across all courses
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
