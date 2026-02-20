'use client';

// app/academy/page.tsx
// Course catalog — browse and search all published courses.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, BookOpen, Play, Lock } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  category: string | null;
  price: number;
  price_type: 'free' | 'one_time' | 'subscription';
  navigation_mode: 'linear' | 'cyoa';
  profiles: { username: string; display_name: string | null } | null;
}

const PRICE_LABEL: Record<string, string> = {
  free: 'Free',
  one_time: 'One-time',
  subscription: 'Subscription',
};

export default function AcademyPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    setLoading(true);
    fetch(`/api/academy/courses?${params}`)
      .then((r) => r.json())
      .then((d) => { setCourses(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [q, category]);

  const categories = Array.from(new Set(courses.map((c) => c.category).filter(Boolean))) as string[];

  return (
    <div className="text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-3">Centenarian Academy</h1>
          <p className="text-gray-400 text-lg">Expert-led courses to help you live longer, stronger.</p>
        </div>

        {/* Search + filter */}
        <div className="dark-input flex flex-col sm:flex-row gap-3 mb-10">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search courses…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-400 focus:outline-none focus:border-fuchsia-500"
            />
          </div>
          {categories.length > 0 && (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-fuchsia-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p>No courses found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/academy/${course.id}`}
                className="group bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-fuchsia-700/50 transition"
              >
                {/* Cover image */}
                <div className="aspect-video bg-gray-800 relative overflow-hidden">
                  {course.cover_image_url ? (
                    <img
                      src={course.cover_image_url}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-10 h-10 text-gray-700" />
                    </div>
                  )}
                  {course.navigation_mode === 'cyoa' && (
                    <span className="absolute top-2 right-2 px-2 py-1 bg-fuchsia-600/90 text-white text-xs font-bold rounded-full">
                      CYOA
                    </span>
                  )}
                </div>

                <div className="p-5">
                  {course.category && (
                    <p className="text-fuchsia-400 text-xs font-semibold uppercase tracking-wide mb-2">{course.category}</p>
                  )}
                  <h2 className="font-bold text-white mb-1 line-clamp-2">{course.title}</h2>
                  {course.description && (
                    <p className="text-gray-500 text-sm line-clamp-2 mb-3">{course.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mb-3">
                    by {course.profiles?.display_name ?? course.profiles?.username ?? 'Instructor'}
                  </p>

                  <div className="flex items-center justify-between">
                    <div>
                      {course.price_type === 'free' ? (
                        <span className="flex items-center gap-1 text-green-400 font-semibold text-sm">
                          <Play className="w-3 h-3" /> Free
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-white font-semibold text-sm">
                          <Lock className="w-3 h-3 text-gray-400" />
                          ${course.price}
                          <span className="text-gray-500 font-normal">· {PRICE_LABEL[course.price_type]}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
