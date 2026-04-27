'use client';

// app/dashboard/teaching/page.tsx
// Teacher dashboard overview.

import { useEffect, useState } from 'react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import Link from 'next/link';
import { BookOpen, Users, DollarSign, Plus, ArrowRight, CreditCard, Layers, Globe, Share2, Copy, Check, ExternalLink } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  is_published: boolean;
  price: number;
  price_type: string;
  created_at: string;
}

interface TeacherStats {
  courses: Course[];
  total_enrollments: number;
}

export default function TeachingDashboard() {
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectStatus, setConnectStatus] = useState<{ connected: boolean; onboarded: boolean } | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [siteOrigin, setSiteOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      offlineFetch('/api/academy/courses?mine=true').then((r) => r.json()),
      offlineFetch('/api/teacher/connect').then((r) => r.json()),
      offlineFetch('/api/auth/me').then((r) => r.json()),
    ]).then(([coursesData, connectData, meData]) => {
      setStats({
        courses: Array.isArray(coursesData) ? coursesData : [],
        total_enrollments: 0,
      });
      setConnectStatus(connectData);
      setUsername(meData?.username ?? null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Prefer the env-configured production URL for sharing (so links work even
  // when viewed on a preview deployment); fall back to the current origin
  // for local dev where the env var may be unset.
  useEffect(() => {
    const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (envUrl) {
      setSiteOrigin(envUrl.replace(/\/$/, ''));
    } else if (typeof window !== 'undefined') {
      setSiteOrigin(window.location.origin);
    }
  }, []);

  const publicProfileUrl = username && siteOrigin ? `${siteOrigin}/academy/teachers/${username}` : null;

  async function copyProfileUrl() {
    if (!publicProfileUrl) return;
    try {
      await navigator.clipboard.writeText(publicProfileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can reject in insecure contexts or when the user
      // denies permission. Fall back to selecting the input so the user
      // can copy manually.
      const input = document.getElementById('teacher-profile-url') as HTMLInputElement | null;
      input?.select();
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const courses = stats?.courses ?? [];
  const publishedCount = courses.filter((c) => c.is_published).length;

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Teaching Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your courses, students, and payouts.</p>
        </div>
        <Link
          href="/dashboard/teaching/courses/new"
          className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition"
        >
          <Plus className="w-4 h-4" />
          New Course
        </Link>
      </div>

      {/* Public profile share card — shown when the teacher has a username
          set. Surfacing this here saves them from typing the URL by hand
          when promoting their courses on social media or in DMs. */}
      {publicProfileUrl ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5 mb-6">
          <div className="flex items-start gap-3 mb-3">
            <Share2 className="w-4 h-4 text-fuchsia-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Your public teacher profile</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Share this link to send people directly to your courses. Featured courses show up first.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <label htmlFor="teacher-profile-url" className="sr-only">Public profile URL</label>
            <input
              id="teacher-profile-url"
              type="text"
              readOnly
              value={publicProfileUrl}
              onFocus={(e) => e.target.select()}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white font-mono focus:outline-none focus:border-fuchsia-500 min-h-11 min-w-0"
            />
            <button
              type="button"
              onClick={copyProfileUrl}
              className="flex items-center justify-center gap-1.5 px-4 min-h-11 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700 transition shrink-0"
              aria-label={copied ? 'Link copied to clipboard' : 'Copy profile link to clipboard'}
            >
              {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <a
              href={publicProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-4 min-h-11 bg-gray-800 border border-gray-700 text-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-700 transition shrink-0"
              aria-label="Open public profile in a new tab"
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              Open
            </a>
          </div>
        </div>
      ) : !loading && !username ? (
        <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-4 sm:p-5 mb-6 flex items-start gap-3">
          <Share2 className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-300">Set a username to get a shareable profile link</p>
            <p className="text-xs text-gray-500 mt-1">
              Without a username, your courses can&apos;t live at <code className="text-gray-400">/academy/teachers/&hellip;</code>. Set one in your <Link href="/settings" className="text-fuchsia-400 hover:text-fuchsia-300 underline">profile settings</Link>.
            </p>
          </div>
        </div>
      ) : null}

      {/* Stripe Connect banner if not onboarded */}
      {connectStatus && !connectStatus.onboarded && (
        <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-amber-300 font-semibold text-sm">Connect your bank account</p>
              <p className="text-amber-500 text-xs mt-0.5">Complete Stripe onboarding to receive course payments.</p>
            </div>
          </div>
          <Link
            href="/dashboard/teaching/payouts"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition"
          >
            Set Up Payouts <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Courses', value: courses.length, icon: BookOpen },
          { label: 'Published', value: publishedCount, icon: BookOpen },
          { label: 'Enrollments', value: stats?.total_enrollments ?? 0, icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <Icon className="w-5 h-5 text-fuchsia-400 mb-3" />
            <p className="text-3xl font-bold text-white">{value}</p>
            <p className="text-gray-500 text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          href="/dashboard/teaching/learning-paths"
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 hover:border-fuchsia-700 text-gray-300 hover:text-fuchsia-300 rounded-xl text-sm font-medium transition"
        >
          <Layers className="w-4 h-4" />
          Learning Paths
        </Link>
        <Link
          href="/dashboard/teaching/students"
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 hover:border-fuchsia-700 text-gray-300 hover:text-fuchsia-300 rounded-xl text-sm font-medium transition"
        >
          <Users className="w-4 h-4" />
          Students
        </Link>
        <Link
          href="/dashboard/teaching/live"
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 hover:border-fuchsia-700 text-gray-300 hover:text-fuchsia-300 rounded-xl text-sm font-medium transition"
        >
          Live Sessions
        </Link>
        <Link
          href="/academy/explore"
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 hover:border-fuchsia-700 text-gray-300 hover:text-fuchsia-300 rounded-xl text-sm font-medium transition"
        >
          <Globe className="w-4 h-4" />
          BVC Episode Map
        </Link>
      </div>

      {/* Course list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Your Courses</h2>
          <Link href="/dashboard/teaching/courses" className="text-fuchsia-400 hover:text-fuchsia-300 text-sm">
            View all
          </Link>
        </div>

        {courses.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-12 text-center">
            <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-700" />
            <p className="text-gray-500 mb-4">No courses yet.</p>
            <Link
              href="/dashboard/teaching/courses/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-700 transition"
            >
              <Plus className="w-4 h-4" /> Create Your First Course
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {courses.slice(0, 5).map((course) => (
              <Link
                key={course.id}
                href={`/dashboard/teaching/courses/${course.id}`}
                className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 hover:bg-gray-800/60 transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{course.title}</p>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {course.price_type === 'free' ? 'Free' : `$${course.price} · ${course.price_type}`}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  course.is_published
                    ? 'bg-green-900/30 text-green-400'
                    : 'bg-gray-800 text-gray-500'
                }`}>
                  {course.is_published ? 'Published' : 'Draft'}
                </span>
                <DollarSign className="w-4 h-4 text-gray-600" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
