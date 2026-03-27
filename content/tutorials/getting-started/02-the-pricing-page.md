# Lesson 02: Understanding Pricing & Plans

**Course:** Getting Started with CentenarianOS
**Module:** Welcome
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** linear → first CYOA crossroads after this lesson

---

## Narrator Script

CentenarianOS has two paid plans and a set of features that are free without any subscription. This lesson breaks down what each plan includes, how the checkout flow works, and what you can do without paying.

---

### The Two Plans

Navigate to `/pricing` to see the pricing page. Two cards are displayed:

**Monthly — $10.60/month** (marked "Popular")
- Full access to every paid module
- Cancel anytime through the Stripe Customer Portal
- Billed monthly — no annual commitment required

**Lifetime — $103.29 one-time** (marked "Best Value")
- Everything in Monthly
- No recurring fees ever
- Free CentenarianOS shirt shipped from AwesomeWebStore.com

Both plans include every current feature and all future features. There's no tier gating — Monthly and Lifetime have identical access.

---

### What's Included in Both Plans

Here's the full feature list shown on the pricing page:

- Roadmap & goal hierarchy
- Daily task planner (week/3-day/daily views)
- Fuel & nutrition tracking (NCV framework)
- Focus Engine (timer, debrief, pain log)
- Travel & vehicle tracking with fuel OCR
- Financial dashboard (accounts, budgets, brands)
- Health metrics & wearable sync
- Equipment & asset tracking with valuation history
- Academy courses & tutorial guides
- Blog & recipe publishing
- AI-powered weekly reviews
- Cross-module activity linking

---

### What's Free (No Subscription Required)

You can access these without a paid plan:

- **Blog** — read and publish articles
- **Recipes** — browse, create, and share recipes
- **Academy** — browse course catalog, take free courses, and watch all tutorial lessons
- **Live** — access live streaming sessions
- **Billing** — manage your subscription (obviously)
- **Messages & Feedback** — communicate with teachers and submit feedback

If you try to navigate to a paid module (like Finance or Travel) without an active subscription, you'll be redirected to the pricing page.

---

### The Signup → Pricing Flow

Here's how new users onboard:

1. **Sign up** at `/signup` — create your account (email + password, with Cloudflare Turnstile bot check)
2. **Redirect to /pricing** — after signup, you're automatically sent to the pricing page with a banner: "Account created! Choose a plan below to access your dashboard."
3. **Choose a plan** — click "Start Monthly" or "Get Lifetime Access"
4. **Stripe checkout** — you're redirected to Stripe's hosted checkout page
5. **Return to billing** — after payment, you're sent to `/dashboard/billing` where a sync confirms your subscription
6. **Dashboard access** — all paid modules are now unlocked

---

### Buying Without an Account

If you land on the pricing page without being logged in and click a plan button, a login/signup modal appears inline — no redirect away from the page. After you authenticate, the checkout flow continues automatically.

---

### Policies

Displayed at the bottom of the pricing page:

> No Refunds. Cancel Anytime. Monthly fees are not transferable to lifetime membership.

Cancel your monthly plan anytime via the Stripe Customer Portal (accessed from `/dashboard/billing`). You keep access until the end of your current billing period.

---

### The Demo Alternative

Below the pricing cards, a link reads: "Want to try before you buy? Explore the demo account." This takes you to `/demo` — a one-click login to a fully loaded demo account. The next lesson covers the demo in detail.

---

## Screen Recording Notes

> [SCREEN: Navigate to /pricing — show the full pricing page]

> [SCREENSHOT: Pricing page — callouts: Monthly card ($10.60/mo, "Popular"), Lifetime card ($103.29, "Best Value"), Feature list, "Explore the demo account" link]

> [SCREEN: Hover over the Monthly plan features — show the check marks]

> [SCREEN: Click "Start Monthly" (without being logged in) — show the PurchaseModal appear]

> [SCREENSHOT: PurchaseModal — callout: "Login or create an account to continue checkout"]

> [SCREEN: Close the modal — scroll to the "Explore the demo account" link]

> [SCREEN: Scroll to the policies text at the bottom]

---

## Key Takeaways

- Two plans: Monthly ($10.60/mo, cancel anytime) and Lifetime ($103.29 one-time, includes free shirt)
- Both plans have identical feature access — no tier gating
- Free without subscription: blog, recipes, academy, live, billing, messages
- New users: signup → redirect to /pricing → choose plan → Stripe checkout → dashboard
- Demo account available for trying the platform before buying
