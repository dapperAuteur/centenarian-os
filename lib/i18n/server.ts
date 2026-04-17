// lib/i18n/server.ts
// Server-side i18n helpers. Safe to call from server components, route
// handlers, and metadata generators. Caches dictionary loads per request
// via Node's module cache (JSON imports are idempotent).
//
// Plan 31 Phase 1.

import 'server-only';
import { cookies, headers } from 'next/headers';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isSupportedLocale,
  pickLocaleFromAcceptLanguage,
  type Locale,
} from './config';

// Dictionary files are imported at module boundary so Next bundles them
// statically. Adding a new namespace = adding a key here and the JSON.
import enCommon from '@/locales/en/common.json';
import enHome from '@/locales/en/home.json';
import enPricing from '@/locales/en/pricing.json';
import enBlog from '@/locales/en/blog.json';
import enAcademy from '@/locales/en/academy.json';
import esCommon from '@/locales/es/common.json';
import esHome from '@/locales/es/home.json';
import esPricing from '@/locales/es/pricing.json';
import esBlog from '@/locales/es/blog.json';
import esAcademy from '@/locales/es/academy.json';

type Dict = Record<string, string>;

export type Namespace = 'common' | 'home' | 'pricing' | 'blog' | 'academy';

const DICTS: Record<Locale, Record<Namespace, Dict>> = {
  en: { common: enCommon, home: enHome, pricing: enPricing, blog: enBlog, academy: enAcademy },
  es: { common: esCommon, home: esHome, pricing: esPricing, blog: esBlog, academy: esAcademy },
};

/**
 * Resolve the active locale for the current request. Priority:
 *   1. `x-locale` request header (set by middleware from URL prefix
 *      like /es/pricing — Phase 2).
 *   2. The LOCALE_COOKIE if set and supported.
 *   3. Accept-Language header.
 *   4. DEFAULT_LOCALE.
 *
 * The URL prefix wins over the cookie so a shared link like
 * centenarianos.com/es/pricing renders in Spanish regardless of the
 * recipient's saved preference — the sender's explicit intent beats
 * the recipient's default.
 */
export async function getLocale(): Promise<Locale> {
  const headerStore = await headers();
  const fromHeader = headerStore.get('x-locale');
  if (isSupportedLocale(fromHeader)) return fromHeader;

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isSupportedLocale(fromCookie)) return fromCookie;

  return pickLocaleFromAcceptLanguage(headerStore.get('accept-language'));
}

/**
 * Fetch the translation dictionary for a namespace at the active locale.
 * Returns a `t` function: `t('hero.title')` → string. Missing keys fall
 * back to the English dictionary, then to the key itself as last resort
 * so a missing translation never renders as `undefined`.
 */
export async function getTranslations(namespace: Namespace): Promise<(key: string) => string> {
  const locale = await getLocale();
  return makeT(locale, namespace);
}

/** Synchronous variant when the caller already has the locale. */
export function makeT(locale: Locale, namespace: Namespace): (key: string) => string {
  const primary = DICTS[locale]?.[namespace] ?? {};
  const fallback = DICTS[DEFAULT_LOCALE]?.[namespace] ?? {};
  return (key: string) => primary[key] ?? fallback[key] ?? key;
}

export async function getDictionary(namespace: Namespace): Promise<Dict> {
  const locale = await getLocale();
  return {
    ...(DICTS[DEFAULT_LOCALE]?.[namespace] ?? {}),
    ...(DICTS[locale]?.[namespace] ?? {}),
  };
}
