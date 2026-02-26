// File: lib/contexts/SyncContext.tsx
// Global sync-state context. Wrap dashboard layout in <SyncProvider>.

'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { OfflineSyncManager, type SyncStatus } from '@/lib/offline/sync-manager';

interface SyncState {
  isOffline: boolean;
  pending: number;
  failed: number;
  isSyncing: boolean;
  /** True for ~3 seconds after sync completes successfully */
  justSynced: boolean;
}

interface SyncContextValue extends SyncState {
  forceSync: () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const managerRef = useRef<OfflineSyncManager | null>(null);
  const justSyncedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prevPending = useRef(0);

  const [state, setState] = useState<SyncState>({
    isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    pending: 0,
    failed: 0,
    isSyncing: false,
    justSynced: false,
  });

  // Initialise manager once
  if (!managerRef.current && typeof window !== 'undefined') {
    managerRef.current = OfflineSyncManager.getInstance();
  }

  useEffect(() => {
    const handleOnline = () => setState((s) => ({ ...s, isOffline: false }));
    const handleOffline = () => setState((s) => ({ ...s, isOffline: true }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to sync status
    const manager = managerRef.current;
    const unsub = manager?.onStatusChange((status: SyncStatus) => {
      const total = status.pending + status.failed;
      const wasSyncing = prevPending.current > 0;
      const nowClear = total === 0;

      setState((s) => ({
        ...s,
        pending: status.pending,
        failed: status.failed,
        isSyncing: manager?.isSyncing ?? false,
        // Show "just synced" when queue went from >0 to 0
        justSynced: wasSyncing && nowClear ? true : s.justSynced,
      }));

      // Auto-dismiss "just synced" after 3 seconds
      if (wasSyncing && nowClear) {
        clearTimeout(justSyncedTimer.current);
        justSyncedTimer.current = setTimeout(() => {
          setState((s) => ({ ...s, justSynced: false }));
        }, 3000);
      }

      prevPending.current = total;
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsub?.();
      clearTimeout(justSyncedTimer.current);
    };
  }, []);

  const forceSync = useCallback(() => {
    managerRef.current?.processSyncQueue();
  }, []);

  return (
    <SyncContext.Provider value={{ ...state, forceSync }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncContext() {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error('useSyncContext must be used within <SyncProvider>');
  }
  return ctx;
}
