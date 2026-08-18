"use client";

import posthog from "posthog-js";
import type { EventName } from "./events";

/**
 * The single client-side entry point for sending an event.
 *
 * Everything goes through here rather than calling posthog.capture() directly, for
 * three reasons:
 *
 *   - **It cannot break a page.** Analytics is never worth a white screen, so the
 *     call is wrapped. A PostHog outage, a blocked request, or a malformed property
 *     degrades to nothing happening.
 *   - **It no-ops when uninitialised.** Keyless is a supported state — local dev and
 *     any deploy before the env vars are set render normally with capture simply off.
 *     `__loaded` is how posthog-js reports that init actually ran.
 *   - **The name is typed.** `EventName` prevents a typo becoming a permanent second
 *     event in the shared project, which is not cleanly fixable after the fact.
 */
export function capture(event: EventName, properties?: Record<string, unknown>): void {
  try {
    if (!posthog.__loaded) return;
    posthog.capture(event, properties);
  } catch {
    // Deliberately silent. There is no user-facing recovery for a failed analytics
    // call, and logging it would just move the noise to the console.
  }
}
