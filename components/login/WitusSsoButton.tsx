'use client';

// File: components/login/WitusSsoButton.tsx
// "Sign in with WitUS", plus the silent "Continue as <name>" check on top of it.
//
// WHAT THE VISITOR SEES. The login form is already on screen; nothing here delays it. The button
// says "Sign in with WitUS" from the first paint — exactly the affordance that shipped before this
// component existed. If the probe comes back with a live WitUS session it becomes "Continue as
// <name>". If the probe fails, times out, is blocked by the browser's third-party-cookie rules, or
// the IdP does not answer, NOTHING changes and NOTHING is said. A failed silent check must be
// completely invisible: no error, no spinner, no layout shift.
//
// THE GATE. `enabled` is resolved on the SERVER from WITUS_OIDC_CLIENT_ID (lib/auth/
// witus-sso-server.ts) and handed down through WitusSsoProvider. Unconfigured means this renders
// null — the divider included — instead of offering a button whose click lands on
// /login?error=witus_not_configured.
//
// Clicking runs the app's real bespoke OIDC code flow at /api/auth/witus/authorize. The name on the
// button grants nothing.

import { useEffect, useState } from 'react';
import { useWitusSso } from '@/lib/auth/witus-sso-client';
import {
  SILENT_SSO_TIMEOUT_MS,
  SSO_ATTEMPT_STORAGE_KEY,
  continueAsLabel,
  parseSilentSsoIdentity,
  silentSsoDecision,
  type SsoIdentity,
} from '@/lib/auth/witus-sso';

export default function WitusSsoButton({
  /** True when the visitor already has a CentOS session — the probe is pointless, so skip it. */
  signedIn = false,
}: {
  signedIn?: boolean;
} = {}) {
  const { enabled, silentCheckUrl } = useWitusSso();
  const [identity, setIdentity] = useState<SsoIdentity | null>(null);

  useEffect(() => {
    const decision = silentSsoDecision({
      endpoint: silentCheckUrl,
      search: window.location.search,
      attempted: readAttempted(),
      signedIn,
    });
    // `!silentCheckUrl` is already implied by decision.attempt; repeating it makes the narrowing
    // the compiler's rather than a cast that could quietly outlive the invariant.
    if (!decision.attempt || !silentCheckUrl) return;

    // Abort rather than hang. A probe still in flight when the visitor has moved on is a leak of
    // attention, not just of a socket.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SILENT_SSO_TIMEOUT_MS);
    let live = true;

    // `credentials: 'include'` is the entire mechanism: the answer depends on the IdP's OWN cookie,
    // which is third-party from centenarianos.com. Browsers that partition or block third-party
    // cookies (Safari ITP, Firefox Total Cookie Protection) answer "nobody", and that is a
    // supported outcome, not a bug to work around — the visitor keeps the ordinary button.
    fetch(silentCheckUrl, {
      credentials: 'include',
      mode: 'cors',
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!live) return;
        const found = parseSilentSsoIdentity(payload);
        // NEVER a credential. This name is display copy for a button whose click runs the real
        // OIDC code flow; it grants nothing on its own and must never be treated as identity.
        if (found) setIdentity(found);
      })
      .catch(() => {
        // Invisible on purpose: network error, CORS refusal, abort, non-JSON body — all the same.
      })
      .finally(() => clearTimeout(timer));

    return () => {
      live = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [silentCheckUrl, signedIn]);

  if (!enabled) return null;

  return (
    <div className="pt-2">
      <div className="my-2 text-center text-xs uppercase tracking-wide text-gray-400">or</div>
      <a
        href="/api/auth/witus/authorize"
        // THE LOOP GUARD, written BEFORE the redirect, never after the return. Without it a visitor
        // whose IdP session has gone stale gets: probe says "Continue as X" -> click -> the IdP
        // cannot finish -> back to /login -> probe says "Continue as X" -> forever. With it, one
        // attempt per tab: the next render of this page offers the plain button and the email form,
        // which always work. Kept as a plain <a> (not a button + router push) so the marker is
        // written by the click handler and the browser then does the ordinary navigation.
        onClick={writeAttempted}
        className="flex min-h-11 w-full items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
      >
        {continueAsLabel(identity)}
      </a>
      {/* Always in the DOM so the label change is announced when it happens, and silent (and
          invisible) when the probe found nothing. */}
      <p
        role="status"
        aria-live="polite"
        className={identity ? 'mt-2 text-center text-xs text-gray-500' : 'sr-only'}
      >
        {identity ? 'Not you? Sign in with your email above.' : ''}
      </p>
    </div>
  );
}

/**
 * sessionStorage throws outright in some privacy modes, so both halves are wrapped. A browser that
 * cannot remember the attempt still gets the other half of the guard: the `?sso=tried` marker that
 * app/api/auth/witus/{authorize,callback} puts on every bounce back to /login.
 */
function readAttempted(): boolean {
  try {
    return window.sessionStorage.getItem(SSO_ATTEMPT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeAttempted(): void {
  try {
    window.sessionStorage.setItem(SSO_ATTEMPT_STORAGE_KEY, '1');
  } catch {
    // No storage, no marker. The query-param half still applies.
  }
}
