import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import MedicalDisclaimer from '@/components/ui/MedicalDisclaimer';
import RiseWellnessCard from '@/components/ui/RiseWellnessCard';
import MuscleDiagram from '@/components/ui/MuscleDiagram';
import VideoEmbed from '@/components/ui/VideoEmbed';
import { exerciseSchema } from '@/lib/seo/json-ld';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `https://${process.env.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, '')}`
  : 'https://centenarianos.com';

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type ExerciseDetail = {
  id: string;
  name: string;
  category: string | null;
  difficulty: string | null;
  instructions: string | null;
  form_cues: string | null;
  primary_muscles: string[] | null;
  video_url: string | null;
  media_url: string | null;
};

async function getExerciseDetail(id: string): Promise<ExerciseDetail | null> {
  const db = getDb();

  // 1. Check user-created exercises (service role bypasses RLS — UUID is the access control)
  const { data: userEx } = await db
    .from('exercises')
    .select(
      'id, name, difficulty, instructions, form_cues, primary_muscles, video_url, media_url, exercise_categories(name)',
    )
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();

  if (userEx) {
    const raw = userEx as unknown as { exercise_categories?: { name: string }[] | null };
    const cat = Array.isArray(raw.exercise_categories) ? raw.exercise_categories[0] : raw.exercise_categories;
    return {
      id: (userEx as unknown as { id: string }).id,
      name: (userEx as unknown as { name: string }).name,
      category: cat?.name ?? null,
      difficulty: (userEx as unknown as { difficulty: string | null }).difficulty,
      instructions: (userEx as unknown as { instructions: string | null }).instructions,
      form_cues: (userEx as unknown as { form_cues: string | null }).form_cues,
      primary_muscles: (userEx as unknown as { primary_muscles: string[] | null }).primary_muscles,
      video_url: (userEx as unknown as { video_url: string | null }).video_url,
      media_url: (userEx as unknown as { media_url: string | null }).media_url,
    };
  }

  // 2. Fall back to system exercise library
  const { data: sysEx } = await db
    .from('system_exercises')
    .select('id, name, category, difficulty, instructions, form_cues, primary_muscles')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();

  if (sysEx) {
    return {
      id: (sysEx as { id: string }).id,
      name: (sysEx as { name: string }).name,
      category: (sysEx as { category: string }).category,
      difficulty: (sysEx as { difficulty: string }).difficulty,
      instructions: (sysEx as { instructions: string | null }).instructions,
      form_cues: (sysEx as { form_cues: string | null }).form_cues,
      primary_muscles: (sysEx as { primary_muscles: string[] | null }).primary_muscles,
      video_url: null,
      media_url: null,
    };
  }

  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ex = await getExerciseDetail(id);
  if (!ex) return { title: 'Exercise not found' };

  const ogImage = ex.media_url || `${SITE_URL}/og-default.png`;
  const muscles = ex.primary_muscles?.join(', ') ?? '';
  const description = muscles
    ? `${ex.name} — targets ${muscles}. Step-by-step instructions and muscle diagram.`
    : `${ex.name} — exercise guide with step-by-step instructions and muscle diagram.`;

  return {
    title: ex.name,
    description,
    openGraph: {
      title: `${ex.name} — CentenarianOS Exercise Library`,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: ex.name }],
      url: `${SITE_URL}/exercises/${id}`,
      type: 'website',
      siteName: 'CentenarianOS',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${ex.name} — CentenarianOS`,
      description,
      images: [ogImage],
    },
    alternates: { canonical: `${SITE_URL}/exercises/${id}` },
  };
}

export default async function ExerciseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const ex = await getExerciseDetail(id);
  if (!ex) redirect('/exercises');

  const primaryMuscles = ex.primary_muscles ?? [];

  const schema = exerciseSchema({
    id: ex.id,
    name: ex.name,
    instructions: ex.instructions,
    primary_muscles: primaryMuscles,
    difficulty: ex.difficulty,
    video_url: ex.video_url,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <SiteHeader />

      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href="/workouts"
            className="text-sm text-sky-600 hover:underline inline-flex items-center gap-1 min-h-11 py-2"
          >
            {from === 'workouts' ? '← Back to Workouts' : 'Workouts'}
          </Link>
          <span className="text-gray-300 text-sm" aria-hidden="true">·</span>
          <Link
            href="/exercises"
            className="text-sm text-sky-600 hover:underline inline-flex items-center gap-1 min-h-11 py-2"
          >
            Exercise Library
          </Link>
        </nav>

        <MedicalDisclaimer />

        {/* Header */}
        <header className="mt-6 mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {ex.category && (
              <span className="text-xs font-medium bg-sky-50 text-sky-700 px-2.5 py-1 rounded-full">
                {ex.category}
              </span>
            )}
            {ex.difficulty && (
              <span className="text-xs font-medium bg-fuchsia-50 text-fuchsia-700 px-2.5 py-1 rounded-full capitalize">
                {ex.difficulty}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{ex.name}</h1>
        </header>

        {/* Muscle Diagram */}
        {primaryMuscles.length > 0 && (
          <section
            aria-label="Muscles worked"
            className="bg-white border border-gray-200 rounded-xl p-5 mb-5"
          >
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Muscles Worked</h2>
            <MuscleDiagram primaryMuscles={primaryMuscles} size="xl" />
          </section>
        )}

        {/* Video */}
        {ex.video_url && (
          <section aria-label="Exercise video" className="mb-5">
            <VideoEmbed url={ex.video_url} title={ex.name} />
          </section>
        )}

        {/* Instructions */}
        {ex.instructions && (
          <section
            aria-label="Instructions"
            className="bg-white border border-gray-200 rounded-xl p-5 mb-5"
          >
            <h2 className="text-base font-semibold text-gray-900 mb-3">How to do it</h2>
            <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {ex.instructions}
            </div>
          </section>
        )}

        {/* Form cues */}
        {ex.form_cues && (
          <section
            aria-label="Form tips"
            className="bg-amber-50 border border-amber-100 rounded-xl p-5 mb-5"
          >
            <h2 className="text-sm font-semibold text-amber-800 mb-2">Form Tips</h2>
            <div className="text-sm text-amber-700 whitespace-pre-line leading-relaxed">
              {ex.form_cues}
            </div>
          </section>
        )}

        <div className="mb-8">
          <RiseWellnessCard />
        </div>

        {/* CTA */}
        <div className="bg-gray-900 rounded-2xl p-6 text-center mb-6">
          <h2 className="text-lg font-bold text-white mb-1">Track your progress with CentenarianOS</h2>
          <p className="text-sm text-gray-400 mb-4">
            Log this exercise, track PRs, and follow a structured longevity program.
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
