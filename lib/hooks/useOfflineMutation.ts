// File: lib/hooks/useOfflineMutation.ts
// Generic hook for offline-safe mutations (POST/PATCH/DELETE).

'use client';

import { useState, useCallback } from 'react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface MutationResult<T = unknown> {
  ok: boolean;
  data?: T;
  /** True when the mutation was queued for later sync (offline) */
  queued?: boolean;
  error?: string;
}

/**
 * Hook for offline-safe mutations.
 *
 * ```ts
 * const { mutate, isMutating } = useOfflineMutation();
 *
 * const result = await mutate('/api/finance/transactions', 'POST', formData);
 * if (result.queued) showToast('Will sync when online');
 * ```
 */
export function useOfflineMutation() {
  const [isMutating, setIsMutating] = useState(false);

  const mutate = useCallback(
    async <T = unknown>(
      url: string,
      method: 'POST' | 'PATCH' | 'DELETE',
      body: unknown
    ): Promise<MutationResult<T>> => {
      setIsMutating(true);

      try {
        const res = await offlineFetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const json = await res.json();

        // Queued for offline sync
        if (res.headers.get('X-Offline-Queued') === 'true') {
          return { ok: true, queued: true };
        }

        if (!res.ok) {
          return { ok: false, error: json.error || `Request failed (${res.status})` };
        }

        return { ok: true, data: json as T };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      } finally {
        setIsMutating(false);
      }
    },
    []
  );

  return { mutate, isMutating };
}
