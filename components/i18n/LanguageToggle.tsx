'use client';

// components/i18n/LanguageToggle.tsx
// Dropdown switch between EN / ES. Phase 2: navigates to the
// locale-prefixed URL so the address bar reflects the choice and
// shareable links carry the language intent. Middleware strips the
// prefix server-side and sets the x-locale header + cookie.
//
// English is the default locale and served at canonical (un-prefixed)
// URLs. Switching TO English strips any /es/ prefix. Switching TO
// Spanish prepends /es/.

import { useState, useTransition } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Globe, Check } from 'lucide-react';
import { LOCALES, LOCALE_LABELS, DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config';

interface Props {
  currentLocale: Locale;
  className?: string;
}

const LOCALE_PREFIX_RE = new RegExp(`^/(${LOCALES.join('|')})(/|$)`);

function buildLocalizedPath(pathname: string, targetLocale: Locale): string {
  // Strip any existing locale prefix so we start from canonical.
  const canonical = pathname.replace(LOCALE_PREFIX_RE, '/');
  // Default locale keeps canonical URLs; non-default prepends prefix.
  if (targetLocale === DEFAULT_LOCALE) return canonical === '' ? '/' : canonical;
  const prefixed = `/${targetLocale}${canonical}`;
  return prefixed === `/${targetLocale}` ? `/${targetLocale}` : prefixed;
}

export default function LanguageToggle({ currentLocale, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handlePick(locale: Locale) {
    if (locale === currentLocale) { setOpen(false); return; }
    startTransition(async () => {
      // 1. Set the cookie server-side first. This matters when navigating
      //    to the canonical (un-prefixed) English URL — without the cookie
      //    update, a sticky `centos_locale=es` would keep rendering Spanish.
      try {
        await fetch('/api/i18n/set-locale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale }),
        });
      } catch {
        // Non-fatal — fall through to the navigation and let middleware
        // set the cookie from the URL prefix (works for ES, not EN).
      }
      // 2. Full-page navigation. `router.push()` would use Next.js's
      //    client-side Router Cache which serves the STALE root-layout
      //    RSC payload (cached from the previous locale) — so dict
      //    changes wouldn't show until a manual refresh.
      //    `window.location.assign()` bypasses the cache and forces
      //    a fresh server render with the new cookie + header state.
      const newPath = buildLocalizedPath(pathname ?? '/', locale);
      const qs = searchParams?.toString();
      window.location.assign(qs ? `${newPath}?${qs}` : newPath);
    });
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Change language (currently ${LOCALE_LABELS[currentLocale]})`}
        className="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition disabled:opacity-50"
      >
        <Globe className="w-4 h-4" aria-hidden="true" />
        <span className="uppercase font-semibold tracking-wide text-xs">{currentLocale}</span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50 min-w-[140px]"
        >
          {LOCALES.map((l) => (
            <li key={l}>
              <button
                type="button"
                role="option"
                aria-selected={l === currentLocale}
                onClick={() => handlePick(l)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 min-h-11 transition ${
                  l === currentLocale ? 'bg-sky-50 text-sky-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{LOCALE_LABELS[l]}</span>
                {l === currentLocale && <Check className="w-4 h-4" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
