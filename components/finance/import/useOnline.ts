'use client';

// components/finance/import/useOnline.ts
// Whether the browser has a connection, kept current as it comes and goes.
// The statement import can't queue its requests the way small edits are
// queued offline, so its server steps are disabled while this is false.

import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    // On the server there is no connection to ask about: assume online.
    () => true,
  );
}
