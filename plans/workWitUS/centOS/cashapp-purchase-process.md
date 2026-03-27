# CashApp Lifetime Purchase Process — Full Specification

**Date:** 2026-03-26
**Apps:** CentenarianOS, ContractorOS (Work.WitUS), any future apps
**Purpose:** Reusable spec for implementing CashApp as a fee-reduced payment option for one-time lifetime purchases alongside Stripe.

---

## Why CashApp

- CashApp charges **2.75%** per received payment vs Stripe's ~3.4% + 30¢
- No monthly fees, no contracts
- Users perceive it as "no processing fees" (lower price point: $100 vs $103.29)
- Broadens payment options for users without credit/debit cards
- **Limitations:** No API, no webhooks, no recurring billing — manual verification required. Use only for one-time lifetime purchases.

---

## User-Facing Flow

### Step 1: User sees CashApp option on pricing page

Below the Stripe plan cards, a collapsible section:

```
[ Pay with CashApp — $100 Lifetime (no processing fees) ]
```

When expanded, shows:
- **QR code image** (stored at `public/images/cashapp-qr.jpg`)
- **CashApp tag** (e.g., `$centenarian` or `$workwitus`)
- **Amount** ($100 — the net amount, no Stripe fee markup)
- **3-step instructions:**
  1. Send $100 to `$centenarian` on CashApp
  2. Enter your CashApp display name below
  3. Click "I've Paid" — we'll verify and activate your account

### Step 2: User sends money via CashApp (outside the app)

User opens CashApp on their phone, sends $100 to the business CashApp tag. This happens entirely within CashApp — the app has no visibility into this step.

### Step 3: User submits confirmation in the app

After sending money, the user returns to the pricing page and fills out:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| CashApp display name | Text input | No (recommended) | Helps admin match the payment in CashApp transaction history |
| Email | Auto-filled | Yes | From their authenticated session — used for confirmation email |

User clicks **"I've Paid"** button.

**If not logged in:** The app shows a login/signup modal first. After auth, the submission proceeds automatically.

**Validations before submission:**
- User must be authenticated
- User must not already be a lifetime member (`subscription_status !== 'lifetime'`)
- User must not have an existing pending CashApp payment

### Step 4: Payment record created

`POST /api/cashapp` creates a row in `cashapp_payments`:

```json
{
  "user_id": "uuid-from-auth",
  "amount": 100.00,
  "cashapp_name": "JohnDoe123",
  "screenshot_url": null,
  "status": "pending"
}
```

User sees a success message:
> "Payment Submitted! We'll verify your CashApp payment and activate your lifetime membership shortly. Check your billing page for status updates."

### Step 5: User can check status

`GET /api/cashapp` returns the user's latest payment:

```json
{
  "id": "uuid",
  "amount": 100.00,
  "cashapp_name": "JohnDoe123",
  "status": "pending",
  "created_at": "2026-03-26T..."
}
```

The billing page can optionally show a "CashApp payment pending" banner if `status === 'pending'`.

---

## Admin Verification Flow

### Step 1: Admin sees pending payments

Admin navigates to `/admin/cashapp`. The page shows:

**Pending Review** section:
- User email
- Amount ($100)
- CashApp display name (if provided)
- Submission date/time
- Current subscription status
- **Approve** button (green)
- **Reject** button (red)

**History** section:
- All processed payments (verified/rejected) with dates and admin notes

### Step 2: Admin cross-references in CashApp

Admin opens the CashApp for Business app (or web dashboard) and:
1. Checks recent received payments for $100
2. Matches by CashApp display name and/or date/time
3. Confirms the payment was actually received

### Step 3: Admin approves or rejects

**Approve (`action: 'verify'`):**

`PATCH /api/admin/cashapp` with `{ id, action: 'verify' }`:

1. Updates `cashapp_payments.status` → `'verified'`
2. Sets `verified_by` (admin user ID) and `verified_at` timestamp
3. Updates `profiles`:
   - `subscription_status` → `'lifetime'`
   - `shirt_promo_code` → generated Shopify code (if applicable)
   - `stripe_subscription_id` → `null`
   - `subscription_expires_at` → `null`
4. Sends **confirmation email** to user via Resend:
   - Subject: "Your CashApp payment is confirmed — Lifetime access is active!"
   - Body: Welcome message, promo code card (if generated), dashboard link
5. Logs success

**Reject (`action: 'reject'`):**

`PATCH /api/admin/cashapp` with `{ id, action: 'reject', admin_notes: 'reason' }`:

1. Admin is optionally prompted for rejection reason
2. Updates `cashapp_payments.status` → `'rejected'`
3. Sets `admin_notes` with reason
4. Sends **rejection email** to user:
   - Subject: "CashApp payment update — action needed"
   - Body: Rejection reason, link to pricing page to retry or use card
5. **Does NOT change** `profiles.subscription_status`

---

## Database Schema

### `cashapp_payments` table

```sql
CREATE TABLE IF NOT EXISTS public.cashapp_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  cashapp_name TEXT,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'rejected')),
  admin_notes TEXT,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cashapp_payments ENABLE ROW LEVEL SECURITY;

-- Users can see their own payments
CREATE POLICY "Users can view own cashapp payments"
  ON public.cashapp_payments FOR SELECT
  USING (auth.uid() = user_id);

-- Users can submit payments
CREATE POLICY "Users can submit cashapp payments"
  ON public.cashapp_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admin updates (verify/reject) use service role client (bypasses RLS)
```

### Optional: `screenshot_url` field

The current CentOS implementation does **not** require a screenshot — the CashApp display name + admin cross-referencing is sufficient. However, the `screenshot_url` column exists for future use if you want to:
- Add a Cloudinary upload button next to the CashApp name input
- Allow users to upload a screenshot of their CashApp payment confirmation
- Display the screenshot in the admin review queue

To add screenshot upload later:
1. Add an `ImageAttachmentPicker` component next to the CashApp name input
2. On upload, set `screenshot_url` to the Cloudinary secure_url
3. In the admin page, show the screenshot as a clickable thumbnail

---

## API Reference

### User APIs

**`GET /api/cashapp`** (authenticated)
- Returns user's latest CashApp payment or `null`
- Response: `{ id, amount, cashapp_name, status, created_at }` or `null`

**`POST /api/cashapp`** (authenticated)
- Creates a new pending CashApp payment
- Body: `{ cashapp_name?: string, screenshot_url?: string }`
- Validations:
  - Must be authenticated (401 if not)
  - Must not be lifetime already (400)
  - Must not have existing pending payment (400)
- Response: `{ id, status: 'pending', created_at }` (201)

### Admin APIs

**`GET /api/admin/cashapp`** (admin only)
- Returns all CashApp payments enriched with user email + current subscription status
- Response: `[{ id, user_id, amount, cashapp_name, screenshot_url, status, admin_notes, verified_at, created_at, email, current_status }]`

**`PATCH /api/admin/cashapp`** (admin only)
- Approve or reject a payment
- Body: `{ id: string, action: 'verify' | 'reject', admin_notes?: string }`
- On verify: activates lifetime, generates promo code, sends confirmation email
- On reject: updates status, sends rejection email
- Response: `{ ok: true, status: 'verified' | 'rejected' }`

---

## Email Templates

### Approval Email

**Subject:** Your CashApp payment is confirmed — Lifetime access is active!

**Content:**
- Personalized greeting (uses `user_metadata.full_name` or "there")
- "Your CashApp payment has been verified and your Lifetime membership is now active."
- Shirt promo code card (green background, monospace code, link to AwesomeWebStore.com)
- "Go to Dashboard" CTA button
- "Questions? Reply to this email" footer

### Rejection Email

**Subject:** CashApp payment update — action needed

**Content:**
- "We were unable to verify your CashApp payment."
- Rejection reason (if admin provided one)
- "Please check your CashApp transaction and try again, or use card payment."
- "View Pricing" CTA button
- "Need help? Reply to this email" footer

---

## Accounting & Revenue Tracking

### Paid vs Gifted Distinction

CashApp-verified users are counted as **paid** in revenue calculations:

| Check | Method |
|-------|--------|
| Stripe paid | `profiles.stripe_customer_id IS NOT NULL` |
| CashApp paid | `cashapp_payments.status = 'verified'` (count rows) |
| Total paid lifetime | Stripe paid + CashApp verified |
| Gifted/invited | `subscription_status = 'lifetime'` but no `stripe_customer_id` and no verified CashApp payment |

**Important:** CashApp users do NOT get `stripe_customer_id` set (they didn't go through Stripe). The founders counter query explicitly counts both:

```sql
-- Stripe paid
SELECT count(*) FROM profiles
WHERE subscription_status = 'lifetime' AND stripe_customer_id IS NOT NULL;

-- CashApp paid
SELECT count(*) FROM cashapp_payments WHERE status = 'verified';

-- Total paid = sum of both
```

### Admin Stats

The admin overview shows:
- Total lifetime members (all)
- Paid lifetime (Stripe + CashApp)
- Gifted lifetime (total - paid)
- Founders counter: X of 100 paid slots used

---

## Multi-App Considerations (Shared DB)

If both CentenarianOS and ContractorOS share the same Supabase database:

1. **Add `app` column** to `cashapp_payments` if you want to track which app the payment came from:
   ```sql
   ALTER TABLE cashapp_payments ADD COLUMN app TEXT DEFAULT 'centenarian';
   ```
   Filter by `app` in all queries.

2. **Different CashApp tags** per app:
   - CentenarianOS: `$centenarian`
   - ContractorOS: `$workwitus` (or whatever your tag is)

3. **Different QR codes** per app — store at `public/images/cashapp-qr.jpg` in each repo.

4. **Same admin email** can manage both — the admin PATCH route just needs to check the right `ADMIN_EMAIL` env var.

5. **Separate promo code generation** — if only one app offers the shirt promo, gate the Shopify call by app context.

---

## Implementation Checklist

- [ ] Create CashApp Business account and note your `$cashtag`
- [ ] Generate QR code from CashApp app, save to `public/images/cashapp-qr.jpg`
- [ ] Run migration to create `cashapp_payments` table
- [ ] Create `POST /api/cashapp` (user submission)
- [ ] Create `GET /api/cashapp` (user status check)
- [ ] Create `GET /api/admin/cashapp` (admin list)
- [ ] Create `PATCH /api/admin/cashapp` (admin approve/reject + email)
- [ ] Add CashApp section to pricing page (QR + name input + submit)
- [ ] Add `/admin/cashapp` page (pending queue + history)
- [ ] Add CashApp link to admin sidebar
- [ ] Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` env vars for email notifications
- [ ] Test: submit payment → admin approves → user gets email + lifetime activated
- [ ] Test: submit payment → admin rejects → user gets email + status stays free
- [ ] Verify admin stats correctly count CashApp verified payments in revenue
