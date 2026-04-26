import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import MedicalDisclaimer from '@/components/ui/MedicalDisclaimer';
import RiseWellnessCard from '@/components/ui/RiseWellnessCard';
import PublicWorkoutCard, { type PublicWorkoutTemplate } from '@/components/workouts/PublicWorkoutCard';
import { workoutTemplateSchema } from '@/lib/seo/json-ld';

export const revalidate = 60;

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `https://${process.env.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, '')}`
  : 'https://centenarianos.com';

export const metadata: Metadata = {
  title: 'Workout Library',
  description:
    'Browse free workout templates: hotel workouts, gym sessions, AM priming, PM recovery, and more. No account needed.',
  openGraph: {
    title: 'Workout Library · CentenarianOS',
    description:
      'Browse free workout templates: hotel workouts, gym sessions, AM priming, PM recovery, and more.',
    url: `${SITE_URL}/workouts`,
    images: [{ url: `${SITE_URL}/og-default.png`, width: 1200, height: 630, alt: 'CentenarianOS Workout Library' }],
    type: 'website',
    siteName: 'CentenarianOS',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Workout Library · CentenarianOS',
    description:
      'Browse free workout templates: hotel workouts, gym sessions, AM priming, PM recovery, and more.',
    images: [`${SITE_URL}/og-default.png`],
  },
  alternates: { canonical: `${SITE_URL}/workouts` },
};

const CATEGORY_OPTIONS = ['AM', 'PM', 'WORKOUT_HOTEL', 'WORKOUT_GYM', 'friction', 'general'];
const CATEGORY_LABELS: Record<string, string> = {
  AM: 'AM Priming',
  PM: 'PM Recovery',
  WORKOUT_HOTEL: 'Hotel Workout',
  WORKOUT_GYM: 'Full Gym',
  friction: 'Friction Protocol',
  general: 'General',
};

const PAGE_SIZE = 18;

interface SearchParams {
  search?: string;
  category?: string;
  sort?: string;
  page?: string;
}

type WorkoutTemplate = PublicWorkoutTemplate;

export default async function WorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const search = sp.search?.trim() ?? '';
  const category = sp.category ?? '';
  const sort = sp.sort ?? 'popular';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const sortCol =
    sort === 'newest' ? 'created_at' : sort === 'done' ? 'done_count' : 'like_count';

  let query = db
    .from('workout_templates')
    .select(
      'id, name, description, category, estimated_duration_min, done_count, like_count, workout_template_exercises(exercise_id, name, sets, reps, weight_lbs, duration_sec, rpe, sort_order, phase, notes)',
      { count: 'exact' },
    )
    .eq('visibility', 'public')
    .order(sortCol, { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (search) query = query.ilike('name', `%${search}%`);
  if (category) query = query.eq('category', category);

  const { data: templates, count } = await query;
  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const ldSchema = {
    '@context': 'https://schema.org',
    '@graph': (templates as WorkoutTemplate[] | null ?? []).map((wt) =>
      workoutTemplateSchema({
        id: wt.id,
        name: wt.name,
        description: wt.description,
        category: wt.category,
        estimated_duration_min: wt.estimated_duration_min,
      }),
    ),
  };

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (sort !== 'popular') params.set('sort', sort);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/workouts${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldSchema) }}
      />

      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <MedicalDisclaimer />

        <header className="mt-6 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Workout Library</h1>
          <p className="mt-1 text-sm text-gray-600">
            Browse workout templates — hotel workouts, gym sessions, AM priming, PM recovery,
            and more. Free, no account needed.
          </p>
        </header>

        {/* Filters */}
        <form
          method="GET"
          action="/workouts"
          className="flex flex-col sm:flex-row gap-3 mb-6"
          role="search"
          aria-label="Filter workouts"
        >
          <div className="flex-1">
            <label htmlFor="wt-search" className="sr-only">
              Search workouts
            </label>
            <input
              id="wt-search"
              name="search"
              type="search"
              defaultValue={search}
              placeholder="Search workouts…"
              className="w-full min-h-11 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-400"
            />
          </div>
          <div>
            <label htmlFor="wt-cat" className="sr-only">
              Filter by category
            </label>
            <select
              id="wt-cat"
              name="category"
              defaultValue={category}
              className="w-full sm:w-44 min-h-11 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
            >
              <option value="">All categories</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="wt-sort" className="sr-only">
              Sort by
            </label>
            <select
              id="wt-sort"
              name="sort"
              defaultValue={sort}
              className="w-full sm:w-36 min-h-11 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
            >
              <option value="popular">Most Popular</option>
              <option value="done">Most Done</option>
              <option value="newest">Newest</option>
            </select>
          </div>
          <button
            type="submit"
            className="min-h-11 px-5 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition"
          >
            Search
          </button>
        </form>

        <p className="text-xs text-gray-500 mb-4" aria-live="polite">
          {total === 0
            ? 'No workouts found.'
            : `${total} workout${total === 1 ? '' : 's'} found`}
        </p>

        {/* Workout cards */}
        {templates && templates.length > 0 ? (
          <ul
            role="list"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8"
          >
            {(templates as WorkoutTemplate[]).map((wt) => (
              <li key={wt.id} role="listitem">
                <PublicWorkoutCard wt={wt} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <p className="text-sm">No workouts match your filters.</p>
            <Link
              href="/workouts"
              className="text-sm text-sky-600 hover:underline mt-2 inline-block min-h-11 py-2"
            >
              Clear filters
            </Link>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav
            aria-label="Workouts pagination"
            className="flex items-center justify-center gap-2 mb-10"
          >
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
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
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

        {/* Rise Wellness */}
        <div className="mb-10">
          <RiseWellnessCard />
        </div>

        {/* CTA */}
        <div className="bg-gray-900 rounded-2xl p-6 sm:p-8 text-center mb-6">
          <h2 className="text-xl font-bold text-white mb-2">
            Follow the Nomad Longevity OS program
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Structured AM priming, PM recovery, hotel &amp; gym workouts — designed for
            long-term health.
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
