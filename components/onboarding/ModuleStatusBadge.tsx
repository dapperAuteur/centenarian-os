'use client';

import { Sparkles } from 'lucide-react';

interface ModuleStatusBadgeProps {
  className?: string;
}

/**
 * Small sparkle badge shown next to nav items for modules not yet toured.
 * Disappears once the tour is completed or skipped.
 */
export default function ModuleStatusBadge({ className }: ModuleStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 ${className ?? ''}`}
      title="Tap to explore this feature"
    >
      <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" aria-hidden="true" />
    </span>
  );
}
