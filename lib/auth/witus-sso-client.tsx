'use client';

// File: lib/auth/witus-sso-client.tsx
// Client-side context + hook for the server-resolved ecosystem SSO config. The server root layout
// hydrates this once (see app/layout.tsx); client components — the login button, the three nav
// menus with a logout row — consume it with useWitusSso().
//
// Same shape as lib/i18n/client.tsx, and for the same reason: every sign-in/sign-out affordance in
// this app lives inside a 'use client' tree, so the only way to give them a SERVER-resolved value
// is to read it in the server layout and pass it down. A client component must never read
// process.env.WITUS_OIDC_* itself.

import { createContext, useContext } from 'react';
import { WITUS_SSO_DISABLED, type WitusSsoConfig } from './witus-sso';

const WitusSsoContext = createContext<WitusSsoConfig>(WITUS_SSO_DISABLED);

export function WitusSsoProvider({
  value,
  children,
}: {
  value: WitusSsoConfig;
  children: React.ReactNode;
}) {
  return <WitusSsoContext.Provider value={value}>{children}</WitusSsoContext.Provider>;
}

/**
 * The ecosystem SSO config for this render. Defaults to the fully dark config, so a component that
 * somehow renders outside the provider degrades to today's behaviour (local-only sign-out, no
 * WitUS button) rather than to a broken affordance.
 */
export function useWitusSso(): WitusSsoConfig {
  return useContext(WitusSsoContext);
}
