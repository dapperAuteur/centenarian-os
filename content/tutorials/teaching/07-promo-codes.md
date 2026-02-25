# Lesson 07: Promo Codes

**Course:** Teaching on CentenarianOS
**Module:** Revenue Tools
**Duration:** ~3 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Promo codes let you offer discounts to students at checkout. They're backed by Stripe coupons, so the discount is applied before payment — students never pay full price and then request a refund. This lesson covers how to create and manage them.

---

### Navigating to Promo Codes

Click **Promo Codes** in the teaching sidebar. The page is at `/dashboard/teaching/promo-codes`.

---

### Creating a Promo Code

Click **New Code** (+ icon). A creation form appears:

**Code** (required)
The discount code string students will type at checkout. As you type, it's automatically uppercased — codes are always uppercase. Keep it short and memorable: `SUMMER20`, `LAUNCH50`, `WELCOME10`.

**Discount %** (required)
A number from 1 to 100. Default is 20. This is a percentage discount — `20` means 20% off, `100` means free.

**Max Uses** (optional)
How many times the code can be used total across all students. Leave blank for unlimited. If you want a code that only works once (for a single invited student), enter `1`.

**Expires At** (optional)
A date-and-time picker. After this moment, the code stops working at checkout. Leave blank if the code never expires.

Click **Create Code**. The code is created in Stripe as a coupon and stored in the platform.

---

### The Promo Codes Table

All active codes appear in a table with five columns:

| Column | What It Shows |
|--------|---------------|
| **Code** | The code string in fuchsia monospace font |
| **Discount** | "{percent}% off" |
| **Uses** | "{count}" or "{count} / {max}" if you set a max |
| **Expires** | Formatted date, or "—" if no expiry |
| **Delete** | Trash icon |

---

### Deleting a Promo Code

Click the trash icon on any row. A confirmation dialog appears: "Delete this promo code? It will also be removed from Stripe."

Confirm to delete. The code is removed from both the platform and from Stripe — students who try to use it at checkout after deletion will see an invalid code error.

If a student has already used the code before you delete it, their enrolled price is unaffected.

---

### How Students Use Promo Codes

Students enter the code during Stripe checkout when enrolling in a paid course. The discount is applied at the payment step — the student pays the discounted price directly, not the full price.

Promo codes apply to any of your courses that use paid enrollment. If you want a code that works only for a specific course, create a code with limited uses and share it only with the intended audience.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/teaching/promo-codes — show the page header]

> [SCREENSHOT: Promo Codes page — callouts: "New Code" button, table (if codes exist) or empty state]

> [SCREEN: Click "New Code" — form appears]

> [SCREENSHOT: Create code form — callouts: Code input (auto-uppercase shown), Discount % input (default 20), Max Uses (optional/blank = unlimited), Expires At picker]

> [SCREEN: Fill in Code = "LAUNCH25", Discount = 25, leave max uses and expiry blank — click Create]

> [SCREEN: Code appears in the table — show the fuchsia monospace Code column, Uses showing "0"]

> [SCREENSHOT: Promo code table row — callouts: Code (fuchsia, monospace), "25% off", uses count, "—" for no expiry, delete icon]

> [SCREEN: Click the trash icon — show the confirmation dialog]

> [SCREENSHOT: Delete confirmation dialog — callout: "It will also be removed from Stripe"]

> [SCREEN: End on the promo codes table — end lesson]

---

## Key Takeaways

- Promo codes are backed by Stripe coupons — applied at checkout before payment
- Code field auto-uppercases; keep codes short and memorable
- Discount: 1–100%; Max Uses: optional limit; Expires At: optional expiry date
- Table shows code, discount %, usage count (and max if set), expiry, and delete button
- Deleting removes the code from both the platform and Stripe — existing used discounts are unaffected
- Students enter the code during Stripe checkout — no post-payment refunds needed
