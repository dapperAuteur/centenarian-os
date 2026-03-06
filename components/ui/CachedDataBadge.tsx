'use client';

import { WifiOff } from 'lucide-react';

/** Small inline pill indicating data is served from offline cache. */
export default function CachedDataBadge({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 text-xs font-medium">
      <WifiOff className="w-3 h-3" />
      Cached
    </span>
  );
}
