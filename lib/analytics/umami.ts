// lib/analytics/umami.ts
// Client-side Umami analytics helper.
// Wraps the global umami.track() API for type-safe event tracking.

declare global {
  interface Window {
    umami?: {
      track: (name: string, data?: Record<string, string | number | boolean>) => void;
    };
  }
}

/**
 * Track a custom event in Umami.
 * No-ops gracefully when Umami is not loaded (dev, ad-blocked, etc).
 */
export function trackEvent(
  name: string,
  data?: Record<string, string | number | boolean>,
) {
  if (typeof window !== 'undefined' && window.umami) {
    window.umami.track(name, data);
  }
}
