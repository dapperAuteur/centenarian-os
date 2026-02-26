// File: lib/hooks/useOfflineData.ts
// Generic hook for offline-cached GET data. Wraps offlineFetch.

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface UseOfflineDataOptions<T> {
  /** Transform the raw JSON response before setting state */
  transform?: (json: unknown) => T;
  /** Whether to fetch on mount (default: true) */
  fetchOnMount?: boolean;
}

interface UseOfflineDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** True when the current data came from IndexedDB cache */
  isFromCache: boolean;
  /** Re-fetch data from network (or cache if offline) */
  refetch: () => Promise<void>;
}

/**
 * Hook for offline-cached API reads.
 *
 * ```ts
 * const { data, loading, isFromCache } = useOfflineData<Transaction[]>(
 *   '/api/finance/transactions?from=2026-01-01',
 *   { transform: (json) => json.transactions }
 * );
 * ```
 *
 * Pass `null` as the URL to skip fetching (conditional fetch).
 */
export function useOfflineData<T = unknown>(
  url: string | null,
  options: UseOfflineDataOptions<T> = {}
): UseOfflineDataReturn<T> {
  const { transform, fetchOnMount = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url && fetchOnMount);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const fetchData = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);

    try {
      const res = await offlineFetch(url);
      const fromCache = res.headers.get('X-Offline-Cache') === 'true';
      setIsFromCache(fromCache);

      if (res.status === 503) {
        setError('Offline — no cached data available');
        return;
      }

      const json = await res.json();

      if (!res.ok && !fromCache) {
        setError(json.error || `Request failed (${res.status})`);
        return;
      }

      const result = transformRef.current ? transformRef.current(json) : (json as T);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [url]);

  // Fetch on mount
  useEffect(() => {
    if (fetchOnMount) fetchData();
  }, [fetchData, fetchOnMount]);

  // Refetch when coming back online
  useEffect(() => {
    const handleOnline = () => {
      if (url) fetchData();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [url, fetchData]);

  return { data, loading, error, isFromCache, refetch: fetchData };
}
