/* eslint-disable @typescript-eslint/no-explicit-any */
// File: lib/hooks/useOfflineSync.ts

import { useEffect, useState } from 'react';
import { OfflineSyncManager, SyncOperation, SyncTable } from '@/lib/offline/sync-manager';
import { createClient } from '@/lib/supabase/client';

/**
 * React Hook for offline-first data operations
 * 
 * **Usage Example:**
 * ```typescript
 * const { data, loading, mutate } = useOfflineSync<Task>('tasks', {
 *   where: { user_id: userId }
 * });
 * 
 * // Update task (works offline!)
 * await mutate('UPDATE', { id: '123', completed: true });
 * ```
 */
export function useOfflineSync<T extends { id: string }>(
  table: SyncTable,
  options: {
    where?: Record<string, any>;
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
  } = {}
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [syncStatus, setSyncStatus] = useState({ pending: 0, failed: 0 });

  const supabase = createClient();
  const syncManager = OfflineSyncManager.getInstance();

  /**
   * Load data (from cache if offline, from Supabase if online)
   */
  const loadData = async () => {
    setLoading(true);

    try {
      if (navigator.onLine) {
        // Online: Fetch from Supabase
        let query = supabase.from(table).select('*');

        // Apply filters
        if (options.where) {
          Object.entries(options.where).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }

        // Apply ordering
        if (options.orderBy) {
          query = query.order(options.orderBy.column, {
            ascending: options.orderBy.ascending ?? false
          });
        }

        // Apply limit
        if (options.limit) {
          query = query.limit(options.limit);
        }

        const { data: fetchedData, error } = await query;

        if (error) throw error;

        setData(fetchedData as T[]);

        // Update cache
        if (fetchedData) {
          for (const item of fetchedData) {
            await syncManager.queueOperation('UPDATE', table, item);
          }
        }
      } else {
        // Offline: Read from cache
        const cachedData = await syncManager.getFromCache<T>(table);
        setData(cachedData);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Mutate data (works offline)
   */
  const mutate = async (operation: SyncOperation, record: Partial<T> & { id: string }) => {
    try {
      // Optimistic update
      if (operation === 'UPDATE') {
        setData(prev => prev.map(item => 
          item.id === record.id ? { ...item, ...record } : item
        ));
      } else if (operation === 'INSERT') {
        setData(prev => [...prev, record as T]);
      } else if (operation === 'DELETE') {
        setData(prev => prev.filter(item => item.id !== record.id));
      }

      // Queue for sync
      await syncManager.queueOperation(operation, table, record);

      // Update sync status
      const status = await syncManager.getSyncStatus();
      setSyncStatus(status);

    } catch (error) {
      console.error('Mutation failed:', error);
      // Rollback optimistic update
      await loadData();
      throw error;
    }
  };

  /**
   * Force sync now
   */
  const forceSync = async () => {
    // Trigger sync by going online
    window.dispatchEvent(new Event('online'));
  };

  // Setup online/offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [table, JSON.stringify(options)]);

  // Update sync status periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      const status = await syncManager.getSyncStatus();
      setSyncStatus(status);
    }, 5000); // Every 5 seconds

    return () => clearInterval(interval);
  }, []);

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