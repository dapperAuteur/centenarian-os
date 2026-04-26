import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import MedicalDisclaimer from '@/components/ui/MedicalDisclaimer';
import RiseWellnessCard from '@/components/ui/RiseWellnessCard';

export const revalidate = 60;

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `https://${process.env.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, '')}`
  : 'https://centenarianos.com';

export const metadata: Metadata = {
  title: 'Exercise Library',
  description:
    'Browse free exercises with step-by-step instructions, muscle diagrams, and video guides. No account required.',
  openGraph: {
    title: 'Exercise Library · CentenarianOS',
    description:
      'Browse free exercises with step-by-step instructions, muscle diagrams, and video guides.',
    url: `${SITE_URL}/exercises`,
    images: [{ url: `${SITE_URL}/og-default.png`, width: 1200, height: 630, alt: 'CentenarianOS Exercise Library' }],
    type: 'website',
    siteName: 'CentenarianOS',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Exercise Library · CentenarianOS',
    description: 'Browse free exercises with step-by-step instructions, muscle diagrams, and video guides.',
    images: [`${SITE_URL}/og-default.png`],
  },
  alternates: { canonical: `${SITE_URL}/exercises` },
};

const DIFFICULTY_OPTIONS = ['beginner', 'intermediate', 'advanced'];
const PAGE_SIZE = 18;

interface SearchParams {
  search?: string;
  difficulty?: string;
  muscle?: string;
  page?: string;
}

type SysExercise = {
  id: string;
  name: string;
  category: string;
  difficulty: string;
  primary_muscles: string[] | null;
  source: 'system';
};

type UserExercise = {
  id: string;
  name: string;
  category: string | null;
  difficulty: string | null;
  primary_muscles: string[] | null;
  like_count: number;
  source: 'user';
};

type DisplayExercise = SysExercise | UserExercise;

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const search = sp.search?.trim() ?? '';
  const difficulty = sp.difficulty ?? '';
  const muscle = sp.muscle?.trim() ?? '';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // --- System exercise library (always public) ---
  let sysQuery = db
    .from('system_exercises')
    .select('id, name, category, difficulty, primary_muscles')
    .eq('is_active', true);

  if (search) sysQuery = sysQuery.ilike('name', `%${search}%`);
  if (difficulty) sysQuery = sysQuery.eq('difficulty', difficulty);
  if (muscle) sysQuery = sysQuery.contains('primary_muscles', [muscle.toLowerCase()]);

  // --- User-created public exercises ---
  let userQuery = db
    .from('exercises')
    .select(
      'id, name, difficulty, primary_muscles, like_count, exercise_categories!inner(name)',
      { count: 'exact' },
    )
    .eq('visibility', 'public')
    .eq('is_active', true)
    .order('like_count', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (search) userQuery = userQuery.ilike('name', `%${search}%`);
  if (difficulty) userQuery = userQuery.eq('difficulty', difficulty);
  if (muscle) userQuery = userQuery.contains('primary_muscles', [muscle.toLowerCase()]);

  const [{ data: rawSys }, { data: rawUser, count: userCount }] = await Promise.all([
    sysQuery,
    userQuery,
  ]);

  const sysExercises: SysExercise[] = (rawSys ?? []).map((ex) => ({
    ...(ex as Omit<SysExercise, 'source'>),
    source: 'system' as const,
  }));

  const userExercises: UserExercise[] = (rawUser ?? []).map((ex) => {
    const raw = ex as unknown as { exercise_categories?: { name: string }[] | null };
    const cat = Array.isArray(raw.exercise_categories) ? raw.exercise_categories[0] : raw.exercise_categories;
    return {
      id: (ex as unknown as { id: string }).id,
      name: (ex as unknown as { name: string }).name,
      category: cat?.name ?? null,
      difficulty: (ex as { difficulty: string | null }).difficulty,
      primary_muscles: (ex as { primary_muscles: string[] | null }).primary_muscles,
      like_count: (ex as { like_count: number }).like_count,
      source: 'user' as const,
    };
  });

  const totalUserPages = Math.ceil((userCount ?? 0) / PAGE_SIZE);

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (difficulty) params.set('difficulty', difficulty);
    if (muscle) params.set('muscle', muscle);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/exercises${qs ? `?${qs}` : ''}`;
  }

  function ExerciseCard({ ex }: { ex: DisplayExercise }) {
    const muscles = ex.primary_muscles ?? [];
    return (
      <li role="listitem">
        <article className="bg-white rounded-xl border border-gray-200 hover:border-sky-300 hover:shadow-sm transition h-full">
          <Link
            href={`/exercises/${ex.id}`}
            className="flex flex-col gap-3 p-4 h-full min-h-22"
            aria-label={`View ${ex.name}`}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900 leading-snug">{ex.name}</h2>
              {ex.source === 'user' && ex.like_count > 0 && (
                <span className="text-xs text-gray-400 shrink-0" aria-label={`${ex.like_count} likes`}>
                  ♥ {ex.like_count}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-auto">
              {ex.category && (
                <span className="text-[11px] font-medium bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">
                  {ex.category}
                </span>
              )}
              {ex.difficulty && (
                <span className="text-[11px] font-medium bg-fuchsia-50 text-fuchsia-700 px-2 py-0.5 rounded-full capitalize">
                  {ex.difficulty}
                </span>
              )}
              {muscles.slice(0, 3).map((m) => (
                <span key={m} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                  {m}
                </span>
              ))}
            </div>
          </Link>
        </article>
      </li>
    );
  }

  const hasResults = sysExercises.length > 0 || userExercises.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <MedicalDisclaimer />

        <header className="mt-6 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Exercise Library</h1>
          <p className="mt-1 text-sm text-gray-600">
            Browse exercises with instructions, muscle diagrams, and video guides — free, no account needed.
          </p>
        </header>

        {/* Filters */}
        <form
          method="GET"
          action="/exercises"
          className="flex flex-col sm:flex-row gap-3 mb-6"
          role="search"
          aria-label="Filter exercises"
        >
          <div className="flex-1">
            <label htmlFor="ex-search" className="sr-only">Search exercises</label>
            <input
              id="ex-search"
              name="search"
              type="search"
              defaultValue={search}
              placeholder="Search exercises…"
              className="w-full min-h-11 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-400"
            />
          </div>
          <div>
            <label htmlFor="ex-diff" className="sr-only">Filter by difficulty</label>
            <select
              id="ex-diff"
              name="difficulty"
              defaultValue={difficulty}
              className="w-full sm:w-40 min-h-11 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
            >
              <option value="">All levels</option>
              {DIFFICULTY_OPTIONS.map((d) => (
                <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ex-muscle" className="sr-only">Filter by muscle group</label>
            <input
              id="ex-muscle"
              name="muscle"
              type="text"
              defaultValue={muscle}
              placeholder="Muscle (e.g. quads)"
              className="w-full sm:w-44 min-h-11 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-400"
            />
          </div>
          <button
            type="submit"
            className="min-h-11 px-5 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition"
          >
            Search
          </button>
        </form>

        {!hasResults && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-sm">No exercises match your filters.</p>
            <Link href="/exercises" className="text-sm text-sky-600 hover:underline mt-2 inline-block min-h-11 py-2">
              Clear filters
            </Link>
          </div>
        )}

        {/* System / Library exercises */}
        {sysExercises.length > 0 && (
          <section aria-label="Library exercises" className="mb-8">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Library{sysExercises.length > 0 && ` · ${sysExercises.length}`}
            </h2>
            <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sysExercises.map((ex) => <ExerciseCard key={ex.id} ex={ex} />)}
            </ul>
          </section>
        )}

        {/* User public exercises */}
        {userExercises.length > 0 && (
          <section aria-label="Community exercises" className="mb-8">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Community
            </h2>
            <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {userExercises.map((ex) => <ExerciseCard key={ex.id} ex={ex} />)}
            </ul>
          </section>
        )}

        {/* User exercises pagination */}
        {totalUserPages > 1 && (
          <nav aria-label="Exercises pagination" className="flex items-center justify-center gap-2 mb-10">
            {page > 1 && (
              <Link
                href={pageUrl(page - 1)}
                className="min-h-11 min-w-11 flex items-center justify-center border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition px-3"
                aria-label="Previous page"
              >
                ← Prev
              </Link>
            )}
            <span className="text-sm text-gray-600 px-3" aria-current="page">
              Page {page} of {totalUserPages}
            </span>
            {page < totalUserPages && (
              <Link
                href={pageUrl(page + 1)}
                className="min-h-11 min-w-11 flex items-center justify-center border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition px-3"
                aria-label="Next page"
              >
                Next →
              </Link>
            )}
          </nav>
        )}

        <div className="mb-10">
          <RiseWellnessCard />
        </div>

        {/* CTA */}
        <div className="bg-gray-900 rounded-2xl p-6 sm:p-8 text-center mb-6">
          <h2 className="text-xl font-bold text-white mb-2">Ready to track your progress?</h2>
          <p className="text-sm text-gray-400 mb-4">
            Log workouts, track PRs, and follow the Nomad Longevity OS program — free to start.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center min-h-11 px-6 py-2.5 bg-sky-500 text-white rounded-xl text-sm font-semibold hover:bg-sky-400 transition"
          >
            Get started free
          </Link>
        </div>
      </div>
    </div>
  );
}
