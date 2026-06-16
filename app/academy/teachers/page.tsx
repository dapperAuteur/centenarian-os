// app/academy/teachers/page.tsx
// Public teachers directory: every instructor with at least one published course, linking to
// their profile. Server component so it is SSR'd (good for crawlers) and exports metadata.

import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'Teachers',
  description: 'Browse the instructors teaching longevity, health, finance, and personal-optimization courses on CentenarianOS Academy.',
  path: '/academy/teachers',
  eyebrow: 'CentenarianOS Academy',
  ogTitle: 'Meet the Teachers',
  ogSubtitle: 'Instructors teaching longevity, health, finance, and personal optimization.',
});

function getDb() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

interface TeacherCard {
  id: string; username: string | null; display_name: string | null; avatar_url: string | null; bio: string | null; courseCount: number;
}

async function getTeachers(): Promise<TeacherCard[]> {
  const db = getDb();
  const { data: courses } = await db.from('courses').select('teacher_id').eq('is_published', true);
  const counts = new Map<string, number>();
  for (const c of courses ?? []) {
    if (c.teacher_id) counts.set(c.teacher_id, (counts.get(c.teacher_id) ?? 0) + 1);
  }
  const ids = [...counts.keys()];
  if (!ids.length) return [];
  const { data: profiles } = await db
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio')
    .in('id', ids);
  return (profiles ?? [])
    .filter((p) => p.username) // need a username to link to a profile
    .map((p) => ({ ...p, courseCount: counts.get(p.id) ?? 0 }))
    .sort((a, b) => b.courseCount - a.courseCount || (a.display_name || '').localeCompare(b.display_name || ''));
}

export default async function TeachersDirectoryPage() {
  const teachers = await getTeachers();
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10 text-white">
      <h1 className="text-3xl font-bold sm:text-4xl">Meet the teachers</h1>
      <p className="mt-3 text-gray-400 max-w-2xl">
        The instructors building courses on CentenarianOS Academy. Open a profile to see their courses.
      </p>

      {teachers.length === 0 ? (
        <p className="mt-10 text-gray-500">No teachers with published courses yet.</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teachers.map((t) => {
            const name = t.display_name || t.username || 'Instructor';
            return (
              <li key={t.id}>
                <Link
                  href={`/academy/teachers/${t.username}`}
                  className="flex items-start gap-4 rounded-2xl border border-gray-800 bg-gray-900 p-5 hover:bg-gray-800/70 transition min-h-11"
                >
                  {t.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-full shrink-0 bg-gradient-to-br from-fuchsia-600 to-sky-600 flex items-center justify-center text-lg font-bold">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{name}</p>
                    <p className="text-sky-400 text-xs mt-0.5">{t.courseCount} course{t.courseCount === 1 ? '' : 's'}</p>
                    {t.bio && <p className="text-gray-400 text-sm mt-2 line-clamp-3">{t.bio}</p>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
