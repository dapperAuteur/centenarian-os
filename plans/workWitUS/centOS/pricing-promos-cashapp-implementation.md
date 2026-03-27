# CentOS → ContractorOS: Pricing, Promos, CashApp & Founder's Counter Implementation Guide

**Date:** 2026-03-26
**Source:** CentenarianOS branches merged March 2026
**Target:** ContractorOS (Work.WitUS)

---

## Overview

This guide covers implementing the following CentOS features in ContractorOS:
1. Price updates (Monthly + Lifetime)
2. CashApp payment option (lifetime only)
3. Lifetime founder's counter (first N users at a special price)
4. Admin promo campaign management
5. Teacher/platform fee changes

---

## 1. Price Updates

### What changed
- Monthly: updated display price
- Lifetime: updated display price to cover Stripe processing fees (you net a target amount)

### Files to update in ContractorOS

| File | What to change |
|------|---------------|
| Pricing page | Update displayed dollar amounts for Monthly and Lifetime |
| Billing page | Update "Monthly — $X/month" label and "Upgrade to Lifetime for $X" CTA |
| FAQ text on pricing page | Update price references in Q&A text |
| Admin stats route | Update `lifetimeRevenue` and `monthlyMRR` multipliers to match new prices |
| Admin overview page | Update stat card labels ("Monthly ($X)", "Lifetime ($X)") |
| Demo page (if exists) | Update promotional pricing text |
| Help articles (`lib/help/articles.ts` or equivalent) | Update any price references |
| Codebase context (`lib/admin/codebase-context.ts` or equivalent) | Update price references |
| Tutorial CSV templates | Search for old prices and replace |
| README.md | Update pricing section |

### Stripe Dashboard
- Create new Price objects in Stripe Dashboard for the updated amounts
- Update env vars `STRIPE_MONTHLY_PRICE_ID` and `STRIPE_LIFETIME_PRICE_ID` with new Price IDs

### Search patterns to find all references
```bash
grep -rn '\$10/mo\|\$10/month\|\$100 one-time\|Lifetime.*\$100' --include='*.{ts,tsx,md,csv}' app/ lib/ content/ public/templates/
```

---

## 2. CashApp Payment (Lifetime Only)

### Database
**Migration** (use next available number):
```sql
CREATE TABLE IF NOT EXISTS public.cashapp_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  cashapp_name TEXT,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  admin_notes TEXT,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cashapp_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cashapp payments"
  ON public.cashapp_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can submit cashapp payments"
  ON public.cashapp_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### API Routes

**User-facing: `app/api/cashapp/route.ts`**
- `GET` — returns current user's latest CashApp payment status
- `POST` — submits a new payment (validates: not already lifetime, no pending payment exists)
  - Body: `{ cashapp_name?: string, screenshot_url?: string }`
  - Hardcode amount to your lifetime price (e.g., 100.00)
  - Returns `{ id, status: 'pending', created_at }`

**Admin: `app/api/admin/cashapp/route.ts`**
- `GET` — lists all CashApp payments with user email enrichment
- `PATCH` — approve or reject: `{ id, action: 'verify'|'reject', admin_notes? }`
  - On verify: update `profiles` to `subscription_status: 'lifetime'`, generate shirt promo code (if applicable), clear subscription fields
  - On reject: just update status + notes

### Pricing Page Changes
- Add "Pay with CashApp" section below plan cards
- Show QR code image + CashApp tag
- Expandable section with:
  - QR code (`<Image>` from `next/image`)
  - Instructions (1. Send $X, 2. Enter CashApp name, 3. Click "I've Paid")
  - Input for CashApp display name
  - Submit button ("I've Paid")
  - Success state after submission
- **Important:** Add `import Image from 'next/image'` — this was missed in CentOS initially

### Admin Page: `/admin/cashapp`
- Queue of pending payments with Approve/Reject buttons
- History section showing processed payments
- Add to admin sidebar navigation

### CashApp Business Notes
- CashApp charges 2.75% per received payment — it is NOT fee-free
- No recurring billing — customer-initiated payments only
- No API/webhooks — manual verification required
- Only use for lifetime (one-time) purchases, not monthly

---

## 3. Lifetime Founder's Counter

### Database
**Migration:**
```sql
INSERT INTO public.platform_settings (key, value, updated_at) VALUES
  ('lifetime_founders_limit', '100', now()),
  ('lifetime_founders_label', 'Founder''s Price', now())
ON CONFLICT (key) DO NOTHING;
```

### Public API: `app/api/pricing/founders/route.ts`
- `GET` — returns `{ limit, count, remaining, active }`
- Count = paid lifetime (has `stripe_customer_id` not null) + verified CashApp payments
- **Critical:** Exclude gifted/invited accounts from the count — only count users who actually paid
- If `remaining <= 0`, return `active: false`

### Pricing Page
- Fetch from `/api/pricing/founders` on mount
- If active, show on lifetime card:
  - "Founder's Price — X of Y remaining"
  - Progress bar showing fill percentage

### Admin Stats
- Add `founders` object to admin stats API: `{ limit, paidLifetime, remaining, giftedLifetime }`
- Distinguish paid vs gifted: paid = has `stripe_customer_id` not null

---

## 4. Admin Promo Campaign Management

### Database
**Migration:**
```sql
CREATE TABLE IF NOT EXISTS public.admin_promo_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage','fixed','free_months')),
  discount_value NUMERIC(10,2) NOT NULL,
  stripe_coupon_id TEXT,
  plan_types JSONB NOT NULL DEFAULT '["lifetime"]'::jsonb,
  promo_code TEXT,
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  max_uses INT,
  current_uses INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_promo_campaigns ENABLE ROW LEVEL SECURITY;
-- Only service role can access
```

### Admin API: `app/api/admin/promos/route.ts`
- `GET` — list all campaigns ordered by created_at desc
- `POST` — create campaign + auto-create Stripe coupon
  - `percentage` → `stripe.coupons.create({ percent_off, duration: 'once' })`
  - `fixed` → `stripe.coupons.create({ amount_off: cents, currency: 'usd', duration: 'once' })`
  - `free_months` → no Stripe coupon needed
- `PATCH` — toggle `is_active`, update `end_date`

### Public API: `app/api/pricing/promo/route.ts`
- `GET` — returns the currently active promo (if any)
- Query: `is_active = true`, `start_date <= now`, `end_date is null OR >= now`, `current_uses < max_uses`
- Returns: `{ name, discount_type, discount_value, promo_code, end_date, plan_types }`

### Admin Page: `/admin/promos`
- Create campaign form (modal): name, description, discount type, value, promo code, end date, max uses
- Campaign list with Active/Inactive sections
- Toggle activate/deactivate button per campaign
- Show usage count, promo code, discount badge, end date

### Pricing Page Integration
- Fetch active promo from `/api/pricing/promo` on mount
- If active: show strikethrough original price + discounted price + "Ends [date]" or "X remaining"

### Checkout Integration
- When creating Stripe checkout session, check for active promo
- If promo has `stripe_coupon_id`, add to checkout: `discounts: [{ coupon: stripeCouponId }]`
- After successful checkout, increment `current_uses` on the campaign

---

## 5. Teacher/Platform Fee Change

### Files to update
- **Enrollment route** (`app/api/academy/courses/[id]/enroll/route.ts`): Change fallback from `'15'` to `'10'` in `Number(feeSetting?.value ?? '10')`
- **Admin academy settings page**: Change default from `'15'` to `'10'`
- **Help articles**: Update any "15%" references to "10%"
- **Codebase context**: Update fee references
- **platform_settings table**: Update the `teacher_fee_percent` row value to `'10'` via admin settings page or direct SQL

---

## Implementation Order

1. **Price updates** — update all display text + Stripe Price objects
2. **Teacher fee** — change default + DB value
3. **CashApp** — migration + API + pricing page + admin page
4. **Founders counter** — migration + API + pricing page + admin stats
5. **Promo campaigns** — migration + API + admin page + pricing page integration

---

## Shared DB Notes

Since both apps share the same Supabase database:
- `cashapp_payments` table is shared — add an `app` column if you want to distinguish which app the payment came from, OR keep it simple since the user's profile determines which app they use
- `admin_promo_campaigns` already has a `plan_types` JSONB column — you could add an `app` discriminator column if you want separate promos per app
- `platform_settings` is shared — the `lifetime_founders_limit` applies to both apps unless you key it per app (e.g., `centos_lifetime_founders_limit`, `workwitus_lifetime_founders_limit`)

---

## Common Pitfalls from CentOS Implementation

1. **Missing `import Image from 'next/image'`** — caused build failure when adding CashApp QR code
2. **CashApp state declarations lost during merge** — 5 `useState` hooks for the CashApp section on pricing page
3. **Unused constant warning** — `DISCOUNT_LABELS` defined but not used in promos page
4. **Distinguishing paid vs gifted lifetime** — founders counter must exclude invited/gifted accounts. Filter by `stripe_customer_id IS NOT NULL` for Stripe-paid, plus count verified CashApp payments separately
5. **Excalidraw `export: false` type** — if hoisting UIOptions to a constant, use `as const` to preserve literal type
6. **Content status `fs.stat` on Vercel** — serverless functions don't have repo files. Use a prebuild manifest script instead
