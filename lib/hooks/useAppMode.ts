// lib/hooks/useAppMode.ts
// Detects whether the app is running in contractor or lister subdomain mode.

'use client';

import { useMemo } from 'react';

export type AppMode = 'main' | 'contractor' | 'lister';

export function useAppMode(): AppMode {
  return useMemo(() => {
    if (typeof window === 'undefined') return 'main';
    const hostname = window.location.hostname;
    if (hostname.startsWith('lister.')) return 'lister';
    if (hostname.startsWith('contractor.')) return 'contractor';
    return 'main';
  }, []);
}
