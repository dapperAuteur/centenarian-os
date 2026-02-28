# Lesson 04: Your Dashboard Tour

**Course:** Getting Started with CentenarianOS
**Module:** Platform Tour
**Duration:** ~6 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Once you're logged in, everything happens inside the dashboard. This lesson walks through the layout — the sidebar, the top bar, module pages, and settings — so you always know where you are.

---

### The Sidebar

The left sidebar is your main navigation. It's organized into five collapsible groups:

**Operate** — Daily Tasks, Engine, Weekly Review, Roadmap

**Health** — Fuel, Metrics, Wearables, Workouts, Correlations, Analytics

**Life** — Finance, Travel, Equipment

**Learn** — Blog, Recipes, Academy, Live

**AI** — Coach, Gems (admin only — hidden for regular users)

Each module name is a link. Click it to navigate to that module's main page. The active page is highlighted in the sidebar.

On mobile, the sidebar collapses into a hamburger menu at the top left. All the same groups and links are available — tap the menu icon to expand.

---

### The Top Bar

At the top of every dashboard page:

- **Module title** — shows where you are (e.g., "Finance", "Travel")
- **User menu** — your avatar or initials in the top right. Click for: Settings, Billing, Log Out
- **Offline indicator** — if you lose connection, a status bar appears at the very top showing offline/syncing/synced state

---

### Module Pages

Each module follows a similar pattern:

**Hub page** — the main landing page for the module. Shows summary cards, charts, and a list or grid of your data. Examples:
- Finance hub: summary cards + budget bars + recent transactions
- Travel hub: vehicle cards + fuel stats + trip summary
- Equipment hub: summary cards + category filters + item grid

**Sub-pages** — deeper views within a module. Accessed via tabs, links, or sidebar sub-items. Examples:
- Finance → Transaction History (`/dashboard/finance/transactions`)
- Travel → Fuel Logs (`/dashboard/travel/fuel`)
- Equipment → Manage (`/dashboard/equipment/manage`)

**Detail pages** — individual record views. Click any item to see its full details. Examples:
- Equipment → Item Detail (`/dashboard/equipment/[id]`)
- Travel → Trip Detail

**Forms** — modals or inline forms for creating and editing data. Most modules use modal forms that open over the current page.

---

### Settings & Billing

Access settings from the user menu (top right avatar):

**Billing** (`/dashboard/billing`) — your current plan, renewal date, and a link to the Stripe Customer Portal for managing payment methods, canceling, or upgrading.

**Wearables** (`/dashboard/settings/wearables`) — connect Oura, WHOOP, or Garmin via OAuth. Import CSV data from Apple Health, Google Health, InBody, or Hume Health.

---

### Quick Navigation Tips

- **Sidebar is always visible** on desktop — use it to jump between modules
- **Browser back/forward** works as expected — the app uses standard URL routing
- **Direct URLs** work — bookmark `/dashboard/finance` or share a course link like `/academy/[courseId]`
- **Offline support** — most pages cache data locally via IndexedDB. If you go offline, you can still browse cached data and queue mutations that sync when you reconnect.

---

## Screen Recording Notes

> [SCREEN: Show the full dashboard with sidebar expanded — hover over each group label]

> [SCREENSHOT: Dashboard layout — callouts: Sidebar (5 groups), Top bar (module title, user menu), Main content area]

> [SCREEN: Click through three modules — Finance hub, Travel hub, Equipment hub — show the consistent hub pattern]

> [SCREEN: Click into a sub-page — e.g., Finance → Transaction History — show the sub-navigation]

> [SCREEN: Click the user avatar in the top right — show the dropdown (Settings, Billing, Log Out)]

> [SCREEN: Navigate to /dashboard/billing — show the billing page with plan info]

> [SCREEN: Resize browser to mobile width — show the sidebar collapse into hamburger menu]

> [SCREEN: Tap the hamburger icon — show the mobile sidebar expand]

---

## Key Takeaways

- Sidebar: 5 groups (Operate, Health, Life, Learn, AI) — always visible on desktop, hamburger on mobile
- Top bar: module title + user menu (Settings, Billing, Log Out) + offline indicator
- Module pattern: Hub page → Sub-pages → Detail pages → Forms (modals)
- Billing at /dashboard/billing — plan management via Stripe portal
- Wearables at /dashboard/settings/wearables — OAuth + CSV imports
- Direct URLs and browser navigation work everywhere — bookmarkable
