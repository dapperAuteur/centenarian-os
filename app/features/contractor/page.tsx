import Link from 'next/link';
import { HardHat, ArrowLeft } from 'lucide-react';
import FeatureCard from '@/components/features/FeatureCard';
import {
  CONTRACTOR_FEATURES,
  CONTRACTOR_FEATURE_GROUPS,
} from '@/lib/features/contractor-features';

export const metadata = {
  title: 'JobHub Features — CentenarianOS',
  description:
    'Explore every feature of JobHub, the contractor management app. Track jobs, manage rates, log travel, handle invoicing, and more.',
};

export default function ContractorFeaturesPage() {
  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-neutral-950/90 backdrop-blur border-b border-neutral-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <Link
            href="/"
            className="flex items-center gap-2 text-neutral-400 hover:text-neutral-200 transition text-sm font-medium min-h-11"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Home
          </Link>
          <Link
            href="/features/lister"
            className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition min-h-11 flex items-center"
          >
            CrewOps Features →
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <div className="mb-12">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 mb-5">
            <HardHat className="w-7 h-7 text-amber-400" aria-hidden="true" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-neutral-100 mb-3">
            JobHub Features
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl">
            Everything a contractor needs to manage gigs, track earnings, and run their business — from assignment through payment.
          </p>
        </div>

        {/* Feature groups */}
        {CONTRACTOR_FEATURE_GROUPS.map((group) => {
          const features = group.slugs
            .map((s) => CONTRACTOR_FEATURES.find((f) => f.slug === s))
            .filter(Boolean) as typeof CONTRACTOR_FEATURES;

          return (
            <div key={group.label} className="mb-10">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-4">
                {group.label}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {features.map((f) => (
                  <FeatureCard key={f.slug} feature={f} app="contractor" />
                ))}
              </div>
            </div>
          );
        })}

        {/* CTA */}
        <div className="mt-12 flex flex-col sm:flex-row gap-3">
          <Link
            href="/signup?from=features-contractor"
            className="flex items-center justify-center px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold transition min-h-11"
          >
            Get Started
          </Link>
          <Link
            href="/features/lister"
            className="flex items-center justify-center px-6 py-3 border border-neutral-700 text-neutral-200 hover:bg-neutral-800 rounded-xl text-sm font-semibold transition min-h-11"
          >
            Explore CrewOps (Lister) Features
          </Link>
        </div>
      </div>
    </div>
  );
}
