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
import esCommon from '@/locales/es/common.json';
import esHome from '@/locales/es/home.json';
import esPricing from '@/locales/es/pricing.json';

type Dict = Record<string, string>;

export type Namespace = 'common' | 'home' | 'pricing';

const DICTS: Record<Locale, Record<Namespace, Dict>> = {
  en: { common: enCommon, home: enHome, pricing: enPricing },
  es: { common: esCommon, home: esHome, pricing: esPricing },
};

/**
 * Resolve the active locale for the current request. Priority:
 *   1. The LOCALE_COOKIE if set and supported.
 *   2. Accept-Language header.
 *   3. DEFAULT_LOCALE.
 */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isSupportedLocale(fromCookie)) return fromCookie;

  const headerStore = await headers();
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
