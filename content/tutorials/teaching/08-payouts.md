# Lesson 08: Payouts

**Course:** Teaching on CentenarianOS
**Module:** Revenue Tools
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

When students pay for your courses, the money flows through Stripe. To receive your earnings, you need to connect a bank account via Stripe Connect. This lesson covers the onboarding process and what the payout setup looks like.

---

### Navigating to Payouts

Click **Payouts** in the teaching sidebar. The page is at `/dashboard/teaching/payouts`.

---

### How Teacher Payments Work

When a student enrolls in one of your paid courses:
1. The student pays at Stripe Checkout
2. The platform takes a small fee (the platform fee percentage, set by the platform)
3. The remainder is transferred to your Stripe Connect account
4. Stripe handles the payout from your Connect account to your bank on its standard schedule

You don't need to invoice anyone or request payments — the transfer happens automatically when a student completes checkout.

---

### Connecting Your Bank Account

If you haven't completed onboarding, the Payouts page shows a **Not Connected** card:

- A gray credit card icon
- Text: "Not Connected — You need to connect your Stripe account to get paid."
- A description of how the system works

Click **Connect Bank Account**. This redirects you to Stripe Express — Stripe's streamlined onboarding flow for platform sellers. You'll provide:
- Legal name and date of birth (for identity verification)
- Bank account details (routing and account number, or login via your bank)
- Tax information (your SSN last 4 or full SSN, depending on your earnings)

Stripe handles all compliance — you're dealing directly with Stripe, not sharing sensitive information with the platform.

After completing the Stripe forms, you're redirected back to the Payouts page.

---

### If Onboarding Was Interrupted

If you started onboarding but didn't finish (e.g., closed the browser or got an error), you'll see an amber warning banner:

> "Onboarding was not completed. Please try again to finish setting up your payout account."

The button changes to **Continue Onboarding** (instead of Connect Bank Account). Click it to resume where you left off in the Stripe flow.

---

### After Successful Onboarding

Once onboarding is complete, the Payouts card changes to **Stripe Connected**:

- Green check icon
- Text: "Stripe Connected — Your bank account is set up to receive payouts."
- Payout status: "Active" (green)
- Button: **Manage Stripe Account** — opens the Stripe Express dashboard where you can:
  - View your balance and payout history
  - Update your bank account
  - Download tax forms

---

### Payout Timing

Stripe pays out on a rolling basis — typically 2–7 days after a transaction, depending on your bank. Stripe sends an email confirmation for each payout. You can also view payout history in your Stripe Express dashboard via the Manage Stripe Account button.

---

### Important Notes

- You can publish courses and students can enroll in **free** courses before completing Stripe Connect.
- Students **cannot** enroll in **paid** courses until your Stripe Connect account is active — they'll see an error at checkout.
- The platform fee percentage is set by CentenarianOS. Check your teacher agreement for the current rate.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/teaching/payouts — show the "Not Connected" state]

> [SCREENSHOT: Payouts page, not connected — callouts: Gray credit card icon, "Not Connected" title, "Connect Bank Account" button]

> [SCREEN: Click "Connect Bank Account" — browser redirects to Stripe Express]

> [SCREENSHOT: Stripe Express onboarding page — callout: "Stripe handles all identity and bank verification"]

> [SCREEN: Complete onboarding — redirect back — show "Stripe Connected" card]

> [SCREENSHOT: Payouts page, connected — callouts: Green check icon, "Stripe Connected" title, "Active" status badge, "Manage Stripe Account" button]

> [SCREEN: Click "Manage Stripe Account" — show the Stripe Express dashboard (brief glimpse)]

> [SCREEN: End on the connected payouts page — end lesson]

---

## Key Takeaways

- Payouts require Stripe Connect — a direct connection from your earnings to your bank account
- Click "Connect Bank Account" → Stripe Express onboarding (identity verification + bank details)
- If interrupted: amber warning banner + "Continue Onboarding" button to resume
- When connected: green "Stripe Connected" card with "Active" status; Manage Stripe Account opens your Stripe dashboard
- Free course enrollments work without Stripe Connect; paid enrollments require it
- Platform takes a fee per sale; remainder goes to your Stripe Connect account; Stripe pays out to your bank on its standard schedule
