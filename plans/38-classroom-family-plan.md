# Plan 38 — Classroom / Family Plan for Academy

> **Status:** Backlog. Blocked on validation: don't build until at least one real teacher asks for it. Until then, high-school teachers can enroll students one-by-one via the standard flow.
> **Source:** owner request 2026-04-16 — listed as a minor gap in [`ecosystem/centenarianos-direction.md §3.2`](ecosystem/centenarianos-direction.md). Noted that BVC's grades-9–12 audience may want classroom bulk-enrollment.
> **Effort:** Medium-large — 4–6 days. New data model + billing + UI + emails.

---

## 1. Context

A high-school teacher who wants to assign BVC Episode 1 to their 28-student class currently has to:

- Have each student create their own CentenarianOS account
- Have each student separately enroll in the course (free preview or paid)
- Have no central visibility into the cohort until Plan 36 (teacher analytics) ships

A classroom/family plan lets one paying account (teacher, parent, or org admin) sponsor N sub-accounts, manage their enrollments, and see their progress.

**Decision gate:** do not start this plan without evidence of real demand. One teacher email asking for bulk-enrollment. One parent asking to buy for their homeschool co-op. Until then, the per-student flow is acceptable — BVC Episode 1 tests against that assumption.

---

## 2. Scope

**In scope (when we do build):**
- New data model: `family_plans` + `family_plan_members` (see §4).
- Stripe: new recurring price tier for N-seat plans (tiered: 5-seat, 15-seat, 30-seat, custom).
- Plan owner UI: invite/remove members, see per-member enrollment + progress, bulk-enroll all members into a course.
- Member invitation flow: email-link signup with family plan pre-attached; they skip pricing + go straight to course catalog.
- Billing visibility: plan owner sees one consolidated invoice; members see "covered by your family plan" in their billing page.
- Grace period: if plan owner cancels, members revert to free tier after 7 days.

**Out of scope:**
- Multi-org tenancy (school district buying a thousand seats). That's a separate "schools" product.
- Gradebook export to school LMS (Canvas, Schoology). Separate integration plan.
- SSO with school identity providers. Plan 34 (magic-link) must ship first; then SSO is a follow-up.
- Age-gating or COPPA compliance for students under 13. Defer unless we explicitly target K-8.

---

## 3. Pricing consideration

Per the ecosystem direction doc §1.3, Starter tier ($5.46/$51.80) stays CentOS-only for 90 days. Classroom plan pricing is a separate question — likely per-seat with a volume discount:

- 5 seats: $20/month ($4/seat) — small homeschool group
- 15 seats: $50/month ($3.33/seat) — full class
- 30 seats: $90/month ($3.00/seat) — two-section teacher
- 30+ custom: contact sales

All numbers net-of-Stripe-fees per owner pricing convention.

**Do not launch the product until pricing is owner-signed off — these are placeholders.**

---

## 4. Data model

```sql
-- supabase/migrations/NNN_family_plans.sql (number TBD when unblocked)
CREATE TABLE IF NOT EXISTS public.family_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  seat_limit        INT NOT NULL,
  stripe_subscription_id TEXT,
  stripe_price_id   TEXT,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','grace')),
  grace_ends_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.family_plan_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_plan_id  UUID NOT NULL REFERENCES public.family_plans(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_email   TEXT NOT NULL,
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at     TIMESTAMPTZ,
  role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','co_admin')),
  UNIQUE (family_plan_id, invited_email)
);
```

No `seats_used` column — compute from `COUNT(*) WHERE accepted_at IS NOT NULL`. Enforce `seat_limit` in application layer on invite send.

## 5. Enforcement points

- `lib/access/family-plan.ts` — helper `getFamilyPlanForUser(user_id)` returns `{ plan, role }` or null.
- Subscription hook change: `useSubscription()` now returns `effectiveStatus` which is the user's own status OR their active family plan's coverage (whichever grants more access). Currently `subStatus === 'free'` would be overridden to `'monthly'` when covered.
- Dashboard layout gate: adds the family-plan path alongside Starter + Invited + paid checks.
- Billing page: if covered by a family plan, shows "Covered by {plan owner name}'s Classroom plan" and hides Stripe management.

## 6. Invitation flow

1. Plan owner enters an email in `/dashboard/teaching/classroom` (or equivalent).
2. Row inserted into `family_plan_members` with `user_id=NULL`, `invited_email`, `invited_at`.
3. Email dispatched via Resend with a signup link carrying a signed token.
4. Member clicks link → creates account OR logs in if they already have one → on first authenticated request, `/api/auth/me` looks up pending invites by email, links `user_id`, sets `accepted_at`.
5. Member redirected to `/academy` with a welcome banner.

## 7. Files (when built)

New:
- `supabase/migrations/NNN_family_plans.sql`
- `lib/access/family-plan.ts`
- `app/api/family-plan/` — CRUD endpoints (create plan, invite, remove, list members)
- `app/dashboard/classroom/page.tsx` — plan-owner management UI
- `components/classroom/InviteMembers.tsx`
- `components/classroom/MemberList.tsx`
- `lib/emails/classroom-invite.ts`

Modified:
- `lib/hooks/useSubscription.ts` — add `effectiveStatus`
- `app/dashboard/layout.tsx` — family-plan gate path
- `app/api/auth/me/route.ts` — lazy-accept pending family invites
- `app/dashboard/billing/page.tsx` — "covered by" messaging

## 8. Verification (when built)

1. Owner creates a plan with 5 seats.
2. Invites 3 emails. All 3 receive emails.
3. First member clicks link → signs up → is in the plan, has `monthly`-equivalent access.
4. Owner tries to invite a 6th — blocked with "seat limit reached; upgrade to 15-seat".
5. Owner removes an accepted member → that member's `effectiveStatus` drops to their own base tier next page load.
6. Owner cancels Stripe subscription → `family_plans.status='grace'` for 7 days → after 7 days all members drop.
7. A removed member who was enrolled in a course retains their lesson_progress but hits the pricing page on next paid-route click.

## 9. Why this is blocked and not shipping now

Per ecosystem decision-making pattern: don't build features without evidence of demand. BVC Episode 1 can be assigned by a teacher one-student-at-a-time today — clunky, but workable. Until we hear "I want to buy BVC for my whole class in one click," this plan is a scoped backlog item, not an active priority.

If the owner hears that demand signal, this doc is ready to implement.
