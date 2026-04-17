'use client';

// lib/i18n/client.tsx
// Client-side i18n context + hook. Server root layout hydrates this
// with the active locale and all namespace dictionaries; client
// components consume via useTranslations(namespace).
//
// Plan 31 Phase 1.

import { createContext, useCallback, useContext } from 'react';
import type { Locale, LocaleBundle } from './config';

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

// Note on LocaleBundle construction: the server root layout builds
// the bundle inline as a plain object literal and passes it to
// <LocaleProvider value={...}>. Exporting a helper from this module
// would make it client-only (every export of a 'use client' module
// is), which the server component can't invoke.
