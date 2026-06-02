'use client';

// components/marketing/MarketingBanner.tsx
// Global marketing/promo banner shown on user-facing pages (public + dashboard).
// Hidden on /admin paths and for lifetime members. Fetches the first active
// banner matching the user's subscription tier via /api/banners?tier=X.
// Anonymous visitors get tier='free'. Dismissals persist in localStorage keyed
// by banner ID, so a new banner (different ID) re-shows even after a dismissal.
// Ported from contractor-os.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { useSubscription } from '@/lib/hooks/useSubscription';

interface Banner {
  id: string;
  title: string;
  body: string;
  cta_text: string;
  cta_url: string;
}

const EXCLUDED_PATH_PREFIXES = ['/admin', '/api'];

export default function MarketingBanner() {
  const pathname = usePathname();
  const { status, loading: subLoading } = useSubscription();
  const [banner, setBanner] = useState<Banner | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const excluded = EXCLUDED_PATH_PREFIXES.some((p) => pathname.startsWith(p));
  // Lifetime members already paid — never show upgrade banners. While the
  // subscription hook is still loading, default to not showing (avoids a flash
  // before we know the user is lifetime).
  const eligible = !excluded && !subLoading && status !== 'lifetime';

  useEffect(() => {
    if (!eligible) {
      setBanner(null);
      return;
    }
    const tier = status === 'monthly' ? 'monthly' : 'free';
    fetch(`/api/banners?tier=${tier}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Banner | null) => {
        if (!data) {
          setBanner(null);
          return;
        }
        const isDismissed =
          typeof window !== 'undefined' &&
          window.localStorage.getItem(`marketing-banner-dismissed-${data.id}`) === '1';
        if (isDismissed) {
          setDismissed(true);
          setBanner(null);
        } else {
          setBanner(data);
          setDismissed(false);
        }
      })
      .catch(() => setBanner(null));
  }, [eligible, status]);

  if (!banner || dismissed) return null;

  function handleDismiss() {
    if (!banner) return;
    try {
      window.localStorage.setItem(`marketing-banner-dismissed-${banner.id}`, '1');
    } catch {
      /* private mode — accept the loss */
    }
    setDismissed(true);
  }

  return (
    <div
      role="region"
      aria-label="Promotional banner"
      className="sticky top-0 z-40 w-full bg-fuchsia-600 text-white shadow-sm"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 text-sm">
        <div className="flex-1 min-w-0">
          <span className="font-semibold">{banner.title}</span>
          <span className="mx-2 hidden sm:inline">·</span>
          <span className="block sm:inline text-fuchsia-50">{banner.body}</span>
        </div>
        <Link
          href={banner.cta_url}
          className="shrink-0 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-fuchsia-700 hover:bg-fuchsia-50 transition min-h-11 flex items-center"
        >
          {banner.cta_text}
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss banner"
          className="shrink-0 flex items-center justify-center min-h-11 min-w-11 rounded-md text-fuchsia-100 hover:bg-fuchsia-700 transition"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
