// lib/ridewitus/witus-sub.ts
// Server-only. The user's WitUS account id (`sub`), which every event to RideWitUS carries
// (RideWitUS PRD §6.3). A thin wrapper over the shared lookup in lib/witus/identity.ts, kept so
// the calendar activity feed's call sites stay unchanged.

import type { SupabaseClient } from '@supabase/supabase-js';
import { witusSubForUserId } from '../witus/identity.ts';

/** The user's witus_sub, or null when they have never signed in with WitUS (or the lookup failed). */
export async function witusSubForUser(db: SupabaseClient, userId: string): Promise<string | null> {
  const result = await witusSubForUserId(db, userId);
  if (result.ok) return result.sub;
  if (result.reason === 'lookup_failed') {
    console.error('[lib/ridewitus/witus-sub] could not read witus_identities');
  }
  return null;
}
