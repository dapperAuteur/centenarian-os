'use client';

// components/onboarding/TourRunner.tsx
// Detects ?tour=auto query param and launches the TourOverlay for the current module.

import { useState, useEffect } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import TourOverlay from './TourOverlay';
import { getTour } from '@/lib/onboarding/tour-steps';
import type { TourStep } from '@/lib/onboarding/tour-steps';

interface TourRunnerProps {
  app: 'main';
  onToursChanged?: () => void;
}

/** Map pathname segments to tour slugs */
function slugFromPathname(pathname: string): string | null {
  const prefix = '/dashboard';
  const rest = pathname.replace(prefix, '').replace(/^\//, '').split('/')[0];
  if (!rest) return null;
  return rest;
}

export default function TourRunner({ app, onToursChanged }: TourRunnerProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [activeTour, setActiveTour] = useState<{ steps: TourStep[]; slug: string } | null>(null);

  useEffect(() => {
    if (searchParams.get('tour') !== 'auto') return;

    // Determine module slug from ?module= param or pathname
    const moduleParam = searchParams.get('module');
    const slug = moduleParam || slugFromPathname(pathname);
    if (!slug) return;

    const tour = getTour(app, slug);
    if (!tour || tour.steps.length === 0) return;

    setActiveTour({ steps: tour.steps, slug });

    // Remove ?tour=auto from URL without navigation
    const params = new URLSearchParams(searchParams.toString());
    params.delete('tour');
    params.delete('module');
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [searchParams, pathname, app, router]);

  if (!activeTour) return null;

  return (
    <TourOverlay
      steps={activeTour.steps}
      app={app}
      moduleSlug={activeTour.slug}
      onComplete={() => {
        setActiveTour(null);
        onToursChanged?.();
      }}
      onExit={() => {
        setActiveTour(null);
        onToursChanged?.();
      }}
    />
  );
}
