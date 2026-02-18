/**
 * Admin access control for blog features.
 *
 * Set NEXT_PUBLIC_ADMIN_EMAILS in your .env.local as a comma-separated list:
 *   NEXT_PUBLIC_ADMIN_EMAILS=you@example.com,other@example.com
 *
 * NEXT_PUBLIC_ prefix makes it available client-side for UI gating.
 * Real enforcement happens server-side in API routes via the same check.
 */

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
  const admins = raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return admins.includes(email.toLowerCase());
}
