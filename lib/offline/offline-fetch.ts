// File: lib/offline/offline-fetch.ts
// Drop-in offline-aware replacement for fetch().
// GET requests are cached in IndexedDB; mutations are queued when offline.

import { OfflineSyncManager } from './sync-manager';

/**
 * Offline-aware fetch wrapper.
 *
 * - GET:  online → fetch + cache | offline → return cached response
 * - POST/PATCH/DELETE: online → fetch normally | offline → queue + return 202
 */
export async function offlineFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const manager = OfflineSyncManager.getInstance();
  await manager.ready();
  const method = (init?.method ?? 'GET').toUpperCase();

  // ── GET requests ────────────────────────────────────────────────────
  if (method === 'GET') {
    if (navigator.onLine) {
      try {
        const res = await fetch(url, init);
        if (res.ok) {
          // Clone before reading body so the original response is still usable
          const clone = res.clone();
          const data = await clone.json();
          await manager.cacheResponse(url, data);
        }
        return res;
      } catch {
        // Network error — fall through to cache
      }
    }

    // Offline or network error: try cache
    const cached = await manager.getCached(url);
    if (cached !== null) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Offline-Cache': 'true',
        },
      });
    }

    // No cache available
    return new Response(JSON.stringify({ error: 'Offline — no cached data' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Mutation requests (POST / PATCH / DELETE) ───────────────────────
  if (navigator.onLine) {
    try {
      return await fetch(url, init);
    } catch {
      // Network error — queue instead
    }
  }

  // Offline or network error: queue mutation
  let body: unknown = null;
  if (init?.body) {
    try {
      body = JSON.parse(init.body as string);
    } catch {
      body = init.body;
    }
  }

  await manager.queueMutation(url, method, body);

  return new Response(JSON.stringify({ queued: true }), {
    status: 202,
    headers: {
      'Content-Type': 'application/json',
      'X-Offline-Queued': 'true',
    },
  });
}
