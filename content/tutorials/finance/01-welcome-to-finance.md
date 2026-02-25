# Lesson 01: Welcome to Finance

**Course:** Mastering Finance
**Module:** Introduction
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

Most financial tracking tools are standalone — they have no idea whether you slept well last week, how your training is going, or whether you hit your goals. CentenarianOS Finance is different because it's in the same system as everything else. Your financial data can appear in your weekly review alongside your focus hours and nutrition quality. Your daily debrief includes a financial snapshot. The Planner lets you attach revenue and costs to specific tasks and milestones.

Finance isn't the most complex module in the system — but because it's integrated, it turns financial data from a separate chore into part of a complete picture of how your week went.

---

### What the Finance Module Tracks

The Finance module tracks two things:

**Budget categories** — Named spending buckets with a monthly budget target. You define these based on how you think about your spending: Food & Groceries, Training & Equipment, Business Expenses, Travel, Rent & Utilities, etc. Each category has a color and a monthly dollar target.

**Transactions** — Individual income and expense entries. Each transaction is dated, categorized, and described. Transactions flow into your category budgets and populate the dashboard charts.

---

### What It Doesn't Track

No bank account integration. No automatic import from your bank, credit card, or Venmo. You enter transactions manually or import via CSV. This is intentional — keeping the system simple and avoiding the OAuth complexity of banking APIs — but it means Finance works best when you either log transactions regularly (daily or weekly) or do a bulk import from your bank's CSV export at the end of each month.

---

### The Finance Dashboard

Navigate to `/dashboard/finance`. The main dashboard shows:

**Summary cards (top row):**
- Total expenses this month
- Total income this month
- Net (income minus expenses) for this month

**Monthly trend chart:** A 6-month bar chart showing income and expenses side by side for each month. Lets you see at a glance whether your financial trend is positive, stable, or declining.

**Spending by category:** A pie or donut chart showing what percentage of your monthly expenses went to each budget category.

**Budget progress bars:** One bar per active budget category, showing how much of the monthly budget has been spent and how much remains. Categories over budget are flagged visually.

Below the dashboard, you can access the detailed transaction history via **View All Transactions** or the **Transactions** link in the Finance navigation.

---

### How Finance Connects to the Rest of the System

**Daily Debrief (Engine):** The daily debrief has optional Revenue and Expenses fields. These aren't connected to the Finance module's transactions — they're a quick daily financial note. But they're conceptually related: the debrief is for quick estimates, Finance is for detailed records.

**Planner tasks:** Every task in the Planner has optional Estimated Cost, Actual Cost, and Revenue fields. These don't automatically create Finance transactions — they're tracked separately within the Planner hierarchy.

**Weekly Review:** The weekly review's financial summary references your Planner task financial data (revenue generated from tasks) alongside other week metrics.

The Finance module is the dedicated ledger. Use it for your actual household and business financial tracking.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/finance — show the full dashboard]

> [SCREENSHOT: Finance dashboard — callouts: Summary cards (expenses, income, net), Monthly trend chart (6 months), Spending by category chart, Budget progress bars]

> [SCREEN: Hover over the monthly trend chart bars — show the hover tooltip with monthly values]

> [SCREEN: Hover over the spending by category chart — show category names and percentages]

> [SCREEN: Scroll down to the budget progress bars — show a category that's under budget and one that's over]

> [SCREEN: End on the full dashboard view — end lesson]

---

## Key Takeaways

- Finance tracks budget categories (monthly targets) and transactions (income + expenses)
- No bank integration — manual entry or CSV import
- Dashboard: summary cards (month totals), 6-month trend chart, spending by category, budget progress bars
- Finance connects to: Engine daily debrief (quick daily notes), Planner task financials (project-level cost/revenue)
- Works best with regular logging (daily or weekly) or a monthly bulk import from your bank's CSV export
