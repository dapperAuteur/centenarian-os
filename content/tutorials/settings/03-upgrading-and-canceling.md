# Lesson 03: Upgrading and Canceling

**Course:** Settings & Billing
**Module:** Billing
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

This lesson covers two billing transitions: upgrading from Monthly to Lifetime, and canceling a Monthly subscription. Both are handled through Stripe — either the checkout flow or the Customer Portal.

---

### Upgrading to Lifetime

Lifetime membership is a one-time $100 payment that replaces your monthly subscription permanently.

**How to upgrade:**

1. Navigate to `/dashboard/billing`
2. In the dark **Upgrade to Lifetime** card, click **View Lifetime Plan**
3. You're taken to `/pricing` where the Lifetime card is highlighted
4. Click **Get Lifetime Access** on the Lifetime plan
5. Stripe Checkout opens — pay $100 one-time
6. After payment, Stripe redirects you to `/dashboard/billing?success=true`
7. The page confirms the payment ("Confirming your payment…") and your plan badge updates to **"Lifetime Member"** (lime green)

Your monthly subscription ends immediately when the Lifetime payment is processed. You won't be charged again for the monthly plan.

**What you get with Lifetime:**
- Everything included in Monthly
- No recurring fees — ever
- All future features as they're added
- A unique free shirt promo code for AwesomeWebStore.com (appears on the Billing page after payment — may take a moment to generate)

---

### Using the Shirt Promo Code

After upgrading to Lifetime, a lime-green card appears on your Billing page with a unique code. Copy it and use it at checkout on AwesomeWebStore.com to claim your free CentenarianOS shirt.

The code is generated once and stored permanently on your account — it won't expire. If you see "Shirt Promo Code Pending," refresh the page after a few seconds.

---

### Canceling a Monthly Subscription

You can cancel at any time. Cancellations are processed through the Stripe Customer Portal.

**How to cancel:**

1. Navigate to `/dashboard/billing`
2. Click **Manage Subscription**
3. In the Stripe Customer Portal, find the cancellation option
4. Confirm cancellation

After canceling:
- Your plan status on the Billing page changes from "Renews on [date]" to **"Cancels on [date]"** (shown in amber)
- You keep **full access** to all features until the end of your current billing period
- On the cancellation date, your account downgrades to free — blog and recipes access only

**You won't be charged again** once you cancel. The final charge was the last monthly payment you already made.

---

### Resubscribing After Cancellation

If you cancel and later want to come back:
- Navigate to `/pricing` and click **Start Monthly**
- Complete the Stripe Checkout flow
- Access is restored immediately upon payment

Your data (all logged health metrics, meals, trips, tasks, etc.) is preserved — canceling doesn't delete anything. Your history is waiting when you return.

---

### What Happens to Your Data on Downgrade?

When your subscription ends and you downgrade to free:
- All your logged data remains in your account
- You lose access to paid dashboard routes (Planner, Fuel, Engine, etc.)
- Your data is still there — it's just inaccessible until you resubscribe

Nothing is deleted. CentenarianOS doesn't purge data on downgrade.

---

### Refund Policy

The platform's policy is **no refunds**. Monthly fees are not transferable to Lifetime membership. This is shown in the policy footer on both the Billing page and the Pricing page.

If you have a billing issue not covered by self-service (duplicate charges, technical errors), contact support at support@centenarianos.com.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/billing — show the Lifetime upgrade CTA on a monthly plan]

> [SCREENSHOT: Billing page — callout: Dark "Upgrade to Lifetime for $100" card, "View Lifetime Plan" button]

> [SCREEN: Click "View Lifetime Plan" → /pricing — show Lifetime card]

> [SCREEN: Click "Get Lifetime Access" → Stripe Checkout]

> [SCREENSHOT: Stripe Checkout for Lifetime — callout: "$100 — one-time payment" clearly shown]

> [SCREEN: After payment — redirect back — "Confirming your payment…" → success banner]

> [SCREENSHOT: Billing page post-upgrade — callouts: "Lifetime Member" in lime, shirt promo code card]

> [SCREEN: Navigate to Manage Subscription → Stripe portal → show cancel option]

> [SCREENSHOT: Stripe Customer Portal — callout: Cancel subscription option]

> [SCREEN: After canceling — redirect back to billing — show "Cancels on [date]" in amber]

> [SCREENSHOT: Billing page after cancellation — callout: Amber "Cancels on [date]" text]

> [SCREEN: End on the billing page — end lesson and end course]

---

## Key Takeaways

- Upgrade to Lifetime: Billing page → "View Lifetime Plan" → Pricing → "Get Lifetime Access" → $100 Stripe checkout → lifetime badge + shirt promo code
- Monthly ends immediately when Lifetime payment processes — no prorated refund
- Cancel monthly: Billing → Manage Subscription → Stripe Customer Portal → cancel; access continues until period-end date
- After cancellation: "Cancels on [date]" in amber on billing page; full access until that date, then downgrade to free
- Resubscribing after cancellation: /pricing → Start Monthly → immediate access restoration
- Data is never deleted on downgrade — history preserved, just inaccessible until resubscription
- No refunds — contact support@centenarianos.com for billing errors
