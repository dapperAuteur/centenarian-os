'use client';

// lib/hooks/useTrackPageView.ts
// Lightweight client-side page view tracker.
// Usage: useTrackPageView('finance', '/dashboard/finance')

import { useEffect } from 'react';

export function useTrackPageView(module: string, detail?: string) {
  useEffect(() => {
    // Usage event (module-level analytics)
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module, action: 'page_view', detail }),
    }).catch(() => {});

    // Page view (traffic analytics with referrer + UTM)
    const params = new URLSearchParams(window.location.search);
    fetch('/api/track/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: detail || window.location.pathname,
        referrer: document.referrer || null,
        utm_source: params.get('utm_source') || null,
        utm_medium: params.get('utm_medium') || null,
        utm_campaign: params.get('utm_campaign') || null,
      }),
    }).catch(() => {});
  }, [module, detail]);
}
