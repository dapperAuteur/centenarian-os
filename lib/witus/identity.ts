// lib/witus/identity.ts
// WitUS identity <-> CentenarianOS user, through the witus_identities table.
//
// WHY THIS EXISTS
// Sibling apps (RideWitUS first) have no shared database with CentenarianOS, so
// they cannot know a CentenarianOS user_id. They know the WitUS IdP subject
// (`sub`) from "Sign in with WitUS". The callback at
// app/api/auth/witus/callback/route.ts writes one witus_identities row per user
// (sub -> user_id, linked by email on first WitUS sign-in to CentenarianOS).
// Until this file, nothing read that table.
//
// UNKNOWN SUBJECT
// A sub with no row is not an error on either side: the person has used WitUS
// to sign in to the sibling app but never to CentenarianOS. Callers answer
// with the typed reason `unknown_subject` (RideWitUS PRD §6.3): the sibling
// keeps its event queued, and the next retry succeeds once the person signs in
// to CentenarianOS with WitUS once.
//
// The table has RLS on and no policies (migration 20260630120000), so pass the
// service-role client. Pure apart from the injected client, with no '@/'
// imports, so node --test loads it (tests/unit/witus-identity.test.ts).

/** The part of a Supabase client this file uses; the service client and the test fake both fit. */
export interface IdentityDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export type SubjectLookup =
  | { ok: true; userId: string }
  | { ok: false; reason: 'unknown_subject' | 'invalid_subject' | 'lookup_failed' };

export type UserLookup =
  | { ok: true; sub: string }
  | { ok: false; reason: 'no_identity' | 'invalid_user' | 'lookup_failed' };

/** OIDC subjects are opaque strings. Bound the length so junk never reaches a query. */
const MAX_SUB_LENGTH = 255;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isWitusSub(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= MAX_SUB_LENGTH;
}

/** The CentenarianOS user for a WitUS subject. */
export async function userIdForWitusSub(db: IdentityDb, sub: unknown): Promise<SubjectLookup> {
  if (!isWitusSub(sub)) return { ok: false, reason: 'invalid_subject' };
  const { data, error } = await db
    .from('witus_identities')
    .select('user_id')
    .eq('witus_sub', sub)
    .maybeSingle();
  if (error) return { ok: false, reason: 'lookup_failed' };
  const userId = (data as { user_id?: unknown } | null)?.user_id;
  if (typeof userId !== 'string' || !userId) return { ok: false, reason: 'unknown_subject' };
  return { ok: true, userId };
}

/** The WitUS subject for a CentenarianOS user (for events CentenarianOS sends out). */
export async function witusSubForUserId(db: IdentityDb, userId: unknown): Promise<UserLookup> {
  if (typeof userId !== 'string' || !UUID_RE.test(userId)) return { ok: false, reason: 'invalid_user' };
  const { data, error } = await db
    .from('witus_identities')
    .select('witus_sub')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { ok: false, reason: 'lookup_failed' };
  const sub = (data as { witus_sub?: unknown } | null)?.witus_sub;
  if (!isWitusSub(sub)) return { ok: false, reason: 'no_identity' };
  return { ok: true, sub };
}
