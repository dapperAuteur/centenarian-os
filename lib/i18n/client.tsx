'use client';

// lib/i18n/client.tsx
// Client-side i18n context + hook. Server root layout hydrates this
// with the active locale and all namespace dictionaries; client
// components consume via useTranslations(namespace).
//
// Plan 31 Phase 1.

import { createContext, useCallback, useContext } from 'react';
import type { Locale } from './config';

type Dict = Record<string, string>;

export interface LocaleBundle {
  locale: Locale;
  dictionaries: Record<string, Dict>;
}

const LocaleContext = createContext<LocaleBundle | null>(null);

export function LocaleProvider({
  value,
  children,
}: {
  value: LocaleBundle;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Access the active locale from a client component. Returns null only
 * if the component renders outside the provider — which, for marketing
 * pages under the root layout, shouldn't happen.
 */
export function useLocale(): Locale | null {
  const ctx = useContext(LocaleContext);
  return ctx?.locale ?? null;
}

/**
 * Client equivalent of server.ts's getTranslations. Returns a `t(key)`
 * function. Missing keys fall back to the key string itself so a
 * stale-build render never shows `undefined`.
 */
export function useTranslations(namespace: string): (key: string) => string {
  const ctx = useContext(LocaleContext);
  const dict = ctx?.dictionaries?.[namespace] ?? {};
  // Keep the t function referentially stable across re-renders so
  // consumers can safely put it in dep arrays.
  return useCallback(
    (key: string) => dict[key] ?? key,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx?.locale, namespace],
  );
}

/**
 * Bundle a set of namespaces for the current locale. Called from the
 * server layout; passes the shape to LocaleProvider.
 */
export function buildLocaleBundle(
  locale: Locale,
  dictionaries: Record<string, Dict>,
): LocaleBundle {
  return { locale, dictionaries };
}
