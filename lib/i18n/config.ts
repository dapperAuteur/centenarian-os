// lib/i18n/config.ts
// Single source of truth for supported locales and i18n behavior.
// Plan 31 Phase 1. Kept minimal — a next-intl migration later only has
// to remap these constants.

export const LOCALES = ['en', 'es'] as const;
export type Locale = typeof LOCALES[number];

export const DEFAULT_LOCALE: Locale = 'en';

// Cookie name for the user's chosen locale. Written by the server via
// /api/i18n/set-locale. Read everywhere we need to branch on language.
// 1-year TTL to survive browser clears reasonably.
export const LOCALE_COOKIE = 'centos_locale';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isSupportedLocale(v: string | null | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

/**
 * Parse Accept-Language header and pick the best supported match.
 * Fallback to DEFAULT_LOCALE when no support found.
 *
 * Intentionally simple — split on comma, strip quality scores, match
 * language prefix. Doesn't handle regional variants (es-MX vs es-ES)
 * because we only ship one Spanish variant.
 */
export function pickLocaleFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const parts = header.split(',').map((p) => p.split(';')[0].trim().toLowerCase());
  for (const part of parts) {
    const prefix = part.split('-')[0];
    if (isSupportedLocale(prefix)) return prefix;
  }
  return DEFAULT_LOCALE;
}

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
};
