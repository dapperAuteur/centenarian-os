// File: lib/auth/witus-sso-server.ts
// Server-side resolution of the ecosystem SSO endpoints. Called ONCE, from the root layout
// (app/layout.tsx), and the result is handed to client components through WitusSsoProvider.
//
// This module reads process.env, so it must never be imported by a 'use client' module. That is the
// whole reason it is split from ./witus-sso.ts: the client needs the pure helpers, not the env.
// Same pattern the root layout already uses for the PostHog key ("read the key HERE, in the Server
// Component, and pass it down").

import {
  WITUS_OIDC_AUTHORIZE_FALLBACK,
  WITUS_SSO_DISABLED,
  endSessionEndpointFromAuthorizeUrl,
  silentSsoEndpointFromAuthorizeUrl,
  type WitusSsoConfig,
} from './witus-sso';

/**
 * Resolve both ecosystem SSO endpoints from this app's existing OIDC configuration.
 *
 * Returns the fully dark config unless `WITUS_OIDC_CLIENT_ID` is set — the same env the bespoke
 * authorize route already requires. If this app is not a configured ecosystem client there is no
 * shared session to probe and none to end, so the "Sign in with WitUS" button disappears and
 * sign-out stays purely local. An affordance the visitor cannot complete is worse than none.
 *
 * CentenarianOS is single-brand (centenarianos.com); it serves no tenant- or customer-branded
 * hosts, so there is no white-label host gate to apply on top of this. If that ever changes, this
 * function is where the host check belongs — resolved from the request host on the SERVER, never
 * from client-supplied data.
 */
export function resolveWitusSsoConfig(): WitusSsoConfig {
  const clientId = process.env.WITUS_OIDC_CLIENT_ID;
  if (!clientId) return WITUS_SSO_DISABLED;

  const authorizeUrl = process.env.WITUS_OIDC_AUTHORIZE_URL ?? WITUS_OIDC_AUTHORIZE_FALLBACK;
  const endSessionBase = endSessionEndpointFromAuthorizeUrl(authorizeUrl);

  return {
    enabled: true,
    // An explicit override wins, because that path is owned by the IdP app, not by this one.
    silentCheckUrl:
      process.env.WITUS_SSO_SESSION_URL ?? silentSsoEndpointFromAuthorizeUrl(authorizeUrl),
    // client_id IS REQUIRED, not optional. better-auth's endSession endpoint rejects a
    // post_logout_redirect_uri with invalid_request ("client_id is required when using
    // post_logout_redirect_uri without a valid id_token_hint") unless the request carries either a
    // verifiable id_token_hint or an explicit client_id. We have no id_token client-side, so we
    // send client_id — baked in HERE, on the server, because the sign-out buttons are client
    // components and must not be handed the raw env.
    endSessionUrl: endSessionBase
      ? `${endSessionBase}?client_id=${encodeURIComponent(clientId)}`
      : null,
  };
}
