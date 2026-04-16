# Plan 32 — Admin Email Verification Dashboard

> **Status:** Shipping in this branch (`feat/admin-email-verification`).
> **Source:** owner request 2026-04-16 — "show admin which users have verified email, resend manually per-user and bulk."
> **Effort:** ~2 hrs.

---

## 1. Context

Users who sign up but never click the Supabase verification email remain in limbo — authenticated enough to browse some pages but blocked from certain actions (and eligible to churn before first use). Today there's no admin visibility into who's in this state, and no way to nudge them. This plan adds:

1. A `Verified` column in `/admin/users` with a filter for the unverified subset.
2. A per-row "Resend verification" button.
3. A header-level "Resend to all unverified" button (with confirmation modal, since it's a bulk email send).

## 2. Data source

Supabase's `auth.users.email_confirmed_at` column is the source of truth. `/api/admin/users` already uses `db.auth.admin.listUsers()` — we just need to thread the `email_confirmed_at` value through into the response. No new DB column, no migration.

## 3. Resend mechanism

Supabase admin API: `db.auth.admin.generateLink({ type: 'signup', email })` creates a fresh confirmation link for an unverified user. When the project's SMTP is configured (it is — the standard signup flow relies on it), Supabase also fires the confirmation email automatically. If SMTP isn't configured, the API returns the link but no email — the admin sees a 200 response with the link in the `properties.action_link` field and can manually forward.

This plan does NOT add a new email provider integration. If the existing signup-email flow works for users, the admin resend will work too (same codepath on Supabase's side).

## 4. API routes

- `POST /api/admin/users/[id]/resend-verification` — single user resend. Returns `{ ok, action_link?, alreadyVerified? }`.
- `POST /api/admin/users/resend-all-unverified` — bulk resend. Returns `{ attempted, succeeded, failed, alreadyVerified }`. Capped at 100 users per call to avoid timeouts; the UI shows a warning and refuses when there are >100 unverified.

Both routes admin-gated via `ADMIN_EMAIL` match.

## 5. UI surface

Extend existing [app/admin/users/page.tsx](app/admin/users/page.tsx):

- `UserRow` gains `email_confirmed_at: string | null`.
- New filter pill: `Unverified` alongside the existing `all/free/monthly/lifetime/promo_pending`.
- New column `Verified`: green checkmark for verified users, amber envelope + "Resend" button for unverified.
- Header: when ≥1 unverified user visible, show "Resend to all unverified" button next to the search. Confirmation modal before firing.
- Toasts for single-resend success/failure; summary toast for bulk.

## 6. Rate limits + abuse guards

- Supabase's own rate limits apply per email (roughly 2 resends per hour per email for the built-in signup flow).
- Bulk endpoint caps at 100 users and runs resends sequentially with `Promise.allSettled` (not `Promise.all`) so one failure doesn't abort the rest.
- Individual resend is unlimited from the admin's side — Supabase's per-email rate limit is the real ceiling.
- No change-history logging for v1. If the owner needs "when was this user last resent," add a `last_verification_resend_at` column later.

## 7. Out of scope

- Customizing the verification email template — stays as Supabase's default.
- Auto-resending on a schedule (e.g., 24h after signup, 72h after signup). Plan 32.1 if needed later.
- Marking a user verified manually (admin override). Plan 32.2 if needed later — Supabase's `updateUserById({ id, email_confirm: true })` does this trivially if added.

## 8. Verification checklist

1. Admin visits `/admin/users` → `Verified` column populated for every user.
2. Filter by `Unverified` → only unverified users remain.
3. Click per-row Resend → toast: "Verification email sent to foo@bar.com" (or the action link if SMTP isn't configured).
4. Click "Resend to all unverified" → confirmation modal → confirm → toast: "Sent N verification emails (M already verified, F failed)."
5. User who received the email clicks through → `email_confirmed_at` populated → reappears as ✓ on next admin refresh.
