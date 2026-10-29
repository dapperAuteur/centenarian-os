'use client';

// File: components/login/WitusSsoButton.tsx
// "Sign in with WitUS", plus the login page's one silent sign-in attempt.
//
// SILENT SIGN-IN (2026-10-29). Once per browser session, a signed-out visitor on /login is sent
// through /api/auth/witus/authorize?prompt=none: a TOP-LEVEL navigation, so the browser carries
// the IdP's SameSite=Lax session cookie even though centenarianos.com and accounts.witus.online
// are different sites. With a live WitUS session the visitor comes back signed in; without one
// the callback returns them here with no message and the normal options below. The decision and
// the loop guard live in lib/auth/witus-sso.ts (silentSsoDecision).
//
// This replaced the "Continue as <name>" background probe, which fetched the IdP's
// /api/ecosystem/session with credentials. A cross-site fetch never carries a SameSite=Lax cookie,
// so that probe could only ever answer "nobody". No CentOS host is same-site with witus.online, so
// nothing was kept.
//
// THE GATE. `enabled` is resolved on the SERVER from WITUS_OIDC_CLIENT_ID (lib/auth/
// witus-sso-server.ts) and handed down through WitusSsoProvider. Unconfigured means this renders
// null — the divider included — and never redirects.
//
// Rendered on /login only. Never add it to another page: the silent attempt navigates away.

import { useEffect } from 'react';
import { useWitusSso } from '@/lib/auth/witus-sso-client';
import {
  hasSilentSsoFlag,
  silentSignInPath,
  silentSsoDecision,
  silentSsoFlagCookie,
} from '@/lib/auth/witus-sso';

export default function WitusSsoButton({
  /** True when the visitor already has a CentOS session (?mfa=pending), so never redirect. */
  signedIn = false,
}: {
  signedIn?: boolean;
} = {}) {
  const { enabled } = useWitusSso();

  useEffect(() => {
    const decision = silentSsoDecision({
      enabled,
      search: window.location.search,
      attempted: readAttempted(),
      signedIn,
    });
    if (!decision.attempt) return;

    // THE LOOP GUARD, written BEFORE leaving, never after the return: a flag written on return is
    // a flag that never exists when the return is the thing that failed. The callback's
    // `?sso=tried` marker covers a browser that refuses the cookie.
    writeAttempted();
    const from = new URLSearchParams(window.location.search).get('from');
    // replace(), not assign(): Back from the dashboard should not land on a page that
    // immediately redirects again.
    window.location.replace(silentSignInPath(from));
  }, [enabled, signedIn]);

  if (!enabled) return null;

  return (
    <div className="pt-2">
      <div className="my-2 text-center text-xs uppercase tracking-wide text-gray-400">or</div>
      <a
        href="/api/auth/witus/authorize"
        // Also records the attempt, so a visitor who comes back from the IdP's login page (or
        // presses Back) is not then sent on a silent round trip as well. Kept as a plain <a> so the
        // flag is written by the click handler and the browser then does the ordinary navigation.
        onClick={writeAttempted}
        className="flex min-h-11 w-full items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
      >
        Sign in with WitUS
      </a>
    </div>
  );
}

/** Cookie access can throw in sandboxed frames; a failure reads as "not attempted". */
function readAttempted(): boolean {
  try {
    return hasSilentSsoFlag(document.cookie);
  } catch {
    return false;
  }
}

function writeAttempted(): void {
  try {
    document.cookie = silentSsoFlagCookie(window.location.protocol === 'https:');
  } catch {
    // No cookie, no flag. The `?sso=tried` marker on every bounce back still applies.
  }
}
