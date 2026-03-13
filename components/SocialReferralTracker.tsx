'use client';

// components/SocialReferralTracker.tsx
// Silently detects social media referrers and logs them for admin analytics.
// Fires once per session per source+path combination (guarded by sessionStorage).
// Mounted in the root layout so it runs on every public page.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const SOCIAL_REFERRERS: Record<string, string> = {
  'twitter.com':   'twitter',
  't.co':          'twitter',
  'x.com':         'twitter',
  'linkedin.com':  'linkedin',
  'facebook.com':  'facebook',
  'fb.com':        'facebook',
  'instagram.com': 'instagram',
};

function detectSource(referrer: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace('www.', '');
    for (const [domain, source] of Object.entries(SOCIAL_REFERRERS)) {
      if (host === domain || host.endsWith(`.${domain}`)) return source;
    }
  } catch {
    // invalid URL — ignore
  }
  return null;
}

export default function SocialReferralTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const referrer = document.referrer;
    const source = detectSource(referrer);
    if (!source) return;

    // Only track public pages (skip dashboard/admin)
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) return;

    const sessionKey = `srt:${source}:${pathname}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');

    fetch('/api/track/social-referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, path: pathname }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
