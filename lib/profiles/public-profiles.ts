// lib/profiles/public-profiles.ts
// Where public pages read OTHER users' profile fields from.
//
// After migration 207 the `profiles` table is readable only by the row's owner (and the service
// role). Author names, avatars and bios for blog posts, recipes and cook/author pages come from the
// `public_profiles` view (migration 206), which carries only the columns below. Reading your own
// profile (settings, subscription, onboarding) still uses `profiles`.
//
// The column lists here are checked against the migrations by tests/unit/public-profiles.test.ts.

/** View with the public columns of every profile. Safe to read with the anon key. */
export const PUBLIC_PROFILES_VIEW = 'public_profiles';

/** Columns the public_profiles view exposes (must match migration 206). */
export const PUBLIC_PROFILE_COLUMNS = [
  'id',
  'username',
  'display_name',
  'bio',
  'avatar_url',
  'created_at',
  'updated_at',
] as const;

export type PublicProfileColumn = (typeof PUBLIC_PROFILE_COLUMNS)[number];

/**
 * Columns a browser session can never set (migration 206 trigger rejects the change). Only server
 * code with the service role writes these: Stripe webhooks/sync, checkout, admin routes.
 */
export const PROTECTED_PROFILE_COLUMNS = [
  'subscription_status',
  'subscription_expires_at',
  'stripe_customer_id',
  'stripe_subscription_id',
  'cancel_at',
  'cancel_at_period_end',
  'cancellation_feedback',
  'cancellation_comment',
  'shirt_promo_code',
  'role',
  'contractor_role',
  'invite_limit',
  'products',
  'lead_session_id',
  'selected_modules',
] as const;
