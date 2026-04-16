'use client';

// lib/offline/blob-store.ts
// Raw-IndexedDB wrapper for storing offline-cached media blobs. Using
// the native API directly (no `idb` package) because the school dev
// network blocks registry.npmjs.org and we want this module to work
// without a new install. The raw API is a bit more verbose, but the
// API surface we need is tiny.
//
// Each blob is keyed by its source URL. Metadata (size, content-type,
// cached-at) is stored alongside so the storage manager can show totals
// without re-reading every blob.
//
// SSR-safe: all functions no-op on the server (indexedDB is undefined
// outside the browser).

const DB_NAME = 'centos-offline';
const DB_VERSION = 1;
const STORE = 'media-blobs';

interface BlobRecord {
  url: string;
  blob: Blob;
  size: number;
  content_type: string;
  cached_at: number;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'url' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Save a blob keyed by URL. Replaces any existing entry for the same URL. */
export async function putBlob(url: string, blob: Blob): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  try {
    const record: BlobRecord = {
      url,
      blob,
      size: blob.size,
      content_type: blob.type,
      cached_at: Date.now(),
    };
    await promisify(tx(db, 'readwrite').put(record));
  } finally {
    db.close();
  }
}

/** Get a blob by URL. Returns null when not cached or in SSR. */
export async function getBlob(url: string): Promise<Blob | null> {
  if (!isBrowser()) return null;
  const db = await openDb();
  try {
    const record = await promisify<BlobRecord | undefined>(tx(db, 'readonly').get(url));
    return record ? record.blob : null;
  } finally {
    db.close();
  }
}

/** Delete the cached blob at a URL. No-op if it doesn't exist. */
export async function deleteBlob(url: string): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDb();
  try {
    await promisify(tx(db, 'readwrite').delete(url));
  } finally {
    db.close();
  }
}

/** List every cached URL + size. Used by the storage manager. */
export async function listBlobs(): Promise<Array<{ url: string; size: number; cached_at: number }>> {
  if (!isBrowser()) return [];
  const db = await openDb();
  try {
    const all = await promisify<BlobRecord[]>(tx(db, 'readonly').getAll());
    return all.map((r) => ({ url: r.url, size: r.size, cached_at: r.cached_at }));
  } finally {
    db.close();
  }
}

/** Total bytes cached across all blobs. */
export async function totalCachedBytes(): Promise<number> {
  const entries = await listBlobs();
  return entries.reduce((n, e) => n + e.size, 0);
}

/** Download a URL as a blob and cache it. Returns the cached blob. */
export async function downloadAndCache(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const blob = await res.blob();
  await putBlob(url, blob);
  return blob;
}
