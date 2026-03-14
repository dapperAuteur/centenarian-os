// lib/onboarding/tour-steps.ts
// Tour step definitions for module walkthroughs.

export interface TourStep {
  title: string;
  description: string;
  target?: string;        // CSS selector to highlight
  placement?: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'navigate' | 'observe';
  nextRoute?: string;     // navigate to this route for next step
}

export interface ModuleTour {
  slug: string;
  app: 'main';
  name: string;
  description: string;
  icon: string;
  steps: TourStep[];
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

export function getTour(_app: 'main', _slug: string): ModuleTour | undefined {
  // No tours defined yet for main app
  return undefined;
}

export function getAllTours(_app: 'main'): ModuleTour[] {
  // No tours defined yet for main app
  return [];
}
