'use client';

// components/ui/PageViewTracker.tsx
// Embeddable client component for tracking page views in server-rendered pages.
// Fires once on mount with path, referrer, and UTM params.

import { useEffect } from 'react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

export default function PageViewTracker({ path }: { path: string }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    offlineFetch('/api/track/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        referrer: document.referrer || null,
        utm_source: params.get('utm_source') || null,
        utm_medium: params.get('utm_medium') || null,
        utm_campaign: params.get('utm_campaign') || null,
      }),
    }).catch(() => {});
  }, [path]);

  return null;
}
