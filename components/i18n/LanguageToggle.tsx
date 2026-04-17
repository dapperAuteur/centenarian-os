'use client';

// components/i18n/LanguageToggle.tsx
// Dropdown switch between EN / ES. POSTs the chosen locale to the
// set-locale cookie endpoint, then reloads the current page so every
// server component picks up the new dictionary.
//
// Plan 31 Phase 1. Appears in the site header for marketing surfaces;
// authenticated surfaces come in a later phase.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Check } from 'lucide-react';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/config';

interface Props {
  currentLocale: Locale;
  className?: string;
}

export default function LanguageToggle({ currentLocale, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handlePick(locale: Locale) {
    if (locale === currentLocale) { setOpen(false); return; }
    startTransition(async () => {
      const res = await fetch('/api/i18n/set-locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      if (!res.ok) {
        // Fall back to an alert — toast provider isn't guaranteed on
        // marketing pages.
        alert('Could not change language. Try again.');
        return;
      }
      setOpen(false);
      router.refresh();
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
