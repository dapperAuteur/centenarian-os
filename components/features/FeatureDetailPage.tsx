'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as LucideIcons from 'lucide-react';
import { ArrowLeft, CheckCircle2, Play, Loader2 } from 'lucide-react';
import type { FeatureConfig } from '@/lib/features/contractor-features';
import VideoEmbed from '@/components/ui/VideoEmbed';

interface FeatureDetailPageProps {
  feature: FeatureConfig;
  app: 'contractor' | 'lister';
  appName: string;
  relatedFeatures: FeatureConfig[];
}

export default function FeatureDetailPage({
  feature,
  app,
  appName,
  relatedFeatures,
}: FeatureDetailPageProps) {
  const router = useRouter();
  const [demoLoading, setDemoLoading] = useState(false);
  const Icon = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[feature.icon] || LucideIcons.Sparkles;
  const accent = app === 'contractor' ? 'amber' : 'indigo';

  const handleDemoLogin = async () => {
    setDemoLoading(true);

    // Track feature page CTA click (fire-and-forget, no auth needed)
    fetch('/api/onboarding/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app,
        module_slug: feature.slug,
        event_type: 'cta_demo_click',
      }),
    }).catch(() => {});

    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `feature/${app}/${feature.slug}`,
          redirect: `${feature.demoRedirect}?tour=auto`,
        }),
      });
      const data = await res.json();
      if (data.ok && data.redirect) {
        router.push(data.redirect);
      } else {
        setDemoLoading(false);
      }
    } catch {
      setDemoLoading(false);
    }
  };

  const handleSignupClick = () => {
    fetch('/api/onboarding/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app,
        module_slug: feature.slug,
        event_type: 'cta_signup_click',
      }),
    }).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Nav bar */}
      <nav className="sticky top-0 z-50 bg-neutral-950/90 backdrop-blur border-b border-neutral-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-14">
          <Link
            href={`/features/${app}`}
            className="flex items-center gap-2 text-neutral-400 hover:text-neutral-200 transition text-sm font-medium min-h-11"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            All {appName} Features
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <div className="mb-12">
          <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-${accent}-500/10 mb-5`}>
            <Icon className={`w-7 h-7 text-${accent}-400`} aria-hidden="true" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-neutral-100 mb-3">
            {feature.title}
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl">
            {feature.tagline}
          </p>
        </div>

        {/* Description */}
        <div className="mb-12">
          <p className="text-neutral-300 leading-relaxed text-base max-w-3xl">
            {feature.description}
          </p>
        </div>

        {/* Highlights */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-neutral-100 mb-4">What you can do</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {feature.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle2 className={`w-5 h-5 text-${accent}-400 shrink-0 mt-0.5`} aria-hidden="true" />
                <span className="text-sm text-neutral-300">{h}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 mb-16">
          <button
            onClick={handleDemoLogin}
            disabled={demoLoading}
            className={`flex items-center justify-center gap-2 px-6 py-3 bg-${accent}-600 hover:bg-${accent}-500 text-white rounded-xl text-sm font-semibold transition min-h-11 disabled:opacity-60`}
          >
            {demoLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="w-4 h-4" aria-hidden="true" />
            )}
            {demoLoading ? 'Logging in…' : 'Try It Now — Demo Login'}
          </button>
          <Link
            href={`/signup?from=feature-${app}-${feature.slug}`}
            onClick={handleSignupClick}
            className="flex items-center justify-center gap-2 px-6 py-3 border border-neutral-700 text-neutral-200 hover:bg-neutral-800 rounded-xl text-sm font-semibold transition min-h-11"
          >
            Create Your Account
          </Link>
        </div>

        {/* Related features */}
        {relatedFeatures.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-neutral-100 mb-4">Related features</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedFeatures.map((rf) => {
                const RfIcon = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[rf.icon] || LucideIcons.Sparkles;
                return (
                  <Link
                    key={rf.slug}
                    href={`/features/${app}/${rf.slug}`}
                    className="group flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-700 hover:bg-neutral-800/80 transition"
                  >
                    <RfIcon className={`w-5 h-5 text-${accent}-400 shrink-0 mt-0.5`} aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-neutral-200 group-hover:text-white transition">
                        {rf.title}
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5">{rf.tagline}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
