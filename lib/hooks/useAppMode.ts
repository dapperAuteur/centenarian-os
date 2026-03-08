// lib/hooks/useAppMode.ts
// Detects whether the app is running in contractor subdomain mode.

'use client';

import { useMemo } from 'react';

export type AppMode = 'main' | 'contractor';

export function useAppMode(): AppMode {
  return useMemo(() => {
    if (typeof window === 'undefined') return 'main';
    const hostname = window.location.hostname;
    return hostname.startsWith('contractor.') ? 'contractor' : 'main';
  }, []);
}
