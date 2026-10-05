// lib/ridewitus/witus-sub.ts
// Server-only. The user's WitUS account id (`sub`), which every event to RideWitUS carries
// (RideWitUS PRD §6.3). Read from witus_identities (migration 20260630120000), written by the
// "Sign in with WitUS" callback.
//
// BUNDLE NOTE: a minimal local lookup. Another branch adds the shared lib/witus/identity.ts;
// when both land, replace this with that helper.

import type { SupabaseClient } from '@supabase/supabase-js';

/** The user's witus_sub, or null when they have never signed in with WitUS (or the table is missing). */
export async function witusSubForUser(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await db
    .from('witus_identities')
    .select('witus_sub')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[lib/ridewitus/witus-sub] could not read witus_identities:', error.code ?? error.message);
    return null;
  }
  const sub = (data as { witus_sub?: unknown } | null)?.witus_sub;
  return typeof sub === 'string' && sub ? sub : null;
}
