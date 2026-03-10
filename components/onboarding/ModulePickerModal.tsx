'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as LucideIcons from 'lucide-react';
import { Sparkles, X } from 'lucide-react';
import type { ModuleTour } from '@/lib/onboarding/tour-steps';

interface ModulePickerModalProps {
  isOpen: boolean;
  tours: ModuleTour[];
  app: 'contractor' | 'lister';
  appName: string;
  onClose: () => void;
}

export default function ModulePickerModal({
  isOpen,
  tours,
  app,
  appName,
  onClose,
}: ModulePickerModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const accent = app === 'contractor' ? 'amber' : 'indigo';

  if (!isOpen) return null;

  const handlePickModule = async (tour: ModuleTour) => {
    setLoading(true);

    // Mark onboarding as started
    await fetch('/api/onboarding/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module_slug: tour.slug }),
    }).catch(() => {});

    // Seed all tours for this app
    await fetch('/api/onboarding/tours/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app }),
    }).catch(() => {});

    // Navigate to the module with tour=auto
    const baseRoutes: Record<string, Record<string, string>> = {
      contractor: {
        jobs: '/dashboard/contractor/jobs',
        offers: '/dashboard/contractor/assignments',
        board: '/dashboard/contractor/board',
        'rate-cards': '/dashboard/contractor/rate-cards',
        compare: '/dashboard/contractor/compare',
        reports: '/dashboard/contractor/reports',
        venues: '/dashboard/contractor/venues',
        cities: '/dashboard/contractor/cities',
        union: '/dashboard/contractor/union',
        invoices: '/dashboard/finance/invoices',
        finance: '/dashboard/finance/transactions',
        travel: '/dashboard/travel',
        equipment: '/dashboard/equipment',
        scan: '/dashboard/scan',
      },
      lister: {
        dashboard: '/dashboard/contractor/lister',
        jobs: '/dashboard/contractor/jobs',
        roster: '/dashboard/contractor/lister/roster',
        assign: '/dashboard/contractor/lister/assign',
        availability: '/dashboard/contractor/lister/availability',
        messages: '/dashboard/contractor/lister/messages',
        groups: '/dashboard/contractor/lister/groups',
        reports: '/dashboard/contractor/reports',
      },
    };

    const route = baseRoutes[app]?.[tour.slug] || '/dashboard/contractor';
    router.push(`${route}?tour=auto&module=${tour.slug}`);
  };

  const handleSkip = async () => {
    await fetch('/api/onboarding/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module_slug: null }),
    }).catch(() => {});

    // Seed tours anyway so badges appear
    await fetch('/api/onboarding/tours/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app }),
    }).catch(() => {});

    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-[9998]" aria-hidden="true" />
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Choose your first feature to explore"
      >
        <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 px-6 py-5 rounded-t-2xl flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className={`w-5 h-5 text-${accent}-400`} aria-hidden="true" />
                <span className={`text-sm font-semibold text-${accent}-400`}>
                  Welcome to {appName}
                </span>
              </div>
              <h2 className="text-xl font-bold text-neutral-100">
                Which feature would you like to explore first?
              </h2>
              <p className="text-sm text-neutral-400 mt-1">
                We&apos;ll give you a quick guided tour. You can explore the rest anytime.
              </p>
            </div>
            <button
              onClick={handleSkip}
              className="flex items-center justify-center min-h-11 min-w-11 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition shrink-0 ml-4"
              aria-label="Skip onboarding"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tour cards */}
          <div className="p-6 grid gap-3 sm:grid-cols-2">
            {tours.map((tour) => {
              const Icon = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[tour.icon] || LucideIcons.Sparkles;
              return (
                <button
                  key={tour.slug}
                  onClick={() => handlePickModule(tour)}
                  disabled={loading}
                  aria-label={`Start ${tour.name} tour`}
                  className={`text-left rounded-xl border border-neutral-800 bg-neutral-950 p-4 hover:border-${accent}-500/50 hover:bg-neutral-800/80 transition disabled:opacity-60 min-h-11`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg bg-${accent}-500/10 shrink-0`}>
                      <Icon className={`w-4 h-4 text-${accent}-400`} aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-200">{tour.name}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">{tour.description}</p>
                      <p className="text-xs text-neutral-500 mt-1">{tour.steps.length} steps</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-neutral-800 flex items-center justify-between">
            <p className="text-xs text-neutral-500">
              You can restart tours anytime from Settings
            </p>
            <button
              onClick={handleSkip}
              disabled={loading}
              className="text-sm text-neutral-500 hover:text-neutral-300 transition min-h-11 px-3"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
