'use client';

import Link from 'next/link';
import * as LucideIcons from 'lucide-react';
import type { FeatureConfig } from '@/lib/features/contractor-features';

interface FeatureCardProps {
  feature: FeatureConfig;
  app: 'contractor' | 'lister';
}

export default function FeatureCard({ feature, app }: FeatureCardProps) {
  const Icon = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[feature.icon] || LucideIcons.Sparkles;
  const accent = app === 'contractor' ? 'amber' : 'indigo';

  return (
    <Link
      href={`/features/${app}/${feature.slug}`}
      className="group block rounded-xl border border-neutral-800 bg-neutral-900 p-5 hover:border-neutral-700 hover:bg-neutral-800/80 transition"
    >
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg bg-${accent}-500/10 mb-3`}>
        <Icon className={`w-5 h-5 text-${accent}-400`} aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-neutral-100 mb-1 group-hover:text-white transition">
        {feature.title}
      </h3>
      <p className="text-sm text-neutral-400 leading-relaxed line-clamp-2">
        {feature.tagline}
      </p>
    </Link>
  );
}
