// lib/mfa/helpers.ts
// Shared MFA utilities for login and settings pages.

import { SupabaseClient } from '@supabase/supabase-js';

export async function getAalAndFactors(supabase: SupabaseClient) {
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  return {
    currentLevel: aalData?.currentLevel ?? 'aal1',
    nextLevel: aalData?.nextLevel ?? 'aal1',
    hasMfaEnabled: (factorsData?.totp ?? []).some((f) => f.status === 'verified'),
    factors: factorsData,
  };
}

export function needsMfaVerification(currentLevel: string, nextLevel: string) {
  return nextLevel === 'aal2' && currentLevel !== 'aal2';
}
