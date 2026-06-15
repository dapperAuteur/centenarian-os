// lib/lead/session.ts
// Anonymous lead-session id. One first-party cookie (wl_sid) threads a visitor's
// downloads and email captures together before they sign up; on enrollment we copy it to
// profiles.lead_session_id so pre-signup activity is attributable to the eventual user.
// No React here so this is safe to import from client and server. The client ensures the
// cookie; API routes read it from the request cookie store.

export const LEAD_SESSION_COOKIE = 'wl_sid';
export const LEAD_SESSION_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function genLeadSessionId(): string {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch { /* fall through */ }
  return `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Client-only: read the wl_sid cookie, creating it if missing. Returns '' on the server.
 */
export function ensureLeadSession(): string {
  if (typeof document === 'undefined') return '';
  const found = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${LEAD_SESSION_COOKIE}=`));
  if (found) return decodeURIComponent(found.split('=')[1] || '');
  const id = genLeadSessionId();
  document.cookie = `${LEAD_SESSION_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${LEAD_SESSION_MAX_AGE}; samesite=lax`;
  return id;
}
