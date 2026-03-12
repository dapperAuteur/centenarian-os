// app/features/[slug]/page.tsx
// Individual module landing page — public, SEO-friendly.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { MODULES, getModuleBySlug, getRelatedModules } from '@/lib/features/modules';
import SiteFooter from '@/components/ui/SiteFooter';
import DemoLoginButton from '@/components/ui/DemoLoginButton';
import PageViewTracker from '@/components/ui/PageViewTracker';
import type { Metadata } from 'next';

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return MODULES.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const mod = getModuleBySlug(slug);
  if (!mod) return {};
  return {
    title: `${mod.name} — CentenarianOS`,
    description: mod.description,
  };
}

export default async function ModuleLandingPage({ params }: Params) {
  const { slug } = await params;
  const mod = getModuleBySlug(slug);
  if (!mod) notFound();

  const related = getRelatedModules(mod.relatedSlugs);

  return (
    <div className="min-h-screen bg-white">
      <PageViewTracker path={`/features/${slug}`} />
      {/* Minimal Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <nav className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-linear-to-br from-fuchsia-500 to-sky-500 rounded-lg shrink-0" />
            <span className="text-lg font-bold text-gray-900">CentenarianOS</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/features" className="text-sm text-gray-600 hover:text-gray-900 font-medium hidden sm:block">
              All Features
            </Link>
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium hidden sm:block">
              Login
            </Link>
            <Link href="/signup" className="text-sm text-gray-600 hover:text-gray-900 font-medium hidden sm:block">
              Sign Up
            </Link>
            <Link
              href="/pricing"
              className="px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition font-medium text-sm"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className={`bg-linear-to-br ${mod.bgGradient} text-white`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <Link
            href="/features"
            className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white mb-6 transition"
          >
            <ArrowLeft className="w-4 h-4" /> All Features
          </Link>

          <div className="flex items-center gap-4 mb-4">
            <mod.Icon className="w-12 h-12 sm:w-14 sm:h-14 text-white/90" />
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold">{mod.name}</h1>
          </div>

          <p className="text-xl sm:text-2xl text-white/90 font-medium mb-3 max-w-2xl">
            {mod.tagline}
          </p>
          <p className="text-base sm:text-lg text-white/75 max-w-2xl">
            {mod.description}
          </p>

          {/* Quick features */}
          <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
            {mod.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-white/90">
                <Check className="w-5 h-5 shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Highlights */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-10 text-center">
          How It Works
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {mod.highlights.map((h, i) => (
            <div key={h.title} className="flex gap-4">
              <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm bg-linear-to-br ${mod.bgGradient}`}>
                {i + 1}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg mb-1">{h.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{h.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 sm:p-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            Ready to try {mod.name}?
          </h2>
          <p className="text-gray-600 mb-6 max-w-lg mx-auto">
            Explore {mod.name} with a pre-loaded demo account — no sign-up needed.
            Or start your own account with full access to every module.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <DemoLoginButton from={`feature:${mod.slug}`} redirect={mod.dashboardPath} label={`Try ${mod.name} Demo`} />
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center px-6 py-3 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition font-semibold"
            >
              View Plans <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
            {mod.tutorialSlug && (
              <Link
                href="/academy"
                className="inline-flex items-center justify-center px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition font-semibold"
              >
                Free Tutorial Course
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Related Modules */}
      {related.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Related Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/features/${r.slug}`}
                className={`bg-white rounded-xl border-t-4 ${r.color} shadow-sm p-5 hover:shadow-md transition`}
              >
                <r.Icon className={`w-8 h-8 ${r.iconColor} mb-2`} />
                <h3 className="font-bold text-gray-900 mb-1">{r.name}</h3>
                <p className="text-sm text-gray-500 line-clamp-2">{r.tagline}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <SiteFooter theme="light" />
    </div>
  );
}
