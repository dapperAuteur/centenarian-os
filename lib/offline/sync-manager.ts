/* eslint-disable @typescript-eslint/no-explicit-any */
// File: lib/offline/sync-manager.ts
// URL-keyed offline cache + mutation sync queue using IndexedDB.

export interface SyncQueueItem {
  id: string;
  url: string;
  method: string;
  body: any;
  timestamp: number;
  retries: number;
  error?: string;
}

export interface SyncStatus {
  pending: number;
  failed: number;
}

type StatusListener = (status: SyncStatus) => void;

/**
 * Offline Sync Manager (singleton)
 *
 * - Caches GET responses by URL in IndexedDB
 * - Queues POST/PATCH/DELETE mutations for replay when back online
 * - 30-second sync loop + immediate sync on `online` event
 * - Event-based status notifications (no polling needed)
 */
export class OfflineSyncManager {
  private static instance: OfflineSyncManager;
  private db: IDBDatabase | null = null;
  private syncInProgress = false;
  private readonly DB_NAME = 'centenarian_offline';
  private readonly DB_VERSION = 3;
  private listeners = new Set<StatusListener>();
  private initPromise: Promise<void>;

  private constructor() {
    this.initPromise = this.init();
  }

  static getInstance(): OfflineSyncManager {
    if (!OfflineSyncManager.instance) {
      OfflineSyncManager.instance = new OfflineSyncManager();
    }
    return OfflineSyncManager.instance;
  }

  /** Wait for IndexedDB to be ready before performing operations */
  async ready(): Promise<void> {
    await this.initPromise;
  }

  // ── Initialisation ────────────────────────────────────────────────────

  private async init() {
    try {
      this.db = await this.openDB();
      this.startSyncLoop();
      this.setupOnlineListener();
    } catch (error) {
      console.error('[OfflineSync] Init failed:', error);
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Delete legacy stores from v1/v2
        const legacy = [
          'tasks', 'meal_logs', 'focus_sessions', 'daily_logs', 'inventory',
        ];
        for (const name of legacy) {
          if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
        }

        // URL-keyed response cache
        if (!db.objectStoreNames.contains('api_cache')) {
          db.createObjectStore('api_cache', { keyPath: 'url' });
        }

        // Mutation sync queue
        if (!db.objectStoreNames.contains('sync_queue')) {
          // v3 schema — may need to recreate if schema changed
          if (event.oldVersion > 0 && event.oldVersion < 3) {
            try { db.deleteObjectStore('sync_queue'); } catch { /* may not exist */ }
          }
          const store = db.createObjectStore('sync_queue', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // ── Cache (GET responses) ─────────────────────────────────────────────

  /** Cache a GET response by URL */
  async cacheResponse(url: string, data: any): Promise<void> {
    await this.ready();
    if (!this.db) return;
    await this.put('api_cache', { url, data, timestamp: Date.now() });
  }

  /** Retrieve cached GET response */
  async getCached<T = any>(url: string): Promise<T | null> {
    await this.ready();
    if (!this.db) return null;
    const row = await this.get<{ url: string; data: T; timestamp: number }>('api_cache', url);
    return row?.data ?? null;
  }

  /** Clear all cached responses */
  async clearCache(): Promise<void> {
    await this.ready();
    if (!this.db) return;
    await this.clear('api_cache');
  }

  // ── Mutation queue ────────────────────────────────────────────────────

  /** Queue a mutation for sync when back online */
  async queueMutation(url: string, method: string, body: any): Promise<void> {
    await this.ready();
    if (!this.db) throw new Error('IndexedDB not initialised');

    const item: SyncQueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url,
      method,
      body,
      timestamp: Date.now(),
      retries: 0,
    };

    await this.put('sync_queue', item);
    this.notifyListeners();

    // Try to sync immediately if online
    if (navigator.onLine && !this.syncInProgress) {
      this.processSyncQueue();
    }
  }

  /** Process all queued mutations */
  async processSyncQueue(): Promise<void> {
    if (!this.db || this.syncInProgress || !navigator.onLine) return;
    this.syncInProgress = true;
    this.notifyListeners();

    try {
      const queue = await this.getAll<SyncQueueItem>('sync_queue');
      if (queue.length === 0) return;

      for (const item of queue) {
        try {
          const res = await fetch(item.url, {
            method: item.method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.body),
          });

          if (!res.ok) {
            throw new Error(`${res.status} ${res.statusText}`);
          }

          // Success — remove from queue
          await this.del('sync_queue', item.id);
        } catch (error) {
          item.retries += 1;
          item.error = error instanceof Error ? error.message : 'Unknown error';

          if (item.retries > 5) {
            console.error('[OfflineSync] Permanently failed:', item);
            await this.del('sync_queue', item.id);
          } else {
            await this.put('sync_queue', item);
          }
        }
      }
    } finally {
      this.syncInProgress = false;
      this.notifyListeners();
    }
  }

  // ── Status ────────────────────────────────────────────────────────────

  /** Get current queue counts */
  async getSyncStatus(): Promise<SyncStatus> {
    await this.ready();
    if (!this.db) return { pending: 0, failed: 0 };

    const queue = await this.getAll<SyncQueueItem>('sync_queue');
    return {
      pending: queue.filter((i) => i.retries === 0).length,
      failed: queue.filter((i) => i.retries > 0).length,
    };
  }

  /** Subscribe to sync-status changes. Returns unsubscribe function. */
  onStatusChange(cb: StatusListener): () => void {
    this.listeners.add(cb);
    // Emit current status immediately
    this.getSyncStatus().then(cb);
    return () => this.listeners.delete(cb);
  }

  get isSyncing(): boolean {
    return this.syncInProgress;
  }

  private async notifyListeners() {
    const status = await this.getSyncStatus();
    this.listeners.forEach((cb) => cb(status));
  }

  // ── Background sync loop ─────────────────────────────────────────────

  private startSyncLoop() {
    setInterval(() => {
      if (navigator.onLine && !this.syncInProgress) {
        this.processSyncQueue();
      }
    }, 30_000);
  }

  private setupOnlineListener() {
    window.addEventListener('online', () => {
      this.processSyncQueue();
    });
  }

  // ── IndexedDB helpers ─────────────────────────────────────────────────

  private put(store: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, 'readwrite');
      tx.objectStore(store).put(data);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private get<T>(store: string, key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  private getAll<T>(store: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  private del(store: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private clear(store: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
