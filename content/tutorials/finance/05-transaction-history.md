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

When you set or change the category of a transaction that has a vendor, a prompt appears above the list: "Always categorize 'CHIPOTLE' as Dining? [Always] [Just this once]". **Always** makes it that vendor's learned category, so its future transactions (including bank syncs and imports) are categorized automatically, and then offers to apply it to the vendor's past transactions, showing how many first. **Just this once** changes nothing else.

---

### Bank-Matched Transactions

If you connect a bank account (Finance → Accounts), each sync checks whether a bank transaction is one you already entered by hand or scanned. When the amount matches to the cent, the dates are within 5 days, and the vendor or description is similar, the sync links your entry to the bank transaction instead of adding a duplicate. Linked entries show a **Bank matched** badge in the list.

If a sync linked two different purchases (two $5 coffees on nearby days, say), open the transaction and click **Unmatch from bank**. Your entry stays as it is, and the bank's transaction is added as its own row, which later syncs leave alone.

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

If several transactions landed in the wrong category (or are uncategorized), tick the checkbox on each row (or the header checkbox for the whole page). A bar appears where you can **Set category**, set a brand, or add a life tag, then click **Apply**.

If every transaction you selected is from the same vendor, the "Always categorize this vendor as ...?" prompt appears after you apply, so you can make the choice stick for that vendor's future transactions.

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

> [SCREENSHOT: The "Always categorize ... as ...?" prompt above the list after saving — callout: "Always / Just this once"]

> [SCREENSHOT: A row with the "Bank matched" badge — callout: "Your entry, linked to the bank's copy instead of duplicated"]

> [SCREEN: Click Delete on a transaction — confirmation prompt — cancel (don't delete for demo)]

> [SCREEN: Clear all filters — show the full unfiltered list]

> [SCREEN: End on the transaction history — end lesson]

---

## Key Takeaways

- Transaction history at /dashboard/finance/transactions — all transactions, most recent first
- Filter by: date range, type (expense/income), category, vendor, description keyword — filters stack
- Edit any transaction: fix category, amount, date, vendor, description
- Changing a category offers "Always" (the vendor's future transactions get it too) or "Just this once"
- Select rows to bulk-set a category, brand, or life tag
- "Bank matched" marks your entries that a bank sync linked instead of duplicating; Unmatch from bank splits them if the match was wrong
- Delete is permanent — use for duplicates and errors, not for over-budget regret
- Vendor search is powerful: "Amazon" finds every Amazon transaction across all time
- Year-end: filter to Jan 1–Dec 31, export CSV for accountant or tax purposes
