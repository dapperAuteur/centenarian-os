'use client';

// lib/offline/purge-revoked.ts
// Client half of the enrollment-revocation purge. Asks the server which
// of this user's cached assets belong to courses they no longer have
// active access to, then deletes the corresponding IndexedDB blobs.
//
// The server already removes the ledger rows before replying, so the
// client's job is only to clean up local storage. A local-only failure
// (IndexedDB blocked, private browsing) is safe to ignore — the ledger
// is already clean, and the next `getStorageSummary()` run will show
// the blob as an orphan the user can purge manually.

import { deleteBlob } from './blob-store';

export interface PurgeRevokedResult {
  revokedCount: number;
  failedUrls: string[];
}

export async function purgeRevoked(): Promise<PurgeRevokedResult> {
  let revokedUrls: string[] = [];
  try {
    const res = await fetch('/api/offline/assets/purge-revoked', {
      method: 'POST',
      cache: 'no-store',
    });
    if (!res.ok) return { revokedCount: 0, failedUrls: [] };
    const json = await res.json();
    revokedUrls = Array.isArray(json.revoked_urls) ? json.revoked_urls : [];
  } catch {
    return { revokedCount: 0, failedUrls: [] };
  }

  if (revokedUrls.length === 0) return { revokedCount: 0, failedUrls: [] };

  const results = await Promise.allSettled(revokedUrls.map((url) => deleteBlob(url)));
  const failedUrls = revokedUrls.filter((_, i) => results[i].status === 'rejected');
  return { revokedCount: revokedUrls.length - failedUrls.length, failedUrls };
}
