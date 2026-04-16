'use client';

// components/academy/offline/RevokedAssetsPurger.tsx
// Invisible mount-point component that runs the enrollment-revocation
// purge once per academy-surface navigation. Placed in the academy
// layout so it covers /academy/*, /dashboard/teaching/*, and any other
// route that touches course content — but not the rest of the app,
// where it would be wasted overhead.
//
// Behavior:
//   - On mount, fire-and-forget POST /api/offline/assets/purge-revoked.
//   - If any URLs were purged server-side, delete matching IDB blobs.
//   - If anything was purged, toast the user so they know their saved
//     lessons just shrank (we don't surprise them silently).
//   - De-duplicated via a module-level flag so SPA navigations within
//     /academy/* don't thrash the endpoint.

import { useEffect } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { logError } from '@/lib/error-logging';
import { purgeRevoked } from '@/lib/offline/purge-revoked';

let didRunThisSession = false;

export default function RevokedAssetsPurger() {
  const toast = useToast();

  useEffect(() => {
    if (didRunThisSession) return;
    didRunThisSession = true;

    // Wait one tick so we don't compete with other mount-time work
    // (auth refresh, analytics, enrollment checks).
    const timer = setTimeout(() => {
      purgeRevoked()
        .then((result) => {
          if (result.revokedCount > 0) {
            toast.info(
              `Removed ${result.revokedCount} offline ${
                result.revokedCount === 1 ? 'lesson' : 'lessons'
              } from courses you no longer have access to.`,
            );
          }
        })
        .catch((err) => {
          logError(err, { module: 'RevokedAssetsPurger', context: { op: 'purge' } });
        });
    }, 1500);

    return () => clearTimeout(timer);
  }, [toast]);

  return null;
}
