# Lesson 01: Your Subscription

**Course:** Settings & Billing
**Module:** Billing
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

The Billing page is where you see your current plan, your next renewal date, and access the Stripe Customer Portal for payment management. This lesson walks through everything on the page.

---

### Navigating to Billing

Click **Billing** in the dashboard sidebar. The page is at `/dashboard/billing`. Billing is one of the free-access routes — you can reach it regardless of your subscription status.

---

### The Current Plan Section

A card at the top of the page shows your current plan. There are four possible states:

**Free**
You have an account but no active subscription. Access is limited to Blog and Recipes. An **Upgrade** button links to `/pricing`.

**Monthly**
Active monthly subscriber. Shows:
- **"Monthly — $10/month"** in fuchsia
- Your **renewal date** — "Renews on [date]" in gray, or "Cancels on [date]" in amber if you've canceled and are in the wind-down period
- **Manage Subscription** button (CreditCard icon) — opens the Stripe Customer Portal

**Lifetime Member**
Paid once for permanent access. Shows:
- **"Lifetime Member"** in lime green
- **"Full access forever. No recurring charges."**
- No manage button — there's nothing to manage for a one-time purchase

**Admin**
Full access without a subscription. Shows a shield icon and "Admin — Full Access."

---

### The Manage Subscription Button

Click **Manage Subscription**. This calls the platform's Stripe portal API, which returns a secure Stripe-hosted URL and redirects you there.

In the Stripe Customer Portal you can:
- **Update your payment method** — change the card on file
- **View invoice history** — download past receipts
- **Cancel your subscription** — sets a cancellation date at the end of the current billing period

After taking action in the portal, Stripe redirects you back to `/dashboard/billing`. Your subscription status updates automatically.

---

### Renewal Date

For monthly subscribers, the page shows your next renewal date: **"Renews on [date]."**

If you've canceled through the Stripe portal but your period hasn't ended yet, it shows: **"Cancels on [date]"** in amber. You keep full access until that date.

---

### The Lifetime Upgrade CTA

If you're on a monthly plan, a dark card below the current plan section shows:

> "Upgrade to Lifetime for $100 — Pay once, own it forever — plus get a free CentenarianOS shirt."

Click **View Lifetime Plan** to go to `/pricing` and start the Lifetime checkout.

---

### The Shirt Promo Code (Lifetime Members)

If you're a Lifetime member, a lime-green card shows your unique shirt promo code — a discount code for a free CentenarianOS shirt from AwesomeWebStore.com.

- The code appears in a bold monospace box
- **Copy** button — copies the code to your clipboard; the button text briefly changes to "Copied!"

If the card shows **"Shirt Promo Code Pending"** instead of the actual code, the code is still being generated. Wait a moment and refresh the page.

---

### After Checkout: Payment Confirmation

When you complete checkout on `/pricing` and Stripe redirects you back to `/dashboard/billing`, the page briefly shows: **"Confirming your payment…"** while it verifies your transaction with Stripe. After confirmation:
- A green banner: **"Payment successful — welcome to CentenarianOS!"**
- Your plan badge updates to Monthly or Lifetime

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/billing — show the page for a monthly subscriber]

> [SCREENSHOT: Billing page — callouts: "CURRENT PLAN" label, "Monthly — $10/month" (fuchsia), renewal date, "Manage Subscription" button]

> [SCREEN: Click "Manage Subscription" — show the redirect to Stripe portal]

> [SCREENSHOT: Stripe Customer Portal — callouts: "Update payment method", "Cancel subscription", "Invoice history"]

> [SCREEN: Cancel from the portal — redirect back — show "Cancels on [date]" in amber]

> [SCREENSHOT: Billing page after canceling — callout: Amber "Cancels on [date]" text instead of renewal date]

> [SCREEN: Show the Lifetime Member state — lime "Shirt Promo Code" card]

> [SCREENSHOT: Shirt promo code card — callouts: Code in monospace box, "Copy" button]

> [SCREEN: Click Copy — show "Copied!" state for 2 seconds]

> [SCREEN: Show the Lifetime Upgrade CTA (on monthly plan view)]

> [SCREENSHOT: Dark lifetime CTA card — callouts: "$100 one-time", "View Lifetime Plan" button, shirt mention]

> [SCREEN: End on the billing page — end lesson]

---

## Key Takeaways

- Billing at /dashboard/billing — four plan states: Free, Monthly, Lifetime, Admin
- Monthly: shows renewal date ("Renews on") or cancellation date ("Cancels on [date]" in amber)
- Manage Subscription → Stripe Customer Portal: update payment, view invoices, cancel
- Cancellation takes effect at period end — you keep access until then
- Lifetime: lime "Lifetime Member" badge, no manage button, shirt promo code card with Copy button
- After Stripe checkout redirect: page confirms payment automatically then shows success banner
