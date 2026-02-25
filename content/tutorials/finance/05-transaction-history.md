# Lesson 05: Transaction History

**Course:** Mastering Finance
**Module:** Transaction Management
**Duration:** ~4 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

The dashboard shows you summaries. The Transaction History shows you the actual records — every individual transaction you've logged, searchable and filterable. This is where you do maintenance work: fixing miscategorized transactions, finding specific entries, and reviewing your spending at a detailed level.

---

### Navigating to Transaction History

From the Finance dashboard, click **View All Transactions** or the **Transactions** link in the Finance navigation. This takes you to `/dashboard/finance/transactions`.

---

### The Transactions List

The transactions page shows all your transactions in reverse chronological order (most recent first). Each row shows:

- **Date** — when the transaction occurred
- **Type** — Expense or Income, visually distinguished (usually red for expense, green for income)
- **Amount** — the dollar value
- **Category** — which budget category it's assigned to
- **Description** — your transaction note
- **Vendor** — the vendor if you logged one
- **Edit** and **Delete** buttons

---

### Filtering and Searching

**Date range filter** — Set a start and end date to view transactions within a specific period. Useful for reviewing a single month, a quarter, or a custom range for tax purposes.

**Type filter** — Show only Expenses, only Income, or both.

**Category filter** — Filter to transactions in a specific category. "Show me all Dining Out transactions for Q1" is a common query.

**Vendor search** — Type any vendor name to filter by vendor. "Amazon" returns all Amazon transactions. Useful for reviewing subscriptions, recurring expenses, or a specific vendor relationship.

**Description search** — Free-text search across description fields. Helpful when you remember part of a description but not the date or category.

Filters stack — you can combine date range + category + type to find exactly what you need.

---

### Editing a Transaction

Click **Edit** on any row. The transaction form opens with all fields pre-filled. Update anything — amount, date, category, description, vendor — and click Save.

Common reasons to edit:
- **Wrong category** — you logged groceries under Dining Out
- **Wrong date** — logged today but the transaction was yesterday
- **Incomplete vendor** — you left it blank but want to add it for better analytics
- **Amount error** — typo in the amount

---

### Deleting a Transaction

Click **Delete** on any row. A confirmation prompt appears. Deletion is permanent — the transaction is removed from all dashboard totals, charts, and budget progress bars immediately.

Use delete for:
- Duplicate transactions (logged the same transaction twice)
- Test entries
- Truly erroneous entries that don't represent a real financial event

Don't delete transactions just because they were over-budget or you regret the expense — that history is useful data.

---

### Bulk Reassignment

If you imported data and several transactions landed in the wrong category (or are uncategorized), you can edit them one by one. For large batches, the import tool (Lesson 06) supports category assignment at import time — a more efficient approach than manual bulk editing.

---

### Year-End Review

The transaction history is your ledger for tax and financial planning purposes. At year-end:

1. Set the date range to January 1 – December 31 of the year
2. Filter to Income to see total annual income by category
3. Filter to Business Expenses to see deductible business costs
4. Use the CSV export (Lesson 06) to download the full year as a spreadsheet for your accountant

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/finance — click "View All Transactions" or "Transactions" in nav]

> [SCREEN: Transaction history page loads — show the full list]

> [SCREENSHOT: Transactions list — callouts: Date, Type badge (Expense/Income), Amount, Category, Description, Vendor, Edit and Delete buttons]

> [SCREEN: Use the date range filter — set to current month — list filters to only this month's transactions]

> [SCREEN: Use the category filter — select "Groceries" — list filters to Groceries only]

> [SCREENSHOT: Filtered list showing only Groceries transactions — callout: Filter chips active at top]

> [SCREEN: Type "Whole Foods" in vendor search — show filtered results]

> [SCREEN: Click Edit on a transaction — edit form opens pre-filled — change the category — save]

> [SCREENSHOT: Edit form — callout: "All fields editable — category reassignment is the most common edit"]

> [SCREEN: Click Delete on a transaction — confirmation prompt — cancel (don't delete for demo)]

> [SCREEN: Clear all filters — show the full unfiltered list]

> [SCREEN: End on the transaction history — end lesson]

---

## Key Takeaways

- Transaction history at /dashboard/finance/transactions — all transactions, most recent first
- Filter by: date range, type (expense/income), category, vendor, description keyword — filters stack
- Edit any transaction: fix category, amount, date, vendor, description
- Delete is permanent — use for duplicates and errors, not for over-budget regret
- Vendor search is powerful: "Amazon" finds every Amazon transaction across all time
- Year-end: filter to Jan 1–Dec 31, export CSV for accountant or tax purposes
