// app/features/page.tsx
// Features index — lists all modules with links to individual landing pages.

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { MODULES } from '@/lib/features/modules';
import SiteFooter from '@/components/ui/SiteFooter';
import DemoLoginButton from '@/components/ui/DemoLoginButton';
import PageViewTracker from '@/components/ui/PageViewTracker';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Features — CentenarianOS',
  description: 'Explore every module in CentenarianOS: planning, nutrition, finance, health metrics, workouts, travel, and more.',
};

export default function FeaturesIndexPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      <PageViewTracker path="/features" />
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-linear-to-br from-fuchsia-500 to-sky-500 rounded-lg shrink-0" />
            <span className="text-lg font-bold text-gray-900">CentenarianOS</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/academy" className="text-sm text-gray-600 hover:text-gray-900 font-medium hidden sm:block">
              Academy
            </Link>
            <Link href="/blog" className="text-sm text-gray-600 hover:text-gray-900 font-medium hidden sm:block">
              Blog
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-8 sm:pb-12 text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
          Everything You Need,{' '}
          <span className="text-transparent bg-clip-text bg-linear-to-r from-fuchsia-600 to-sky-600">One Platform</span>
        </h1>
        <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto">
          {MODULES.length} integrated modules for planning, health, finance, fitness, learning, and more.
          Every feature works together — no data silos.
        </p>
      </section>

      {/* Module Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {MODULES.map((mod) => (
            <Link
              key={mod.slug}
              href={`/features/${mod.slug}`}
              className={`group bg-white rounded-2xl shadow-sm border-t-4 ${mod.color} p-6 hover:shadow-lg transition`}
            >
              <mod.Icon className={`w-10 h-10 ${mod.iconColor} mb-3`} />
              <h2 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-fuchsia-600 transition">
                {mod.name}
              </h2>
              <p className="text-sm text-gray-500 mb-3">{mod.tagline}</p>
              <ul className="space-y-1.5 text-sm text-gray-600 mb-4">
                {mod.features.map((f) => (
                  <li key={f} className="flex items-start">
                    <span className={`${mod.checkColor} mr-2 shrink-0`} aria-hidden="true">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <span className="inline-flex items-center text-sm font-semibold text-fuchsia-600 group-hover:gap-2 transition-all">
                Learn more <ArrowRight className="w-4 h-4 ml-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="bg-linear-to-r from-fuchsia-600 to-sky-600 rounded-2xl p-8 sm:p-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            All Features, One Subscription
          </h2>
          <p className="text-white/90 mb-6 max-w-xl mx-auto">
            Every module is included. No per-feature pricing, no add-ons.
            Try the demo first, or start your own account today.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <DemoLoginButton from="feature:index" label="Try the Demo" />
            <Link
              href="/pricing"
              className="inline-flex items-center px-8 py-4 bg-white text-fuchsia-600 rounded-lg hover:bg-gray-100 transition font-bold text-lg"
            >
              View Plans <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter theme="light" />
    </div>
  );
}
