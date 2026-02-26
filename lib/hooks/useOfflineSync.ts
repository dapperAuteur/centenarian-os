/* eslint-disable @typescript-eslint/no-explicit-any */
// File: lib/hooks/useOfflineSync.ts
// Offline-first data hook for pages that use supabase.from() directly (e.g. planner).
// For pages that use fetch('/api/...'), prefer useOfflineData + useOfflineMutation instead.

import { useEffect, useState, useCallback, useRef } from 'react';
import { OfflineSyncManager, SyncStatus } from '@/lib/offline/sync-manager';
import { createClient } from '@/lib/supabase/client';

export function useOfflineSync<T extends { id: string }>(
  table: string,
  options: {
    where?: Record<string, any>;
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
  } = {}
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ pending: 0, failed: 0 });

  const supabase = createClient();
  const managerRef = useRef<OfflineSyncManager | null>(null);

  if (!managerRef.current && typeof window !== 'undefined') {
    managerRef.current = OfflineSyncManager.getInstance();
  }

  // Stable cache key derived from table + filters
  const cacheKey = `supabase://${table}?${JSON.stringify(options)}`;

  const loadData = useCallback(async () => {
    const manager = managerRef.current;
    if (!manager) return;
    setLoading(true);

    try {
      if (navigator.onLine) {
        let query = supabase.from(table).select('*');

        if (options.where) {
          Object.entries(options.where).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }
        if (options.orderBy) {
          query = query.order(options.orderBy.column, {
            ascending: options.orderBy.ascending ?? false,
          });
        }
        if (options.limit) {
          query = query.limit(options.limit);
        }

        const { data: fetched, error } = await query;
        if (error) throw error;

        setData((fetched as T[]) || []);

        // Cache response (NOT queuing for sync — just caching)
        await manager.cacheResponse(cacheKey, fetched);
      } else {
        // Offline: read from cache
        const cached = await manager.getCached<T[]>(cacheKey);
        if (cached) setData(cached);
      }
    } catch (error) {
      console.error('[useOfflineSync] Load failed:', error);
      // Fallback to cache on any error
      const manager = managerRef.current;
      if (manager) {
        const cached = await manager.getCached<T[]>(cacheKey);
        if (cached) setData(cached);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, cacheKey]);

  /** Mutate data (works offline via API queue) */
  const mutate = useCallback(
    async (
      operation: 'INSERT' | 'UPDATE' | 'DELETE',
      record: Partial<T> & { id: string }
    ) => {
      const manager = managerRef.current;
      if (!manager) return;

      // Optimistic update
      if (operation === 'UPDATE') {
        setData((prev) =>
          prev.map((item) =>
            item.id === record.id ? { ...item, ...record } : item
          )
        );
      } else if (operation === 'INSERT') {
        setData((prev) => [...prev, record as T]);
      } else if (operation === 'DELETE') {
        setData((prev) => prev.filter((item) => item.id !== record.id));
      }

      if (navigator.onLine) {
        // Execute immediately via Supabase
        try {
          if (operation === 'INSERT') {
            const { error } = await supabase.from(table).insert(record);
            if (error) throw error;
          } else if (operation === 'UPDATE') {
            const { id, ...rest } = record;
            const { error } = await supabase.from(table).update(rest).eq('id', id);
            if (error) throw error;
          } else if (operation === 'DELETE') {
            const { error } = await supabase.from(table).delete().eq('id', record.id);
            if (error) throw error;
          }
        } catch (error) {
          console.error('[useOfflineSync] Mutation failed, will retry:', error);
          // Queue for retry
          const method =
            operation === 'INSERT' ? 'POST' : operation === 'UPDATE' ? 'PATCH' : 'DELETE';
          await manager.queueMutation(`/api/_sync/${table}`, method, record);
        }
      } else {
        // Offline: queue for later
        const method =
          operation === 'INSERT' ? 'POST' : operation === 'UPDATE' ? 'PATCH' : 'DELETE';
        await manager.queueMutation(`/api/_sync/${table}`, method, record);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table]
  );

  const forceSync = useCallback(() => {
    window.dispatchEvent(new Event('online'));
  }, []);

  // Online/offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      loadData(); // Refetch fresh data
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData]);

  // Subscribe to sync-status changes (replaces polling)
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    return manager.onStatusChange(setSyncStatus);
  }, []);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    isOffline,
    syncStatus,
    mutate,
    refetch: loadData,
    forceSync,
  };
}
