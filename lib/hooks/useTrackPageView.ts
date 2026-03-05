'use client';

// lib/hooks/useTrackPageView.ts
// Lightweight client-side page view tracker.
// Usage: useTrackPageView('finance', '/dashboard/finance')

import { useEffect } from 'react';

export function useTrackPageView(module: string, detail?: string) {
  useEffect(() => {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module, action: 'page_view', detail }),
    }).catch(() => {});
  }, [module, detail]);
}
