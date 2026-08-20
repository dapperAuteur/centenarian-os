/**
 * Event taxonomy for CentenarianOS.
 *
 * The ecosystem shares ONE PostHog project, separated by the `app` property that
 * posthog-provider registers on load. Two rules keep that project readable, and both
 * are cheap now and expensive to retrofit once data has landed:
 *
 *   1. `snake_case`, object first, verb in past tense — `route_viewed`.
 *   2. NEVER put the app name in the event name. `centenarianos_signin_started` is
 *      wrong: it makes the same action from two apps look like two events and kills
 *      the cross-app comparison that sharing a project exists to enable. The `app`
 *      property already carries that.
 *
 * Shared lifecycle events (the SHARED_EVENTS block) use identical names in every
 * ecosystem app, so "where do people fall out of sign-in" is answerable across all of
 * them at once. Do not rename these here without renaming them everywhere.
 *
 * A NOTE SPECIFIC TO THIS APP. CentenarianOS carries health data — body-pain logs,
 * biometrics, habit streaks — and some surfaces are used by minors. That is why the
 * provider's posture is not negotiable here in particular: `autocapture: false` and
 * `disable_session_recording: true` are what keep keystrokes and screen content of a
 * health form from reaching a third-party vendor. Any event added below must carry
 * slugs and ids, NEVER a free-text health value, a body measurement, or a note body.
 *
 * See the witus repo: lib/analytics/INTEGRATE.md and plans/26-posthog-ecosystem-rollout.md.
 */

/** Matches this app's slug in the witus repo's lib/identity/clients.ts. Every event carries it. */
export const ANALYTICS_APP = "centenarianos";

/**
 * Events with identical names across every ecosystem app. Names are contractual.
 */
export const SHARED_EVENTS = {
  signinStarted: "signin_started",
  signinSucceeded: "signin_succeeded",
  signinFailed: "signin_failed",
} as const;

/**
 * Events specific to CentenarianOS.
 *
 * Deliberately minimal right now: this change is the wiring, not the instrumentation.
 * Names are added here as call sites are actually added, so the shared project never
 * carries a declared event that nothing emits — an unfired name is indistinguishable
 * from a broken one when you are reading a funnel.
 */
export const EVENTS = {
  /** An explicit route view. capture_pageview is off — Next's client router would
   *  fire it once and then lie — so route changes are reported deliberately. */
  routeViewed: "route_viewed",
  ...SHARED_EVENTS,
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
