/* eslint-disable @typescript-eslint/no-explicit-any */
// File: lib/offline/sync-manager.ts

import { createClient } from '@/lib/supabase/client';

/**
 * Operation types for sync queue
 */
export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Supported tables for offline sync
 */
export type SyncTable = 
  | 'tasks' 
  | 'meal_logs' 
  | 'focus_sessions' 
  | 'daily_logs'
  | 'inventory';

/**
 * Queue item structure
 */
export interface SyncQueueItem {
  id: string;
  operation: SyncOperation;
  table: SyncTable;
  data: any;
  timestamp: number;
  retries: number;
  error?: string;
}

/**
 * Offline Sync Manager
 * 
 * Handles all offline operations with IndexedDB cache and sync queue.
 * 
 * **User Flow:**
 * 1. User marks task complete
 * 2. UI updates instantly (optimistic)
 * 3. Change saved to IndexedDB
 * 4. Operation queued for sync
 * 5. When online, queue processes automatically
 * 
 * **Developer Flow:**
 * ```typescript
 * const sync = OfflineSyncManager.getInstance();
 * await sync.queueOperation('UPDATE', 'tasks', { id: '123', completed: true });
 * ```
 */
export class OfflineSyncManager {
  private static instance: OfflineSyncManager;
  private db: IDBDatabase | null = null;
  private syncInProgress = false;
  private readonly DB_NAME = 'centenarian_offline';
  private readonly DB_VERSION = 1;

  private constructor() {
    this.init();
  }

  /**
   * Singleton instance
   */
  public static getInstance(): OfflineSyncManager {
    if (!OfflineSyncManager.instance) {
      OfflineSyncManager.instance = new OfflineSyncManager();
    }
    return OfflineSyncManager.instance;
  }

  /**
   * Initialize IndexedDB and start sync loop
   */
  private async init() {
    try {
      this.db = await this.openDB();
      this.startSyncLoop();
      this.setupOnlineListener();
    } catch (error) {
      console.error('Failed to initialize OfflineSyncManager:', error);
    }
  }

  /**
   * Open IndexedDB connection
   */
  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create sync queue store
        if (!db.objectStoreNames.contains('sync_queue')) {
          const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Create cache stores for each table
        const tables: SyncTable[] = ['tasks', 'meal_logs', 'focus_sessions', 'daily_logs', 'inventory'];
        tables.forEach(table => {
          if (!db.objectStoreNames.contains(table)) {
            db.createObjectStore(table, { keyPath: 'id' });
          }
        });
      };
    });
  }

  /**
   * Queue an operation for sync
   * 
   * @param operation - INSERT, UPDATE, or DELETE
   * @param table - Table name
   * @param data - Record data (must include 'id' field)
   */
  public async queueOperation(
    operation: SyncOperation,
    table: SyncTable,
    data: any
  ): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    const queueItem: SyncQueueItem = {
      id: `${table}-${data.id}-${Date.now()}`,
      operation,
      table,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    // Save to sync queue
    await this.saveToStore('sync_queue', queueItem);

    // Update local cache immediately (optimistic update)
    if (operation === 'DELETE') {
      await this.deleteFromStore(table, data.id);
    } else {
      await this.saveToStore(table, data);
    }

    // Try to sync immediately if online
    if (navigator.onLine && !this.syncInProgress) {
      this.processSyncQueue();
    }
  }

  /**
   * Process sync queue
   */
  private async processSyncQueue(): Promise<void> {
    if (!this.db || this.syncInProgress) return;

    this.syncInProgress = true;
    const supabase = createClient();

    try {
      const queue = await this.getAllFromStore<SyncQueueItem>('sync_queue');
      
      for (const item of queue) {
        try {
          // Execute operation on Supabase
          if (item.operation === 'INSERT') {
            const { error } = await supabase.from(item.table).insert(item.data);
            if (error) throw error;
          } else if (item.operation === 'UPDATE') {
            const { error } = await supabase
              .from(item.table)
              .update(item.data)
              .eq('id', item.data.id);
            if (error) throw error;
          } else if (item.operation === 'DELETE') {
            const { error } = await supabase
              .from(item.table)
              .delete()
              .eq('id', item.data.id);
            if (error) throw error;
          }

          // Success - remove from queue
          await this.deleteFromStore('sync_queue', item.id);
          console.log(`✓ Synced: ${item.operation} ${item.table}`);

        } catch (error) {
          // Increment retry count
          item.retries += 1;
          item.error = error instanceof Error ? error.message : 'Unknown error';

          if (item.retries > 5) {
            // Give up after 5 retries - move to error log
            console.error('❌ Sync failed permanently:', item);
            await this.deleteFromStore('sync_queue', item.id);
          } else {
            // Update retry count in queue
            await this.saveToStore('sync_queue', item);
            console.warn(`⚠️ Sync failed (retry ${item.retries}/5):`, item.table);
          }
        }
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Start background sync loop (every 30 seconds)
   */
  private startSyncLoop() {
    setInterval(() => {
      if (navigator.onLine && !this.syncInProgress) {
        this.processSyncQueue();
      }
    }, 30000); // 30 seconds
  }

  /**
   * Setup online event listener
   */
  private setupOnlineListener() {
    window.addEventListener('online', () => {
      console.log('🌐 Connection restored - syncing...');
      this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      console.log('📡 Offline mode - operations will queue');
    });
  }

  /**
   * Get all items from cache (for reading data while offline)
   */
  public async getFromCache<T>(table: SyncTable): Promise<T[]> {
    if (!this.db) return [];
    return this.getAllFromStore<T>(table);
  }

  /**
   * Get single item from cache
   */
  public async getFromCacheById<T>(table: SyncTable, id: string): Promise<T | null> {
    if (!this.db) return null;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(table, 'readonly');
      const store = transaction.objectStore(table);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all cached data (use sparingly)
   */
  public async clearCache(): Promise<void> {
    if (!this.db) return;

    const tables: SyncTable[] = ['tasks', 'meal_logs', 'focus_sessions', 'daily_logs', 'inventory'];
    
    for (const table of tables) {
      await this.clearStore(table);
    }
  }

  /**
   * Get sync queue status
   */
  public async getSyncStatus(): Promise<{
    pending: number;
    failed: number;
    lastSync: number | null;
  }> {
    if (!this.db) {
      return { pending: 0, failed: 0, lastSync: null };
    }

    const queue = await this.getAllFromStore<SyncQueueItem>('sync_queue');
    
    return {
      pending: queue.filter(item => item.retries === 0).length,
      failed: queue.filter(item => item.retries > 0).length,
      lastSync: queue.length > 0 ? Math.max(...queue.map(item => item.timestamp)) : null,
    };
  }

  // ===== Helper Methods =====

  private saveToStore(storeName: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('DB not initialized');

      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private deleteFromStore(storeName: string, id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('DB not initialized');

      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private getAllFromStore<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve([]);

      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  private clearStore(storeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('DB not initialized');

      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}