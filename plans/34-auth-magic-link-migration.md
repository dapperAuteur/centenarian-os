# Plan 34 — Magic-Link Auth Migration

> **Status:** Backlog stub. Owner confirmed priority 2026-04-16.
> **Source:** ecosystem alignment per [`ecosystem/README.md` Auth Alignment table](ecosystem/README.md). CentOS currently lists "Email/password + OTP" — target is magic link.
> **Effort:** Medium — estimate 2–4 days. Not a from-scratch rewrite; Supabase already supports magic links.

---

## 1. Context

Every WitUS app is supposed to migrate toward magic-link authentication for eventual single-sign-on via the WitUS account system (a future goal, not blocking). CentOS is currently email/password + OTP. New auth-touching changes must move toward magic-link, not away.

This plan is a dedicated migration — not blocking on any current work, but sizeable enough to warrant its own branch series.

---

## 2. Scope

**In scope:**
- Enable Supabase Auth email magic-link delivery (`supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })`) as the primary signup + login path.
- Landing page login/signup forms updated: email field only, then "Check your inbox" confirmation state.
- Existing email/password still works for existing users (no forced migration; they can continue to log in with password). Phase in magic-link-only for new signups first.
- OTP codes remain as an MFA option when the user opts in.
- Session handling unchanged — the existing `@supabase/ssr` client works with magic link identically.
- `/login` and `/signup` UI updates.
- Email template updates in Supabase dashboard (done by owner in Supabase console, not code).

**Out of scope:**
- Password migration tooling — we're not removing passwords, just preferring magic links.
- WitUS single-sign-on implementation — separate larger effort, this is the prerequisite.
- Social login providers (Google, Apple, etc.) — separate decision.

---

## 3. Migration phases

1. **Phase A:** Magic-link enabled as opt-in secondary path on existing login page. "Sign in with email" link alongside password field. Ships under a feature flag so we can roll back if delivery has issues.
2. **Phase B:** Magic-link is default on `/signup`. Password signup still possible via "prefer a password" expander.
3. **Phase C:** Magic-link is default on `/login` too. Password login hidden behind "Use password instead" expander.
4. **Phase D:** Monitor for 30 days. If delivery reliability is ≥99% and support tickets don't spike, treat magic-link as primary.

Don't collapse phases into a single branch — each one is its own deploy + watch window.

---

## 4. Things to verify before starting

- Supabase project email SMTP is configured and deliverable (the existing signup-confirm email flow proves this, so likely fine).
- Rate limit on `auth.signInWithOtp` — Supabase default is 2/min per email; confirm doesn't bottleneck the "forgot I just sent one" case.
- Current `/api/auth/verify-turnstile` bot check plays nicely with magic-link signup.

---

## 5. Out-of-scope but related

- Passwordless migration for Teacher plan subscribers (they pay through a Stripe checkout that already captures email — no friction impact).
- Team / sub-account sharing (not built, different scope).

---

## 6. Next actions for the human

This plan goes live when it reaches the top of the queue. After plan 33 ships, re-evaluate against any other owner priorities.
