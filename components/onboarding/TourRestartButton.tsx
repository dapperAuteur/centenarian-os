'use client';

import { useState } from 'react';
import { RotateCcw, Loader2 } from 'lucide-react';

interface TourRestartButtonProps {
  /** Reset all tours for a specific app, or a single tour if moduleSlug provided */
  app?: 'main';
  moduleSlug?: string;
  label?: string;
  onReset?: () => void;
}

export default function TourRestartButton({
  app,
  moduleSlug,
  label,
  onReset,
}: TourRestartButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    if (!confirm(moduleSlug
      ? 'Restart this module tour?'
      : 'Restart all module tours? Sparkle badges will reappear on every feature.'
    )) return;

    setLoading(true);

    try {
      if (moduleSlug) {
        await fetch(`/api/onboarding/tours/${moduleSlug}/restart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ app: app || 'main' }),
        });

        fetch('/api/onboarding/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            app: app || 'main',
            module_slug: moduleSlug,
            event_type: 'tour_restarted',
          }),
        }).catch(() => {});
      } else {
        await fetch('/api/onboarding/tours/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ app }),
        });
      }

      setDone(true);
      onReset?.();
      window.dispatchEvent(new Event('tours-reset'));
      setTimeout(() => setDone(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleReset}
      disabled={loading}
      className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition min-h-11 px-2 disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : (
        <RotateCcw className="w-4 h-4" aria-hidden="true" />
      )}
      {done ? 'Done!' : (label || 'Re-take Tours')}
    </button>
  );
}
